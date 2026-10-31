import { contract } from './contract.tsx';
import { YogaLayout } from '../../src/wasm/layout.ts';
export const run = (bytes: Uint8Array) => contract(() => YogaLayout.load(bytes));
