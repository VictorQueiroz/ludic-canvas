# Font fixtures

These small, synthetic outline fonts are original MIT-licensed test data generated
by `tools/fontgen/fixtures.py`. They contain printable ASCII mappings with deliberately
simple shapes, including space and the question-mark fallback.

The fixtures exercise TrueType outlines, OpenType CFF outlines, WOFF and WOFF2
containers for both outline types, and a variable TrueType font with a `wght` axis.
No third-party font artwork is included in these fixtures.

`fixture-kerning.ttf` has space, question-mark, A and V mappings, with NBSP sharing
the space glyph. Its legacy `kern` table has A/V = -100 and A/space = -50 units
in a 1000-unit em. CLI regressions check normalized adjustments, runtime width,
and expansion of the A/space pair to A/NBSP. This fixture does not test GPOS.
`fixture-kerning-alias-limit.ttf` adds 600 aliases of A and an A/A pair, exercising
the expanded-pair limit before large atlas or metadata output is allocated.

Regeneration dependencies: `fonttools==4.60.2`, `brotli==1.2.1`.
