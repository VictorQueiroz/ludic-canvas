export { createUI } from './root.ts';
export type { UIRoot, UIOptions, UITheme, FontSource, FrameInfo } from './root.ts';
export type { FrameProfile } from './runtime/profile.ts';
export type { SurfacePoint, ClientPoint } from './platform/contracts.ts';
export { createScrollHandle } from './scroll.ts';
export type { ScrollHandle, ScrollSnapshot } from './scroll.ts';
export { VirtualList, createVirtualListHandle } from './virtual-list.tsx';
export type {
  VirtualListProps,
  VirtualListHandle,
  VirtualItemKey,
  VirtualItemState,
  ScrollAlignment,
} from './virtual-list.tsx';
export { View, Text, Image, Line } from './primitives.ts';
export type {
  ViewProps,
  TextProps,
  ImageProps,
  LineProps,
  CommonProps,
  Interactive,
  UIPointerEvent,
  UIWheelEvent,
  UIKeyEvent,
  UIEvent,
  LayoutStyle,
  VisualStyle,
  TextVisualStyle,
  ImageVisualStyle,
  GlowStyle,
  ViewStyle,
  TextStyleProp,
  ImageStyleProp,
  Enter,
  Dim,
} from './runtime/types.ts';
export { createAssetResolver } from './assets.ts';
export type { ImageAsset, ImageAssets, AssetResolver } from './assets.ts';
export type { AtlasJson, FontFamily, FontDiagnostic } from './gfx/font.ts';
export { defaultAssets } from './defaults.ts';
export type { ResourceLimits } from './resources.ts';
export { useUIRoot } from './context.ts';
export { TextInput, TextArea } from './text-input.tsx';
export type { TextInputProps, TextAreaProps, TextInputHandle, NativeTextStyle } from './text-input.tsx';
export { Button, Switch, Slider, Tab, Tabs, Dialog, ScrollArea } from './controls.tsx';
export type {
  ButtonProps,
  SwitchProps,
  SliderProps,
  SliderState,
  TabProps,
  TabItem,
  TabState,
  TabsProps,
  DialogProps,
  ScrollAreaProps,
} from './controls.tsx';
