export function editingGuide(code, version) {
  const pending = Number(version.split('.')[0]) === 0 && Number(version.split('.')[1]) < 7;
  return `${pending ? '<p><strong>Unreleased:</strong> native fields are available in this source checkout and its local tarball, not npm 0.6.0.</p>' : ''}
<p><code>TextInput</code> and <code>TextArea</code> combine a Yoga box and WebGL decoration with a persistent native DOM editor. The browser draws field text, placeholder, caret and selection while focused and unfocused. Its editing, direction and fonts are independent of the canvas atlas renderer.</p>${code(
    `const [name, setName] = useState('');
const [notes, setNotes] = useState('');

<TextInput label="Player name" value={name} onValueChange={setName}
  placeholder="Enter your name" maxLength={40}
  style={{ width: 280, height: 44, background: '#243247' }}
  textStyle={{ fontFamily: 'system-ui', fontSize: 16, color: '#edf2ff' }} />
<TextArea label="Notes" value={notes} onValueChange={setNotes}
  style={{ width: 280, height: 120, background: '#243247' }} />`,
    'tsx',
    'Controlled native fields',
  )}<p>Update the string synchronously from <code>onValueChange</code>; debounce persistence or expensive derived work separately. Unaccepted edits revert to the controlled value. Native input callbacks flush their React updates before reconciling the value; prop echoes do not rewrite the DOM value, preserving selection and native undo. During IME composition, drafts are reported without replacing the editor value. An external value differing from the live draft is deferred until composition ends and takes precedence over later drafts. Do not transform composing text. <code>onSubmit</code> requests single-line Enter submission outside composition; Enter inserts a newline in TextArea.</p>
<p>Fields share this root's Tab order, controller focus, modal trapping/restoration and focus-driven scroll reveal. Editing keys stay with the browser; Tab and non-composing Escape participate in UI focus/dialog behavior. Global game capture listeners must respect UI focus. Native fields have one labelled accessible element; <code>error</code> attaches an error description and <code>aria-invalid</code>. Static canvas text retains its existing accessibility limits.</p>
<p>Use a nonzero Yoga box. Defaults are 100% width and heights of 44/120 pixels. <code>style</code> lays out/decorates the field; <code>textStyle.padding</code> controls native content inset (default 10 pixels). Yoga padding does not place editor text. Native font size, tracking and line height follow root text scaling. Supply CSS/FontFace fonts through your application; registering an atlas does not register a native font. Native script rendering does not add shaping or bidi to canvas Text.</p>
<p>A <code>ref</code> exposes <code>focus()</code>, <code>blur()</code> and <code>select()</code> after the first painted frame. Focus/select return false when unavailable or outside the active modal. <code>ui.focus(id)</code> also supports fields. Unmount and root destruction remove editors, descriptions, callbacks and handles. Context loss or zero-sized canvas suspension disables and hides them until painting resumes.</p>
<p><strong>Layering boundary:</strong> use fields in topmost form panels or dialogs. DOM field text is above the canvas; arbitrary interleaving with canvas siblings, rotation/skew, canvas-only screenshots and rich-text editing are unsupported. Fields follow inherited translation, uniform scale, opacity and rectangular scroll clips; background fields hide while another modal owns input. Keep the canvas and its overlay container aligned; custom <code>accessibilityContainer</code> integrations must provide the same origin and dimensions. Continue calling the application-owned frame loop during viewport/keyboard changes.</p>
<p>The <a href="/components/">catalogue's Edit profile dialog</a> demonstrates both fields in two independent roots. See <a href="https://github.com/VictorQueiroz/ludic-canvas/blob/main/docs/NATIVE_EDITING.md">the editing contract and qualification record</a>. Synthetic composition and mobile emulation do not establish real IME, phone-keyboard or screen-reader qualification.</p>`;
}
