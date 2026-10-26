import * as THREE from 'three';
import { sites, terrainHeight, type Marker, type SurveyState } from './game.ts';

/** Only the application knows about Three.js, cameras and world coordinates. */
export function createSurveyWorld(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor('#c5b69d');
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#c5b69d');
  scene.fog = new THREE.Fog('#c5b69d', 45, 110);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 180);
  scene.add(new THREE.HemisphereLight('#f6ead6', '#85775e', 2.3));
  const sun = new THREE.DirectionalLight('#fff0d0', 3.5);
  sun.position.set(-22, 32, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 35;
  sun.shadow.camera.bottom = -35;
  sun.shadow.camera.far = 100;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  const material = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
  const sand = material('#b79a70', { vertexColors: true, flatShading: true });
  const terrain = new THREE.PlaneGeometry(110, 110, 100, 100);
  terrain.rotateX(-Math.PI / 2);
  const positions = terrain.attributes.position!;
  const colors: number[] = [];
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      z = positions.getZ(i);
    positions.setY(i, terrainHeight(x, z));
    const light = 0.86 + Math.sin(x * 0.32 + z * 0.17) * 0.035 + Math.cos(x * 0.15 - z * 0.28) * 0.035;
    color.set('#d1b78b').multiplyScalar(light);
    colors.push(color.r, color.g, color.b);
  }
  terrain.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  terrain.computeVertexNormals();
  const ground = new THREE.Mesh(terrain, sand);
  ground.receiveShadow = true;
  scene.add(ground);
  const dark = material('#394441'),
    rubber = material('#25332f'),
    cream = material('#dfdfcb'),
    orange = material('#da6f3e'),
    metal = material('#6d827a', { metalness: 0.45, roughness: 0.45 });
  const mesh = (
    geometry: THREE.BufferGeometry,
    mat: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
    parent: THREE.Object3D = scene,
  ) => {
    const object = new THREE.Mesh(geometry, mat);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  };
  // Rocks and distant eroded spires frame the playable clearing.
  let seed = 7813;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const rockGeometry = new THREE.IcosahedronGeometry(1, 0);
  const rocks = new THREE.InstancedMesh(rockGeometry, material('#8d8067', { flatShading: true }), 95);
  const transform = new THREE.Object3D();
  for (let i = 0; i < 95; i++) {
    const angle = random() * Math.PI * 2,
      radius = 19 + random() * 30,
      x = Math.cos(angle) * radius,
      z = Math.sin(angle) * radius;
    transform.position.set(x, terrainHeight(x, z) + 0.3, z);
    transform.rotation.set(random(), random() * 6, random());
    const size = 0.35 + random() * 1.4;
    transform.scale.set(size, size * (0.5 + random()), size * 0.8);
    transform.updateMatrix();
    rocks.setMatrixAt(i, transform.matrix);
  }
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  scene.add(rocks);
  const ridgeMaterial = material('#b69b76', { flatShading: true });
  for (let i = 0; i < 15; i++) {
    const x = -38 + i * 5.5,
      z = -32 - random() * 9,
      h = 4 + random() * 10;
    const ridge = mesh(
      new THREE.ConeGeometry(4 + random() * 6, h, 5),
      ridgeMaterial,
      x,
      terrainHeight(x, z) + h / 2 - 1,
      z,
    );
    ridge.rotation.y = random() * 6;
  }
  // Small, application-owned autonomous rover, including six rolling wheels.
  const rover = new THREE.Group();
  scene.add(rover);
  mesh(new THREE.BoxGeometry(1.35, 0.28, 2.1), dark, 0, 0.68, 0, rover);
  mesh(new THREE.BoxGeometry(1.23, 0.55, 1.65), cream, 0, 1.05, -0.05, rover);
  mesh(new THREE.BoxGeometry(1.25, 0.13, 0.45), orange, 0, 1.37, -0.52, rover);
  mesh(new THREE.BoxGeometry(0.8, 0.24, 0.6), metal, 0, 1.45, 0.45, rover);
  const solar = mesh(
    new THREE.BoxGeometry(1.13, 0.04, 0.68),
    material('#314b52', { metalness: 0.3 }),
    0,
    1.62,
    0.45,
    rover,
  );
  solar.rotation.x = -0.1;
  for (let i = 0; i < 5; i++)
    mesh(new THREE.BoxGeometry(0.018, 0.01, 0.64), cream, -0.45 + i * 0.225, 1.65, 0.45, rover);
  const wheels: THREE.Mesh[] = [];
  for (const side of [-1, 1])
    for (const z of [-0.74, 0.04, 0.82]) {
      const wheel = mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.3, 12), rubber, side * 0.84, 0.45, z, rover);
      wheel.rotation.z = Math.PI / 2;
      wheels.push(wheel);
      const cap = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.32, 12), metal, side * 0.86, 0.45, z, rover);
      cap.rotation.z = Math.PI / 2;
      const axle = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 6), metal, side * 0.65, 0.65, z, rover);
      axle.rotation.z = side * 0.7;
    }
  mesh(new THREE.CylinderGeometry(0.045, 0.06, 1.3, 8), metal, 0.35, 1.93, -0.3, rover);
  const head = mesh(new THREE.BoxGeometry(0.52, 0.25, 0.24), cream, 0.35, 2.55, -0.3, rover);
  mesh(
    new THREE.CylinderGeometry(0.085, 0.085, 0.07, 12),
    material('#94ccc6', { emissive: '#72aaa5', emissiveIntensity: 0.3 }),
    0.1,
    0,
    0.15,
    head,
  ).rotation.x = Math.PI / 2;
  mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.05, 6), dark, -0.42, 1.97, 0.5, rover);
  mesh(new THREE.SphereGeometry(0.07, 8, 6), orange, -0.42, 2.52, 0.5, rover);
  const beaconRings: THREE.Mesh[] = [],
    crystals: THREE.Group[] = [];
  for (const [index, site] of sites.entries()) {
    const group = new THREE.Group();
    group.position.set(site.x, terrainHeight(site.x, site.z), site.z);
    scene.add(group);
    mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.18, 12), dark, 0, 0.12, 0, group);
    const crystal = new THREE.Group();
    group.add(crystal);
    crystals.push(crystal);
    const crystalMaterial = material(site.color, {
      emissive: site.color,
      emissiveIntensity: 0.12,
      flatShading: true,
      metalness: 0.1,
    });
    for (let j = 0; j < 5; j++) {
      const a = j * 2.4,
        h = 0.7 + ((j + index) % 3) * 0.45;
      const shard = mesh(
        new THREE.ConeGeometry(0.25, h, 5),
        crystalMaterial,
        Math.cos(a) * 0.6,
        h / 2 + 0.3,
        Math.sin(a) * 0.6,
        crystal,
      );
      shard.rotation.z = Math.cos(a) * 0.3;
    }
    const ring = mesh(
      new THREE.TorusGeometry(1.9, 0.035, 6, 48),
      new THREE.MeshBasicMaterial({ color: site.color, transparent: true, opacity: 0.65 }),
      0,
      0.22,
      0,
      group,
    );
    ring.rotation.x = -Math.PI / 2;
    beaconRings.push(ring);
    mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.8, 6), metal, 1.5, 1.5, 0.5, group);
    const flag = mesh(new THREE.BoxGeometry(0.8, 0.42, 0.025), cream, 1.88, 2.6, 0.5, group);
    flag.rotation.y = -0.25;
    for (let j = 0; j <= index; j++)
      mesh(new THREE.BoxGeometry(0.06, 0.21, 0.03), orange, -0.25 + j * 0.18, 0, 0.02, flag);
  }
  // A world-space guide line; all labels and controls are in the UI overlay.
  const routeGeometry = new THREE.BufferGeometry();
  routeGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(33 * 3), 3));
  const route = new THREE.Line(
    routeGeometry,
    new THREE.LineDashedMaterial({ color: '#f5e3b3', dashSize: 0.5, gapSize: 0.3, transparent: true, opacity: 0.7 }),
  );
  route.frustumCulled = false;
  scene.add(route);
  const dustGeometry = new THREE.BufferGeometry(),
    dustPositions = new Float32Array(100 * 3);
  for (let i = 0; i < 100; i++) {
    dustPositions[i * 3] = (random() - 0.5) * 65;
    dustPositions[i * 3 + 1] = 0.7 + random() * 4;
    dustPositions[i * 3 + 2] = (random() - 0.5) * 65;
  }
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({ color: '#f7e7c3', size: 0.06, transparent: true, opacity: 0.4 }),
  );
  scene.add(dust);
  let width = 1,
    height = 1,
    lastDpr = 0,
    ready = false,
    lost = false,
    disposed = false;
  const desired = new THREE.Vector3(),
    target = new THREE.Vector3(),
    projected = new THREE.Vector3(),
    ndc = new THREE.Vector2(),
    raycaster = new THREE.Raycaster();
  const events = new AbortController();
  canvas.addEventListener(
    'webglcontextlost',
    () => {
      lost = true;
    },
    { signal: events.signal },
  );
  canvas.addEventListener(
    'webglcontextrestored',
    () => {
      lost = false;
      ready = false;
    },
    { signal: events.signal },
  );
  return {
    draw(state: Readonly<SurveyState>, w: number, h: number, dt: number) {
      if (disposed || lost || w <= 0 || h <= 0) return;
      const dpr = state.lowPower ? 1 : Math.min(devicePixelRatio || 1, 1.5);
      if (width !== w || height !== h || lastDpr !== dpr) {
        width = w;
        height = h;
        lastDpr = dpr;
        renderer.setPixelRatio(dpr);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      renderer.shadowMap.enabled = !state.lowPower;
      dust.visible = !state.lowPower && !state.reducedMotion;
      rover.position.set(state.x, terrainHeight(state.x, state.z), state.z);
      rover.rotation.y = state.heading;
      const gradientX = terrainHeight(state.x + 0.5, state.z) - terrainHeight(state.x - 0.5, state.z);
      const gradientZ = terrainHeight(state.x, state.z + 0.5) - terrainHeight(state.x, state.z - 0.5);
      rover.rotation.z = -gradientX * 0.5;
      rover.rotation.x = gradientZ * 0.5;
      for (const wheel of wheels) wheel.rotation.x = state.distance / 0.37;
      for (const [index, ring] of beaconRings.entries()) {
        ring.visible = !state.samples[index];
        ring.scale.setScalar(index === state.selected ? 1.12 : 1);
        crystals[index]!.position.y = state.samples[index] ? -0.35 : 0;
      }
      const distance = state.overview ? 45 : 20 + state.zoom * 18;
      const aspectBoost = w / h < 0.75 ? 1.12 : 1;
      target.set(state.overview ? 1 : state.x, 0.8, state.overview ? -5 : state.z - 3);
      desired.set(
        target.x + Math.sin(state.yaw) * distance * aspectBoost,
        target.y + distance * 0.78,
        target.z + Math.cos(state.yaw) * distance * aspectBoost,
      );
      if (!ready || state.reducedMotion) camera.position.copy(desired);
      else camera.position.lerp(desired, 1 - Math.exp(-dt * 4));
      camera.lookAt(target);
      camera.updateMatrixWorld();
      ready = true;
      if (!state.reducedMotion) dust.position.x = Math.sin(state.elapsed * 0.1) * 2;
      route.visible = Boolean(state.destination);
      if (state.destination) {
        const position = routeGeometry.attributes.position!;
        for (let i = 0; i < 33; i++) {
          const t = i / 32,
            x = state.x + (state.destination.x - state.x) * t,
            z = state.z + (state.destination.z - state.z) * t;
          position.setXYZ(i, x, terrainHeight(x, z) + 0.14, z);
        }
        position.needsUpdate = true;
        route.computeLineDistances();
      }
      renderer.render(scene, camera);
    },
    project(): Marker[] {
      return sites.map((site, index) => {
        projected.set(site.x, terrainHeight(site.x, site.z) + 3.4, site.z).project(camera);
        return {
          index,
          x: (projected.x * 0.5 + 0.5) * width,
          y: (0.5 - projected.y * 0.5) * height,
          visible:
            ready &&
            !lost &&
            projected.z >= -1 &&
            projected.z <= 1 &&
            Math.abs(projected.x) < 0.98 &&
            Math.abs(projected.y) < 0.92,
        };
      });
    },
    pick(x: number, y: number) {
      if (!ready || lost) return;
      ndc.set((x / width) * 2 - 1, 1 - (y / height) * 2);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObject(ground, false)[0];
      return hit ? { x: hit.point.x, z: hit.point.z } : undefined;
    },
    get contextLost() {
      return lost;
    },
    get drawCalls() {
      return renderer.info.render.calls;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      events.abort();
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        const drawable = object as THREE.Mesh;
        if (drawable.geometry) geometries.add(drawable.geometry);
        if (drawable.material)
          for (const mat of Array.isArray(drawable.material) ? drawable.material : [drawable.material])
            materials.add(mat);
      });
      for (const geometry of geometries) geometry.dispose();
      for (const mat of materials) mat.dispose();
      sun.shadow.map?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
export type SurveyWorld = ReturnType<typeof createSurveyWorld>;
