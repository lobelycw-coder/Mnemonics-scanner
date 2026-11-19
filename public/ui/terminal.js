const MAX = 200;   // hard DOM cap — thousands of rows kill mobile Safari

export function createTerminal(root, viewport) {
  const rows = [];
  let pinned = true;
  let queued = [];
  let frame = 0;

  viewport.addEventListener('scroll', () => {
    pinned = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 40;
  }, { passive: true });

  function flush() {
    frame = 0;
    if (!queued.length) return;
    const frag = document.createDocumentFragment();
    for (const r of queued) frag.append(build(r));
    root.append(frag);
    queued = [];

    while (root.childElementCount > MAX) root.firstElementChild.remove();
    if (pinned) viewport.scrollTop = viewport.scrollHeight;
  }

  function build(r) {
    const el = document.createElement('div');
    el.className = `row ${r.kind}`;
    const a = document.createElement('span');
    a.className = 'a';
    a.textContent = r.text;
    el.append(a);
    return el;
  }

  return {
    push(kind, text) {
      queued.push({ kind, text });
      if (!frame) frame = requestAnimationFrame(flush);   // one paint per frame
    },
    clear() { root.replaceChildren(); rows.length = 0; },
    pinned: () => pinned,
  };
}