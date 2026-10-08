// The manifesto sentence lights up word by word as you scroll through it (the section pins for a beat).
// Without JS, or with reduced motion, the sentence is simply fully visible.
const el = document.querySelector('[data-words]');

if (el) {
  const section = el.closest('.manifesto');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const words = [];

  const wrap = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) frag.append(part);
          else {
            const s = document.createElement('span');
            s.className = 'w';
            s.textContent = part;
            frag.append(s);
            words.push(s);
          }
        });
        node.replaceChild(frag, n);
      } else if (n.nodeType === 1) wrap(n);
    });
  };
  wrap(el);

  if (reduced || !words.length) {
    words.forEach((w) => w.classList.add('is-lit'));
  } else {
    section.classList.add('manifesto--pin');
    section.style.setProperty('--mp', '0');
    let lit = 0;
    let ticking = false;
    const update = () => {
      ticking = false;
      const r = section.getBoundingClientRect();
      const total = r.height - innerHeight;
      const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 1;
      const want = Math.min(words.length, Math.round(p * 1.15 * words.length));
      section.style.setProperty('--mp', Math.min(1, p * 1.12).toFixed(3));
      if (want === lit) return;
      for (let i = Math.min(lit, want); i < Math.max(lit, want); i++) words[i].classList.toggle('is-lit', i < want);
      lit = want;
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll, { passive: true });
    update();
  }
}
