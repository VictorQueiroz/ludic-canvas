import type { FontSource } from 'ludic-canvas';
import atlas from './fonts/generated/display.png?url';
import metrics from './fonts/generated/display.json?url';

/** The interface module owns its face and atlas, without a global font registry. */
export const interfaceFont: FontSource = { name: 'display', atlas, metrics };
