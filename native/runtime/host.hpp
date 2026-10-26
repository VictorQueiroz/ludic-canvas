#pragma once
// The narrow seam between a wasm module and its JavaScript host.

#define LC_EXPORT(name) __attribute__((export_name(#name)))
#define LC_IMPORT(name) __attribute__((import_module("env"), import_name(name)))

namespace lc::host {
enum class Level : int { Debug = 0, Info = 1, Warn = 2, Error = 3 };
void log(Level level, const char* message);
}  // namespace lc::host
