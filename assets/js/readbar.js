// Slim reading-progress line under the header on article pages.
const bar = document.querySelector('[data-readbar] i');
const body = document.querySelector('.article .prose');

if (bar && body) {
  let ticking = false;
  const update = () => {
    ticking = false;
    const r = body.getBoundingClientRect();
    const total = r.height - innerHeight * 0.55;
    const p = total > 0 ? Math.min(1, Math.max(0, (innerHeight * 0.3 - r.top) / total)) : 0;
    bar.style.transform = `scaleX(${p.toFixed(4)})`;
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  update();
}
