# Ludic Canvas 0.8.0 verification

## Implementation

[PR 32](https://github.com/VictorQueiroz/ludic-canvas/pull/32) adds wheel callbacks,
the root UI hit query and the generic map-and-sidebar integration example. It was
merged as `59d1ba81199e1eb7ac78ac89138b005cb838e5a4`; its reviewed branch head was
`f99e45d3af6e3e0d48694d3ca40fe158715ec253`.

SDK source-tree SHA-256: `617acf0ae21841d91d324fbd7454bb4919fe74ed2cec8c6b933dcd9b00bbcaba`.
The hashing convention and early test/acquisition failures are recorded in
[INPUT_ROUTING.md](INPUT_ROUTING.md).

## Qualification

- `npm run check` passed locally on Node 26.12.1/macOS 26.6.2: build, types,
  105 unit tests, generated documentation/site, public boundaries and independent
  packed consumers. The map/sidebar source also builds against the tarball.
- Formatting, whitespace and package dry-run checks passed.
- The complete local five-project browser suite passed **382 tests with 13 explicit
  skips**, no failures or retries, in 7.4 minutes. This includes the new input
  contracts and existing controls, native editors, scrolling, collections and games.
- [Implementation CI](https://github.com/VictorQueiroz/ludic-canvas/actions/runs/41218108233)
  passed all eight jobs on `f99e45d`. It acquired **382 browser passes and 13 skips**,
  plus **16 independent packed/registry consumer passes**. No test retry or flaky
  result was reported. Linux/macOS unit checks passed 105 tests; Windows passed
  104 with the existing platform-specific skip. CI uses Node 24.

The 13 browser skips are existing clipboard/touch restrictions and mobile-WebKit
mouse-wheel injection exclusions, including three new input/example exclusions.
Synthetic routing contracts still execute on mobile WebKit. These results do not
qualify physical phones, OS IME, screen readers, GPU timing or memory reclamation.
Original performance acquisitions remain unchanged.

Local logs, initial failure traces, passing input screenshots and registry-input
verification artifacts are kept under `/tmp/ludic-input-routing-2026-10-31/`.

## Publication and deployment

[Release PR 33](https://github.com/VictorQueiroz/ludic-canvas/pull/33) merged as
`64660902d8748211e83d33763c7f173d77fce82c`. Its version/changelog/generated-docs
diff leaves SDK source unchanged. Publication runs through
[the existing Changesets/OIDC workflow](https://github.com/VictorQueiroz/ludic-canvas/actions/runs/41219033794).
The workflow completed successfully, including its complete check matrix, with
no reported test retries. npm `latest` resolves to 0.8.0 and both tag `v0.8.0`
and registry `gitHead` match the version commit above.

The downloaded **829,164-byte** registry tarball matched
`sha512-UlaE1kNuiVWhS22MbEkhUV069OumHJftlwGCQ1D33g9nsbn9NlnH9MeuECf1YIp+OxCwcKJhelXkq7dcTTgzUQ==`.
Provenance metadata was inspected; this is not independent cryptographic
signature/attestation validation.

`npm run verify:release -- --version 0.8.0 --site https://libraries.ludic-canvas.victorqueiroz.dev`
passed tag identity, metadata, tarball integrity, the independently installed
registry consumer (including font generation/build) and all six public version
pages. Both standalone manifests/locks now pin the exact version and integrity.
The report is `/tmp/ludic-input-routing-2026-10-31/registry-verification.json`;
it records the checkout as the release commit with the uncommitted consumer-pin
and documentation follow-up. SDK source was unchanged.

A second fresh npm installation built and ran the map/sidebar source against
the actual registry package. Real Chromium wheel input zoomed each map; sidebar
scrolling stayed isolated through its boundary; keyboard Reset worked. Cleanup
removed the canvases and UI mirrors, and no page errors occurred. The report,
exact installed lockfile and screenshot are under
`/tmp/ludic-input-routing-2026-10-31/installed-input/`.

Registry availability was checked independently of workflow success. The first
metadata lookup returned 404, then resolved to 0.8.0. A subsequent fresh install
failed while the canonical tarball endpoint still served a cached 404 (observed
`max-age=300`, with age increasing from 75 to 284 seconds). The endpoint returned
200 at 16:30 UTC, after which normal installation and both verifiers passed.
No package was republished, and no alternate artifact or registry was substituted.

Vercel independently reported deployment `dpl_3ZgHQiRtbbPqqM3WAgHrja3NCMit`
READY, production, at that exact version commit, with the canonical alias
`libraries.ludic-canvas.victorqueiroz.dev`. The existing Vite project is
`prj_kEyfh6TLuhsYKTfZryYKA2vo3K6o` in team `team_2RngWKl69QIK4FGBEZdpNkgN`.

The live `/input/` page served the 0.8.0 badge and passed both UI-tree and external
camera routing, sidebar isolation and keyboard Reset. A 320-pixel viewport had no
horizontal document overflow; no page errors were observed. The acquisition used
Chromium and synthetic wheel dispatch to assert routing synchronously; actual
wheel injection is covered by the five-project tests above. Deployment is
verified independently of npm publication.
