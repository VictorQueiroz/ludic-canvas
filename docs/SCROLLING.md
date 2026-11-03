# Scroll ownership and observation

Create a handle once per scrolling region, for example with
`const [scroll] = useState(createScrollHandle)`, and pass it to
`<ScrollArea label="Inventory" scrollHandle={scroll}>`. Size the region explicitly.
Handles have no animation loop and may be created before a root exists. A handle
can attach to only one mounted region at a time, including across roots.

`scrollTo(offset)` and `scrollBy(delta)` queue finite offsets. The next application
frame clamps the command to the newly laid-out content. Negative offsets clamp to
zero. Commands before the first layout are queued; teardown disconnects the handle
and clears pending commands. A detached handle may be attached to a new region.

`getSnapshot()` returns a cached immutable object with `connected`, `mode`, `offset`,
`viewportWidth`, `viewportHeight`, `contentHeight` and `maxOffset`. Values are local
CSS pixels before visual transforms, independent of DPR. Resizing, wheel, touch,
focus reveal and programmatic commands all use the same layout and clamping.

`subscribe(listener)` is a synchronous external-store subscription and returns
an unsubscribe function. Listeners may read the snapshot; use React's
`useSyncExternalStore` for a component subscription. Application notifications can
instead use `onScroll`, coalesced asynchronously after the frame. Do not destroy
the root or reenter `frame()` inside a synchronous store listener.

An ordinary ScrollArea retains all its children. Clipping and scrolling alone do
not virtualize content or reduce the number of Yoga nodes.

## Browser-native presentation

Browser roots default to `scrollMode: 'auto'`. Supported ScrollAreas and
VirtualLists use actual DOM overflow containers containing bounded canvas tiles.
The browser owns touch dragging, momentum and elastic overscroll. Tiles are
painted from the same mounted HostNode tree and shared WebGL context/fonts;
there is no second React root, additional WebGL context or independent frame loop.
The existing semantic buttons own native clicks, focus and keyboard activation.
Root-owned control mirrors reset document button geometry constraints so minimum/
maximum sizes and transforms cannot move their Yoga-defined click/focus boxes.

The default support boundary is a topmost, unscaled scrolling region fully
inside a root-owned canvas. Shared engine contexts, nested scrollers/interior
clips, native editors, custom pointer/wheel handlers, overlapping foreground
content, hover-only targets without native controls, unlabeled pressables and unrepresentable browser extents retain canvas
scrolling. This avoids changing custom gesture ownership or editor lifetime.
The browser host uses native overscroll locally without chaining to the page.
Portable/native hosts retain their canvas/renderer scrolling path.

Set `scrollMode="canvas"` on a ScrollArea/VirtualList, or `scrollMode: 'canvas'`
on createUI, to preserve canvas presentation. A region can override its root's
default. `scrollMode="native"` requires a supported surface when it overflows;
unsupported arrangements report an error. `snapshot.mode` reports the actual
presentation after the latest layout and defaults to canvas while disconnected.

Browser offsets are sampled by the owning application frame. Programmatic,
focus and viewport-anchor commands update the native range before writing the
offset, and layout commands retain next-frame ordering. Raw elastic overscroll
is not echoed back as a clamped browser offset. Snapshots remain clamped logical
CSS pixels and may lag compositor motion between application frames.

Tile replay uses the existing root canvas as a temporary viewport and restores
its final drawing pass. Only prepared tiles plus bounded overscan are retained.
`nativeScrollBudgetBytes` defaults to 16 MiB per root for estimated RGBA tile
backing storage, separate from texture/font limits and excluding browser/GPU
overhead. If coverage cannot fit the budget, auto uses canvas presentation.
Very tall extents beyond the browser's scrollable-height limit also fall back.

`frame().nativeScroll` reports region/tile counts, estimated raster bytes, copied
tiles, copy-call time and native replay submissions for that frame. Total draw
calls and profiled submitted quads include replay. Call timing does not measure
GPU completion or presentation; zero retained surfaces does not prove memory
reclamation. Stopping automatic frames does not stop browser physics, so an
application must keep supplying frames to refresh content and virtual windows.
Prepared content can be exhausted during a long task or paused application.
