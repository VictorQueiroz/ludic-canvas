/** Platform-independent entry point. No DOM or WebGL implementations are imported. */
export { createPortableUI } from './platform/root.ts';
export type { PortableUIOptions, PortableImages } from './platform/root.ts';
export type { UIRoot, UITheme, FrameInfo, FontSource } from './platform/root-types.ts';
export type {
  LayoutBackend,
  RenderContext,
  TextureResource,
  ImageProvider,
  Scheduler,
  SurfacePoint,
  ClientPoint,
} from './platform/contracts.ts';
export type { PlatformHost, PlatformEvent, SemanticNode, HostKeyEvent } from './platform/host.ts';
export { createHeadlessHost } from './platform/host.ts';
export {
  CommandRenderer,
  RecordingRenderer,
  DrawOp,
  DRAW_COMMAND_STRIDE,
  DRAW_COMMAND_VERSION,
} from './platform/commands.ts';
export type { DrawFrame } from './platform/commands.ts';
export { Font, FontBook, validateFontMetrics } from './gfx/font.ts';
export type { FrameProfile } from './runtime/profile.ts';
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
