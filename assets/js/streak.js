// Hero ribbon: a long ruler of days. It starts patchy, with a coral "Day 1" every time it restarts, then
// settles into an unbroken gold line that runs off the edge of the page. An illustration, not data.
// Canvas only; aria-hidden in the markup. Reduced-motion users get the finished ribbon, drawn once.
const canvas = document.querySelector('[data-streak]');

if (canvas && canvas.getContext) {
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;

  const GOLD = [255, 182, 39];
  const CORAL = [255, 106, 77];
  const BONE = [244, 240, 231];
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

  // Deterministic, so the ribbon looks the same on every load.
  const prng = (seed) => () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // 0 = missed, 1 = showed up, 2 = restart ("Day 1, again").
  const makeDays = (n) => {
    const rnd = prng(20261008);
    const turn = Math.floor(n * 0.37);
    const days = [];
    let i = 0;
    while (i < turn) {
      days.push(2); i++;                                   // a fresh start
      const len = 7 + Math.floor(rnd() * 6);               // it fades within a week or two
      for (let d = 1; d < len && i < turn; d++, i++) days.push(rnd() < 0.92 - d * 0.1 ? 1 : 0);
      const gap = 3 + Math.floor(rnd() * 5);               // then nothing, for a while
      for (let g = 0; g < gap && i < turn; g++, i++) days.push(0);
    }
    days.push(2); // the last Day 1
    while (days.length < n) days.push(rnd() < 0.935 ? 1 : 0); // off days happen; none becomes a restart
    return { days, turn: days.lastIndexOf(2) };
  };

  let W = 0, H = 0, dpr = 1, step = 12, tw = 5, days = [], turn = 0;
  let t0 = 0, raf = 0, visible = false, pointerX = -9999, pointerS = -9999;
  const INTRO = 2800;

  const layout = () => {
    const r = canvas.getBoundingClientRect();
    W = Math.round(r.width); H = Math.round(r.height);
    if (!W || !H) return;
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    step = clamp(Math.round(W / 105), 9, 15);
    tw = Math.max(3, Math.round(step * 0.4));
    const made = makeDays(Math.ceil(W / step) + 2);
    days = made.days; turn = made.turn;
  };

  const draw = (now) => {
    if (!W) return;
    const elapsed = reduced ? INTRO * 2 : now - t0;
    const intro = clamp(elapsed / INTRO, 0, 1);
    const reveal = ease(intro) * (W + step * 4);
    const base = H - 16;
    const maxH = H * 0.56; // leaves a band above the tallest tick for the ring and its label
    const labels = H >= 96; // on a short canvas (phones) the labels would collide with the rings
    const LABEL_Y = 13;
    const pulseX = reduced ? -9999 : ((now - t0 - INTRO * 0.6) / 5200 % 1) * (W * 1.5) - W * 0.2;
    ctx.clearRect(0, 0, W, H);

    // baseline
    const bl = ctx.createLinearGradient(0, 0, W, 0);
    bl.addColorStop(0, rgba(BONE, 0)); bl.addColorStop(0.06, rgba(BONE, 0.22)); bl.addColorStop(0.94, rgba(BONE, 0.22)); bl.addColorStop(1, rgba(BONE, 0));
    ctx.fillStyle = bl;
    ctx.fillRect(0, base + 7, Math.min(W, reveal), 1);

    ctx.font = '500 10px "JetBrains Mono", ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'alphabetic';

    for (let i = 0; i < days.length; i++) {
      const x = 8 + i * step;
      if (x > W + step) break;
      const age = (reveal - x) / 260; // each tick grows over ~260px of the sweep
      if (age <= 0) continue;
      const g = ease(age);
      const kind = days[i];
      const system = i >= turn;
      let h = kind === 0 ? H * 0.1 : kind === 2 ? maxH * 0.96 : maxH * (system ? 0.64 + 0.16 * Math.sin(i * 1.7) : 0.46 + 0.2 * Math.sin(i * 2.3));
      let col = kind === 2 ? (system ? GOLD : CORAL) : system ? GOLD : BONE;
      let alpha = kind === 0 ? 0.16 : system ? 0.95 : kind === 2 ? 0.95 : 0.5;

      // hover swell + travelling pulse (both tiny, both optional)
      const dx = Math.abs(x - pointerS);
      const swell = fine && !reduced && dx < 150 ? (1 - dx / 150) ** 2 : 0;
      const pulse = system && !reduced ? Math.max(0, 1 - Math.abs(x - pulseX) / 110) : 0;
      h = h * g * (1 + swell * 0.38 + pulse * 0.1);
      alpha = clamp(alpha + swell * 0.25 + pulse * 0.35, 0, 1);
      if (kind === 0 && swell) alpha += swell * 0.2;

      ctx.fillStyle = rgba(col, alpha);
      const r = Math.min(tw / 2, 3);
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, base - h, tw, h, r) : ctx.rect(x, base - h, tw, h);
      ctx.fill();

      if (kind === 2) {
        // the loop: a ring above every restart
        ctx.strokeStyle = rgba(col, alpha * g);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + tw / 2, base - h - 9 * g, 4.2, 0, Math.PI * 2);
        ctx.stroke();
        if (labels && g > 0.85 && x < W - 40) {
          ctx.fillStyle = rgba(col, 0.78 * g);
          ctx.fillText('DAY 1', x - 8, LABEL_Y);
        }
      } else if (system && labels && g > 0.85) {
        const n = i - turn + 1;
        if (n === 5 || (n > 5 && n % 20 === 0)) { // not Day 2: its label would sit on top of the gold Day 1
          ctx.fillStyle = rgba(GOLD, 0.62 * g);
          ctx.fillText('DAY ' + n, x - 8, LABEL_Y); // one fixed row of labels, clear of every tick
        }
      }
    }
  };

  const frame = (now) => {
    raf = 0;
    if (!visible) return;
    pointerS += (pointerX - pointerS) * 0.14;
    if (Math.abs(pointerX - pointerS) < 0.5) pointerS = pointerX;
    draw(now);
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (!raf && !reduced) { t0 = t0 || performance.now(); raf = requestAnimationFrame(frame); } };

  layout();
  const boot = () => { layout(); draw(performance.now()); };
  (document.fonts?.ready ?? Promise.resolve()).then(() => { if (reduced) boot(); });
  if (reduced) { boot(); }
  else {
    t0 = performance.now() + 450; // let the headline lead
    new IntersectionObserver((e) => {
      visible = e[0].isIntersecting;
      if (visible) start();
    }, { threshold: 0.01 }).observe(canvas);
  }

  new ResizeObserver(() => { const w = canvas.getBoundingClientRect().width; if (Math.round(w) !== W) { layout(); if (reduced) draw(0); } }).observe(canvas);

  if (fine && !reduced) {
    const hero = canvas.closest('.hero') || canvas;
    hero.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      pointerX = e.clientY > r.top - 140 ? e.clientX - r.left : -9999;
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { pointerX = -9999; });
  }
}
