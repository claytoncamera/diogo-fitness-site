// Interval timer (/tools/interval-timer/, tracker BP-T1, Plan 19 lane E). Loaded by a script tag on its own page only, not
// through main.js's lazy() (F-53, as the other tools). Everything runs in the browser: nothing is stored or sent (tools/check.mjs
// holds this file to the same rule as apply.js), no permission is asked for (no screen wake lock, no notifications), and the
// beeps are made in code with Web Audio only after the visitor switches sound on. The page renders the Tabata default as plain
// HTML, so it reads the same without this script. Every element it updates sits inside the [data-it] box. The timing is
// exported so tools/interval-timer.test.mjs can check it in Node (seo-geo/factsheets/BP-T1-interval-timer.md, section B).
//
// How it keeps time: a run is a list of segments (get ready, work, rest, ...). The clock is performance.now(); the state at
// any moment is computed from the time elapsed since Start, minus pauses, so a throttled background tab is right again the
// moment it is looked at. Nothing counts down by adding up ticks.

export const LEAD = 5; // seconds of "Get ready" before the first round (not in rest mode)
export const COUNT_IN = 3; // short beeps at 3, 2 and 1 seconds before each change

// Each mode's fields: [name, label, default, min, max]. Defaults (fact sheet rows A1 to A4 and B3):
//   tabata  20 s on, 10 s off, 8 rounds (the eight-round format; the 1996 study used seven to eight)
//   emom    a 60-second interval, 12 rounds (/learn/emom-workout/'s "set a timer for twelve minutes")
//   amrap   10 minutes (/learn/amrap-workout/'s "set a timer for ten minutes"; the 2024 study: 10 to 20)
//   rest    90 seconds (/learn/rest-between-sets/'s "about ninety seconds suits most sets" early on)
export const MODES = {
  tabata: { name: 'Tabata', fields: [['work', 'Work (seconds)', 20, 5, 600], ['rest', 'Rest (seconds)', 10, 0, 600], ['rounds', 'Rounds', 8, 1, 50]] },
  emom: { name: 'EMOM', fields: [['every', 'Every (seconds)', 60, 10, 600], ['rounds', 'Rounds', 12, 1, 60]] },
  amrap: { name: 'AMRAP', fields: [['minutes', 'Minutes', 10, 1, 60]] },
  rest: { name: 'Rest', fields: [['seconds', 'Rest (seconds)', 90, 5, 900]] },
};

export const defaults = (mode) => Object.fromEntries(MODES[mode].fields.map(([k, , d]) => [k, d]));

/** m:ss (or h:mm:ss past an hour) for a whole number of seconds. */
export function clock(sec) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** A spoken duration: "20 seconds", "1 minute 30 seconds". */
export function spoken(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const part = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  return [m ? part(m, 'minute') : '', s || !m ? part(s, 'second') : ''].filter(Boolean).join(' ');
}

/**
 * (mode, settings) -> { ok: true, mode, segments, total } or { ok: false, error }.
 * A segment is { phase, label, round, rounds, sec, start } with start in seconds from Start.
 * phase: ready | work | rest | interval (EMOM) | amrap | break (rest mode).
 */
export function build(mode, settings = {}) {
  const def = MODES[mode];
  if (!def) return { ok: false, error: 'Pick a mode.' };
  const v = {};
  for (const [k, label, d, min, max] of def.fields) {
    const x = settings[k] === undefined || settings[k] === null || settings[k] === '' ? d : Number(settings[k]);
    if (!(Number.isInteger(x) && x >= min && x <= max)) return { ok: false, error: `${label.replace(/ \(.*\)/, '')}: enter a whole number from ${min} to ${max}.` };
    v[k] = x;
  }
  const segs = [];
  const add = (phase, label, sec, round = 0, rounds = 0) => { if (sec > 0) segs.push({ phase, label, sec, round, rounds }); };
  if (mode !== 'rest') add('ready', 'Get ready', LEAD);
  if (mode === 'tabata') {
    for (let r = 1; r <= v.rounds; r++) {
      add('work', 'Work', v.work, r, v.rounds);
      if (r < v.rounds) add('rest', 'Rest', v.rest, r, v.rounds); // no rest after the last round: the timer ends on the work
    }
  } else if (mode === 'emom') {
    for (let r = 1; r <= v.rounds; r++) add('interval', v.every === 60 ? `Minute ${r}` : `Round ${r}`, v.every, r, v.rounds);
  } else if (mode === 'amrap') {
    add('amrap', 'As many rounds as possible', v.minutes * 60);
  } else {
    add('break', 'Rest', v.seconds);
  }
  let t = 0;
  for (const s of segs) { s.start = t; t += s.sec; }
  return { ok: true, mode, settings: v, segments: segs, total: t };
}

/** Where a run is after `sec` seconds: { done, i, seg, left, elapsed, remaining }. left = whole seconds shown on the clock. */
export function at(run, sec) {
  const e = Math.max(0, sec);
  if (e >= run.total) return { done: true, i: run.segments.length, seg: null, left: 0, elapsed: run.total, remaining: 0 };
  let i = 0;
  while (i < run.segments.length - 1 && e >= run.segments[i + 1].start) i++;
  const seg = run.segments[i];
  // a countdown shows the second it is in: 20 at the start, 1 in the last second, and the next segment at 0
  return { done: false, i, seg, left: Math.ceil(seg.start + seg.sec - e - 1e-9), elapsed: e, remaining: run.total - e };
}

/**
 * The beeps due when the clock moves from `from` to `to` seconds (from < to): [{ at, kind }], in order.
 * kind: 'count' at 3, 2 and 1 seconds before each change (only inside segments long enough to hold them),
 * 'change' when a new segment starts, 'done' when the run ends.
 */
export function cues(run, from, to) {
  const out = [];
  const within = (t) => t > from && t <= to;
  run.segments.forEach((s, i) => {
    const end = s.start + s.sec;
    for (let k = COUNT_IN; k >= 1; k--) if (s.sec > k && within(end - k)) out.push({ at: end - k, kind: 'count' });
    if (i > 0 && within(s.start)) out.push({ at: s.start, kind: 'change' });
  });
  if (within(run.total)) out.push({ at: run.total, kind: 'done' });
  return out.sort((a, b) => a.at - b.at);
}

/** The line under the clock before Start: what the run is, in words. */
export function summary(run) {
  const v = run.settings;
  const lead = run.mode === 'rest' ? '' : `, after ${LEAD} seconds to get ready`;
  if (run.mode === 'tabata')
    return `${v.rounds} round${v.rounds === 1 ? '' : 's'} of ${spoken(v.work)} work${v.rest ? ` and ${spoken(v.rest)} rest` : ', no rest'}: ${clock(run.total - LEAD)} in all${lead}.`;
  if (run.mode === 'emom') return `A new round every ${spoken(v.every)}, ${v.rounds} round${v.rounds === 1 ? '' : 's'}: ${clock(run.total - LEAD)} in all${lead}.`;
  if (run.mode === 'amrap') return `One ${spoken(v.minutes * 60)} clock; tap "+1 round" each time you finish a round${lead}.`;
  return `${spoken(v.seconds)} of rest. Start it when you rack the weight.`;
}

/** What the screen reader hears when a segment starts. */
export function announce(run, seg) {
  if (seg.phase === 'ready') return `Get ready: ${LEAD} seconds.`;
  if (seg.phase === 'work') return `Work, round ${seg.round} of ${seg.rounds}: ${spoken(seg.sec)}.`;
  if (seg.phase === 'rest') return `Rest: ${spoken(seg.sec)}.`;
  if (seg.phase === 'interval') return `${seg.label} of ${seg.rounds}. Go.`;
  if (seg.phase === 'amrap') return `Go: ${spoken(seg.sec)}.`;
  return `Resting: ${spoken(seg.sec)}.`;
}

export const doneText = (run, rounds) =>
  run.mode === 'rest' ? 'Rest over: next set.' : run.mode === 'amrap' ? `Time. Rounds logged: ${rounds}.` : `Done: ${run.settings.rounds} round${run.settings.rounds === 1 ? '' : 's'}.`;

// ---- the page --------------------------------------------------------------------------------------------------------
function init(root) {
  const form = root.querySelector('[data-it-form]');
  if (!form) return;
  const $ = (sel) => root.querySelector(sel);
  const set = (sel, text) => { const el = $(sel); if (el && el.textContent !== text) el.textContent = text; };
  const live = $('[data-it-live]');
  const say = (msg) => { if (live) live.textContent = msg; };
  const startBtn = $('[data-it-start]');
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

  let mode = 'tabata';
  let run = build(mode);
  let state = 'idle'; // idle | running | paused | done
  let acc = 0; // seconds run before the current stretch
  let since = 0; // when the current stretch started
  let last = 0; // the clock at the previous tick, for cues
  let seen = -1; // the segment last announced
  let rounds = 0; // AMRAP rounds logged (kept in memory only)
  let ticker = 0;
  let audio = null;

  const elapsed = () => (state === 'running' ? acc + now() - since : acc);
  const pick = () => { const r = form.querySelector('[name="mode"]:checked'); return r && MODES[r.value] ? r.value : 'tabata'; };
  const read = () => {
    const out = {};
    for (const [k] of MODES[mode].fields) {
      const el = form.querySelector(`[data-it-mode="${mode}"] [name="${k}"]`);
      const raw = el ? String(el.value).trim() : '';
      out[k] = raw === '' ? NaN : Number(raw);
    }
    return out;
  };

  // Sound is off until the visitor turns it on; the AudioContext is made in that click, so no browser blocks it.
  const beep = (kind) => {
    if (!audio) return;
    const [f, len, n] = kind === 'count' ? [660, 0.12, 1] : kind === 'change' ? [880, 0.35, 1] : [880, 0.18, 3];
    for (let k = 0; k < n; k++) {
      const t = audio.currentTime + k * 0.28;
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g);
      g.connect(audio.destination);
      o.start(t);
      o.stop(t + len + 0.02);
    }
  };
  const sound = $('[data-it-sound]');
  if (sound)
    sound.addEventListener('change', () => {
      if (!sound.checked) { if (audio && audio.close) audio.close(); audio = null; return; }
      const Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!Ctx) { sound.checked = false; say('Sound is not available in this browser.'); return; }
      audio = new Ctx();
      if (audio.resume) audio.resume();
    });

  const paint = () => {
    const e = elapsed();
    const p = at(run, e);
    root.setAttribute('data-phase', state === 'idle' ? 'idle' : p.done ? 'done' : p.seg.phase);
    if (state === 'idle') {
      const first = run.segments.find((s) => s.phase !== 'ready') || run.segments[0];
      set('[data-it-phase]', MODES[run.mode].name);
      set('[data-it-clock]', clock(first.sec));
      set('[data-it-round]', first.rounds ? `Round 1 of ${first.rounds}` : '');
      set('[data-it-total]', summary(run));
    } else if (p.done) {
      set('[data-it-phase]', 'Done');
      set('[data-it-clock]', clock(0));
      set('[data-it-round]', '');
      set('[data-it-total]', doneText(run, rounds));
    } else {
      set('[data-it-phase]', `${p.seg.label}${state === 'paused' ? ' (paused)' : ''}`);
      set('[data-it-clock]', clock(p.left));
      set('[data-it-round]', p.seg.rounds ? `Round ${p.seg.round} of ${p.seg.rounds}` : '');
      set('[data-it-total]', `${clock(Math.ceil(p.remaining - 1e-9))} left in all`);
    }
    set('[data-it-count]', String(rounds));
    set('[data-it-start]', state === 'running' ? 'Pause' : state === 'paused' ? 'Resume' : state === 'done' ? 'Start again' : 'Start');
    return p;
  };

  const tick = () => {
    const e = elapsed();
    for (const c of cues(run, last, e)) if (e - c.at < 0.5) beep(c.kind); // skip beeps missed while the tab was asleep
    last = e;
    const p = paint();
    if (p.done) {
      stop('done');
      say(doneText(run, rounds));
      return;
    }
    if (p.i !== seen) { seen = p.i; say(announce(run, p.seg)); }
  };

  const stop = (to) => {
    if (state === 'running') acc = elapsed();
    clearInterval(ticker);
    ticker = 0;
    state = to;
    paint();
  };
  const reset = (quiet) => {
    clearInterval(ticker);
    ticker = 0;
    state = 'idle';
    acc = 0; last = 0; seen = -1; rounds = 0;
    paint();
    if (!quiet) say('Reset.');
  };

  const configure = () => {
    mode = pick();
    root.querySelectorAll('[data-it-mode]').forEach((el) => { el.hidden = el.getAttribute('data-it-mode') !== mode; });
    const amrap = $('[data-it-amrap]');
    if (amrap) amrap.hidden = mode !== 'amrap';
    const r = build(mode, read());
    root.classList.toggle('is-invalid', !r.ok);
    set('[data-it-error]', r.ok ? '' : r.error);
    if (startBtn) startBtn.disabled = !r.ok;
    if (r.ok) run = r;
    reset(true);
  };

  if (startBtn)
    startBtn.addEventListener('click', () => {
      if (state === 'running') { stop('paused'); say(`Paused at ${clock(at(run, acc).left)}.`); return; }
      if (state === 'done') reset(true);
      const resuming = state === 'paused';
      state = 'running';
      since = now();
      if (resuming) say('Resumed.');
      clearInterval(ticker);
      ticker = setInterval(tick, 100);
      tick();
    });
  const resetBtn = $('[data-it-reset]');
  if (resetBtn) resetBtn.addEventListener('click', () => reset(false));
  const plus = $('[data-it-plus]');
  if (plus) plus.addEventListener('click', () => { rounds++; paint(); say(`Rounds: ${rounds}.`); });
  const minus = $('[data-it-minus]');
  if (minus) minus.addEventListener('click', () => { rounds = Math.max(0, rounds - 1); paint(); say(`Rounds: ${rounds}.`); });
  root.querySelectorAll('[data-it-preset]').forEach((b) =>
    b.addEventListener('click', () => {
      const el = form.querySelector('[data-it-mode="rest"] [name="seconds"]');
      if (el) el.value = b.getAttribute('data-it-preset');
      configure();
      say(`Rest set to ${spoken(run.settings.seconds)}.`);
    })
  );
  form.addEventListener('input', configure);
  form.addEventListener('change', configure);
  form.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target && e.target.tagName === 'INPUT') e.preventDefault(); });
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange', () => { if (state === 'running') tick(); });
  root.classList.add('is-ready');
  configure(); // quietly, in case the browser restored typed values (Back): nothing is announced on load
}

if (typeof document !== 'undefined') document.querySelectorAll('[data-it]').forEach(init);
