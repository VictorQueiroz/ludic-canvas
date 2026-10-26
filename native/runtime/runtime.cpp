// Minimal runtime glue for reactor modules. libc++ and libc++abi report fatal
// errors by formatting into stderr, which would drag stdio and a handful of
// WASI imports into every module; these overrides send the message to the host
// console instead and trap, keeping the modules import-light.

#include <cstddef>
#include <cstring>

#include "host.hpp"

extern "C" LC_IMPORT("lc_log") void lc_host_log(int level, const char* message, std::size_t length);

namespace lc::host {
void log(Level level, const char* message) { lc_host_log(static_cast<int>(level), message, std::strlen(message)); }
}  // namespace lc::host

// Called by libc++ hardening/assertions. The format string is reported as-is.
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wpragma-clang-attribute"
_LIBCPP_BEGIN_NAMESPACE_STD
_LIBCPP_BEGIN_EXPLICIT_ABI_ANNOTATIONS
[[noreturn]] void __libcpp_verbose_abort(const char* format, ...) noexcept {
  lc::host::log(lc::host::Level::Error, format);
  __builtin_trap();
}
_LIBCPP_END_EXPLICIT_ABI_ANNOTATIONS
_LIBCPP_END_NAMESPACE_STD
#pragma clang diagnostic pop

// libc++abi's internal fatal-error reporter (type_info / shared_ptr paths).
extern "C" [[noreturn]] void __abort_message(const char* format, ...) {
  lc::host::log(lc::host::Level::Error, format);
  __builtin_trap();
}

extern "C" [[noreturn]] void __cxa_pure_virtual() {
  lc::host::log(lc::host::Level::Error, "pure virtual function called");
  __builtin_trap();
}
