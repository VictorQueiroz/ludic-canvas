#pragma once
#include "layout.hpp"
#include <chrono>
#include <filesystem>
#include <hermes/hermes.h>
#include <jsi/jsi.h>
#include <map>
#include <thread>

namespace lc {
namespace jsi = facebook::jsi;
class Engine {
public:
  Engine();
  ~Engine();
  jsi::Runtime &runtime() {
    checkThread();
    return *runtime_;
  }
  void bind(const char *name, unsigned argc, jsi::HostFunctionType function);
  void evaluate(const std::string &source, const std::string &name);
  void load(const std::filesystem::path &path);
  void pump();
  void shutdown();
  double now() const;
  std::vector<std::string> errors;
  size_t layoutCount() const { return layouts_.size(); }
  size_t nodeCount() const;

private:
  void checkThread() const;
  std::unique_ptr<facebook::hermes::HermesRuntime> runtime_;
  const std::thread::id owner_ = std::this_thread::get_id();
  const std::chrono::steady_clock::time_point start_ = std::chrono::steady_clock::now();
  struct Timer {
    double due;
    double interval;
    std::shared_ptr<jsi::Function> callback;
  };
  std::map<uint32_t, Timer> timers_;
  std::map<uint32_t, std::unique_ptr<NativeLayout>> layouts_;
  uint32_t nextTimer_ = 0, nextLayout_ = 0;
  bool stopped_ = false;
};
std::string readFile(const std::filesystem::path &path);
std::filesystem::path assetPath(const std::filesystem::path &root, const std::string &name);
} // namespace lc
