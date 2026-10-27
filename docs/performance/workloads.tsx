import { useLayoutEffect, type ReactNode } from 'react';
import { ScrollArea, Text, View, type UIRoot } from 'ludic-canvas';

export const workloadVersion = '1';
export const workloads = ['static-hud', 'telemetry', 'inventory-scroll', 'responsive-layout'] as const;
export type Workload = (typeof workloads)[number];
export const workloadSizes = { 'static-hud': 96, telemetry: 48, 'inventory-scroll': 400, 'responsive-layout': 96 };

const family = ['interface', 'latin'] as const;
function Hud({ step, count }: { step: number; count: number }) {
  return (
    <View style={{ flex: 1, padding: 16, gap: 8, background: '#111c29' }}>
      <Text style={{ fontFamily: family, fontSize: 26 }}>Survey station / Café</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {Array.from({ length: count }, (_, i) => (
          <View key={i} style={{ width: 140, padding: 6, gap: 4, background: '#203347', borderRadius: 4 }}>
            <Text style={{ fontFamily: family, fontSize: 14 }}>{`Sector ${i + 1} · résumé`}</Text>
            <Text style={{ fontFamily: family, fontSize: 16 }}>{`Signal ${(i * 73 + step * 17) % 1000}`}</Text>
            <View
              fill={((i * 37 + step) % 100) / 100}
              fillColor="#a6d8c7"
              style={{ height: 3, background: '#344c60' }}
            />
          </View>
        ))}
      </View>
    </View>
  );
}
function Inventory() {
  return (
    <ScrollArea
      id="benchmark-inventory"
      label="Benchmark inventory"
      style={{ flex: 1, padding: 12, gap: 4, background: '#111c29' }}
    >
      {Array.from({ length: workloadSizes['inventory-scroll'] }, (_, i) => (
        <View
          key={i}
          id={`bench-item-${i}`}
          label={`Inventory item ${i + 1}`}
          onPress={() => {}}
          style={{
            height: 36,
            flexShrink: 0,
            flexDirection: 'row',
            gap: 12,
            alignItems: 'center',
            paddingX: 8,
            background: '#203347',
          }}
        >
          <Text style={{ fontFamily: family, fontSize: 16, width: 80 }}>{`#${i + 1}`}</Text>
          <Text style={{ fontFamily: family, fontSize: 16, flex: 1 }}>{`Café supplies ${(i * 73) % 1000}`}</Text>
        </View>
      ))}
    </ScrollArea>
  );
}
export function workloadElement(workload: Workload, step = 0) {
  return workload === 'inventory-scroll' ? <Inventory /> : <Hud step={step} count={workloadSizes[workload]} />;
}
function Commit({ children, done }: { children: ReactNode; done: () => void }) {
  useLayoutEffect(done, [done]);
  return children;
}
/** Measures scheduling through commit, separately from the subsequent Yoga/paint frame. */
export function renderCommitted(root: UIRoot, children: ReactNode, signal: AbortSignal): Promise<number> {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const finish = (error?: unknown) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      if (error) reject(error);
      else resolve(performance.now() - start);
    };
    const abort = () => finish(signal.reason ?? new Error('Benchmark stopped'));
    const timer = setTimeout(() => finish(new Error('React commit exceeded five seconds')), 5000);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    try {
      root.render(
        <Commit
          done={() => {
            finish();
          }}
        >
          {children}
        </Commit>,
      );
    } catch (error) {
      finish(error);
    }
  });
}
