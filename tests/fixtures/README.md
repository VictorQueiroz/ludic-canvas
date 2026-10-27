# Font fixtures

These small, synthetic outline fonts are original MIT-licensed test data generated
by `tools/fontgen/fixtures.py`. They contain printable ASCII mappings with deliberately
simple shapes, including space and the question-mark fallback.

The fixtures exercise TrueType outlines, OpenType CFF outlines, WOFF and WOFF2
containers for both outline types, and a variable TrueType font with a `wght` axis.
No third-party font artwork is included in these fixtures.

`fixture-kerning.ttf` has unique space, question-mark, A and V mappings and a
legacy `kern` table with an A/V adjustment of -100 units in a 1000-unit em.
The CLI regression checks that the exported adjustment is -0.1 em and that
runtime measurement uses it. This fixture does not test GPOS positioning.

Regeneration dependencies: `fonttools==4.60.2`, `brotli==1.2.1`.
