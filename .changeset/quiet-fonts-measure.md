---
'ludic-canvas': minor
---

Add ordered `fontFamily` fallback chains, atlas pair kerning and `fontKerning: 'none'`.
Measurement, wrapping, ellipsis and glyph painting share the selected face and
baseline metrics. Opt into bounded root-local missing-glyph reports with
`onFontDiagnostic`. The offline font compiler now extracts legacy kern-table pairs;
GPOS, bidi and complex-script shaping remain outside this release.

Add documented browser performance workloads with raw JSON evidence, explicit
budgets, source/environment metadata and separate CPU submission, commit latency
and frame-interval measurements. Physical mobile and assistive-technology
qualification remain separate from automated correctness tests.
