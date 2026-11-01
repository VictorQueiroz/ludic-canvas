import { existsSync } from 'node:fs';

if (
  existsSync('.git') &&
  process.env.NODE_ENV !== 'production' &&
  process.env.CI !== 'true' &&
  process.env.HUSKY !== '0'
) {
  const husky = (await import('husky')).default;
  const error = husky();
  if (error) throw new Error(error);
}
