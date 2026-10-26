const query = new URLSearchParams(location.search);
if (query.get('embed') === '1') {
  // Preserve embeds created before /play/ became the gallery.
  location.replace('/play/orbital-relay/?embed=1');
} else {
  const cards = [...document.querySelectorAll<HTMLButtonElement>('[data-game]')];
  const player = document.querySelector<HTMLIFrameElement>('#example-player')!;
  const viewer = document.querySelector<HTMLElement>('.example-viewer')!;
  const title = document.querySelector<HTMLElement>('#selected-example')!;
  const renderer = document.querySelector<HTMLElement>('#selected-renderer')!;
  const open = document.querySelector<HTMLAnchorElement>('#open-example')!;
  const announcement = document.querySelector<HTMLElement>('#example-announcement')!;
  const notes = [...document.querySelectorAll<HTMLElement>('[data-integration]')];
  let selected = '';
  const select = (id: string | null, navigate: boolean) => {
    const requested = cards.find((item) => item.dataset.game === id);
    const card = requested ?? cards[0]!;
    const game = card.dataset.game!;
    if (game === selected) return;
    selected = game;
    cards.forEach((item) => item.setAttribute('aria-pressed', String(item === card)));
    notes.forEach((item) => {
      item.hidden = item.dataset.integration !== game;
    });
    title.textContent = card.dataset.title!;
    renderer.textContent = card.dataset.renderer!;
    open.href = card.dataset.page!;
    player.title = `Play ${card.dataset.title}`;
    player.dataset.example = game;
    if (requested && matchMedia('(max-width: 1100px)').matches) {
      // Explicit mobile selections should reveal the game before its first frame.
      viewer.style.scrollMarginTop = `${document.querySelector('header')!.getBoundingClientRect().height + 12}px`;
      viewer.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
    // The gallery owns Back/Forward; game changes must not add iframe history entries.
    player.contentWindow!.location.replace(new URL(card.dataset.src!, location.href).href);
    announcement.textContent = `${card.dataset.title} selected.`;
    if (navigate) {
      const url = new URL(location.href);
      url.searchParams.set('example', game);
      history.pushState(null, '', url);
    }
  };
  cards.forEach((card) => card.addEventListener('click', () => select(card.dataset.game!, true)));
  window.addEventListener('popstate', () => select(new URLSearchParams(location.search).get('example'), false));
  select(query.get('example'), false);
}
