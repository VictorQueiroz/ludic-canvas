import type { FontSource } from 'ludic-canvas';
import atlas from './fonts/generated/interface.png?url';
import metrics from './fonts/generated/interface.json?url';

// Vite gives these files deployment-relative URLs, including under a URL prefix.
export const interfaceFont: FontSource = { name: 'interface', atlas, metrics };
