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

extern "C" LC_IMPORT("lcl_measure") void lcl_host_measure(std::uint32_t context, float width, std::uint32_t widthMode,
                                                          float height, std::uint32_t heightMode);

namespace {

// Property identifiers are ABI (mirrored in src/infrastructure/wasm/abi.ts).
enum class EnumProp : std::uint32_t {
  Direction,
  FlexDirection,
  JustifyContent,
  AlignContent,
  AlignItems,
  AlignSelf,
  PositionType,
  FlexWrap,
  Overflow,
  Display,
  BoxSizing
};
enum class NumberProp : std::uint32_t { Flex, FlexGrow, FlexShrink, AspectRatio };
enum class LengthProp : std::uint32_t {
  Width,
  Height,
  MinWidth,
  MinHeight,
  MaxWidth,
  MaxHeight,
  FlexBasis,
  Position,
  Margin,
  Padding,
  Border,
  Gap
};
enum class Unit : std::uint32_t { Undefined, Point, Percent, Auto };

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

template <class SetPt, class SetPct, class SetAuto>
void setLength(Unit unit, float value, SetPt pt, SetPct pct, SetAuto autoFn) {
  switch (unit) {
    case Unit::Undefined: pt(YGUndefined); break;
    case Unit::Point: pt(value); break;
    case Unit::Percent: pct(value); break;
    case Unit::Auto: autoFn(); break;
  }
}

}  // namespace

extern "C" {

LC_EXPORT(lcl_abi_version) std::uint32_t lcl_abi_version() { return 1; }
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

LC_EXPORT(lcl_set_enum) void lcl_set_enum(std::uint32_t n, std::uint32_t prop, std::int32_t v) {
  auto* yn = node(n);
  switch (static_cast<EnumProp>(prop)) {
    case EnumProp::Direction: YGNodeStyleSetDirection(yn, static_cast<YGDirection>(v)); break;
    case EnumProp::FlexDirection: YGNodeStyleSetFlexDirection(yn, static_cast<YGFlexDirection>(v)); break;
    case EnumProp::JustifyContent: YGNodeStyleSetJustifyContent(yn, static_cast<YGJustify>(v)); break;
    case EnumProp::AlignContent: YGNodeStyleSetAlignContent(yn, static_cast<YGAlign>(v)); break;
    case EnumProp::AlignItems: YGNodeStyleSetAlignItems(yn, static_cast<YGAlign>(v)); break;
    case EnumProp::AlignSelf: YGNodeStyleSetAlignSelf(yn, static_cast<YGAlign>(v)); break;
    case EnumProp::PositionType: YGNodeStyleSetPositionType(yn, static_cast<YGPositionType>(v)); break;
    case EnumProp::FlexWrap: YGNodeStyleSetFlexWrap(yn, static_cast<YGWrap>(v)); break;
    case EnumProp::Overflow: YGNodeStyleSetOverflow(yn, static_cast<YGOverflow>(v)); break;
    case EnumProp::Display: YGNodeStyleSetDisplay(yn, static_cast<YGDisplay>(v)); break;
    case EnumProp::BoxSizing: YGNodeStyleSetBoxSizing(yn, static_cast<YGBoxSizing>(v)); break;
  }
}

LC_EXPORT(lcl_set_number) void lcl_set_number(std::uint32_t n, std::uint32_t prop, float v) {
  auto* yn = node(n);
  switch (static_cast<NumberProp>(prop)) {
    case NumberProp::Flex: YGNodeStyleSetFlex(yn, v); break;
    case NumberProp::FlexGrow: YGNodeStyleSetFlexGrow(yn, v); break;
    case NumberProp::FlexShrink: YGNodeStyleSetFlexShrink(yn, v); break;
    case NumberProp::AspectRatio: YGNodeStyleSetAspectRatio(yn, v); break;
  }
}

// `slot` is the YGEdge for position/margin/padding/border and the YGGutter for gap.
LC_EXPORT(lcl_set_length)
void lcl_set_length(std::uint32_t n, std::uint32_t prop, std::uint32_t slot, float v, std::uint32_t unitRaw) {
  auto* yn = node(n);
  const auto unit = static_cast<Unit>(unitRaw);
  const auto edge = static_cast<YGEdge>(slot);
  const auto noop = [] {};
  switch (static_cast<LengthProp>(prop)) {
    case LengthProp::Width:
      setLength(
          unit, v, [&](float x) { YGNodeStyleSetWidth(yn, x); }, [&](float x) { YGNodeStyleSetWidthPercent(yn, x); },
          [&] { YGNodeStyleSetWidthAuto(yn); });
      break;
    case LengthProp::Height:
      setLength(
          unit, v, [&](float x) { YGNodeStyleSetHeight(yn, x); }, [&](float x) { YGNodeStyleSetHeightPercent(yn, x); },
          [&] { YGNodeStyleSetHeightAuto(yn); });
      break;
    case LengthProp::MinWidth:
      setLength(
          unit, v, [&](float x) { YGNodeStyleSetMinWidth(yn, x); },
          [&](float x) { YGNodeStyleSetMinWidthPercent(yn, x); }, noop);
      break;
    case LengthProp::MinHeight:
      setLength(
          unit, v, [&](float x) { YGNodeStyleSetMinHeight(yn, x); },
          [&](float x) { YGNodeStyleSetMinHeightPercent(yn, x); }, noop);
      break;
    case LengthProp::MaxWidth:
      setLength(
          unit, v, [&](float x) { YGNodeStyleSetMaxWidth(yn, x); },
          [&](float x) { YGNodeStyleSetMaxWidthPercent(yn, x); }, noop);
      break;
    case LengthProp::MaxHeight:
      setLength(
          unit, v, [&](float x) { YGNodeStyleSetMaxHeight(yn, x); },
          [&](float x) { YGNodeStyleSetMaxHeightPercent(yn, x); }, noop);
      break;
    case LengthProp::FlexBasis:
      setLength(
          unit, v, [&](float x) { YGNodeStyleSetFlexBasis(yn, x); },
          [&](float x) { YGNodeStyleSetFlexBasisPercent(yn, x); }, [&] { YGNodeStyleSetFlexBasisAuto(yn); });
      break;
    case LengthProp::Position:
      setLength(
          unit, v, [&](float x) { YGNodeStyleSetPosition(yn, edge, x); },
          [&](float x) { YGNodeStyleSetPositionPercent(yn, edge, x); }, [&] { YGNodeStyleSetPositionAuto(yn, edge); });
      break;
    case LengthProp::Margin:
      setLength(
          unit, v, [&](float x) { YGNodeStyleSetMargin(yn, edge, x); },
          [&](float x) { YGNodeStyleSetMarginPercent(yn, edge, x); }, [&] { YGNodeStyleSetMarginAuto(yn, edge); });
      break;
    case LengthProp::Padding:
      setLength(
          unit, v, [&](float x) { YGNodeStyleSetPadding(yn, edge, x); },
          [&](float x) { YGNodeStyleSetPaddingPercent(yn, edge, x); }, noop);
      break;
    case LengthProp::Border: YGNodeStyleSetBorder(yn, edge, unit == Unit::Point ? v : YGUndefined); break;
    case LengthProp::Gap:
      setLength(
          unit, v, [&](float x) { YGNodeStyleSetGap(yn, static_cast<YGGutter>(slot), x); },
          [&](float x) { YGNodeStyleSetGapPercent(yn, static_cast<YGGutter>(slot), x); }, noop);
      break;
  }
}

LC_EXPORT(lcl_calculate) void lcl_calculate(std::uint32_t root, float width, float height) {
  YGNodeCalculateLayout(node(root), width, height, YGDirectionLTR);
}

LC_EXPORT(lcl_has_new_layout) std::uint32_t lcl_has_new_layout(std::uint32_t n) {
  return YGNodeGetHasNewLayout(node(n)) ? 1u : 0u;
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
