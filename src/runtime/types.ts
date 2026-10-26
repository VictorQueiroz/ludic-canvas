// Prop types for the four host primitives of the WebGL UI. Styles mix
// Yoga layout properties with visual ones, React-Native style.

import type { ReactNode } from 'react';
import type { FontName } from '../gfx/font.ts';

export type Dim = number | `${number}%` | 'auto';

export interface LayoutStyle {
  display?: 'flex' | 'none';
  position?: 'relative' | 'absolute';
  flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
  alignSelf?: 'auto' | 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
  alignContent?: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'space-between' | 'space-around';
  flexWrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  overflow?: 'visible' | 'hidden' | 'scroll';
  flex?: number;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: Dim;
  aspectRatio?: number;
  width?: Dim;
  height?: Dim;
  minWidth?: Dim;
  minHeight?: Dim;
  maxWidth?: Dim;
  maxHeight?: Dim;
  top?: Dim;
  left?: Dim;
  right?: Dim;
  bottom?: Dim;
  margin?: Dim;
  marginX?: Dim;
  marginY?: Dim;
  marginTop?: Dim;
  marginBottom?: Dim;
  marginLeft?: Dim;
  marginRight?: Dim;
  padding?: Dim;
  paddingX?: Dim;
  paddingY?: Dim;
  paddingTop?: Dim;
  paddingBottom?: Dim;
  paddingLeft?: Dim;
  paddingRight?: Dim;
  gap?: number;
  rowGap?: number;
  columnGap?: number;
}

export interface GlowStyle {
  color: string;
  spread?: number; // px beyond the box
  falloff?: number; // 2 (wide) … 6 (tight)
  pulse?: number; // 0..1 breathing amplitude
}

export interface VisualStyle {
  opacity?: number;
  translateX?: number;
  translateY?: number;
  scale?: number;
  background?: string | [string, string]; // colour or vertical gradient
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  glow?: GlowStyle;
  breathe?: number; // 0..1 slow opacity oscillation
}

export interface TextVisualStyle {
  color?: string;
  emphasisColor?: string;
  fontFamily?: FontName;
  fontSize?: number;
  lineHeight?: number;
  letterSpacing?: number; // em
  textAlign?: 'left' | 'center' | 'right';
  textTransform?: 'none' | 'uppercase';
  weight?: number; // -0.1 … 0.15 SDF bias (thicker/thinner)
  shadow?: boolean;
  maxLines?: number;
}

export interface ImageVisualStyle {
  tint?: string;
  fit?: 'cover' | 'contain' | 'fill';
  flipX?: boolean;
  flipY?: boolean;
  focusX?: number; // 0..1 crop focus for cover
  focusY?: number;
  desaturate?: number;
  darken?: number;
}

export type ViewStyle = LayoutStyle & VisualStyle;
export type TextStyleProp = LayoutStyle & VisualStyle & TextVisualStyle;
export type ImageStyleProp = LayoutStyle & VisualStyle & ImageVisualStyle;

export interface Enter {
  opacity?: number;
  translateX?: number;
  translateY?: number;
  scale?: number;
  delay?: number;
  duration?: number;
}

export interface Interactive {
  onPress?: () => void;
  onHover?: (hovered: boolean) => void;
  /** Style overrides blended in while hovered / pressed / focused. */
  hoverStyle?: Partial<VisualStyle & TextVisualStyle & ImageVisualStyle>;
  pressStyle?: Partial<VisualStyle>;
  disabled?: boolean;
  /** Accessible name; pressable nodes get an invisible DOM button mirror. */
  label?: string;
  hotkey?: string; // e.g. "1", "Escape", "Enter"
  pointerEvents?: 'auto' | 'none' | 'box-none';
  /** Swallow presses/hover over this box (modal panels above a scrim). */
  block?: boolean;
  cursor?: 'pointer' | 'default';
}

export interface CommonProps extends Interactive {
  /** Called (asynchronously) when the node's laid-out size or position changes. */
  onLayout?: (box: { x: number; y: number; width: number; height: number }) => void;
  /** Milliseconds; animates opacity/transform/colour changes. */
  transition?: number;
  enter?: Enter;
  /** Draw order among siblings (higher on top). */
  zIndex?: number;
  children?: ReactNode;
}

export interface ViewProps extends CommonProps {
  style?: ViewStyle;
  /** 0..1 horizontal fill drawn inside the box (bars). Animated with `transition`. */
  fill?: number;
  fillColor?: string;
}

export interface TextProps extends CommonProps {
  style?: TextStyleProp;
  /** Parse **emphasis** markup. */
  rich?: boolean;
  /** Announce changes to screen readers (aria-live). */
  announce?: boolean;
}

export interface ImageProps extends CommonProps {
  src: string | undefined;
  /** Optional second image cross-faded on top by `mix` (0..1). */
  src2?: string | undefined;
  mix?: number;
  style?: ImageStyleProp;
}

export interface LineProps extends CommonProps {
  from: [number, number];
  to: [number, number];
  /** Interpret from/to as fractions of the parent's box instead of pixels. */
  relative?: boolean;
  width?: number;
  color?: string;
  dash?: number;
  speed?: number;
}

export type HostType = 'view' | 'text' | 'image' | 'line';
export type AnyProps = ViewProps & TextProps & Partial<ImageProps> & Partial<LineProps>;
