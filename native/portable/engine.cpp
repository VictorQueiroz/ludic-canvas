#include "engine.hpp"
#include <cstring>
#include <fstream>
#include <iostream>

namespace lc {
std::string readFile(const std::filesystem::path &path) {
  std::ifstream stream(path, std::ios::binary | std::ios::ate);
  if (!stream)
    throw std::runtime_error("Cannot open " + path.string());
  auto length = stream.tellg();
  if (length < 0 || length > 128 * 1024 * 1024)
    throw std::runtime_error("Invalid asset size");
  std::string bytes(static_cast<size_t>(length), '\0');
  stream.seekg(0);
  if (!stream.read(bytes.data(), length))
    throw std::runtime_error("Cannot read " + path.string());
  return bytes;
}
std::filesystem::path assetPath(const std::filesystem::path &root, const std::string &name) {
  const auto path = std::filesystem::path(name);
  if (path.empty() || path.is_absolute())
    throw std::runtime_error("Expected a bundled asset name");
  for (const auto &part : path)
    if (part == "..")
      throw std::runtime_error("Asset escapes bundle");
  const auto base = std::filesystem::weakly_canonical(root),
             resolved = std::filesystem::weakly_canonical(base / path);
  auto relative = resolved.lexically_relative(base);
  if (relative.empty() || *relative.begin() == "..")
    throw std::runtime_error("Asset escapes bundle");
  return resolved;
}
double Engine::now() const {
  return std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - start_).count();
}
void Engine::checkThread() const {
  if (std::this_thread::get_id() != owner_)
    throw std::runtime_error("Hermes accessed from a different thread");
}
void Engine::bind(const char *name, unsigned argc, jsi::HostFunctionType function) {
  auto &rt = runtime();
  auto object = rt.global().getPropertyAsObject(rt, "__ludicNative");
  object.setProperty(
      rt, name,
      jsi::Function::createFromHostFunction(
          rt, jsi::PropNameID::forAscii(rt, name), argc,
          [fn = std::move(function), argc](jsi::Runtime &rt, const jsi::Value &self, const jsi::Value *args,
                                           size_t count) -> jsi::Value {
            if (count < argc)
              throw jsi::JSError(rt, "Missing native arguments");
            try {
              return fn(rt, self, args, count);
            } catch (const jsi::JSError &) {
              throw;
            } catch (const std::exception &e) {
              throw jsi::JSError(rt, e.what());
            }
          }));
}
Engine::Engine() {
  runtime_ = facebook::hermes::makeHermesRuntime(
      ::hermes::vm::RuntimeConfig::Builder().withMicrotaskQueue(true).build());
  auto &rt = runtime();
  rt.global().setProperty(rt, "__ludicNative", jsi::Object(rt));
  bind("now", 0, [this](auto &, const auto &, const auto *, size_t) { return jsi::Value(now()); });
  bind("log", 1, [](auto &rt, const auto &, const auto *args, size_t) {
    std::cout << args[0].asString(rt).utf8(rt) << std::endl;
    return jsi::Value::undefined();
  });
  bind("microtask", 1, [](auto &rt, const auto &, const auto *args, size_t) {
    rt.queueMicrotask(args[0].asObject(rt).asFunction(rt));
    return jsi::Value::undefined();
  });
  bind("timer", 3, [this](auto &rt, const auto &, const auto *args, size_t) {
    auto callback = std::make_shared<jsi::Function>(args[0].asObject(rt).asFunction(rt));
    const double delay = std::isfinite(args[1].asNumber()) ? std::max(0.0, args[1].asNumber()) : 0;
    const auto id = ++nextTimer_;
    timers_.emplace(id,
                    Timer{now() + delay, args[2].getBool() ? std::max(1.0, delay) : -1, std::move(callback)});
    return jsi::Value(static_cast<double>(id));
  });
  bind("cancelTimer", 1, [this](auto &, const auto &, const auto *args, size_t) {
    timers_.erase(static_cast<uint32_t>(args[0].asNumber()));
    return jsi::Value::undefined();
  });
  bind("createLayout", 1, [this](auto &rt, const auto &, const auto *args, size_t) {
    auto callback = std::make_shared<jsi::Function>(args[0].asObject(rt).asFunction(rt));
    const auto id = ++nextLayout_;
    layouts_.emplace(id, std::make_unique<NativeLayout>(
                             [this, callback](uint32_t measure, float w, uint32_t wm, float h, uint32_t hm) {
                               auto &rt = runtime();
                               auto result = callback
                                                 ->call(rt, static_cast<double>(measure),
                                                        static_cast<double>(w), static_cast<double>(wm),
                                                        static_cast<double>(h), static_cast<double>(hm))
                                                 .asObject(rt)
                                                 .asArray(rt);
                               return YGSize{static_cast<float>(result.getValueAtIndex(rt, 0).asNumber()),
                                             static_cast<float>(result.getValueAtIndex(rt, 1).asNumber())};
                             }));
    return jsi::Value(static_cast<double>(id));
  });
  bind("layout", 2, [this](auto &rt, const auto &, const auto *args, size_t count) {
    const auto id = static_cast<uint32_t>(args[0].asNumber());
    const auto found = layouts_.find(id);
    if (found == layouts_.end())
      throw jsi::JSError(rt, "Invalid layout context");
    auto &l = *found->second;
    auto value = [&](size_t i) {
      if (i + 2 >= count)
        throw jsi::JSError(rt, "Missing layout argument");
      return args[i + 2].asNumber();
    };
    auto node = [&](size_t i) { return l.node(static_cast<uint32_t>(value(i))); };
    switch (static_cast<int>(args[1].asNumber())) {
    case 0:
      layouts_.erase(found);
      break;
    case 1:
      return jsi::Value(static_cast<double>(l.create()));
    case 2:
      l.free(value(0));
      break;
    case 3:
      YGNodeInsertChild(node(0), node(1), value(2));
      break;
    case 4:
      YGNodeRemoveChild(node(0), node(1));
      break;
    case 5:
      return jsi::Value(static_cast<double>(YGNodeGetChildCount(node(0))));
    case 6:
      l.setPointScale(value(0));
      break;
    case 7:
      l.measured(value(0), value(1));
      break;
    case 8:
      YGNodeMarkDirty(node(0));
      break;
    case 9:
      layout::setEnum(node(0), value(1), value(2));
      break;
    case 10:
      layout::setNumber(node(0), value(1), value(2));
      break;
    case 11:
      layout::setLengthProperty(node(0), value(1), value(2), value(3), value(4));
      break;
    case 12:
      YGNodeCalculateLayout(node(0), value(1), value(2), YGDirectionLTR);
      break;
    case 13:
      return jsi::Value(YGNodeGetHasNewLayout(node(0)) ? 1 : 0);
    case 14:
      return jsi::Value(static_cast<double>(YGNodeLayoutGetPadding(node(0), YGEdgeBottom)));
    default:
      throw jsi::JSError(rt, "Unknown layout operation");
    }
    return jsi::Value(0);
  });
  bind("readLayouts", 3, [this](auto &rt, const auto &, const auto *args, size_t) {
    auto found = layouts_.find(static_cast<uint32_t>(args[0].asNumber()));
    if (found == layouts_.end())
      throw jsi::JSError(rt, "Invalid layout context");
    auto handles = args[1].asObject(rt), boxes = args[2].asObject(rt);
    auto in = handles.getPropertyAsObject(rt, "buffer").getArrayBuffer(rt),
         out = boxes.getPropertyAsObject(rt, "buffer").getArrayBuffer(rt);
    const size_t n = handles.getProperty(rt, "length").asNumber(),
                 inputOffset = handles.getProperty(rt, "byteOffset").asNumber(),
                 outputOffset = boxes.getProperty(rt, "byteOffset").asNumber();
    if (n > 1000000 || inputOffset > in.size(rt) || n * 4 > in.size(rt) - inputOffset ||
        outputOffset > out.size(rt) || n * 16 > out.size(rt) - outputOffset)
      throw jsi::JSError(rt, "Invalid layout buffer");
    for (size_t i = 0; i < n; ++i) {
      uint32_t handle;
      std::memcpy(&handle, in.data(rt) + inputOffset + i * 4, 4);
      auto node = found->second->node(handle);
      float result[4] = {YGNodeLayoutGetLeft(node), YGNodeLayoutGetTop(node), YGNodeLayoutGetWidth(node),
                         YGNodeLayoutGetHeight(node)};
      std::memcpy(out.data(rt) + outputOffset + i * 16, result, sizeof(result));
      YGNodeSetHasNewLayout(node, false);
    }
    return jsi::Value::undefined();
  });
  evaluate(R"JS(
globalThis.performance = { now: () => __ludicNative.now() };
globalThis.console = Object.fromEntries(['log','warn','error','info','debug'].map(name => [name, (...args) => __ludicNative.log(args.map(x => typeof x === 'string' ? x : String(x)).join(' '))]));
globalThis.queueMicrotask = fn => __ludicNative.microtask(fn);
globalThis.setTimeout = (fn, delay = 0, ...args) => __ludicNative.timer(() => fn(...args), Number(delay), false);
globalThis.clearTimeout = id => __ludicNative.cancelTimer(Number(id));
globalThis.setInterval = (fn, delay = 0, ...args) => __ludicNative.timer(() => fn(...args), Number(delay), true);
globalThis.clearInterval = clearTimeout;
globalThis.setImmediate = fn => setTimeout(fn, 0);
globalThis.clearImmediate = clearTimeout;
globalThis.requestAnimationFrame = fn => setTimeout(() => fn(performance.now()), 16);
globalThis.cancelAnimationFrame = clearTimeout;
)JS",
           "ludic-host.js");
}
void Engine::evaluate(const std::string &source, const std::string &name) {
  auto &rt = runtime();
  rt.evaluateJavaScript(std::make_shared<jsi::StringBuffer>(source), name);
  rt.drainMicrotasks();
}
void Engine::load(const std::filesystem::path &path) { evaluate(readFile(path), path.filename().string()); }
void Engine::pump() {
  if (stopped_)
    return;
  auto &rt = runtime();
  std::vector<uint32_t> ready;
  const auto time = now();
  for (const auto &[id, timer] : timers_)
    if (timer.due <= time && ready.size() < 256)
      ready.push_back(id);
  for (auto id : ready) {
    auto found = timers_.find(id);
    if (found == timers_.end())
      continue;
    auto callback = found->second.callback;
    if (found->second.interval < 0)
      timers_.erase(found);
    else
      found->second.due = time + found->second.interval;
    try {
      callback->call(rt);
      rt.drainMicrotasks();
    } catch (const std::exception &error) {
      errors.emplace_back(error.what());
      std::cerr << error.what() << '\n';
    }
  }
  rt.drainMicrotasks();
}
size_t Engine::nodeCount() const {
  size_t n = 0;
  for (const auto &[id, layout] : layouts_)
    n += layout->nodeCount();
  return n;
}
void Engine::shutdown() {
  if (stopped_)
    return;
  stopped_ = true;
  auto &rt = runtime();
  auto stop = rt.global().getProperty(rt, "__ludicShutdown");
  if (stop.isObject() && stop.asObject(rt).isFunction(rt))
    stop.asObject(rt).asFunction(rt).call(rt);
  timers_.clear();
  layouts_.clear();
}
Engine::~Engine() {
  try {
    shutdown();
  } catch (...) {
  }
  timers_.clear();
  layouts_.clear();
  runtime_.reset();
}
} // namespace lc
