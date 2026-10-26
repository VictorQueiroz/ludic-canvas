// The four host primitives, typed as components. Like React Native's <View>,
// each is just a host type string; the reconciler maps it to a HostNode.

import type { ComponentType } from 'react';
import type { ImageProps, LineProps, TextProps, ViewProps } from './runtime/types.ts';

export const View = 'view' as unknown as ComponentType<ViewProps>;
export const Text = 'text' as unknown as ComponentType<TextProps>;
export const Image = 'image' as unknown as ComponentType<ImageProps>;
export const Line = 'line' as unknown as ComponentType<LineProps>;

export type { ImageProps, LineProps, TextProps, ViewProps } from './runtime/types.ts';
