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

`getSnapshot()` returns a cached immutable object with `connected`, `offset`,
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
