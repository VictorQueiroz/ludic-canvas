# The font compiler is a WASI command with main(), rather than a reactor.
include("${CMAKE_CURRENT_LIST_DIR}/wasm32-wasip1.cmake")
string(REPLACE "-mexec-model=reactor -Wl,--no-entry" "-mexec-model=command"
  CMAKE_EXE_LINKER_FLAGS_INIT "${CMAKE_EXE_LINKER_FLAGS_INIT}")
