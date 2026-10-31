import { createContext, useContext } from 'react';
import type { UIRoot } from './platform/root-types.ts';

/** Internal provider; each createUI().render() supplies its own root. */
export const UIRootContext = createContext<UIRoot | undefined>(undefined);

/** Access the owning root inside a component rendered by createUI(). No global root is used. */
export function useUIRoot(): UIRoot {
  const root = useContext(UIRootContext);
  if (!root) throw new Error('useUIRoot must be used inside createUI().render()');
  return root;
}
