import type { ReactNode } from 'react';
import type { AtlasJson } from '../gfx/font.ts';
import type { FrameProfile } from '../runtime/profile.ts';
import type { SurfacePoint, ClientPoint } from './contracts.ts';

/** An MTSDF atlas and its metrics, produced by msdf-atlas-gen. Maximum: four faces per root. */
export interface FontSource {
  name: string;
  atlas: string;
  metrics: string | AtlasJson;
}

/** Visual defaults. Individual primitive styles take precedence. */
export interface UITheme {
  textColor: string;
  emphasisColor: string;
  focusRing: string;
}

/** Logical and device-pixel dimensions of the latest frame. cssWidth/cssHeight are logical units on native hosts. */
export interface FrameInfo {
  width: number;
  height: number;
  dpr: number;
  cssWidth: number;
  cssHeight: number;
  /** Backend submissions: WebGL draws in the browser, command buffers for CommandRenderer. */
  drawCalls: number;
  contextLost: boolean;
  textureBytes: number;
  /** Present only when profiling is enabled and a frame is drawn. */
  profile?: FrameProfile;
}

/** A mounted React interface and its layout, input and GPU resources. */
export interface UIRoot {
  /** Schedule an update. State, context and ordinary React hooks work inside the tree. */
  render(element: ReactNode): void;
  /** Draw a frame; now is a requestAnimationFrame timestamp in milliseconds. */
  frame(now?: number): FrameInfo;
  /** Start or resume automatic drawing. Idempotent. */
  start(): void;
  /** Pause automatic drawing; the React tree stays mounted. */
  stop(): void;
  /** Unmount React, cancel frames, remove listeners and free resources. Idempotent. */
  destroy(): void;
  setTextScale(scale: number): void;
  setReducedMotion(enabled: boolean): void;
  setTheme(theme: Partial<UITheme>): void;
  /** Preload image identifiers. Rejects on unknown assets or failed requests. */
  preloadImages(ids: readonly string[]): Promise<void>;
  /** Host tree with computed boxes for development tools. */
  invalidateImages(ids?: readonly string[]): void;
  /** Focus a named pressable, or navigate spatially from a gamepad adapter. */
  focus(id: string): boolean;
  /** Navigate mounted geometry or an owning collection's logical items. Accepted collection focus settles in a frame. */
  navigate(direction: 'up' | 'down' | 'left' | 'right'): boolean;
  activateFocused(): boolean;
  /**
   * Whether this root reserves a point for UI, using its latest painted geometry.
   * SurfacePoint is root-local in logical units. ClientPoint accepts browser viewport coordinates;
   * portable hosts without a viewport interpret ClientPoint as root-local too. No prior movement is needed.
   * Counts controls (including disabled ones), wheel surfaces, scroll regions and block boxes.
   * Respects clipping, transforms and pointerEvents. A modal reserves the entire canvas.
   * Empty layout/decorative boxes do not count. An application world-input View does count.
   * Returns false outside the canvas, before first paint, while suspended, or after destroy.
   * Does not dispatch, cancel events, render, or report pointer capture ownership.
   */
  isPointerOverUI(point: SurfacePoint | ClientPoint): boolean;
  inspect(): unknown;
}
