import { createHighlighter } from 'shiki';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

const labels = { tsx: 'TSX', typescript: 'TypeScript', json: 'JSON', html: 'HTML', bash: 'Shell' };
export const escapeHtml = (source) =>
  source.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

/** All grammar work happens in the documentation build, with no browser dependency. */
export async function createCodeRenderer() {
  const highlighter = await createHighlighter({
    themes: ['github-dark-default'],
    langs: Object.keys(labels),
    engine: createJavaScriptRegexEngine(),
  });
  let nextId = 0;
  return {
    code(source, lang = 'tsx', title = '') {
      if (!labels[lang]) throw new Error(`Unsupported documentation language: ${lang}`);
      const id = `code-${++nextId}`;
      const name = title || labels[lang];
      const html = highlighter
        .codeToHtml(source.trim(), { lang, theme: 'github-dark-default' })
        .replace('<pre ', `<pre id="${id}" aria-labelledby="${id}-caption" `);
      return `<figure class="code-block" data-language="${lang}"><figcaption><span id="${id}-caption" class="code-title">${escapeHtml(name)}</span><span class="code-actions">${title ? `<span class="code-language">${labels[lang]}</span>` : ''}<button type="button" data-copy-code aria-controls="${id}" aria-label="Copy ${escapeHtml(name)} code" hidden>Copy</button></span></figcaption>${html}</figure>`;
    },
    dispose: () => highlighter.dispose(),
  };
}
