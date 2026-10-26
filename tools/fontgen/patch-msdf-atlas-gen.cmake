# Newer Clang rejects an ambiguous C-style cast in msdf-atlas-gen v1.4
# (BitmapAtlasStorage converts to both BitmapConstSection and BitmapConstRef,
# and the former is constructible from the latter). Call the intended
# conversion operator explicitly.
file(READ "msdf-atlas-gen/main.cpp" source)
string(REPLACE
  "(msdfgen::BitmapConstSection<T, N>) generator.atlasStorage()"
  "generator.atlasStorage().operator msdfgen::BitmapConstSection<T, N>()"
  source "${source}")
file(WRITE "msdf-atlas-gen/main.cpp" "${source}")
