import type { RenderContext } from '../platform/contracts.ts';

/** Stateless geometry/interaction pass. No resources, submissions or platform state. */
export const emptyRenderer: RenderContext = Object.freeze({
  drawCalls: 0,
  submittedQuads: 0,
  begin() {},
  end() {},
  dispose() {},
  setClip() {},
  rect() {},
  ring() {},
  gradient() {},
  image() {},
  glyph() {},
  glow() {},
  line() {},
});
