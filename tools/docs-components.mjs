export function componentsPage(code, version) {
  const pending = Number(version.split('.')[1]) < 4;
  const editingPending = Number(version.split('.')[0]) === 0 && Number(version.split('.')[1]) < 7;
  return `<section class="controls-intro"><p class="eyebrow">COMPONENTS / BEHAVIOR WITHOUT A VISUAL THEME</p><h1>The mechanics are shared.<br>The identity is yours.</h1><p class="lead">Controlled buttons, switches, sliders, tabs, dialogs, scroll areas and native text fields. The same components below take on two different appearances, with independent state and focus.</p>${pending ? '<p class="component-release">These controls and the project initializer arrive in 0.4.0. Until npm publication, use a tarball built from main.</p>' : ''}</section>
<div class="controls-toolbar" role="group" aria-label="Component preview options"><label><input type="checkbox" id="controls-disabled"> Disable controls</label><label><input type="checkbox" id="controls-text"> Larger text</label><label><input type="checkbox" id="controls-motion"> Reduce motion</label><span>Try Tab, arrows, Home, End and Escape.</span></div>
<div class="controls-previews"><section class="control-preview" id="lab-night" aria-label="Night shift component preview"><div class="control-preview-heading"><span class="eyebrow">01 / NIGHT SHIFT</span><h2>Technical. Luminous. Direct.</h2></div><div class="control-surface"><canvas id="controls-night" aria-label="Night shift controls"></canvas><p class="control-loading" role="status">Preparing the controls...</p></div><p class="control-frame-stats" id="stats-night">Initializing renderer</p></section><section class="control-preview" id="lab-field" aria-label="Field notes component preview"><div class="control-preview-heading"><span class="eyebrow">02 / FIELD NOTES</span><h2>Warm. Tactile. Deliberate.</h2></div><div class="control-surface"><canvas id="controls-field" aria-label="Field notes controls"></canvas><p class="control-loading" role="status">Preparing the controls...</p></div><p class="control-frame-stats" id="stats-field">Initializing renderer</p></section></div>
<section class="controls-guide" id="composition"><p class="eyebrow">ONE CONTRACT / YOUR DESIGN</p><h2>State flows in. Requests flow out.</h2><p>These are React components built from the four primitives. They do not install a theme or keep a second copy of your game state. A change callback asks the owner to update the next prop. Plain text belongs inside <code>Text</code>; use children or render functions to compose any appearance.</p>${code(
    `import { useState } from 'react';
import { Button, Switch, Slider, Text, View } from 'ludic-canvas';

function Settings() {
  const [hints, setHints] = useState(true);
  const [volume, setVolume] = useState(0.5);
  return <View style={{ gap: 16 }}>
    <Switch label="Navigation hints" checked={hints}
      onCheckedChange={setHints} style={{ padding: 12 }}>
      <Text>{hints ? 'Hints on' : 'Hints off'}</Text>
    </Switch>
    <Slider label="Volume" value={volume} onValueChange={setVolume}
      style={{ width: 240, height: 44, justifyContent: 'center' }}>
      {({ ratio }) => <View fill={ratio} fillColor="#a6e5cf"
        style={{ height: 6, background: '#28483f' }} />}
    </Slider>
    <Button label="Save settings" onPress={() => save({ hints, volume })}
      style={{ padding: 16, background: '#28483f' }}>
      <Text>Save settings</Text>
    </Button>
  </View>;
}`,
    'tsx',
    'Controlled settings (save is your application action)',
  )}
<div class="component-contracts"><article><h3>Button and Switch</h3><p>Pointer activation, Enter and Space use the same callback. Disabled controls block activation. A switch reports its checked state to assistive technology. Supply your own layout, hover/press styles and content.</p><a href="/api/#SwitchProps">Switch API →</a></article><article><h3>Slider</h3><p>A horizontal slider owns primary-pointer capture, cancellation, min/max clamping and step snapping. Arrows change one step, Page Up/Down ten steps, and Home/End the endpoints. Its render function receives value, ratio and dragging. Cancellation never calls <code>onValueCommit</code>.</p><a href="/api/#SliderProps">Slider API →</a></article><article><h3>Tabs and Tab</h3><p>Tabs groups controlled Tab components into one keyboard Tab stop. Arrows activate and focus adjacent enabled entries; Home/End jump to the ends. Choose horizontal or vertical navigation. Render the corresponding content from your controlled value; this component does not create tab panels.</p><a href="/api/#TabsProps">Tabs API →</a></article><article><h3>Dialog</h3><p>The owner controls <code>open</code>. While visible, the topmost dialog isolates background input, traps Tab and requests Escape dismissal. Closing restores focus. Style the scrim and compose a panel and close button yourself. Disable Escape dismissal for a mandatory briefing or result screen.</p><a href="/api/#DialogProps">Dialog API →</a></article><article><h3>ScrollArea</h3><p>A named vertical scroll region with wheel/touch scrolling and automatic reveal of focused controls. Give it a constrained height and content that can exceed it. Rendering remains eager; this is not a virtualized list.</p><a href="/api/#ScrollAreaProps">ScrollArea API →</a></article><article><h3>TextInput and TextArea</h3><p>Choose Edit profile in either preview to try single-line and multiline native editing inside a scrolling dialog. Yoga positions the box and WebGL decorates it; native controls draw text, selection and caret. Fields share root-local focus and modal isolation. ${editingPending ? 'Native fields are unreleased in npm 0.6.0.' : ''}</p><a href="/guide/#text-entry">Native editing guide →</a></article><article><h3>VirtualList</h3><p>A bounded window for fixed-height single-select collections. Stable keys preserve logical focus and selection; typed handles scroll and focus distant items through the owning game loop. Rows support custom visual layouts, disabled states and logical position/size metadata.</p><a href="/guide/#virtualization">Collection guide →</a></article><article><h3>useUIRoot</h3><p>Components can focus a stable control identifier through their owning root. Every <code>createUI().render()</code> supplies its own React context. The two previews deliberately reuse control identifiers while retaining separate focus and resource ownership.</p><a href="/api/#useUIRoot">Root hook API →</a></article></div>
<h2>Compose a modal without coupling it to the game.</h2>${code(
    `const [open, setOpen] = useState(false);

<Dialog label="Pause menu" open={open} onOpenChange={setOpen}
  style={{ background: '#10201be6', justifyContent: 'center', alignItems: 'center' }}>
  <View style={{ width: 280, padding: 24, gap: 16, background: '#28483f' }}>
    <Text>Take a moment.</Text>
    <Button label="Resume game" onPress={() => setOpen(false)}>
      <Text>Resume</Text>
    </Button>
  </View>
</Dialog>`,
    'tsx',
    'Application-controlled dialog',
  )}
<p>The dialog manages UI input. Your application decides whether opening it also pauses simulation, audio or networking. Set comfortable touch targets, provide labels, and test your finished interface with real assistive technology. Static text still has the <a href="/guide/#production">documented accessibility and typography limits</a>.</p>
<div class="controls-next"><div><h2>Put the controls in your game.</h2><p>Both playable examples use these components with their own design systems. The initializer gives you a smaller starting point.</p></div><a class="button secondary" href="/play/">Explore the games →</a><a class="button primary" href="/guide/#project-init">Create a project →</a></div></section>`;
}
