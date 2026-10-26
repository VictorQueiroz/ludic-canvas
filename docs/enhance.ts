// Static documentation enhancements. Highlighted code remains readable without JS.
const feedback = document.createElement('p');
feedback.className = 'visually-hidden';
feedback.setAttribute('role', 'status');
document.body.append(feedback);

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-copy-code]')) {
  const pre = document.getElementById(button.getAttribute('aria-controls')!);
  const code = pre?.querySelector('code');
  if (!pre || !code) continue;
  button.hidden = false;
  let reset = 0;
  button.addEventListener('click', async () => {
    clearTimeout(reset);
    try {
      await navigator.clipboard.writeText(code.textContent ?? '');
      button.textContent = 'Copied';
      feedback.textContent = `${button.getAttribute('aria-label')?.replace(/^Copy /, '')} copied to clipboard.`;
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(code);
      selection?.removeAllRanges();
      selection?.addRange(range);
      pre.focus();
      button.textContent = 'Selected';
      feedback.textContent = 'Clipboard unavailable. Code selected; use your browser copy command.';
    }
    reset = window.setTimeout(() => {
      button.textContent = 'Copy';
    }, 2200);
  });
}

const small = matchMedia('(max-width: 680px)');
for (const toc of document.querySelectorAll<HTMLDetailsElement>('.page-toc')) {
  const update = () => {
    toc.open = !small.matches;
  };
  update();
  small.addEventListener('change', update);
  toc.addEventListener('click', (event) => {
    if (small.matches && (event.target as Element).closest('a')) toc.open = false;
  });
}

export {};
