#pragma once
#include <cstdint>
#include <yoga/Yoga.h>

// Property IDs are shared with src/wasm/abi.ts by both bindings.
namespace lc::layout {
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

template <class SetPt, class SetPct, class SetAuto>
void setLength(Unit unit, float value, SetPt pt, SetPct pct, SetAuto autoFn) {
  switch (unit) {
  case Unit::Undefined:
    pt(YGUndefined);
    break;
  case Unit::Point:
    pt(value);
    break;
  case Unit::Percent:
    pct(value);
    break;
  case Unit::Auto:
    autoFn();
    break;
  }
}

inline void setEnum(YGNodeRef yn, std::uint32_t prop, std::int32_t v) {
  switch (static_cast<EnumProp>(prop)) {
  case EnumProp::Direction:
    YGNodeStyleSetDirection(yn, static_cast<YGDirection>(v));
    break;
  case EnumProp::FlexDirection:
    YGNodeStyleSetFlexDirection(yn, static_cast<YGFlexDirection>(v));
    break;
  case EnumProp::JustifyContent:
    YGNodeStyleSetJustifyContent(yn, static_cast<YGJustify>(v));
    break;
  case EnumProp::AlignContent:
    YGNodeStyleSetAlignContent(yn, static_cast<YGAlign>(v));
    break;
  case EnumProp::AlignItems:
    YGNodeStyleSetAlignItems(yn, static_cast<YGAlign>(v));
    break;
  case EnumProp::AlignSelf:
    YGNodeStyleSetAlignSelf(yn, static_cast<YGAlign>(v));
    break;
  case EnumProp::PositionType:
    YGNodeStyleSetPositionType(yn, static_cast<YGPositionType>(v));
    break;
  case EnumProp::FlexWrap:
    YGNodeStyleSetFlexWrap(yn, static_cast<YGWrap>(v));
    break;
  case EnumProp::Overflow:
    YGNodeStyleSetOverflow(yn, static_cast<YGOverflow>(v));
    break;
  case EnumProp::Display:
    YGNodeStyleSetDisplay(yn, static_cast<YGDisplay>(v));
    break;
  case EnumProp::BoxSizing:
    YGNodeStyleSetBoxSizing(yn, static_cast<YGBoxSizing>(v));
    break;
  }
}

inline void setNumber(YGNodeRef yn, std::uint32_t prop, float v) {
  switch (static_cast<NumberProp>(prop)) {
  case NumberProp::Flex:
    YGNodeStyleSetFlex(yn, v);
    break;
  case NumberProp::FlexGrow:
    YGNodeStyleSetFlexGrow(yn, v);
    break;
  case NumberProp::FlexShrink:
    YGNodeStyleSetFlexShrink(yn, v);
    break;
  case NumberProp::AspectRatio:
    YGNodeStyleSetAspectRatio(yn, v);
    break;
  }
}

// `slot` is the YGEdge for position/margin/padding/border and the YGGutter for gap.
inline void setLengthProperty(YGNodeRef yn, std::uint32_t prop, std::uint32_t slot, float v,
                              std::uint32_t unitRaw) {
  const auto unit = static_cast<Unit>(unitRaw);
  const auto edge = static_cast<YGEdge>(slot);
  const auto noop = [] {};
  switch (static_cast<LengthProp>(prop)) {
  case LengthProp::Width:
    setLength(
        unit, v, [&](float x) { YGNodeStyleSetWidth(yn, x); },
        [&](float x) { YGNodeStyleSetWidthPercent(yn, x); }, [&] { YGNodeStyleSetWidthAuto(yn); });
    break;
  case LengthProp::Height:
    setLength(
        unit, v, [&](float x) { YGNodeStyleSetHeight(yn, x); },
        [&](float x) { YGNodeStyleSetHeightPercent(yn, x); }, [&] { YGNodeStyleSetHeightAuto(yn); });
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
        [&](float x) { YGNodeStyleSetPositionPercent(yn, edge, x); },
        [&] { YGNodeStyleSetPositionAuto(yn, edge); });
    break;
  case LengthProp::Margin:
    setLength(
        unit, v, [&](float x) { YGNodeStyleSetMargin(yn, edge, x); },
        [&](float x) { YGNodeStyleSetMarginPercent(yn, edge, x); },
        [&] { YGNodeStyleSetMarginAuto(yn, edge); });
    break;
  case LengthProp::Padding:
    setLength(
        unit, v, [&](float x) { YGNodeStyleSetPadding(yn, edge, x); },
        [&](float x) { YGNodeStyleSetPaddingPercent(yn, edge, x); }, noop);
    break;
  case LengthProp::Border:
    YGNodeStyleSetBorder(yn, edge, unit == Unit::Point ? v : YGUndefined);
    break;
  case LengthProp::Gap:
    setLength(
        unit, v, [&](float x) { YGNodeStyleSetGap(yn, static_cast<YGGutter>(slot), x); },
        [&](float x) { YGNodeStyleSetGapPercent(yn, static_cast<YGGutter>(slot), x); }, noop);
    break;
  }
}

} // namespace lc::layout
