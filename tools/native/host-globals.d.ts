// The minimal JavaScript environment supplied by engine.cpp. This file is only
// used by the portable typecheck, never included in published declarations.
declare const performance: { now(): number };
declare const console: {
  log(...values: unknown[]): void;
  warn(...values: unknown[]): void;
  error(...values: unknown[]): void;
};
declare function setTimeout(callback: () => void, delay?: number): number;
declare function clearTimeout(id: number | undefined): void;
declare function queueMicrotask(callback: () => void): void;
