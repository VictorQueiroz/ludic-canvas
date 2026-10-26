# Brotli is built from the pinned source archive in this build.
set(BROTLIDEC_FOUND TRUE)
set(BROTLIDEC_LIBRARIES "$<BUILD_INTERFACE:lc_brotli>")
set(BROTLIDEC_INCLUDE_DIRS "${brotli_SOURCE_DIR}/c/include")
set(BROTLIDEC_VERSION "1.1.0")
