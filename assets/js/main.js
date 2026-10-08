// Site behaviour. Progressive enhancement only: every page works with this script blocked.
import { track } from './track.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.add('js-ready'); // tells the CSS the script is running (see the fail-safes in 60-v2.css)

/* ---- Analytics: see track.js ---------------------------------------------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-track]');
  if (el) track(el.dataset.track, { loc: el.dataset.loc || '', page: document.body.dataset.page || '' });
});

/* ---- Header: solid once scrolled ----------------------------------------- */
const header = $('[data-site-header]');
if (header) {
  const onScroll = () => header.classList.toggle('is-scrolled', scrollY > 24);
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });
}

/* ---- Mobile menu ---------------------------------------------------------- */
const toggle = $('[data-nav-toggle]');
if (toggle && header) {
  const setOpen = (open) => {
    header.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.documentElement.style.overflow = open ? 'hidden' : '';
  };
  toggle.addEventListener('click', () => setOpen(!header.classList.contains('is-open')));
  addEventListener('keydown', (e) => e.key === 'Escape' && setOpen(false));
  $$('.site-nav a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  matchMedia('(min-width: 901px)').addEventListener('change', (m) => m.matches && setOpen(false));
}

/* ---- Scroll reveal --------------------------------------------------------- */
const revealables = $$('[data-reveal]');
if (revealables.length) {
  if (reduced || !('IntersectionObserver' in window)) {
    revealables.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }),
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    revealables.forEach((el) => io.observe(el));
  }
}

/* ---- Ambient video: load near viewport, play only while visible ----------- */
const pickSource = (video) => {
  const s = $$('source[data-src]', video).find((x) => !x.media || matchMedia(x.media).matches);
  return s ? s.dataset.src : '';
};
const startVideo = (video) => {
  if (!video.dataset.loaded) {
    const src = pickSource(video);
    if (!src) return;
    video.src = src;
    video.dataset.loaded = '1';
    video.load();
  }
  if (!reduced) video.play().catch(() => {});
};
const videos = $$('video[data-ambient]');
if (videos.length && !reduced) {
  const vio = new IntersectionObserver(
    (entries) => entries.forEach((en) => (en.isIntersecting ? startVideo(en.target) : en.target.pause())),
    { rootMargin: '200px 0px' }
  );
  videos.forEach((v) => vio.observe(v));
  // Some browsers pause media when the tab is hidden; resume what is visible.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) videos.forEach((v) => v.dataset.loaded && v.getBoundingClientRect().bottom > 0 && v.getBoundingClientRect().top < innerHeight && v.play().catch(() => {}));
  });
}

/* ---- Sticky DM bar (phones): after the hero, hidden over the closing CTA --- */
const bar = $('[data-dm-bar]');
if (bar) {
  const btn = $('a', bar);
  let overCta = false;
  const update = () => {
    const show = scrollY > innerHeight * 0.75 && !overCta;
    bar.classList.toggle('is-visible', show);
    bar.setAttribute('aria-hidden', String(!show));
    btn.tabIndex = show ? 0 : -1;
  };
  addEventListener('scroll', update, { passive: true });
  const ctaTargets = $$('[data-final-cta], .site-footer');
  if (ctaTargets.length && 'IntersectionObserver' in window) {
    const seen = new Set();
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((en) => (en.isIntersecting ? seen.add(en.target) : seen.delete(en.target)));
      overCta = seen.size > 0;
      update();
    }, { threshold: 0.2 });
    ctaTargets.forEach((t) => obs.observe(t));
  }
  update();
}

/* ---- Story player: click to play, native controls once started --------------------- */
$$('[data-storycard]').forEach((card) => {
  const video = $('video', card);
  const btn = $('[data-story-play]', card);
  if (!video || !btn) return;
  btn.addEventListener('click', async () => {
    if (!video.src) video.src = video.dataset.src;
    video.controls = true;
    card.classList.add('is-playing');
    try {
      await video.play();
    } catch {
      // Some browsers refuse un-muted playback without a user gesture; retry muted rather than fail.
      try { video.muted = true; await video.play(); } catch { card.classList.remove('is-playing'); video.controls = false; }
    }
    track('story_play', { page: document.body.dataset.page || '' });
  });
  video.addEventListener('ended', () => { video.controls = false; card.classList.remove('is-playing'); video.currentTime = 0; });
  // Pause when scrolled away so a half-watched story doesn't keep decoding off-screen.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((en) => en.forEach((e) => { if (!e.isIntersecting && !video.paused) video.pause(); }), { threshold: 0.1 }).observe(video);
  }
});

/* ---- Page-specific modules, loaded only where used -------------------------- */
// They inherit this file's ?v= cache-buster, so a redeploy never mixes old and new scripts.
const V = new URL(import.meta.url).search;
const lazy = (name) => import(`./${name}.js${V}`).catch((err) => { console.warn(`[site] ${name}.js did not load`, err); return null; });
if ($('[data-week]')) lazy('week-widget');
if ($('[data-streak]')) lazy('streak');
if ($('[data-words]')) lazy('manifesto');
if ($('[data-cal]')) lazy('calendars');
if ($('[data-rail-page]')) lazy('rail');
if ($('[data-apply]')) lazy('apply').then((m) => { if (!m) $('[data-apply]').classList.add('is-failed'); }); // is-failed: show the plain DM link text
if ($('[data-readbar]')) lazy('readbar');
