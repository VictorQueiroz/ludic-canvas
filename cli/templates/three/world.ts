import {
  BoxGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';

/** Three.js owns WebGL2. Ludic Canvas uses a separate transparent WebGL1 canvas. */
export function createWorld(canvas: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  const scene = new Scene();
  scene.background = new Color('#0b1d29');
  const camera = new PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(3.5, 2.2, 5);
  camera.lookAt(0, 0, 0);
  scene.add(new HemisphereLight('#ddf5ed', '#1b3848', 2.2));
  const light = new DirectionalLight('#ffffff', 3);
  light.position.set(4, 6, 3);
  scene.add(light);
  const geometry = new BoxGeometry(1.5, 1.5, 1.5);
  const material = new MeshStandardMaterial({ color: '#b4ecd5', roughness: 0.45 });
  const mesh = new Mesh(geometry, material);
  scene.add(mesh);
  let size = '';
  return {
    draw(elapsed: number, width: number, height: number) {
      if (width <= 0 || height <= 0 || renderer.getContext().isContextLost()) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const next = `${width}/${height}/${dpr}`;
      if (size !== next) {
        renderer.setPixelRatio(dpr);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        size = next;
      }
      mesh.rotation.set(elapsed * 0.25, elapsed * 0.5, 0);
      renderer.render(scene, camera);
    },
    destroy() {
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}
