// lc_layout.wasm — Yoga (facebook/yoga) compiled by the same raw Clang/LLVM
// toolchain as the simulation, behind a deliberately tiny C ABI.
//
// Instead of exporting ~80 Yoga setters, style properties are grouped into
// three dispatchers (enum / number / length). Text measurement calls back into
// the host through a single import; results come back through a fixed slot in
// linear memory, so no struct ever crosses the boundary by value.

#include <yoga/Yoga.h>

#include <cmath>
#include <cstdarg>
#include <cstdint>

#include "host.hpp"
#include "style.hpp"

extern "C" LC_IMPORT("lcl_measure") void lcl_host_measure(std::uint32_t context, float width, std::uint32_t widthMode,
                                                          float height, std::uint32_t heightMode);

namespace {

float g_measureSlot[2] = {0.0f, 0.0f};

YGConfigRef config() {
  static YGConfigRef instance = [] {
    YGConfigRef c = YGConfigNew();
    // Messages are forwarded unformatted: pulling in vsnprintf would cost
    // stdio and WASI imports for diagnostics that only fire on misuse.
    YGConfigSetLogger(c, [](YGConfigConstRef, YGNodeConstRef, YGLogLevel level, const char* format, va_list) {
      lc::host::log(
          level == YGLogLevelError || level == YGLogLevelFatal ? lc::host::Level::Error : lc::host::Level::Debug,
          format);
      return 0;
    });
    return c;
  }();
  return instance;
}

YGNodeRef node(std::uint32_t handle) { return reinterpret_cast<YGNodeRef>(static_cast<std::uintptr_t>(handle)); }

YGSize measureThroughHost(YGNodeConstRef n, float width, YGMeasureMode widthMode, float height,
                          YGMeasureMode heightMode) {
  const auto context = static_cast<std::uint32_t>(reinterpret_cast<std::uintptr_t>(YGNodeGetContext(n)));
  lcl_host_measure(context, width, static_cast<std::uint32_t>(widthMode), height,
                   static_cast<std::uint32_t>(heightMode));
  return {g_measureSlot[0], g_measureSlot[1]};
}

}  // namespace

extern "C" {

LC_EXPORT(lcl_abi_version) std::uint32_t lcl_abi_version() { return 2; }
LC_EXPORT(lcl_measure_slot) float* lcl_measure_slot() { return g_measureSlot; }
LC_EXPORT(lcl_set_point_scale) void lcl_set_point_scale(float scale) { YGConfigSetPointScaleFactor(config(), scale); }

LC_EXPORT(lcl_node_new) std::uint32_t lcl_node_new() {
  return static_cast<std::uint32_t>(reinterpret_cast<std::uintptr_t>(YGNodeNewWithConfig(config())));
}
LC_EXPORT(lcl_node_free) void lcl_node_free(std::uint32_t n) { YGNodeFree(node(n)); }
LC_EXPORT(lcl_insert_child) void lcl_insert_child(std::uint32_t parent, std::uint32_t child, std::uint32_t index) {
  YGNodeInsertChild(node(parent), node(child), index);
}
LC_EXPORT(lcl_remove_child) void lcl_remove_child(std::uint32_t parent, std::uint32_t child) {
  YGNodeRemoveChild(node(parent), node(child));
}
LC_EXPORT(lcl_child_count) std::uint32_t lcl_child_count(std::uint32_t n) {
  return static_cast<std::uint32_t>(YGNodeGetChildCount(node(n)));
}
LC_EXPORT(lcl_mark_dirty) void lcl_mark_dirty(std::uint32_t n) {
  if (YGNodeHasMeasureFunc(node(n))) YGNodeMarkDirty(node(n));
}

// Leaf nodes measured by the host (text). context == 0 removes the measurer.
LC_EXPORT(lcl_set_measured) void lcl_set_measured(std::uint32_t n, std::uint32_t context) {
  YGNodeSetContext(node(n), reinterpret_cast<void*>(static_cast<std::uintptr_t>(context)));
  YGNodeSetMeasureFunc(node(n), context ? measureThroughHost : nullptr);
  YGNodeSetNodeType(node(n), context ? YGNodeTypeText : YGNodeTypeDefault);
}

LC_EXPORT(lcl_set_enum) void lcl_set_enum(std::uint32_t n, std::uint32_t prop, std::int32_t v) { lc::layout::setEnum(node(n), prop, v); }
LC_EXPORT(lcl_set_number) void lcl_set_number(std::uint32_t n, std::uint32_t prop, float v) { lc::layout::setNumber(node(n), prop, v); }
LC_EXPORT(lcl_set_length) void lcl_set_length(std::uint32_t n, std::uint32_t prop, std::uint32_t slot, float v, std::uint32_t unit) { lc::layout::setLengthProperty(node(n), prop, slot, v, unit); }

LC_EXPORT(lcl_calculate) void lcl_calculate(std::uint32_t root, float width, float height) {
  YGNodeCalculateLayout(node(root), width, height, YGDirectionLTR);
}

LC_EXPORT(lcl_has_new_layout) std::uint32_t lcl_has_new_layout(std::uint32_t n) {
  return YGNodeGetHasNewLayout(node(n)) ? 1u : 0u;
}

LC_EXPORT(lcl_padding_bottom) float lcl_padding_bottom(std::uint32_t n) {
  return YGNodeLayoutGetPadding(node(n), YGEdgeBottom);
}

// Batch read: for each handle writes [left, top, width, height] (relative to
// the parent) into `out`, and acknowledges the new layout.
LC_EXPORT(lcl_read_layouts)
void lcl_read_layouts(const std::uint32_t* handles, std::uint32_t count, float* out) {
  for (std::uint32_t i = 0; i < count; ++i) {
    auto* yn = node(handles[i]);
    out[i * 4 + 0] = YGNodeLayoutGetLeft(yn);
    out[i * 4 + 1] = YGNodeLayoutGetTop(yn);
    out[i * 4 + 2] = YGNodeLayoutGetWidth(yn);
    out[i * 4 + 3] = YGNodeLayoutGetHeight(yn);
    YGNodeSetHasNewLayout(yn, false);
  }
}

LC_EXPORT(lcl_alloc) void* lcl_alloc(std::uint32_t bytes) { return ::operator new(bytes); }
LC_EXPORT(lcl_free) void lcl_free(void* p) { ::operator delete(p); }

}  // extern "C"
