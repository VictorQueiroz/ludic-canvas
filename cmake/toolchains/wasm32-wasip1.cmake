# Raw Clang/LLVM → wasm32-wasip1 toolchain (no Emscripten).
#
# Uses the host LLVM (clang + wasm-ld) with the WASI sysroot prepared by
# `node tools/toolchain/bootstrap.mjs`. The output modules are "reactors":
# no main(), C++ constructors run from `_initialize`, and every entry point is
# an explicit `export_name`.

get_filename_component(_lc_root "${CMAKE_CURRENT_LIST_DIR}/../.." ABSOLUTE)
set(_lc_generated "${_lc_root}/.toolchain/toolchain.cmake")
if(NOT EXISTS "${_lc_generated}")
  message(FATAL_ERROR "Missing ${_lc_generated}. Run `npm run toolchain` first.")
endif()
include("${_lc_generated}")

set(CMAKE_SYSTEM_NAME WASI)
set(CMAKE_SYSTEM_VERSION 1)
set(CMAKE_SYSTEM_PROCESSOR wasm32)
set(LC_WASM_TRIPLE wasm32-wasip1)

set(CMAKE_C_COMPILER "${LC_LLVM_ROOT}/bin/clang")
set(CMAKE_CXX_COMPILER "${LC_LLVM_ROOT}/bin/clang++")
set(CMAKE_AR "${LC_LLVM_ROOT}/bin/llvm-ar" CACHE FILEPATH "")
set(CMAKE_RANLIB "${LC_LLVM_ROOT}/bin/llvm-ranlib" CACHE FILEPATH "")
set(CMAKE_C_COMPILER_TARGET ${LC_WASM_TRIPLE})
set(CMAKE_CXX_COMPILER_TARGET ${LC_WASM_TRIPLE})
set(CMAKE_SYSROOT "${LC_WASI_SYSROOT}")
set(CMAKE_EXECUTABLE_SUFFIX ".wasm")

# The sysroot ships exception/no-exception flavours of libc++; we use `noeh`.
set(_lc_libcxx_inc "${LC_WASI_SYSROOT}/include/${LC_WASM_TRIPLE}/noeh/c++/v1")
set(_lc_libcxx_lib "${LC_WASI_SYSROOT}/lib/${LC_WASM_TRIPLE}/noeh")

set(_lc_common "-resource-dir=${LC_CLANG_RESOURCE_DIR} -fno-exceptions -msimd128 -mbulk-memory -mnontrapping-fptoint")
set(CMAKE_C_FLAGS_INIT "${_lc_common}")
set(CMAKE_CXX_FLAGS_INIT "${_lc_common} -fno-rtti -nostdinc++ -isystem ${_lc_libcxx_inc}")
set(CMAKE_EXE_LINKER_FLAGS_INIT
    "-fuse-ld=${LC_WASM_LD} -L${_lc_libcxx_lib} -mexec-model=reactor -Wl,--no-entry -Wl,-z,stack-size=524288")

# Compiler probes must not try to link a reactor without exports.
set(CMAKE_TRY_COMPILE_TARGET_TYPE STATIC_LIBRARY)
set(CMAKE_FIND_ROOT_PATH "${LC_WASI_SYSROOT}")
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_PACKAGE ONLY)
