// "Two ways to spend 13 weeks": the cells pop in day by day when the figure scrolls into view; Replay runs it again.
const cal = document.querySelector('[data-cal]');

if (cal) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  cal.classList.add('cal--armed'); // only now do the cells start hidden, so a failed script never leaves them blank

  const play = () => cal.classList.add('is-play');
  if (reduced || !('IntersectionObserver' in window)) {
    play();
  } else {
    const io = new IntersectionObserver(
      (e) => {
        if (e[0].isIntersecting) { play(); io.disconnect(); }
      },
      { threshold: 0.3 }
    );
    io.observe(cal);
  }

  cal.querySelector('[data-cal-replay]')?.addEventListener('click', () => {
    cal.classList.remove('is-play');
    void cal.offsetWidth; // restart the CSS animations
    play();
  });
}
