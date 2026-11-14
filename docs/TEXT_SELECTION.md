# Browser text selection

Prepared 2026-11-14 from source baseline `b00e7098310969874f1769ef020095c5b0e8cb20`
(0.10.3). This implementation has not been published or deployed. Run
`npm run dev` and open `/selection/` for two independent
interactive roots and a paste target.

## Chromium research

Eleven questions were submitted directly to DeepWiki's public MCP endpoint for
`chromium/chromium`. Its index was insufficient for the requested core paths:
the answers repeatedly reported that the selection implementations were absent.
Those gaps are evidence limits, not verified Chromium behavior. The follow-up
therefore inspected the actual upstream source files. No Chromium code was
copied into this implementation.

The question/answer records are available through DeepWiki:

1. [Blink mouse selection](https://deepwiki.com/search/explain-blink-noneditable-text_3915411f-64fa-4073-b25c-2c9a10c14df3)
2. [Caret mapping and Unicode](https://deepwiki.com/search/how-does-chromium-map-pointer_ef100d89-95d2-4fcc-8a29-63c059e261f5)
3. [Cross-node boundaries](https://deepwiki.com/search/how-does-chromium-select-acros_27fcdec0-9065-43df-8ef9-4388974ea907)
4. [Keyboard and clipboard](https://deepwiki.com/search/how-do-chromium-noneditable-se_24931f29-7205-4263-9602-c1464ae15dff)
5. [Autoscroll and touch](https://deepwiki.com/search/explain-chromium-drag-selectio_df712f44-c733-4ad1-8b4e-22675cb21936)
6. [Highlight painting](https://deepwiki.com/search/explain-chromium-painting-sele_d61c93fa-9051-49f9-9ee0-12bb70c24e9f)
7. [Blink controller follow-up](https://deepwiki.com/search/in-thirdpartyblinkrenderercore_45911ca4-e416-4b5a-9a41-860a348a0e41)
8. [Selection modifier follow-up](https://deepwiki.com/search/in-thirdpartyblinkrenderercore_b6317635-3d6d-437f-8999-854602ab801d)
9. [Clipboard follow-up](https://deepwiki.com/search/in-thirdpartyblinkrenderercore_b0623ce7-dd94-4cb6-aaaa-42f754029e0c)
10. [Views UI labels](https://deepwiki.com/search/in-uiviewscontrolslabelcc-and_94ba33e5-f570-4a37-a0d7-909ca3efb014)
11. [Views versus Blink](https://deepwiki.com/search/in-uigfxrendertextcc-uigfxsele_21540403-8522-4a13-adcd-2d78fa428a25)

The primary-source findings used here:

- [Blink SelectionController](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/core/editing/selection_controller.cc):
  `HandleMousePressEvent` dispatches by click count; double click expands to a
  word and triple click to a paragraph. Dragging updates a directional selection
  from hit-test positions. Editable, selectable and activation boundaries affect
  whether selection starts. This is web content, distinct from native UI.
- [Views SelectionController](https://github.com/chromium/chromium/blob/main/ui/views/selection_controller.cc):
  a single primary press moves or extends the cursor, double click selects a
  word, and triple click selects the label. Word dragging preserves its initial
  word on direction reversal. A timer continues selection beyond the edge;
  release and capture loss stop it. Right-click policy is platform dependent.
- [Views Label](https://github.com/chromium/chromium/blob/main/ui/views/controls/label.cc):
  selection is an explicit label capability. Keyboard and context-menu commands
  support copy and select-all. Obscured labels cannot be selectable. Read-only
  labels do not implement a full editor's arrow-key or undo behavior.
- [Blink ClipboardCommands](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/core/editing/commands/clipboard_commands.cc):
  copying dispatches the DOM copy event before the default operation. Its default
  path serializes HTML and plain text separately from painting.

These links follow upstream `main`, acquired on the date above. Local raw answers
and source acquisitions are retained under `.local/text-selection/`; they are
not packaged or part of the public source change.

## Local contract

Font layout retains UTF-16 display offsets, advance cells (including spaces) and
line boxes alongside glyph quads. Soft wrapping does not insert newlines into
copied text. Selection uses advances rather than glyph ink; painting shares the
alignment, scaling, line metrics and clipping of the text.

Each browser root owns its selection manager. Anchor and extent stay directional,
with word/paragraph seeds retained while dragging. Runs follow React tree order
across Text elements. Frontmost surfaces and clipping constrain gesture starts.
Scroll-edge dragging uses the existing scroll writer. Native scroll tiles include
selection in their cache key.

`userSelect` accepts `auto`, `text`, `none` and `all`, inherited through CommonProps.
Plain text defaults to selectable; controls/editors are excluded unless a text
label explicitly opts in. Disabled and pointer-disabled subtrees remain excluded.
`all` selects eligible descendants of its policy owner atomically. Modal changes,
replacement text, unmount, suspension and destruction cancel stale selection and
pending gestures. Layout-only updates preserve offsets.

The adapter mirrors only the current selected string into a hidden root-owned
DOM node. Standard browser copy commands use this selection; the root's copy
handler writes plain text. Right click supplies Copy/Select all. Touch long press
supplies endpoint handles and copy controls. Destruction releases timers,
listeners, handles, menu, mirror and selected node references. Native fields keep
their existing selection and IME.

## Scope and evidence limits

This is Chromium-informed behavior for the current atlas renderer, not full
Blink/Views parity. It does not add complex shaping, bidi, vertical writing,
grapheme-aware line wrapping, text drag-and-drop, HTML clipboard data, native-host
selection or OS touch menus. Pointer offsets snap to Unicode graphemes with
browser Intl.Segmenter, but glyph layout keeps its documented limits. Multi-click
thresholds use 500 ms / 5 CSS pixels rather than an OS preference. Copy uses
displayed uppercase text, strips rich delimiters and omits maxLines-hidden
content. Distinct Text elements copy with newline separators. Virtualized content
is selectable only while mounted.

Physical touch devices, screen readers, native macOS and other browsers are not
qualified by a Windows Chrome software-rendering check. No hardware performance
claim is made. Existing performance acquisitions were not changed.

## Verification record

- The original baseline was reproduced without selectable advance geometry.
- Focused layout/text tests passed (7 tests); normal and DOM-free type checks
  passed during implementation.
- A real browser session confirmed word selection, glyph/background highlights,
  plain-text copy events, directional dragging and select-all.
- Initial demo testing caught a shared scroll handle; the fixture now creates
  one per root and waits for both roots' layout callbacks.
- Pinned Playwright Chromium downloads repeatedly timed out. Initial runner
  attempts failed before launch because executables were missing. A local
  alternate config uses installed Chrome 157.0.8103.51 without changing CI.
- Initial installed-Chrome attempts failed during fixture readiness and teardown.
  Traces showed rendered canvases and no SDK exception. The new test waits for its
  full rendered-state predicate within the normal test budget. Later connection
  refusals followed a tool-runtime reset that stopped session-owned dev servers;
  persistent hidden servers were started on the same ports.
- A broad Windows unit run completed with 130 passes, 23 failures and one skip.
  Failures were deadlines in font CLI, project initializer, qualification recorder
  and CI-policy fixtures, with some temporary-directory cleanup failures after
  deadlines. They have not been attributed to this patch or established as
  baseline failures. The full repository gate is not claimed to pass.

Final focused checks passed: 16 text/selection/portable unit tests, both typecheck
targets, package build, documentation generation/build, public-boundary audit,
formatting of all changed authored files, and `git diff --check`.

Browser acquisition required additional triage. Writing trace HTML inside the
unignored `.local` directory triggered Vite page reloads and enlarged dependency
scanning. Those task-owned trace directories were preserved outside the workspace,
under the Windows temporary directory. Concurrent runners also collided while
writing trace resources. Pinned Chromium Headless Shell 156.0.8078.4 / Playwright
1.64.1 was then installed using IPv4-first DNS; no dependency or CI image changed.

An installed-Chrome sweep passed six interaction cases before a trace-resource
collision during touch-case teardown. Independent browser interaction also
confirmed the exact word/paragraph/forward/reverse selected strings and copy-event
payload. Later pinned-browser attempts encountered context-teardown deadlines and
connection refusals after external test servers exited. The fixture now explicitly
destroys its roots after each case and the final attempt owned its Vite server.
That run still exceeded the normal test budget during interpolated mouse movement
and context teardown; native-editor isolation passed. It was interrupted after
three cases. SDK behavior, motion settings, browser ports and deadlines were not
changed to mask these results. Test output remains outside the watched workspace.

The nine-case browser suite is **not qualified as passing**. Trusted touch injection,
native tile selection, the real system clipboard command and the remaining final
sweep need a successful controlled rerun. The earlier synthetic-touch attempt
reported an inactive pointer-capture error; the test now uses trusted Chromium CDP
touch input rather than changing SDK pointer behavior for synthetic events. The
full unit gate's tooling failures and browser deadline causes remain unresolved.
Manual verification is available at the development `/selection/` page; this
record does not turn those acquisition limits into compatibility or speed claims.
