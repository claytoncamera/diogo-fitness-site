// Left-hand progress rail: one node per section marked [data-rail], filled as you scroll. Desktop only (CSS hides it below 1180px).
const sections = [...document.querySelectorAll('main [data-rail]')];

if (sections.length >= 3) {
  const mq = matchMedia('(min-width: 1180px)');
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  sections.forEach((s, i) => { if (!s.id) s.id = `rail-${i}`; });

  const nav = document.createElement('nav');
  nav.className = 'rail';
  nav.setAttribute('aria-label', 'Sections on this page');
  nav.innerHTML = `<div class="rail__track" aria-hidden="true"><i class="rail__fill"></i></div><ol class="rail__list">${sections
    .map((s, i) => `<li><a class="rail__link" href="#${esc(s.id)}" data-i="${i}"><span class="rail__dot" aria-hidden="true"></span><span class="rail__label">${esc(s.dataset.rail)}</span></a></li>`)
    .join('')}</ol>`;
  document.body.append(nav);

  const links = [...nav.querySelectorAll('.rail__link')];
  let active = -1;
  let ticking = false;

  const update = () => {
    ticking = false;
    if (!mq.matches) return;
    const vh = innerHeight;
    const line = vh * 0.42;
    let idx = 0;
    sections.forEach((s, i) => { if (s.getBoundingClientRect().top <= line) idx = i; });
    const r = sections[idx].getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (line - r.top) / Math.max(1, r.height)));
    const pos = Math.min(sections.length - 1, idx + frac);
    nav.style.setProperty('--p', (pos / (sections.length - 1)).toFixed(4));
    if (idx !== active) {
      links.forEach((a, i) => {
        a.classList.toggle('is-active', i === idx);
        a.classList.toggle('is-past', i < idx);
        if (i === idx) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
      });
      active = idx;
    }
    // Over a dark section the capsule keeps its own background, so nothing else to switch.
    nav.classList.toggle('is-ready', true);
  };

  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  mq.addEventListener('change', onScroll);
  update();
}
