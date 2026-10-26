import { debrisAt, STOPS, WORLD, type Game } from './game.ts';
import { gameLayout } from './layout.ts';

/** The host game's world renderer. Ludic Canvas remains an independent overlay. */
export function createWorld(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable');
  const stars = Array.from({ length: 170 }, (_, i) => ({
    x: ((i * 7919 + 327) % 1000) / 1000,
    y: ((i * 3571 + 113) % 1000) / 1000,
    size: i % 7 === 0 ? 1.6 : 0.7,
  }));
  return {
    draw(game: Game, width: number, height: number, reducedMotion: boolean) {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#091521';
      ctx.fillRect(0, 0, width, height);
      const { arena } = gameLayout(width, height);
      const flight = game.getFlight(),
        snapshot = game.getSnapshot();
      const glow = ctx.createRadialGradient(
        arena.x + arena.width * 0.8,
        arena.y + arena.height * 0.2,
        0,
        arena.x + arena.width * 0.8,
        arena.y + arena.height * 0.2,
        arena.width,
      );
      glow.addColorStop(0, '#193746');
      glow.addColorStop(0.65, '#0d1d2a');
      glow.addColorStop(1, '#091521');
      ctx.fillStyle = glow;
      ctx.fillRect(arena.x, arena.y, arena.width, arena.height);
      ctx.save();
      ctx.beginPath();
      ctx.rect(arena.x + 1, arena.y + 1, arena.width - 2, arena.height - 2);
      ctx.clip();
      for (const star of stars) {
        ctx.fillStyle = star.size > 1 ? '#bed7d4' : '#77909e';
        const drift = reducedMotion ? 0 : flight.elapsed * 0.0007;
        ctx.fillRect(
          arena.x + ((star.x + drift) % 1) * arena.width,
          arena.y + star.y * arena.height,
          star.size,
          star.size,
        );
      }
      ctx.strokeStyle = '#65838c16';
      ctx.lineWidth = 1;
      for (let i = 1; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo(arena.x + (i * arena.width) / 10, arena.y);
        ctx.lineTo(arena.x + (i * arena.width) / 10, arena.y + arena.height);
        ctx.stroke();
      }
      for (let i = 1; i < 7; i++) {
        ctx.beginPath();
        ctx.moveTo(arena.x, arena.y + (i * arena.height) / 7);
        ctx.lineTo(arena.x + arena.width, arena.y + (i * arena.height) / 7);
        ctx.stroke();
      }
      const sx = arena.width / WORLD.width,
        sy = arena.height / WORLD.height;
      const point = (x: number, y: number) => [arena.x + x * sx, arena.y + y * sy] as const;
      // A quiet planet on the edge of the map, behind the navigation markers.
      const [px, py] = point(970, 675),
        radius = Math.min(arena.width, arena.height) * 0.35;
      const planet = ctx.createRadialGradient(px - radius * 0.6, py - radius * 0.6, 0, px, py, radius);
      planet.addColorStop(0, '#4f6968');
      planet.addColorStop(0.5, '#273e48');
      planet.addColorStop(1, '#10202d');
      ctx.fillStyle = planet;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#9bc7b433';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (snapshot.target !== null) {
        const stop = STOPS[snapshot.target]!,
          [x, y] = point(flight.x, flight.y),
          [tx, ty] = point(stop.x, stop.y);
        ctx.strokeStyle = '#f4c77e7a';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 7]);
        ctx.lineDashOffset = reducedMotion ? 0 : -flight.elapsed * 12;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      for (const rock of debrisAt(flight.elapsed)) {
        const [x, y] = point(rock.x, rock.y),
          r = rock.radius * Math.min(sx, sy);
        ctx.beginPath();
        for (let i = 0; i < 7; i++) {
          const angle = (i / 7) * Math.PI * 2 + rock.phase,
            length = r * (i % 2 ? 1 : 0.82);
          const nx = x + Math.cos(angle) * length,
            ny = y + Math.sin(angle) * length;
          if (i === 0) ctx.moveTo(nx, ny);
          else ctx.lineTo(nx, ny);
        }
        ctx.closePath();
        ctx.fillStyle = '#3c4951';
        ctx.fill();
        ctx.strokeStyle = '#82949c';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#1d2d38';
        ctx.beginPath();
        ctx.arc(x + r * 0.2, y - r * 0.1, r * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const stop of STOPS) {
        const [x, y] = point(stop.x, stop.y),
          secured = snapshot.cargo.includes(stop.id) || snapshot.delivered.includes(stop.id);
        ctx.strokeStyle = secured ? '#41565e' : stop.color + '44';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(x, y, 36, 36, 0, 0, Math.PI * 2);
        ctx.stroke();
        if (snapshot.target === stop.id) {
          ctx.beginPath();
          ctx.ellipse(x, y, 43, 43, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      const [x, y] = point(flight.x, flight.y);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(Math.sin(flight.angle) * sy, Math.cos(flight.angle) * sx));
      if (snapshot.target !== null && snapshot.status === 'playing') {
        const length = snapshot.boost > 0 ? 28 : 16;
        ctx.fillStyle = '#8edbc355';
        ctx.beginPath();
        ctx.moveTo(-9, -5);
        ctx.lineTo(-9 - length, 0);
        ctx.lineTo(-9, 5);
        ctx.fill();
        ctx.fillStyle = '#b9f5d8';
        ctx.fillRect(-15, -2, 8, 4);
      }
      ctx.shadowBlur = reducedMotion ? 0 : 12;
      ctx.shadowColor = '#8edbc3';
      ctx.fillStyle = flight.hit > 0 ? '#ff9990' : '#e8f2e8';
      ctx.strokeStyle = '#8edbc3';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-9, -9);
      ctx.lineTo(-5, 0);
      ctx.lineTo(-9, 9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#244553';
      ctx.fillRect(-3, -2, 5, 4);
      ctx.restore();
      ctx.restore();
    },
  };
}
