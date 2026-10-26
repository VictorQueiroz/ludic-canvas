import { describe, expect, it } from 'vitest';
import { createGame, STOPS, type Game } from '../examples/orbital-relay/game.ts';

function flyTo(game: Game, id: number) {
  game.navigate(id);
  for (let i = 0; i < 400 && game.getSnapshot().target !== null; i++) game.tick(0.05);
  expect(game.getSnapshot().target).toBeNull();
}

describe('Orbital Relay simulation', () => {
  it('collects three different pods, unloads at Relay, wins, and can replay', () => {
    const game = createGame();
    game.navigate(0);
    expect(game.getSnapshot().target).toBeNull();
    game.start();
    for (const id of [0, 1, 2]) flyTo(game, id);
    expect(game.getSnapshot().cargo).toEqual([0, 1, 2]);
    expect(game.getSnapshot().status).toBe('playing');
    game.navigate(0);
    expect(game.getSnapshot().target).toBeNull();
    expect(game.getSnapshot().cargo).toHaveLength(3);
    flyTo(game, 3);
    expect(game.getSnapshot()).toMatchObject({ status: 'won', delivered: [0, 1, 2], cargo: [] });
    expect(game.getFlight()).toMatchObject({ x: STOPS[3].x, y: STOPS[3].y });
    game.start();
    expect(game.getSnapshot()).toMatchObject({
      status: 'playing',
      hull: 100,
      remaining: 120,
      delivered: [],
      cargo: [],
    });
  });

  it('freezes simulation and actions while paused, and resumes from the same position', () => {
    const game = createGame();
    game.start();
    game.navigate(0);
    game.tick(0.05);
    game.pause();
    const snapshot = { ...game.getSnapshot() },
      flight = { ...game.getFlight() };
    game.tick(3);
    game.navigate(1);
    game.boost();
    expect(game.getSnapshot()).toEqual(snapshot);
    expect(game.getFlight()).toEqual(flight);
    game.pause();
    game.tick(0.05);
    expect(game.getFlight().x).not.toBe(flight.x);
    expect(game.getSnapshot().remaining).toBeLessThan(snapshot.remaining);
  });

  it('boosts only in flight, cools down, and clamps suspended frame deltas', () => {
    const game = createGame();
    game.start();
    game.boost();
    expect(game.getSnapshot().boost).toBe(0);
    game.navigate(0);
    game.boost();
    game.tick(30);
    game.tick(0.05);
    expect(game.getSnapshot().remaining).toBeCloseTo(119.9);
    expect(game.getSnapshot().cooling).toBeCloseTo(7.9);
    const remaining = game.getSnapshot().boost;
    game.boost();
    expect(game.getSnapshot().boost).toBe(remaining);
    game.tick(Number.NaN);
    expect(Number.isFinite(game.getFlight().x)).toBe(true);
  });

  it('ends when the delivery window closes and isolates independent games', () => {
    const game = createGame(),
      other = createGame();
    game.start();
    for (let i = 0; i < 2500; i++) game.tick(0.05);
    expect(game.getSnapshot()).toMatchObject({ status: 'lost', remaining: 0 });
    expect(other.getSnapshot()).toMatchObject({ status: 'ready', remaining: 120 });
    game.navigate(0);
    expect(game.getSnapshot().target).toBeNull();
  });

  it('keeps previous snapshots immutable between notifications', () => {
    const game = createGame();
    game.start();
    const initial = game.getSnapshot();
    game.tick(0.05);
    expect(game.getSnapshot()).toBe(initial);
    game.tick(0.05);
    expect(game.getSnapshot()).not.toBe(initial);
    expect(initial.remaining).toBe(120);
    expect(game.getSnapshot().remaining).toBeCloseTo(119.9);
  });
});
