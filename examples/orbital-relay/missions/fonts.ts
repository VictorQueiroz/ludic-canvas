import type { FontSource } from 'ludic-canvas';
import atlas from './fonts/generated/telemetry.png?url';
import metrics from './fonts/generated/telemetry.json?url';

/** Mission telemetry has an independent font configuration and build output. */
export const telemetryFont: FontSource = { name: 'telemetry', atlas, metrics };
