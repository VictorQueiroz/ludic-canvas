const query = new URLSearchParams(location.search);
if (query.get('embed') === '1') {
  // Preserve embeds created before /play/ became the gallery.
  location.replace('/play/orbital-relay/?embed=1');
} else {
  const cards = [...document.querySelectorAll<HTMLButtonElement>('[data-game]')];
  let player = document.querySelector<HTMLIFrameElement>('#example-player')!;
  const viewer = document.querySelector<HTMLElement>('.example-viewer')!;
  const title = document.querySelector<HTMLElement>('#selected-example')!;
  const renderer = document.querySelector<HTMLElement>('#selected-renderer')!;
  const open = document.querySelector<HTMLAnchorElement>('#open-example')!;
  const announcement = document.querySelector<HTMLElement>('#example-announcement')!;
  const notes = [...document.querySelectorAll<HTMLElement>('[data-integration]')];
  const galleryReady = Promise.all([
    document.fonts.ready,
    ...[...document.querySelectorAll<HTMLImageElement>('.game-thumbnail img')].map((image) =>
      image.decode().catch(() => undefined),
    ),
  ]);
  let selected = '';
  let selection = 0;
  const select = (id: string | null, navigate: boolean) => {
    const requested = cards.find((item) => item.dataset.game === id);
    const card = requested ?? cards[0]!;
    const game = card.dataset.game!;
    if (game === selected) return;
    selected = game;
    const revision = ++selection;
    cards.forEach((item) => item.setAttribute('aria-pressed', String(item === card)));
    notes.forEach((item) => {
      item.hidden = item.dataset.integration !== game;
    });
    title.textContent = card.dataset.title!;
    renderer.textContent = card.dataset.renderer!;
    open.href = card.dataset.page!;
    player.title = `Play ${card.dataset.title}`;
    player.dataset.example = game;
    void galleryReady.then(() => {
      if (revision !== selection) return;
      if (requested && matchMedia('(max-width: 1100px)').matches) {
        // Reveal against settled gallery dimensions before starting the game.
        viewer.style.scrollMarginTop = `${document.querySelector('header')!.getBoundingClientRect().height + 12}px`;
        viewer.scrollIntoView({ block: 'start', behavior: 'instant' });
      }
      // A fresh frame loads its declared URL as its initial document. This
      // avoids blank-frame restoration on reload and extra child history.
      const next = player.cloneNode(false) as HTMLIFrameElement;
      // A fresh browsing-context name prevents an old blank history entry
      // from being matched to this newly created scene on a parent reload.
      next.name = `ludic-${game}-${crypto.randomUUID()}`;
      next.src = card.dataset.src!;
      player.replaceWith(next);
      player = next;
    });
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
