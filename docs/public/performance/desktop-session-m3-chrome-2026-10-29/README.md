# Desktop session acquisition, 2026-10-29

This campaign uses the published `ludic-canvas@0.6.0` package in an independent
Kestrel Survey consumer. The runner verifies the registry tarball, committed
consumer lock and release source before acquiring. It uses installed, headed
Chrome in an isolated profile without software-GPU flags. The copied game is
instrumented for acquisition; original and instrumented hashes are in each
report. See [the protocol](../../../DEVICE_QUALIFICATION.md#desktop-acquisition).

## Completed active session

[Original report](desktop-m3-chrome-2026-10-29-complete.json.gz),
[checksum](desktop-m3-chrome-2026-10-29-complete.json.gz.sha256),
[final screenshot](desktop-m3-chrome-2026-10-29-complete.json.gz.png) and
[screenshot checksum](desktop-m3-chrome-2026-10-29-complete.json.gz.png.sha256)
are preserved without rewriting. Report SHA-256:
`8308186c0311bdc290ea576696e0899410fb8ec98f7794566aef983791e1916f`.

- Clean acquisition source: `7195d99c7a7317835c0d38dba6efa93807fff3fe`.
  Its SDK `src/` matches release 0.6.0.
- Artifact: npm 0.6.0, 821,884 bytes; the report retains its verified SHA-512
  integrity and release `gitHead`. Provenance was inspected as metadata, not
  independently signature-validated.
- Hardware: Apple M3, 8 GiB; macOS 26.6.2; installed Chrome 156.0.8078.73;
  ANGLE Metal Renderer: Apple M3.
- Acquisition: 2026-10-29T10:11:53.726Z through 10:42:36.085Z, including setup and
  a complete three-site survey before the timed session. Active acquisition was
  1,803.099 seconds. Viewports alternated 1280 × 720 and 960 × 720, at configured
  DPR 2, with normal game motion and the Three.js world renderer.
- Thirty mounted intervals, six destroy/remount cycles and final destruction;
  zero unhandled browser errors, zero dropped buffered samples and zero mirrors
  at all seven destruction checkpoints.

Timing below uses nearest-rank quantiles over `mounted-1` onward. The baseline
drain (which includes survey completion) and destruction drains are excluded.

| Observation                     | Samples |  Median |     p95 |  Maximum |
| ------------------------------- | ------: | ------: | ------: | -------: |
| CPU elapsed around `ui.frame()` | 106,526 |  1.4 ms |  2.3 ms | 139.5 ms |
| Positive RAF intervals          | 106,521 | 16.7 ms | 18.3 ms |   384 ms |

No performance acceptance budget was supplied. The maxima and wider RAF tail
are retained rather than discarded; this run does not attribute them to a
particular subsystem.

| Destruction checkpoint          | Used JS heap after GC (MiB) | DOM nodes | JS listeners | Mirrors |
| ------------------------------- | --------------------------: | --------: | -----------: | ------: |
| 5 minutes                       |                       6.325 |        38 |           28 |       0 |
| 10 minutes                      |                       6.545 |        39 |           28 |       0 |
| 15 minutes                      |                       6.655 |        40 |           28 |       0 |
| 20 minutes                      |                       6.761 |        41 |           28 |       0 |
| 25 minutes                      |                       6.865 |        42 |           28 |       0 |
| 30 minutes                      |                       6.952 |        43 |           28 |       0 |
| Final destruction after remount |                       7.112 |        44 |           28 |       0 |

Heap and node counts increased across settled destruction checkpoints. No heap
snapshot or retaining-path attribution was acquired, so this is an unresolved
observation, not proof of a leak or leak freedom. The report also retains
per-process RSS and CPU observations; RSS is not additive private memory.

The report status is `partial` despite completing the active 30-minute session.
It predates the recorder's explicit `backgroundResume` coverage field; its empty
visibility-event arrays are the original evidence that background recovery was
not observed. The limits below still apply.

## Preserved interruption

[Original interrupted report](interrupted/desktop-m3-chrome-2026-10-29.json.gz)
and its [original checksum](interrupted/desktop-m3-chrome-2026-10-29.json.gz.sha256)
are preserved byte for byte. SHA-256:
`94bd9c5c0734dc97850527f95469f1346806af0a1410918f1218aac4a29c8087`.

Source `369be2d9d77b336dc4b3a502b0dc167419a295b4` was clean and its SDK
`src/` matched release 0.6.0. The full three-site survey completed, but the
30-minute attempt stopped with `ENOSPC` while persisting a later checkpoint.
The last valid checkpoint is `mounted-7`, at 438,902.859292 ms (7.315 minutes).
The acquired report remains `incomplete`; no final status or later observations
were reconstructed. Its seven mounted intervals and one destroy checkpoint do
not establish a completed long session.

The recorder now checks free space and stages report/checksum bytes before
replacement. Its regression test injects a partial write followed by `ENOSPC`
and verifies that the previous report and checksum survive unchanged. An
intermediate restart stopped at the new free-space preflight before acquisition;
that refusal is not a game or SDK failure.

## Interpretation

CPU samples wrap `ui.frame()`; RAF intervals also include the normal Three.js
world renderer and browser scheduling. Forced GC/checkpoint diagnostics affect
timing. CDP heap, DOM/listener counts and OS process RSS are distinct observations;
RSS includes shared mappings and is not GPU allocation. No performance budget or
leak-attribution experiment was established. Tab backgrounding is not OS suspend.

This campaign is desktop-only. Physical phones and VoiceOver are explicitly
pending. One game/browser/hardware configuration does not qualify other games,
branded Safari, all desktop systems, complete accessibility or GPU memory.

Tab foreground switches did not produce hidden/visible events under Playwright's
default focus emulation. Two short isolated-Chrome diagnostic probes also failed
to observe hiding, including a probe disabling focus emulation and background
switches. No hidden state was forced or inferred. Background/resume therefore
remains unqualified. These probes ran during the active session; background
applications and system load were otherwise uncontrolled. This is an observation
of one interactive desktop workload, not an isolated timing comparison.
