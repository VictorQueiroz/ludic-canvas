cmake_minimum_required(VERSION 3.28)
project(LudicCanvas VERSION 0.1.0 LANGUAGES C CXX)
set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
include(FetchContent)
FetchContent_Declare(yoga
  URL https://github.com/facebook/yoga/archive/refs/tags/v3.2.1.tar.gz
  URL_HASH SHA256=86b399ac31fd820d8ffa823c3fae31bb690b6fc45301b2a8a966c09b5a088b55
  SOURCE_SUBDIR _none_ DOWNLOAD_EXTRACT_TIMESTAMP ON)
FetchContent_MakeAvailable(yoga)
file(GLOB_RECURSE LC_YOGA_SOURCES CONFIGURE_DEPENDS "${yoga_SOURCE_DIR}/yoga/*.cpp")
add_library(lc_yoga STATIC ${LC_YOGA_SOURCES})
target_include_directories(lc_yoga SYSTEM PUBLIC "${yoga_SOURCE_DIR}")
target_compile_options(lc_yoga PRIVATE -w -flto)
add_executable(lc_layout native/layout/yoga_bridge.cpp native/runtime/runtime.cpp)
target_include_directories(lc_layout PRIVATE native/runtime)
target_link_libraries(lc_layout PRIVATE lc_yoga)
target_compile_options(lc_layout PRIVATE -Wall -Wextra -flto)
target_link_options(lc_layout PRIVATE -flto -Wl,--lto-O3 -Wl,--strip-all -Wl,--gc-sections)
add_custom_command(TARGET lc_layout POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E copy "$<TARGET_FILE:lc_layout>" "${CMAKE_SOURCE_DIR}/assets/layout.wasm")
