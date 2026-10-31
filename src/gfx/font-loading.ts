import { fetchBytes } from '../resources.ts';
import { validateFontMetrics, type AtlasJson } from './font.ts';

export async function loadFontJson(
  url: string,
  options: { signal?: AbortSignal; maxBytes?: number } = {},
): Promise<AtlasJson> {
  const bytes = await fetchBytes(url, { ...options, label: 'Font metrics' });
  return validateFontMetrics(JSON.parse(new TextDecoder().decode(bytes)));
}
