# Third-party notices

Ludic Canvas source is MIT licensed. Third-party components retain their own licenses.

| Component                                                                                                       | Version / use                                                   | License                                                               |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------- |
| [React](https://github.com/facebook/react)                                                                      | React 19.3.1 peer and react-reconciler 0.34.0 runtime           | MIT; copies in licenses/                                              |
| [Yoga](https://github.com/facebook/yoga)                                                                        | 3.2.1, compiled into assets/layout.wasm                         | MIT; copy in licenses/Yoga-MIT.txt                                    |
| [Barlow Condensed](https://github.com/google/fonts/tree/main/ofl/barlowcondensed)                               | SemiBold font, source and generated default atlas               | SIL OFL 1.1; copy in licenses/Barlow-OFL.txt                          |
| [msdf-atlas-gen](https://github.com/Chlumsky/msdf-atlas-gen) and [msdfgen](https://github.com/Chlumsky/msdfgen) | Pinned build tools used for MTSDF atlas baking                  | MIT; copies in licenses/                                              |
| [LLVM libc++ / compiler-rt](https://github.com/llvm/llvm-project)                                               | WASI SDK 34 sysroot and builtins linked into the layout reactor | Apache-2.0 with LLVM exceptions; copy in licenses/LLVM.txt            |
| [wasi-libc](https://github.com/WebAssembly/wasi-libc)                                                           | WASI SDK 34 libc in the layout reactor                          | Multi-license; see licenses/wasi-libc.txt and linked upstream notices |

Font source provenance is recorded in tools/fontgen/fonts/SOURCE_COMMIT. Yoga and WASI archives are SHA-256 pinned in CMakeLists.txt and tools/toolchain/bootstrap.mjs. Font tool source revisions and hashes are pinned in tools/fontgen/wasm/CMakeLists.txt. Browser runtime dependencies are locked in package-lock.json.

The project initializer copies that same unmodified Barlow Condensed SemiBold
source into generated projects as `fonts/Interface.ttf`, together with
`fonts/OFL.txt`. Its packaged template source and license are verified against
the pinned repository font and license by the public-distribution audit.

The portable font compiler in assets/fontgen.wasm also includes FreeType 2.14.3 (selected FreeType License, licenses/FreeType-FTL.txt and licenses/FreeType-LICENSE.txt), its bundled zlib (licenses/FreeType-bundled-zlib.txt), and Brotli 1.1.0 (MIT, licenses/Brotli-MIT.txt). These dependencies are used for offline outline-font decoding, including WOFF and WOFF2. Build inputs, compiler and artifact hash are recorded in assets/fontgen-provenance.json. The WASI/LLVM notices above apply to this module as well.
