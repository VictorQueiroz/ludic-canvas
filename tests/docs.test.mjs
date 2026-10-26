import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCodeRenderer } from '../tools/docs-code.mjs';

let renderer;
beforeAll(async () => {
  renderer = await createCodeRenderer();
});
afterAll(() => renderer.dispose());

describe('documentation code blocks', () => {
  it('highlights syntax at build time and preserves copyable code exactly', () => {
    const source = 'const label = "<canvas> & coins &lt; &#x3C;";\n\n// café\nconsole.log(label);';
    const html = renderer.code(source, 'typescript', 'src/main.ts');
    expect(html).toContain('class="shiki');
    expect(html).toMatch(/style="color:#[A-Fa-f0-9]+"/);
    expect(html).toContain('tabindex="0"');
    const text = html
      .match(/<code>([\s\S]*?)<\/code>/)[1]
      .replace(/<[^>]+>/g, '')
      .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity) => {
        if (entity.startsWith('#'))
          return String.fromCodePoint(
            entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1)),
          );
        return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[entity];
      });
    expect(text).toBe(source);
    expect(html).toContain('Copy src/main.ts code');
    expect(html).not.toContain('<script');
  });

  it.each(['tsx', 'typescript', 'json', 'html', 'bash'])(
    'labels %s and gives each block its own control target',
    (lang) => {
      const first = renderer.code('sample', lang);
      const second = renderer.code('sample', lang);
      expect(first).toContain(`data-language="${lang}"`);
      expect(first.match(/aria-controls="([^"]+)"/)[1]).not.toBe(second.match(/aria-controls="([^"]+)"/)[1]);
      expect(first).toContain('data-copy-code');
    },
  );

  it('rejects unspecified grammars instead of silently mislabeling code', () => {
    expect(() => renderer.code('sample', 'not-a-language')).toThrow('Unsupported documentation language');
  });
});
