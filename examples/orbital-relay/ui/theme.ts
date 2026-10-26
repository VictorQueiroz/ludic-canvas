import type { ViewStyle } from 'ludic-canvas';
export const colors = {
  text: '#f1f3eb',
  muted: '#9daebd',
  mint: '#8edbc3',
  gold: '#f4c77e',
  line: '#344853',
  panel: '#101f2deb',
};
export const panel: ViewStyle = {
  background: colors.panel,
  borderWidth: 1,
  borderColor: colors.line,
  borderRadius: 10,
  padding: 16,
  gap: 12,
};
