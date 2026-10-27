/** Opt-in wall-clock measurements inside the runtime. Excludes root setup and asynchronous GPU execution. */
export interface FrameProfile {
  layoutMs: number;
  readLayoutMs: number;
  paintMs: number;
  inputMs: number;
  totalMs: number;
  mountedNodes: number;
  /** Nodes traversed for painting; clipping does not currently prune descendants. */
  paintedNodes: number;
  submittedQuads: number;
}
