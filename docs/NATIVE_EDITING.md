# Native text editing

TextInput and TextArea are implemented in the source checkout with a pending
minor changeset. They are not included in npm 0.6.0. The work is based on
`4143a592d62de8121137db3f18255bc436a8c86a`; the implementation is prepared on the
`feat/native-text-fields` branch with a pending minor changeset. No npm publication or deployment is claimed.

## Ownership and rendering

- React owns field composition and application values. The existing four host
  primitives remain unchanged; the fields compose an internal editor-bearing View.
- Yoga owns the explicit field rectangle. WebGL draws its background, border
  and focus treatment. The native input/textarea draws text, placeholder, caret
  and selection both while focused and unfocused.
- Each root owns its editor manager, focus registry, accessible descriptions
  and listeners. Native editors replace the field's button mirror; they do not
  create a second focus stop. Destroying a field/root removes its native elements,
  aborts field listeners and releases imperative handles.
- Browser fonts are configured through `textStyle.fontFamily` and application CSS
  or FontFace loading. Atlas registration does not load a browser font, and native
  field script rendering does not establish canvas Text shaping/bidi support.

## Public contract

```tsx
const [name, setName] = useState('');
const editor = useRef<TextInputHandle>(null);

<TextInput
  ref={editor}
  id="player-name"
  label="Player name"
  value={name}
  onValueChange={setName}
  maxLength={40}
  style={{ width: 280, height: 44, background: '#243247' }}
  textStyle={{ fontFamily: 'system-ui', fontSize: 16, color: '#edf2ff' }}
/>;
```

Labels must be nonempty and values must remain strings. The default field width
is 100%; default heights are 44 pixels for TextInput and 120 for TextArea.
Size multiline fields explicitly; native resize is disabled. Field `style` controls
Yoga layout and WebGL decoration. `textStyle.padding` controls native content
inset (default 10 pixels); Yoga padding does not place native text. Root text scale
applies to native font size/tracking; line height is a unitless multiplier.

TextInput supports native text/search/password types; `inputMode` supplies a
keyboard hint. `maxLength` follows browser UTF-16 length semantics. Enter requests
`onSubmit` in a single-line field outside composition and modifier shortcuts;
TextArea Enter inserts a newline. Readonly fields remain focusable; disabled fields
do not. `error` sets aria-invalid and references a native accessible description.

After the first painted frame, refs expose focus(), blur() and select(). Focus
and select return false if unmounted, disabled, suspended or outside the active
modal. `ui.focus(id)` also finds fields. Focus reveals the field through Yoga
ScrollArea ancestors. Fields participate in this root's Tab order, nested modal
trapping and focus return. Editing keys remain native; Tab and non-composing
Escape participate in UI routing. Game capture listeners/polling remain
application-owned and must respect editor focus.

## Controlled values and composition

1. Native input events call onValueChange with the live string. The callback's
   React updates flush synchronously before value reconciliation. Update state
   directly; debounce persistence or expensive derived work separately.
2. Prop echoes do not assign element.value or selection. Unaccepted edits revert
   to the controlled value. External replacements preserve the current selection
   offsets clamped to the replacement length; they may reset native undo history.
3. During composition, report drafts and preserve the browser's live editor value.
   A changed external value differing from that draft is queued until composition
   ends and takes precedence over subsequent drafts. Do not transform drafts.
4. Compositionend reconciles the latest committed props even if no frame occurred
   since their update. Duplicate final input notifications do not duplicate the
   change callback. IME key events do not activate submit or Escape dismissal.

## Geometry and layering limits

The application continues to own the frame loop. Native boxes use the painter's
inherited translation, uniform scale, opacity and rectangular ancestor clips.
TextArea consumes its native wheel scroll before chaining to a Yoga scroller.
Background fields hide and disable when a modal takes ownership. Context loss or
a zero-size canvas hides/disables editors until painting resumes.

Use fields on topmost form panels/dialogs. DOM text is above the canvas: arbitrary
canvas sibling occlusion/interleaving, rotation/skew, rounded child clipping,
rich-text editing, intrinsic/autogrowing text layout and canvas-only captures of
native text are unsupported. A supplied accessibilityContainer must be aligned
with the canvas and permit visible native children. The field's browser font
metrics need not match its atlas font. Physical mobile viewport/keyboard behavior
requires device qualification; emulated viewports do not establish that behavior.

## Verification record — 2026-10-29

Node 24.22.1 on macOS; Playwright 1.64.1. The initial Chromium run passed five of
seven contracts. One failed before library loading: the retained trace shows
browser page creation stalled for over 30 seconds. Another used a visible-box
assertion on the deliberately zero-size semantic dialog group; the assertion
was corrected to attachment plus native-editor focus. A subsequent run passed
all 11 then-current editing/catalogue contracts with unchanged test deadlines.

The first Playwright startup also stopped at the documentation export audit:
the new public module had not yet been added to the API generator. Adding it
resolved that build phase. These were separate failures, not SDK startup fixes.

The initial package check passed types/build, 105 unit tests, generated docs/site,
public-boundary audit and independent packed consumers. The expanded browser run
adds actual Chromium clipboard paste/undo and zero-size suspension, plus existing
input, collection and modal regression contracts across the configured engines.
Final outcomes are recorded below.

Initial failure traces are preserved locally under
`/tmp/ludic-canvas-native-editing-2026-10-29/initial/`; generated artifacts are not
part of the npm package. Synthetic composition events test bridge state handling,
not a real OS IME. Clipboard permissions are acquired only in Chromium tests;
clipboard tests in other engines are explicitly skipped. Real IME, physical
iPhone/Android keyboards, screen readers, autofill/password managers and long
editing-session memory behavior have not been acquired by this implementation.

Two additional SDK regressions were reproduced before fixing them: re-entering a
previously emitted string after an external reset was incorrectly ignored, and
hiding a mounted field recreated its editor. The retained native-input comparison
then isolated undo loss to unnecessary semantic-group movement. Value tracking
now follows external resets, and hidden fields/groups remain mounted without
reordering live controls. The native comparison passed on all five configured
projects after the placement fix. Native undo is preserved for prop echoes;
external value replacement still follows the documented browser limits.

The expanded initial run was interrupted after revealing a missing Firefox 1555
binary and platform-specific Home-key assumptions. Firefox was installed using
the pinned Playwright CLI, and the caret test now establishes a caret position
explicitly before testing real typing. A later catalogue test pressed Save before
its DOM mirror became enabled; it now waits for that rendered state. No test
deadlines, motion settings or server ports were changed to address these cases.
All original failure traces and before/after logs remain under the local report
directory above.

### Final results

- SDK source-tree SHA-256: `56e7f95b5802461ebf586b4e95753eb8f9858438ff6ac0bf1f78aa331c0a02ba`
  (sorted `src/**/*.ts`/`*.tsx` paths and bytes, separated by NUL bytes).
- `npm run check`: passed the package build, typecheck, all 105 unit tests,
  generated documentation/site, public boundary audit and independent packed
  consumers. Packed checks now also require and import TextInput/TextArea and
  build an independent consumer containing both fields.
- The final focused browser command below passed **240** contracts with **10**
  explicit skips, no failures and no retries, in 2.6 minutes on the final SDK
  source. It includes new editing/catalogue behavior and existing runtime, scroll
  and VirtualList regression contracts across all five configured projects.
- The 10 skips are three clipboard tests outside Chromium, six touch-only tests in
  desktop configurations, and the existing mobile-WebKit wheel contract.
- `npm run format:check`, `git diff --check` and `npm pack --dry-run`: passed.
  The inspected local package has 0.6.0 metadata, 101 entries and 828,234 packed
  bytes; these are local build facts, not a new registry publication.
- Production-preview visual inspection passed at 1360 and 320 pixel viewports:
  both native values persisted through resizing, no page errors occurred and
  no horizontal document overflow was observed. Screenshots and logs remain
  in `/tmp/ludic-canvas-native-editing-2026-10-29/`.

```sh
npm run test:browser -- tests/browser/editing.spec.ts tests/browser/controls.spec.ts \
  tests/browser/runtime.spec.ts tests/browser/scroll.spec.ts tests/browser/virtual.spec.ts \
  --workers=1 --max-failures=1
```

The local preview is served at `http://127.0.0.1:6175/components/`; choose Edit
profile. This preview serves a local source build with 0.6.0 metadata,
not the registry artifact or a deployed revision. The pending minor changeset
prepares future versioning; publication was not performed.
