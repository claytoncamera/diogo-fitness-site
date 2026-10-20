// Site behaviour. Progressive enhancement only: every page works with this script blocked.
import { track } from './track.js?v=a5fa2226';
import { carryLabel } from './source.js?v=a5fa2226';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const saveData = Boolean(navigator.connection && navigator.connection.saveData); // Data Saver on: no background video (F-53)
document.documentElement.classList.add('js-ready'); // tells the CSS the script is running (see the fail-safes in 60-v2.css)

/* ---- Analytics: see track.js ---------------------------------------------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-track]');
  if (el) track(el.dataset.track, { loc: el.dataset.loc || '', page: document.body.dataset.page || '' });
});

/* ---- Source label (F-58), see source.js ---- */
carryLabel();

/* ---- Header: solid once scrolled ----------------------------------------- */
const header = $('[data-site-header]');
if (header) {
  const onScroll = () => header.classList.toggle('is-scrolled', scrollY > 24);
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });
}

/* ---- Mobile menu ---------------------------------------------------------- */
// While the full-screen menu is open, everything outside the header is inert, so Tab cannot reach links hidden behind
// it (WCAG 2.4.11, F-37); Escape closes it and puts focus back on the toggle.
const toggle = $('[data-nav-toggle]');
if (toggle && header) {
  let behind = [];
  const setOpen = (open) => {
    header.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.documentElement.style.overflow = open ? 'hidden' : '';
    behind.forEach((el) => { el.inert = false; });
    behind = open ? [...document.body.children].filter((el) => !el.contains(header) && !el.inert && el.tagName !== 'SCRIPT') : [];
    behind.forEach((el) => { el.inert = true; });
  };
  const isOpen = () => header.classList.contains('is-open');
  toggle.addEventListener('click', () => setOpen(!isOpen()));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) { setOpen(false); toggle.focus(); } });
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
  if (video.dataset.paused) return; // the visitor paused it with the section's pause button (below)
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
if (videos.length && !reduced && !saveData) {
  const vio = new IntersectionObserver(
    (entries) => entries.forEach((en) => (en.isIntersecting ? startVideo(en.target) : en.target.pause())),
    { rootMargin: '200px 0px' }
  );
  videos.forEach((v) => vio.observe(v));
  // Some browsers pause media when the tab is hidden; resume what is visible.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) videos.forEach((v) => v.dataset.loaded && !v.dataset.paused && v.getBoundingClientRect().bottom > 0 && v.getBoundingClientRect().top < innerHeight && v.play().catch(() => {}));
  });

  // Pause control (WCAG 2.2.2, SEO tracker F-37): the loops start on their own and never end, so each one gets a visible
  // button that pauses and restarts it. A video card (.media: Home pillars, the Coaching portrait) gets its own, in its
  // corner; a full-bleed background loop shares the button of the last card in its section, or else gets one in the
  // section's corner. Only made here, where the videos can play: without this script, or with reduced motion on, nobody
  // sees anything but the still poster. Nothing is stored.
  const SVG = (inner) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor">${inner}</svg>`;
  const PAUSE = SVG('<rect x="6.5" y="5" width="3.8" height="14" rx="1"/><rect x="13.7" y="5" width="3.8" height="14" rx="1"/>');
  const PLAY = SVG('<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/>');
  const groups = new Map(); // where the button goes → the videos it controls
  const cardOf = (v) => v.parentElement.closest('.media');
  videos.forEach((v) => cardOf(v) && groups.set(cardOf(v), [v]));
  videos.forEach((v) => {
    if (cardOf(v)) return;
    const section = v.closest('section') || v.parentElement;
    const host = [...groups.keys()].filter((c) => c.classList.contains('media') && section.contains(c)).pop() || section;
    groups.set(host, [...(groups.get(host) || []), v]);
  });
  groups.forEach((list, host) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn motion-btn';
    const what = list.length > 1 ? 'videos' : 'video';
    const render = (paused) => { btn.innerHTML = `${paused ? PLAY : PAUSE}<span class="sr-only">${paused ? 'Play' : 'Pause'} ${what}</span>`; };
    render(false);
    btn.addEventListener('click', () => {
      const pause = list.some((v) => !v.dataset.paused);
      list.forEach((v) => {
        if (pause) { v.dataset.paused = '1'; v.pause(); }
        else { delete v.dataset.paused; const r = v.getBoundingClientRect(); if (r.bottom > -200 && r.top < innerHeight + 200) startVideo(v); }
      });
      render(pause);
    });
    host.append(btn);
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
  const note = $('.storycard__label i', card);
  if (!video || !btn) return;
  const idle = note ? note.textContent : '';
  // While it plays the button is invisible, so it leaves the tab order and focus moves to the video and its native
  // controls; when it comes back, so does focus (WCAG 2.4.7, F-37).
  const reset = (msg) => {
    const hadFocus = card.contains(document.activeElement);
    video.controls = false;
    video.removeAttribute('tabindex');
    btn.inert = false;
    btn.removeAttribute('tabindex');
    card.classList.remove('is-playing');
    if (note) note.textContent = msg ?? idle;
    if (hadFocus) btn.focus({ preventScroll: true });
  };
  btn.addEventListener('click', async () => {
    if (!video.src || video.error) { video.src = video.dataset.src; video.load(); } // first play, or try again after an error
    video.controls = true;
    video.tabIndex = 0;
    card.classList.add('is-playing');
    if (note) note.textContent = idle;
    video.focus({ preventScroll: true });
    btn.tabIndex = -1; // for browsers without inert
    btn.inert = true;
    try {
      await video.play();
    } catch {
      // Some browsers refuse un-muted playback without a user gesture; retry muted rather than fail.
      try { video.muted = true; await video.play(); } catch { reset('Couldn’t play it. Tap to try again.'); }
    }
    track('story_play', { page: document.body.dataset.page || '' });
  });
  video.addEventListener('error', () => reset('Couldn’t load it. Tap to try again.'));
  video.addEventListener('ended', () => { reset(); video.currentTime = 0; });
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
if ($('[data-cal]')) lazy('calendars');
if ($('[data-apply]')) lazy('apply').then((m) => { if (!m) $('[data-apply]').classList.add('is-failed'); }); // is-failed: show the plain DM link text
if ($('[data-readbar]')) lazy('readbar');
