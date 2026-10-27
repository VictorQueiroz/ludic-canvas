export function productionGuide(code) {
  return `<p>Ludic Canvas is an interface layer for desktop and mobile browser games. Build HUDs, menus, inventory grids, dialogue panels, maps and settings by composing primitives. A general-purpose renderer does not automatically supply every widget, text system or engine adapter.</p>
<h3>Choose the right boundary</h3><table><thead><tr><th>Use case</th><th>Support and integration</th></tr></thead><tbody>
<tr><td>HUDs, menus, cards, meters, dialogue and maps</td><td>React composition, nested Yoga flex layouts, absolute positioning, four font faces, images, lines, transitions and rectangular scroll clipping.</td></tr>
<tr><td>Mouse, touch, keyboard and controllers</td><td>Pointer capture and bubbling events; press actions, hotkeys, modal focus scopes, DOM control semantics and spatial focus navigation. Your game polls its controller and maps actions to the root.</td></tr>
<tr><td>Sliders, toggles, tabs and drag interactions</td><td>Use the unstyled controlled components in the <a href="/components/">catalogue</a>, or compose custom pointer/key behavior from primitives. The game owns values, selection, inventory rules and persistence.</td></tr>
<tr><td>Chat entry, player names, IME and rich documents</td><td>Use native DOM inputs/dialogs alongside the canvas. Editable canvas text, bidi, GPOS positioning, ligature shaping, complex-script shaping and automatic emoji fallback are not implemented.</td></tr>
<tr><td>3D engines and WebGL 2</td><td>A transparent WebGL 1 overlay canvas is the portable integration. Shared WebGL 1 contexts are supported when the engine resets its state before its next pass. WebGL 2 contexts and native engine bindings are not supported.</td></tr>
<tr><td>Large collections and advanced visual effects</td><td>Paginate or virtualize lists in application components. The retained tree is traversed each frame. Rotation, skew, stencil masks, rounded child clipping, arbitrary shaders and 3D world-space UI are outside the current renderer.</td></tr>
</tbody></table>
<h3>Recovery and ownership</h3><p>The layout reactor uses ABI 2; custom layout URLs/bytes must match this package version. Prefer the bundled default, or update your deployed reactor when upgrading. Every root owns its Yoga instance, fonts, textures, input listeners, focus scope, caches and animation state. Destroy roots when scenes leave; use an AbortSignal for asynchronous setup and teardown. Two roots can coexist without a game singleton. A canvas accepts one root at a time, including across bundled copies.</p>${code(
    `const lifetime = new AbortController();
const ui = await createUI({
  canvas,
  signal: lifetime.signal,
  onError: reportError,
  onContextLost: () => showRecoveryNotice(),
  onContextRestored: () => hideRecoveryNotice(),
});
// When the scene leaves: cancels pending loads and destroys the root.
lifetime.abort();`,
    'typescript',
    'Scene lifecycle',
  )}
<p>Context loss suspends rendering and controls. Restoration rebuilds font textures and the GPU batch, preserves the React tree, and reloads visible image assets. Fonts retain their source blobs for recovery. If recovery fails, <code>onError</code> runs and the root remains suspended; the application can destroy and recreate it. A zero-sized canvas also suspends controls. Call <code>frame()</code> regularly when using a game-owned loop.</p>
<h3>Resource and text limits</h3><p>Defaults: 32 MiB per downloaded resource, 8192 pixels per uploaded image dimension (also capped by the GPU), four concurrent image tasks, 64 MiB combined font textures, and a soft 64 MiB image cache. Set <code>resourceLimits</code> and <code>textureBudgetBytes</code> for your target devices. Decoding can temporarily use additional browser memory; downloaded-byte limits do not bound decoder memory. Visible or explicitly preloaded images can exceed the soft cache budget. <code>FrameInfo.textureBytes</code> measures resident image textures, excluding fonts and browser overhead.</p><p>Failed images remain failed until <code>invalidateImages(ids)</code> clears them. Call it after replacing content or before retrying a failed request. Fetches use browser CORS rules. Texture uploads preserve bindings and pixel-store settings; a UI drawing pass intentionally changes other GL state. Draw UI last and reset engine state before the next pass.</p><p>Text uses build-time MSDF/MTSDF atlases and runtime glyph placement. Include all localized glyphs in the CLI configuration. Explicit ordered <code>fontFamily</code> chains select registered faces. Atlas pair kerning uses the selected face. Unknown glyphs use <code>?</code> and can trigger opt-in <code>onFontDiagnostic</code> reports. Long words break at codepoint boundaries; CRLF is normalized. Use <code>maxLines</code> with <code>textOverflow: 'ellipsis'</code> for labels, and <code>overflow: 'hidden'</code> for clipping. This is not a Unicode shaping engine. The text cache retains at most 2,000 layouts and 100,000 glyph quads; very large strings are not cached.</p><p>The font CLI reads each source with a 128 MiB cap, compiles one face at a time in a worker with a 120-second deadline, and locks the output directory against concurrent writers. A compiler failure preserves existing generated files. Output files are renamed individually; a power failure or filesystem error during publication can still interrupt a set. Generate into a build directory and deploy the complete build atomically. After a killed process, remove the named stale lock only after confirming no generator remains running.</p>
<h3>Release qualification</h3><p>CI runs Node tests and packed-package consumers on Linux, macOS and Windows, plus browser contracts on Chromium, Firefox and WebKit, with Android-sized Chromium and iPhone-sized WebKit emulation. Browser tests cover pixel alpha/orientation, inherited transforms, scrolling, modal keys/focus, custom pointer controls, context recovery, cleanup and a 1,000-node batch case. The draw-call check is a batching regression. Use the <a href="/performance/">performance lab</a> to acquire raw CPU frame-call, commit-latency and RAF-interval samples with explicit device/workload budgets. The lab does not measure GPU execution or memory.</p><p>For each game release, test representative scenes on physical target phones and desktops, including low-memory devices, browser zoom, orientation changes, screen readers, text scaling, background/resume and your engine's GL state reset. Mobile emulation does not certify Safari on an iPhone or Chrome on an Android device. Measure frame time and memory with your assets and scene complexity before setting a performance budget.</p><p>Changesets opens a version PR after changes merge to the default branch. npm publication occurs after that version PR merges and all checks pass, using trusted publishing and provenance. The API is still versioned below 1.0; pin compatible versions and review release notes.</p>`;
}

export function controlRecipes(code) {
  return `<p>The <a href="/components/">shared controlled components</a> provide common interaction mechanics without a visual theme. Use Dialog for pause menus, confirmations and inventory inspectors. The topmost dialog restricts this root's hotkeys, Tab order and spatial navigation, focuses its first control, and restores each scope's trigger when it closes. Your game separately controls simulation and its own global input bindings.</p>${code(
    `<Dialog label="Pause menu" open={paused} onOpenChange={setPaused}
  style={{ position: 'absolute', top: 0, left: 0,
  right: 0, bottom: 0, padding: 24, background: '#000000bb' }}>
  <Text style={{ fontSize: 28 }}>Paused</Text>
  <Button id="resume" label="Resume game" onPress={resume}>
    <Text>Resume game</Text>
  </Button>
</Dialog>`,
    'tsx',
    'Modal focus scope',
  )}
<p>Map controller edges to actions; poll the gamepad in the application loop, apply a dead zone and repeat delay, then call:</p>${code(
    `ui.navigate('down'); // up, down, left or right
ui.activateFocused();
ui.focus('resume');`,
    'typescript',
    'Controller adapter actions',
  )}
<p>Slider handles pointer capture/cancellation, step snapping, range clamping and keyboard adjustment. The application owns its value and draws the track/thumb through a render function. For custom drag controls, pointer events bubble in CSS pixels; local coordinates use the node's unscaled layout space. Clear drag state on <code>onPointerCancel</code>. <code>preventDefault()</code> disables built-in press/touch scrolling; <code>stopPropagation()</code> stops ancestor callbacks.</p>${code(
    `function Volume({ value, onChange }: {
  value: number; onChange: (value: number) => void;
}) {
  return <Slider id="volume" label="Volume" value={value}
    onValueChange={onChange} step={0.05}
    valueText={Math.round(value * 100) + '%'}
    style={{ width: 240, height: 44, justifyContent: 'center' }}>
    {({ ratio }) => <View fill={ratio} fillColor="#a6e5cf"
      style={{ height: 6, background: '#243247' }} />}
  </Slider>;
}`,
    'tsx',
    'A controlled slider',
  )}
<p>For text entry, open an application-owned native DOM dialog with a labelled input. Keep its value in the game's React/store state, then pass the result back into the canvas interface. This gives the browser responsibility for selection, copy/paste, mobile keyboards, IME and assistive technology. The library's mirror exposes interactive controls and announcements; static canvas text is not a complete accessible document. Provide a DOM alternative when the complete experience needs document semantics.</p>`;
}
