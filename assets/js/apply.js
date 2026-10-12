// The Apply flow: one question at a time, ending as a message the visitor sends to Diogo themselves.
// Everything happens in the browser. Nothing is sent, stored or kept (no localStorage, no cookies, no network).
import { track } from './track.js?v=a3f2170b';

const root = document.querySelector('[data-apply]');

if (root) {
  const $ = (sel, scope = root) => scope.querySelector(sel);
  const $$ = (sel, scope = root) => [...scope.querySelectorAll(sel)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const keyword = root.dataset.keyword || 'TRANSFORM';
  const direct = root.dataset.direct || '';
  const form = $('[data-apply-form]');
  const steps = $$('[data-step]', form);
  const order = steps.map((s) => s.dataset.step); // intro, name, goal, …, extra, review, done
  const QUESTIONS = order.filter((k) => !['intro', 'review', 'done'].includes(k));
  const top = $('[data-apply-top]');
  const bar = $$('li', $('[data-apply-bar]'));
  const count = $('[data-apply-count]');
  const nav = $('[data-apply-nav]');
  const back = $('[data-apply-back]');
  const next = $('[data-apply-next]');
  const nextLabel = $('[data-apply-next-label]');
  const need = $('[data-apply-need]');
  const msgEl = $('[data-apply-msg]');
  const charsEl = $('[data-apply-chars]');

  let idx = 0;
  let started = false;
  let message = '';

  /* ---- reading the answers ------------------------------------------------------------------ */
  const el = (name) => form.elements[name];
  const val = (name) => (el(name)?.value || '').replace(/\s+/g, ' ').trim();
  const vals = (name) => $$(`input[name="${name}"]:checked`, form).map((i) => i.value);
  const answered = (key) => (['goal', 'falls', 'days'].includes(key) ? vals(key).length > 0 : val(key).length > 0);

  const build = () => {
    const lines = [keyword, '', val('name') ? `Hi Diogo, it’s ${val('name')}.` : 'Hi Diogo.', ''];
    const goals = vals('goal');
    if (goals.length) lines.push(`Goal: ${goals.join(', ')}`);
    if (val('tried')) lines.push(`What I’ve tried: ${val('tried')}`);
    const falls = vals('falls');
    if (falls.length) lines.push(`Where it falls apart: ${falls.join(', ')}`);
    const [days] = vals('days');
    if (days) lines.push(`Days I could realistically train: ${days}`);
    if (val('different')) lines.push(`What would make this time different: ${val('different')}`);
    if (val('extra')) lines.push(`Also: ${val('extra')}`);
    return lines.join('\n');
  };

  /* ---- showing a step ------------------------------------------------------------------------ */
  const pad = (n) => String(n).padStart(2, '0');

  const updateNav = () => {
    const key = order[idx];
    const isQ = QUESTIONS.includes(key);
    const required = steps[idx].hasAttribute('data-required');
    const has = isQ && answered(key);
    nav.hidden = !isQ;
    if (!isQ) return;
    const last = key === QUESTIONS[QUESTIONS.length - 1];
    next.disabled = required && !has;
    nextLabel.textContent = required || has ? (last ? 'Review' : 'Next') : 'Skip';
    next.classList.toggle('btn--sun', required || has);
    next.classList.toggle('btn--ghost', !(required || has));
    need.textContent = required && !has ? 'Pick at least one to continue.' : '';
  };

  const updateProgress = () => {
    const key = order[idx];
    const qi = QUESTIONS.indexOf(key);
    const inFlow = qi >= 0 || key === 'review' || key === 'done';
    top.hidden = !inFlow;
    bar.forEach((li, i) => {
      li.classList.toggle('is-done', qi < 0 ? inFlow : i < qi);
      li.classList.toggle('is-now', i === qi);
    });
    count.textContent = qi >= 0 ? `${pad(qi + 1)} / ${pad(QUESTIONS.length)}` : key === 'review' ? 'Review' : key === 'done' ? 'Done' : '';
  };

  const focusStep = (step, key) => {
    const field = $('input[type="text"], textarea', step);
    if (field && QUESTIONS.includes(key)) {
      // Opening the keyboard on a phone is the point of a text question; chips just get the heading read out.
      field.focus({ preventScroll: true });
    } else {
      const h = $('.aq, h1', step);
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }
  };

  const keepInView = () => {
    const r = root.getBoundingClientRect();
    if (r.top < -8 || r.top > innerHeight * 0.4) scrollTo({ top: scrollY + r.top - 4, behavior: reduced ? 'auto' : 'smooth' });
  };

  const show = (to, { focus = true } = {}) => {
    const dir = to >= idx ? 'fwd' : 'back';
    idx = Math.max(0, Math.min(order.length - 1, to));
    const key = order[idx];
    root.dataset.dir = dir;
    steps.forEach((s, i) => {
      const on = i === idx;
      s.hidden = !on;
      s.classList.toggle('is-active', on);
    });
    if (key === 'review') {
      message = build();
      msgEl.textContent = message;
      charsEl.textContent = message.length;
    }
    updateProgress();
    updateNav();
    const hint = $('[data-apply-scroll]');
    if (hint) hint.hidden = key !== 'intro';
    if (focus) { keepInView(); focusStep(steps[idx], key); }
    if (key !== 'intro') track('apply_step', { step: key });
  };

  /* ---- moves --------------------------------------------------------------------------------- */
  // Every forward move adds a history entry (same URL, no storage), so a phone's Back gesture steps back
  // through the questions instead of throwing the whole application away.
  const go = (to, opts) => { history.pushState({ apply: to }, ''); show(to, opts); };
  const start = () => {
    if (!started) { started = true; track('apply_start'); }
    go(1);
  };
  const goNext = () => {
    const key = order[idx];
    if (key === 'intro') return start();
    if (!QUESTIONS.includes(key)) return;
    if (steps[idx].hasAttribute('data-required') && !answered(key)) return;
    go(idx + 1);
  };
  let stepping = false;
  const goBack = () => {
    if (idx <= 0 || stepping) return;
    stepping = true; // history.back() is asynchronous; a second quick tap must not leave the page
    history.back();
    setTimeout(() => { stepping = false; }, 450);
  };
  addEventListener('popstate', (e) => {
    stepping = false;
    const to = e.state && typeof e.state.apply === 'number' ? e.state.apply : 0;
    if (to !== idx) show(to);
  });

  /* ---- copy + open --------------------------------------------------------------------------- */
  const copyText = async (text) => {
    // Synchronous copy first: it still counts as part of the click, in every browser.
    const before = document.activeElement;
    try {
      const ta = Object.assign(document.createElement('textarea'), { value: text });
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;font-size:16px'; // 16px: iOS zooms smaller inputs on focus
      document.body.append(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      ta.remove();
      if (before && before !== document.body && document.contains(before)) before.focus({ preventScroll: true });
      if (ok) return true;
    } catch { /* fall through to the async API */ }
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };

  const finish = (ok, opened) => {
    const manual = $('[data-apply-manual]');
    manual.hidden = ok;
    if (!ok) {
      const t = $('[data-apply-manual-text]');
      t.value = message;
      requestAnimationFrame(() => { t.focus({ preventScroll: true }); t.select(); });
    }
    const lead = $('[data-apply-done-lead]');
    if (lead) {
      lead.textContent = ok
        ? opened
          ? 'Your message is copied and Instagram is open in a new tab. Paste it into the chat and press send.'
          : 'Your message is copied. Open Instagram, paste it into the chat with Diogo and press send.'
        : opened
          ? 'Instagram is open in a new tab, but your browser wouldn’t let us copy the message. Copy it below, then paste it into the chat and press send.'
          : 'Your browser wouldn’t let us copy the message. Copy it below, then open Instagram, paste it into the chat with Diogo and press send.';
    }
    go(order.indexOf('done'));
  };

  const send = (open) => {
    // Start the copy and open the tab in the same click so neither gets blocked.
    const copying = copyText(message);
    let opened = false;
    if (open && direct) {
      const w = window.open(direct, '_blank');
      if (w) {
        try { w.opener = null; } catch { /* cross-origin already */ }
        opened = true;
      }
    }
    copying.then((ok) => {
      track(open ? 'apply_send' : 'apply_copy', { chars: message.length, copied: ok });
      finish(ok, opened);
    });
  };

  /* ---- wiring -------------------------------------------------------------------------------- */
  $('[data-apply-start]').addEventListener('click', start);
  next.addEventListener('click', goNext);
  back.addEventListener('click', goBack);
  $('[data-apply-edit]').addEventListener('click', () => go(1));
  $$('[data-apply-copy]').forEach((b) => b.addEventListener('click', () => {
    const wasDone = order[idx] === 'done';
    const copying = copyText(message);
    copying.then((ok) => {
      track('apply_copy', { chars: message.length, copied: ok });
      if (!wasDone) return finish(ok, false);
      const label = $('span', b);
      label.dataset.was ||= label.textContent; // the real label, never the temporary "Copied"
      label.textContent = ok ? 'Copied' : 'Copy failed';
      clearTimeout(b._t);
      b._t = setTimeout(() => (label.textContent = label.dataset.was), 1600);
    });
  }));
  $('[data-apply-send]').addEventListener('click', () => send(true));

  form.addEventListener('submit', (e) => e.preventDefault());

  form.addEventListener('input', (e) => {
    const t = e.target;
    if (t.matches('textarea')) {
      const c = $(`[data-count="${t.name}"]`);
      if (c) c.textContent = t.value.length;
    }
    if (!started) { started = true; track('apply_start'); }
    updateNav();
  });

  // Single-choice answers move on by themselves after a tap or a number key, never after arrow keys:
  // arrowing through a radio group changes the selection as it goes, and jumping ahead mid-way would strand keyboard users.
  let autoOK = false;
  form.addEventListener('pointerdown', () => { autoOK = true; }, true);
  document.addEventListener('keydown', () => { autoOK = false; }, true);

  form.addEventListener('change', (e) => {
    const t = e.target;
    updateNav();
    if (!(t.matches('input[type="radio"]') && t.closest('[data-auto]') && autoOK)) return;
    autoOK = false;
    if (reduced) goNext();
    else setTimeout(() => { if (order[idx] === t.name) goNext(); }, 420);
  });

  // Enter and the 1-9 shortcuts work only while focus is inside the form, never from the page body (WCAG 2.1.4, F-37).
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    const inside = form.contains(t);
    if (!inside || e.altKey || (e.metaKey && e.key !== 'Enter') || (e.ctrlKey && e.key !== 'Enter')) return;
    const key = order[idx];

    if (e.key === 'Enter') {
      if (t.closest('a, button')) return; // let buttons and links do their own thing
      if (t.matches('textarea') && !(e.metaKey || e.ctrlKey)) return; // plain Enter = new line
      if (key === 'review') return; // sending takes a deliberate click
      e.preventDefault();
      goNext();
      return;
    }
    // 1–9 picks the Nth chip, like a quiz.
    if (/^[1-9]$/.test(e.key) && !t.matches('input[type="text"], textarea')) {
      const chips = $$('.achip input', steps[idx]);
      const chip = chips[Number(e.key) - 1];
      if (chip) {
        e.preventDefault();
        autoOK = chip.type === 'radio'; // a number key is a deliberate pick, so it may advance
        chip.checked = chip.type === 'radio' ? true : !chip.checked;
        chip.dispatchEvent(new Event('change', { bubbles: true }));
        chip.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  });

  /* ---- go ------------------------------------------------------------------------------------ */
  // Un-hide the interactive parts only now, so a page whose script failed still shows the plain DM link.
  $('[data-apply-start]').hidden = false;
  $('.apply__nojs').hidden = true;
  $('.apply__dm').hidden = false;
  history.replaceState({ apply: 0 }, ''); // a reload starts again at the intro, so the entry must say so
  root.classList.add('is-armed');
  $('[data-apply-scroll]')?.setAttribute('data-armed', '');
  show(0, { focus: false });
}
