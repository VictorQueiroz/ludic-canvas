# Font fixtures

These small, synthetic outline fonts are original MIT-licensed test data generated
by `tools/fontgen/fixtures.py`. They contain printable ASCII mappings with deliberately
simple shapes, including space and the question-mark fallback.

The fixtures exercise TrueType outlines, OpenType CFF outlines, WOFF and WOFF2
containers for both outline types, and a variable TrueType font with a `wght` axis.
No third-party font artwork is included in these fixtures.

Regeneration dependencies: `fonttools==4.60.2`, `brotli==1.2.1`.
