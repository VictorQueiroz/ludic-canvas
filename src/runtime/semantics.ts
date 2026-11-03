import { HostNode } from './nodes.ts';

export function labelOf(node: HostNode): string {
  const parts: string[] = [];
  const walk = (n: HostNode) => {
    if (n.type === 'text' && n.text) parts.push(n.text.replace(/\*\*/g, ''));
    for (const c of n.children) if (c instanceof HostNode) walk(c);
  };
  walk(node);
  return parts.join(' ').trim();
}
