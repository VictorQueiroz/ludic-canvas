# Host tool: msdf-atlas-gen (Chlumsky), built from pinned sources against the
# system FreeType and libpng. It bakes the configured fonts into multi-channel
# signed-distance-field atlases at build time; the browser never parses a font.
cmake_minimum_required(VERSION 3.28)
project(lc_fontgen LANGUAGES C CXX)

include(FetchContent)
set(FETCHCONTENT_QUIET ON)

set(MSDFGEN_USE_VCPKG OFF CACHE BOOL "" FORCE)
set(MSDFGEN_USE_SKIA OFF CACHE BOOL "" FORCE)
set(MSDFGEN_DISABLE_SVG ON CACHE BOOL "" FORCE)
set(MSDFGEN_BUILD_STANDALONE OFF CACHE BOOL "" FORCE)
set(MSDFGEN_INSTALL OFF CACHE BOOL "" FORCE)
FetchContent_Declare(
  msdfgen
  # The exact msdfgen commit msdf-atlas-gen v1.4 pins as its submodule.
  URL https://github.com/Chlumsky/msdfgen/archive/1874bcf7d9624ccc85b4bc9a85d78116f690f35b.tar.gz
  URL_HASH SHA256=cef1f49b755427371fe3416a1a8ec8fc4632d44f30a034b0e887ccae72d46fc8
  DOWNLOAD_EXTRACT_TIMESTAMP ON)
FetchContent_MakeAvailable(msdfgen)

set(MSDF_ATLAS_USE_VCPKG OFF CACHE BOOL "" FORCE)
set(MSDF_ATLAS_USE_SKIA OFF CACHE BOOL "" FORCE)
set(MSDF_ATLAS_NO_ARTERY_FONT ON CACHE BOOL "" FORCE)
set(MSDF_ATLAS_MSDFGEN_EXTERNAL ON CACHE BOOL "" FORCE)
set(MSDF_ATLAS_BUILD_STANDALONE ON CACHE BOOL "" FORCE)
FetchContent_Declare(
  msdf_atlas_gen
  URL https://github.com/Chlumsky/msdf-atlas-gen/archive/refs/tags/v1.4.tar.gz
  URL_HASH SHA256=57db9548b30905b18640ceab5011144e9d362f33a53748bef6be53dd743c9992
  PATCH_COMMAND ${CMAKE_COMMAND} -P ${CMAKE_CURRENT_SOURCE_DIR}/patch-msdf-atlas-gen.cmake
  DOWNLOAD_EXTRACT_TIMESTAMP ON)
FetchContent_MakeAvailable(msdf_atlas_gen)
