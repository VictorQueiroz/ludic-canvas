import { contract } from './contract.tsx';
import { NativeYogaLayout, type NativeLayoutBinding } from '../../src/platform/native-layout.ts';
declare const __ludicNative: NativeLayoutBinding;
const state = globalThis as typeof globalThis & { __ludicTestDone?: boolean };
contract(() => new NativeYogaLayout(__ludicNative)).then(
  (result) => {
    console.log(JSON.stringify(result));
    state.__ludicTestDone = true;
  },
  (error: unknown) => {
    console.error(String(error));
    state.__ludicTestDone = false;
  },
);
