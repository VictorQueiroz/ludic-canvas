/** Application-owned Canvas2D rendering. No library internals or game singleton. */
export function createWorld(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas2D is unavailable');
  return {
    draw(elapsed: number, width: number, height: number) {
      if (width <= 0 || height <= 0) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const pixelsX = Math.round(width * dpr),
        pixelsY = Math.round(height * dpr);
      if (canvas.width !== pixelsX) canvas.width = pixelsX;
      if (canvas.height !== pixelsY) canvas.height = pixelsY;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.fillStyle = '#0b1d29';
      context.fillRect(0, 0, width, height);
      context.strokeStyle = '#284751';
      for (let x = 0; x < width; x += 48) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }
      for (let y = 0; y < height; y += 48) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }
      const radius = Math.min(width, height) * 0.22;
      const x = width * 0.66 + Math.cos(elapsed) * radius;
      const y = height * 0.5 + Math.sin(elapsed) * radius;
      context.strokeStyle = '#8ddcc18a';
      context.beginPath();
      context.arc(width * 0.66, height * 0.5, radius, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = '#b4ecd5';
      context.beginPath();
      context.arc(x, y, 17, 0, Math.PI * 2);
      context.fill();
    },
    destroy() {
      context.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
