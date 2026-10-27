# Collection acquisition, 2026-10-27

Original unformatted acquisition files and their SHA-256 checksums. Source:
`802b0d72292480e5ae71b026189b1c393996d901`, clean repository-source candidate carrying
0.5.0 package metadata before the release version bump. These are not measurements
of the published 0.5.0 package.

Hardware was verified with system_profiler: Mac15,12, Apple M3, 8 GB,
macOS 26.6.2 (25G83). Installed Chrome 156 reported ANGLE Metal / Apple M3. The
browser used an isolated headed profile, a 1710 × 930 viewport and DPR 2. Workload
canvases measured 960 × 540 CSS pixels. No software GPU flags were supplied.

All runs used collections-1, 20 warmup frames, 120 acquired frames per workload,
119 RAF intervals and five creation/teardown cycles. Timing acquisition alternated
forward/reverse/forward order. Profiling and tracing were disabled for run-1/2/3.
The separate diagnostic run enabled both; its timings are not acceptance evidence.

| Workload      | Nodes at completion | Run 1 p95 ms | Run 2 p95 ms | Run 3 p95 ms |
| ------------- | ------------------: | -----------: | -----------: | -----------: |
| retained-400  |                1202 |          4.8 |          5.0 |          4.7 |
| virtual-400   |                  60 |          2.2 |          3.4 |          2.7 |
| retained-4000 |               12002 |         54.5 |         49.9 |         49.4 |
| virtual-4000  |                  60 |          3.5 |          3.3 |          2.7 |
| virtual-40000 |                  60 |          2.6 |          3.1 |          2.5 |

Every virtualized workload met the supplied 4 ms CPU frame-call p95 budget in all
three unprofiled runs. Retained controls exceeded it. The diagnostic run recorded
51–63 mounted nodes for each virtualized size. All measured scroll offsets matched
their commands; runs reported zero errors/diagnostics and no remaining checked
accessibility surfaces after teardown.

The diagnostic trace contains 55,353 events and 1,286 CPU profile chunks. Load
`diagnostic.trace.json.gz` in Chrome DevTools Performance. Coarse stage means for
the retained 4,000-item case were 20.8 ms paint/submission and 23.9 ms input/mirror
synchronization under diagnostic instrumentation. These are wall-clock segments,
not isolated JavaScript or GPU execution measurements. Windowing removed most of
this retained-node work; no additional renderer rewrite was needed to meet this
collection budget on the reference machine.

Browser/process cache and background applications were uncontrolled. Application
dataset creation is outside render-to-commit timing; React element construction
and list indexing are inside it. Initial metadata/data memory remains linear in
item count. No heap/process/GPU memory or presentation measurement was acquired.
The 40,000-item case has no retained comparator. These UI-only microbenchmarks
do not qualify physical phones, screen readers or complete game frame budgets.
