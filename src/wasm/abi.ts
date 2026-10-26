// Layout ABI shared with native/layout/yoga_bridge.cpp.
export const LAYOUT_ABI_VERSION = 2;

export const EnumProp = {
  Direction: 0,
  FlexDirection: 1,
  JustifyContent: 2,
  AlignContent: 3,
  AlignItems: 4,
  AlignSelf: 5,
  PositionType: 6,
  FlexWrap: 7,
  Overflow: 8,
  Display: 9,
  BoxSizing: 10,
} as const;

export const NumberProp = { Flex: 0, FlexGrow: 1, FlexShrink: 2, AspectRatio: 3 } as const;

export const LengthProp = {
  Width: 0,
  Height: 1,
  MinWidth: 2,
  MinHeight: 3,
  MaxWidth: 4,
  MaxHeight: 5,
  FlexBasis: 6,
  Position: 7,
  Margin: 8,
  Padding: 9,
  Border: 10,
  Gap: 11,
} as const;

export const Unit = { Undefined: 0, Point: 1, Percent: 2, Auto: 3 } as const;
export const Edge = {
  Left: 0,
  Top: 1,
  Right: 2,
  Bottom: 3,
  Start: 4,
  End: 5,
  Horizontal: 6,
  Vertical: 7,
  All: 8,
} as const;
export const Gutter = { Column: 0, Row: 1, All: 2 } as const;
export const MeasureMode = { Undefined: 0, Exactly: 1, AtMost: 2 } as const;

// Yoga enum values, by CSS-ish name.
export const FLEX_DIRECTION = { column: 0, 'column-reverse': 1, row: 2, 'row-reverse': 3 } as const;
export const JUSTIFY = {
  'flex-start': 0,
  center: 1,
  'flex-end': 2,
  'space-between': 3,
  'space-around': 4,
  'space-evenly': 5,
} as const;
export const ALIGN = {
  auto: 0,
  'flex-start': 1,
  center: 2,
  'flex-end': 3,
  stretch: 4,
  baseline: 5,
  'space-between': 6,
  'space-around': 7,
  'space-evenly': 8,
} as const;
export const POSITION = { static: 0, relative: 1, absolute: 2 } as const;
export const WRAP = { nowrap: 0, wrap: 1, 'wrap-reverse': 2 } as const;
export const OVERFLOW = { visible: 0, hidden: 1, scroll: 2 } as const;
export const DISPLAY = { flex: 0, none: 1, contents: 2 } as const;
