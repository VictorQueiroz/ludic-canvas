/** Native entry point. Requires the versioned Ludic host installed by the application binary. */
export * from './core.ts';
export { createNativeUI } from './platform/native.ts';
export type { NativeUIOptions } from './platform/native.ts';
