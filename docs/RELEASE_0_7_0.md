# 0.7.0 publication verification — 2026-10-29

TextInput and TextArea are available from `ludic-canvas@0.7.0`. They are native
editors over Yoga/WebGL field boxes, intended for topmost forms and dialogs.
See [the editing contract](NATIVE_EDITING.md) for behavior and support limits.

## Source, artifact and deployment

| Identity                            | Verified value                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Implementation                      | [PR 29](https://github.com/VictorQueiroz/ludic-canvas/pull/29), merge `941a337e4a09c3f95a75aad8a0e976c35b4ad203`                     |
| SDK source checksum                 | `56e7f95b5802461ebf586b4e95753eb8f9858438ff6ac0bf1f78aa331c0a02ba`                                                                   |
| Publication                         | [PR 30](https://github.com/VictorQueiroz/ludic-canvas/pull/30), tag `v0.7.0`, npm gitHead `b0c9beaca76cf72e17d824af463e27a684abb991` |
| Registry artifact                   | [ludic-canvas 0.7.0](https://www.npmjs.com/package/ludic-canvas/v/0.7.0), 828,230 downloaded bytes                                   |
| SHA-512 integrity                   | `sha512-Kc2CgvyKHNc5Z9jlmbvKNx/7KR1YlGSxzbo2ZREtIWbgQtsHjK/cRKy456XKeWBcWMpsFEeV7rN6N0ADkYRQEA==`                                    |
| Initial 0.7.0 production deployment | `dpl_ERsXEHZTsz8281vqGs5gteqEWeTf`, READY, production, source `b0c9beaca76cf72e17d824af463e27a684abb991`                             |
| Canonical site                      | <https://libraries.ludic-canvas.victorqueiroz.dev>                                                                                   |

Versioning and the consumer/documentation follow-up do not change SDK source.
The checksum method is documented in NATIVE_EDITING.md. The registry's SLSA
provenance metadata was present; signatures/attestations were not independently
cryptographically validated.

## Checks and observed behavior

- [Implementation CI](https://github.com/VictorQueiroz/ludic-canvas/actions/runs/40911352644)
  passed all eight jobs: package/type/format/distribution checks on Linux, macOS
  and Windows; 320 full-suite browser passes with 10 explicit skips across five
  projects; and 16 independent packed/registry consumer passes. No flaky case
  was reported in that run.
- [Version PR CI](https://github.com/VictorQueiroz/ludic-canvas/actions/runs/40913914180)
  passed all eight jobs on `87b4ddbbeb7bce0b84415a1783e522338dbbe1c8` before merge.
- [Publication workflow](https://github.com/VictorQueiroz/ludic-canvas/actions/runs/40914787011)
  passed its gates and published through the existing Changesets/OIDC setup.
  Its WebKit typography diagnostic callback case timed out waiting for the error
  marker and passed on retry: that job reported 62 passed, one flaky and three
  skipped, then four consumer passes. No SDK or deadline change was made for it.
- `npm run verify:release -- --version 0.7.0 --site ...` passed on the committed
  0.7.0 Kestrel consumer: tag/gitHead/integrity, actual tarball download, fresh
  independent npm installation, font regeneration, public exports/assets and
  production build. All six checked public page badges were 0.7.0 with HTTP 200.
- A separate independent npm-installed field consumer built and passed real
  browser editing, native undo, multiline entry, submit and modal remount.
  Layout WASM, font JSON and PNG were fetched from the installed package with
  HTTP 200. No page error was recorded.
- The production catalogue passed field editing, modal focus return and value
  persistence after reopening. Provider READY/source identity and browser/page
  behavior are separate checks.

## Attempts and limits

The publish job reported success at 16:51:51 UTC. The exact registry version was
initially unavailable (including HTTP 404 at 16:54:18); it later resolved as
latest with the expected gitHead and integrity. The registry metadata records
0.7.0 at 16:55:00 UTC. No second publication, authentication change or registry
change was performed. The failed initial installation and later successful
checks are retained separately.

Additional local full-suite and isolated survey startup/resize failures remain
unresolved; see NATIVE_EDITING.md. A green CI run does not establish their cause
or repair. The publishing WebKit retry likewise remains a flaky observation.

The minimal consumer's existing Vite 7.3.5/esbuild development dependencies
reported advisories during lock verification. The follow-up keeps Vite 7 and
updates to Vite 7.3.7/esbuild 0.28.2; its subsequent npm audit reported zero
advisories. This changes the example toolchain, not the published SDK.

Real CJK IME, physical phone keyboards, screen readers, long-session editing
memory and hardware performance are unqualified. Only the U.S. desktop input
layout was enabled. The attempted VoiceOver smoke produced no usable spoken or
caption evidence and was restored to its original off state. Browser tests and
synthetic composition events do not fill those gaps.

Raw local logs, reports and screenshots are retained under
`/tmp/ludic-canvas-native-editing-release-2026-10-29/`. The earlier hardware
performance records remain unchanged.
