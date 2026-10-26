cmake_minimum_required(VERSION 3.28)
project(LudicCanvasFontgen LANGUAGES C CXX)
set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
# FreeType's rasterizers use setjmp/longjmp. WASI SDK 34 implements them
# through WebAssembly exception handling; Node 24 supports this feature.
add_compile_options(-mexception-handling -mllvm -wasm-enable-sjlj)
list(PREPEND CMAKE_MODULE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/cmake")
include(FetchContent)

FetchContent_Declare(brotli
  URL https://github.com/google/brotli/archive/refs/tags/v1.1.0.tar.gz
  URL_HASH SHA256=e720a6ca29428b803f4ad165371771f5398faba397edf6778837a18599ea13ff
  SOURCE_SUBDIR _none_ DOWNLOAD_EXTRACT_TIMESTAMP ON)
FetchContent_MakeAvailable(brotli)
file(GLOB BROTLI_DEC_SOURCES "${brotli_SOURCE_DIR}/c/common/*.c" "${brotli_SOURCE_DIR}/c/dec/*.c")
add_library(lc_brotli STATIC ${BROTLI_DEC_SOURCES})
target_include_directories(lc_brotli PUBLIC "${brotli_SOURCE_DIR}/c/include")

set(FT_DISABLE_ZLIB ON CACHE BOOL "Use FreeType's bundled zlib" FORCE)
set(FT_DISABLE_BZIP2 ON CACHE BOOL "" FORCE)
set(FT_DISABLE_PNG ON CACHE BOOL "" FORCE)
set(FT_DISABLE_HARFBUZZ ON CACHE BOOL "" FORCE)
set(FT_REQUIRE_BROTLI ON CACHE BOOL "Enable WOFF2 decoding" FORCE)
set(FT_ENABLE_ERROR_STRINGS ON CACHE BOOL "" FORCE)
FetchContent_Declare(freetype
  URL https://github.com/freetype/freetype/archive/refs/tags/VER-2-14-3.tar.gz
  URL_HASH SHA256=dc49de6b01a266eef4876a4dd34d9842c475d3e28ff2eff63bd2fb760ab56261
  DOWNLOAD_EXTRACT_TIMESTAMP ON)
FetchContent_MakeAvailable(freetype)
if(NOT TARGET Freetype::Freetype)
  add_library(Freetype::Freetype ALIAS freetype)
endif()

set(MSDFGEN_USE_VCPKG OFF CACHE BOOL "" FORCE)
set(MSDFGEN_USE_SKIA OFF CACHE BOOL "" FORCE)
set(MSDFGEN_DISABLE_SVG ON CACHE BOOL "" FORCE)
set(MSDFGEN_DISABLE_PNG ON CACHE BOOL "PNG encoding happens in Node" FORCE)
set(MSDFGEN_BUILD_STANDALONE OFF CACHE BOOL "" FORCE)
set(MSDFGEN_INSTALL OFF CACHE BOOL "" FORCE)
FetchContent_Declare(msdfgen
  URL https://github.com/Chlumsky/msdfgen/archive/1874bcf7d9624ccc85b4bc9a85d78116f690f35b.tar.gz
  URL_HASH SHA256=cef1f49b755427371fe3416a1a8ec8fc4632d44f30a034b0e887ccae72d46fc8
  DOWNLOAD_EXTRACT_TIMESTAMP ON)
FetchContent_MakeAvailable(msdfgen)

set(MSDF_ATLAS_USE_VCPKG OFF CACHE BOOL "" FORCE)
set(MSDF_ATLAS_USE_SKIA OFF CACHE BOOL "" FORCE)
set(MSDF_ATLAS_NO_ARTERY_FONT ON CACHE BOOL "" FORCE)
set(MSDF_ATLAS_MSDFGEN_EXTERNAL ON CACHE BOOL "" FORCE)
set(MSDF_ATLAS_BUILD_STANDALONE OFF CACHE BOOL "" FORCE)
FetchContent_Declare(msdf_atlas_gen
  URL https://github.com/Chlumsky/msdf-atlas-gen/archive/refs/tags/v1.4.tar.gz
  URL_HASH SHA256=57db9548b30905b18640ceab5011144e9d362f33a53748bef6be53dd743c9992
  DOWNLOAD_EXTRACT_TIMESTAMP ON)
FetchContent_MakeAvailable(msdf_atlas_gen)
get_target_property(atlas_sources msdf-atlas-gen SOURCES)
list(FILTER atlas_sources EXCLUDE REGEX "(^|/)Workload.cpp$")
set_property(TARGET msdf-atlas-gen PROPERTY SOURCES "${atlas_sources}")
target_sources(msdf-atlas-gen PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/workload.cpp")
target_include_directories(msdf-atlas-gen PRIVATE "${msdf_atlas_gen_SOURCE_DIR}")

add_executable(lc_fontgen main.cpp)
target_link_libraries(lc_fontgen PRIVATE msdf-atlas-gen Freetype::Freetype)
target_compile_options(lc_fontgen PRIVATE -Wall -Wextra)
target_link_options(lc_fontgen PRIVATE -mexception-handling -lsetjmp -Wl,--strip-all -Wl,--gc-sections -Wl,--max-memory=1073741824)
get_filename_component(LC_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/../../.." ABSOLUTE)
add_custom_command(TARGET lc_fontgen POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E copy "$<TARGET_FILE:lc_fontgen>" "${LC_ROOT}/assets/fontgen.wasm")
