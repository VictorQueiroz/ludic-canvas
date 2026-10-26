import { describe, expect, it } from 'vitest';
import { advanceSurvey, createSurvey, sites, terrainHeight } from '../examples/kestrel-survey/src/game.ts';
const tick = (game: ReturnType<typeof createSurvey>, seconds: number) => {
  for (let i = 0; i < seconds * 20; i++) game.tick(0.05);
  game.publish();
};
describe('Kestrel Survey simulation', () => {
  it('advances slow frames through bounded steps instead of slowing game time', () => {
    const game = createSurvey();
    game.setInput(1, 0);
    advanceSurvey(game, 0.2);
    expect(game.read().elapsed).toBeCloseTo(0.2);
    expect(game.read().distance).toBeCloseTo(1);
    advanceSurvey(game, 3);
    expect(game.read().elapsed).toBeCloseTo(0.45);
  });
  it('requires proximity before collecting a sample', () => {
    const game = createSurvey();
    game.scan();
    expect(game.read().scanning).toBe(false);
    expect(game.read().message).toContain('within 2.5');
  });
  it('navigates and collects all three samples through public actions', () => {
    const game = createSurvey();
    for (let i = 0; i < sites.length; i++) {
      game.select(i);
      game.navigate();
      tick(game, 12);
      expect(game.range()).toBeLessThan(0.31);
      game.scan();
      tick(game, 2);
      expect(game.getSnapshot().samples[i]).toBe(true);
    }
    expect(game.read().complete).toBe(true);
    expect(game.read().samples).toEqual([true, true, true]);
    const elapsed = game.read().elapsed;
    tick(game, 10);
    expect(game.read().elapsed).toBe(elapsed);
  });
  it('pauses simulation while camera preferences remain interactive', () => {
    const game = createSurvey();
    game.navigate();
    game.dialog('settings');
    tick(game, 2);
    expect(game.read().z).toBe(7);
    expect(game.read().elapsed).toBe(0);
    game.zoom(2);
    expect(game.read().zoom).toBe(1);
    game.dialog('none');
    tick(game, 1);
    expect(game.read().z).toBeLessThan(7);
  });
  it('manual movement cancels autopilot and scanning, with normalized diagonal speed', () => {
    const game = createSurvey();
    game.navigate();
    game.setInput(1, 1);
    game.tick(0.05);
    expect(game.read().destination).toBeUndefined();
    expect(game.read().distance).toBeCloseTo(0.25);
    expect(game.read().speed).toBeCloseTo(5);
  });
  it('boost consumes power and idle recharges it', () => {
    const game = createSurvey();
    game.setInput(1, 0, true);
    tick(game, 2);
    expect(game.read().speed).toBeCloseTo(8);
    const reserve = game.read().battery;
    game.setInput(0, 0);
    tick(game, 2);
    expect(game.read().battery).toBeGreaterThan(reserve);
  });
  it('bounds time steps and ignores invalid input', () => {
    const game = createSurvey();
    game.setInput(1, 0);
    game.tick(NaN);
    game.tick(-1);
    expect(game.read().elapsed).toBe(0);
    game.tick(100);
    expect(game.read().distance).toBeCloseTo(0.25);
    expect(Number.isFinite(terrainHeight(12, -4))).toBe(true);
  });
  it('keeps separate games independent and resets progress without losing preferences', () => {
    const game = createSurvey(),
      other = createSurvey();
    game.quality(true);
    game.zoom(0.8);
    game.setInput(1, 0);
    tick(game, 1);
    expect(other.read().x).toBe(0);
    game.reset();
    expect(game.read().x).toBe(0);
    expect(game.read().lowPower).toBe(true);
    expect(game.read().zoom).toBe(0.8);
    expect(game.read().samples).toEqual([false, false, false]);
  });
});
