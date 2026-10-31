import { Button, ScrollArea, Text, View, createUI, type UIWheelEvent } from 'ludic-canvas';

/** A Canvas 2D map and a WebGL sidebar. The application owns the camera and frame loop. */
export async function mountMapSidebar(stage: HTMLElement, mode: 'ui' | 'external', status: HTMLOutputElement) {
  const world = document.createElement('canvas');
  const canvas = document.createElement('canvas');
  for (const surface of [world, canvas]) {
    surface.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    stage.append(surface);
  }
  canvas.setAttribute('aria-label', 'Map with a scrolling sidebar');
  const context = world.getContext('2d')!;
  const ui = await createUI({ canvas, autoStart: false });
  const events = new AbortController();
  let zoom = 1,
    raf = 0,
    width = 0,
    height = 0;
  const changeZoom = (delta: number, deltaMode: number) => {
    // Camera sensitivity is application policy; UIWheelEvent preserves browser units.
    const pixels = delta * (deltaMode === 1 ? 32 : deltaMode === 2 ? height : 1);
    zoom = Math.max(0.5, Math.min(3, zoom * Math.exp(-pixels * 0.002)));
    status.value = `Map zoom: ${zoom.toFixed(2)}×`;
  };
  const onWheel = (event: UIWheelEvent) => {
    event.preventDefault();
    changeZoom(event.deltaY, event.deltaMode);
  };
  function render() {
    ui.render(
      <View pointerEvents="box-none" style={{ width, height }}>
        {mode === 'ui' && <View onWheel={onWheel} style={{ position: 'absolute', width, height }} />}
        <View
          block
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: 120,
            height,
            padding: 10,
            gap: 10,
            background: '#182b45',
          }}
        >
          <Text style={{ fontSize: 16, color: '#ffffff' }}>Waypoints</Text>
          <ScrollArea label="Map waypoints" style={{ height: 150, gap: 8 }}>
            {Array.from({ length: 12 }, (_, index) => (
              <Button
                key={index}
                label={`Waypoint ${index + 1}`}
                disabled={index === 2}
                onPress={() => changeZoom(-40, 0)}
                style={{ height: 36, flexShrink: 0, padding: 8, background: '#284968', borderRadius: 4 }}
              >
                <Text style={{ fontSize: 13 }}>{`Point ${index + 1}`}</Text>
              </Button>
            ))}
          </ScrollArea>
          <Button
            label="Reset map zoom"
            onPress={() => {
              zoom = 1;
              changeZoom(0, 0);
            }}
            style={{ height: 36, padding: 8, background: '#345b7d', borderRadius: 4 }}
          >
            <Text style={{ fontSize: 13 }}>Reset zoom</Text>
          </Button>
        </View>
      </View>,
    );
  }
  if (mode === 'external') {
    stage.addEventListener(
      'wheel',
      (event) => {
        if (ui.isPointerOverUI(event)) return;
        event.preventDefault();
        changeZoom(event.deltaY, event.deltaMode);
      },
      { passive: false, signal: events.signal },
    );
  }
  changeZoom(0, 0);
  function tick(now: number) {
    const rect = stage.getBoundingClientRect();
    if (width !== rect.width || height !== rect.height) {
      width = rect.width;
      height = rect.height;
      world.width = Math.round(width);
      world.height = Math.round(height);
      render();
    }
    context.fillStyle = '#0a1b2b';
    context.fillRect(0, 0, width, height);
    context.save();
    context.translate((width - 120) / 2, height / 2);
    context.scale(zoom, zoom);
    context.strokeStyle = '#28475b';
    for (let p = -600; p <= 600; p += 40) {
      context.beginPath();
      context.moveTo(p, -600);
      context.lineTo(p, 600);
      context.stroke();
      context.beginPath();
      context.moveTo(-600, p);
      context.lineTo(600, p);
      context.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      context.beginPath();
      context.arc(Math.cos(angle) * 65, Math.sin(angle) * 65, 12, 0, Math.PI * 2);
      context.fillStyle = i === 0 ? '#a9efc3' : '#518a9c';
      context.fill();
    }
    context.restore();
    ui.frame(now);
    stage.dataset.ready = 'true';
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(raf);
    events.abort();
    ui.destroy();
    world.remove();
    canvas.remove();
  };
}
