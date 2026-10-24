// Warm-up set calculator (/tools/warm-up-set-calculator/, tracker X-04-3). Loaded by a script tag on its own page only, not
// through main.js's lazy() (F-53, as plate-calculator.js). Everything runs in the browser: nothing is stored or sent
// (tools/check.mjs holds this file to the same rule as apply.js). The page renders a worked example as plain HTML, so it
// reads the same without this script; the script only rebuilds the ramp from the visitor's numbers. The math is exported so
// tools/warm-up-sets.test.mjs can check it in Node (seo-geo/factsheets/X-04-warm-up-set-calculator.md, section B).
import { plan, sideText, num, BARS, MAX } from './plate-calculator.js?v=ead49f4f';

// The ramp for each kind of working set, as [percent of the working weight, reps]: the table on
// /learn/how-to-warm-up-before-lifting/ (heavy: about 8 at 40 to 50%, 5 at 60%, 3 at 75%, then 1 or 2 at 85%; moderate:
// about 8 at 50%, then about 4 at 75%; light or high reps: one set of about 10 at half the weight, or none).
export const LADDERS = {
  heavy: [[45, 8], [60, 5], [75, 3], [85, 1]], // 5 reps or fewer
  moderate: [[50, 8], [75, 4]], // 6 to 11 reps
  light: [[50, 10]], // 12 reps or more
};
export const MAX_REPS = 30;
export const BAR_REPS = 10; // the empty bar, for a barbell set of 11 reps or fewer
// Loads round to these steps: on a barbell, two of the smallest default plates (2.5 lb or 1.25 kg); dumbbells, 5 lb or 2.5 kg.
export const STEP = { lb: 5, kg: 2.5 };
// A warm-up set closer than this to the set before it, or to the working weight, is dropped (barbell; dumbbells per hand).
export const MIN_JUMP = { barbell: { lb: 20, kg: 10 }, dumbbell: { lb: 10, kg: 5 } };

export const ladderFor = (reps) => (reps <= 5 ? 'heavy' : reps < 12 ? 'moderate' : 'light');

/**
 * { weight, reps, unit = 'lb', lift = 'barbell', bar } -> { ok: true, sets, work, ... } or { ok: false, error }.
 * weight = the working weight (for dumbbells, one dumbbell); bar = the bar's weight (barbell only; default 45 lb / 20 kg).
 * sets = [{ step, load, reps, perSide }] in order: step is 'bar' for the empty bar, else the ramp's percent.
 */
export function ramp({ weight, reps, unit = 'lb', lift = 'barbell', bar } = {}) {
  const u = unit === 'kg' ? 'kg' : 'lb';
  const barbell = lift !== 'dumbbell';
  if (!(Number.isFinite(weight) && weight > 0 && weight <= MAX[u])) return { ok: false, error: `Enter the working weight, up to ${MAX[u]} ${u}.` };
  if (!(Number.isInteger(reps) && reps >= 1 && reps <= MAX_REPS)) return { ok: false, error: `Enter whole reps from 1 to ${MAX_REPS}.` };
  const b = barbell ? (Number.isFinite(bar) ? bar : BARS[u][0]) : 0;
  if (barbell && !BARS[u].includes(b)) return { ok: false, error: 'Pick the bar.' };
  const step = STEP[u];
  const gap = MIN_JUMP[barbell ? 'barbell' : 'dumbbell'][u];
  const ladder = ladderFor(reps);
  const base = { ok: true, unit: u, lift: barbell ? 'barbell' : 'dumbbell', bar: b, ladder, weight, reps };
  const side = (load) => (barbell ? plan({ target: load, unit: u, bar: b }) : null);
  const work = { load: weight, reps, perSide: null, exact: true, nearest: null };
  if (barbell) {
    const p = side(weight);
    if (!p.ok) return { ...base, sets: [], work, onlyBar: true }; // lighter than the bar
    work.perSide = p.perSide;
    work.exact = p.exact;
    if (!p.exact) work.nearest = [p.loaded, p.nextUp].filter((x) => x !== null);
    if (weight <= b + 1e-9) return { ...base, sets: [], work, onlyBar: true };
  }
  // Round to a loadable weight: the bar plus whole steps (never below the bar), or whole dumbbell steps (never below one).
  const round = (x) => (barbell ? (x <= b ? b : b + step * Math.round((x - b) / step + 1e-9)) : Math.max(step, step * Math.round(x / step + 1e-9)));
  const sets = [];
  if (barbell && ladder !== 'light') sets.push({ step: 'bar', load: b, reps: BAR_REPS, perSide: [] });
  for (const [pct, n] of LADDERS[ladder]) {
    const load = round((weight * pct) / 100);
    const prev = sets.length ? sets[sets.length - 1].load : null;
    if (prev !== null && load - prev < gap - 1e-9) continue; // too close to the set before (or the bar)
    if (weight - load < gap - 1e-9) continue; // too close to the working weight
    sets.push({ step: barbell && load <= b ? 'bar' : pct, load, reps: n, perSide: barbell ? side(load).perSide : null });
  }
  return { ...base, sets, work, onlyBar: false };
}

/** The table's first column: "Empty bar", "45%" (the ramp's step, before rounding). */
export const stepText = (s) => (s.step === 'bar' ? 'Empty bar' : `About ${s.step}%`);
export const sideCell = (perSide) => (perSide === null ? '' : perSide.length ? sideText(perSide) : 'Nothing');

function init(root) {
  // A plain group of fields, not a <form>: there is nothing to submit, and Enter never sends the numbers anywhere.
  const fields = root.querySelector('[data-wu-form]');
  if (!fields) return;
  const $ = (sel) => root.querySelector(sel);
  const set = (sel, text) => { const el = $(sel); if (el) el.textContent = text; };
  const field = (name) => fields.querySelector(`[name="${name}"]`);
  const checked = (name, dflt) => (fields.querySelector(`input[name="${name}"]:checked`) || {}).value || dflt;
  const live = $('[data-wu-live]');
  let timer = 0;

  const read = () => {
    const unit = checked('unit', 'lb') === 'kg' ? 'kg' : 'lb';
    return {
      unit,
      lift: checked('lift', 'barbell'),
      weight: parseFloat(String(field('weight').value).replace(',', '.')),
      reps: Number(field('reps').value),
      bar: BARS[unit][Number(field('bar').value)] ?? BARS[unit][0],
    };
  };

  const sync = (input) => {
    field('bar').querySelectorAll('option').forEach((o) => { o.textContent = `${BARS[input.unit][Number(o.value)]} ${input.unit}`; });
    const barField = $('[data-wu-bar]');
    if (barField) barField.hidden = input.lift === 'dumbbell';
    root.querySelectorAll('[data-wu-side]').forEach((el) => { el.hidden = input.lift === 'dumbbell'; });
  };

  const row = (cells) => {
    const tr = document.createElement('tr');
    cells.forEach((text, i) => {
      const td = document.createElement('td');
      td.textContent = text;
      if (i === 3) td.setAttribute('data-wu-side', '');
      td.hidden = i === 3 && text === '';
      tr.append(td);
    });
    return tr;
  };

  const render = (announce) => {
    const input = read();
    sync(input);
    const r = ramp(input);
    root.classList.toggle('is-invalid', !r.ok);
    clearTimeout(timer);
    const speak = (msg) => { if (live && announce !== null) timer = setTimeout(() => { live.textContent = msg; }, announce ? 0 : 700); };
    if (!r.ok) {
      set('[data-wu-error]', r.error);
      speak(r.error);
      return;
    }
    set('[data-wu-error]', '');
    const u = r.unit;
    const w = `${num(r.weight)} ${u}`;
    const loaded = r.sets.filter((s) => s.step !== 'bar').length;
    const bar = r.sets.some((s) => s.step === 'bar');
    let summary;
    if (r.onlyBar) summary = `${w} is the empty bar or lighter: no warm-up sets, just the easy movement first.`;
    else if (!r.sets.length) summary = `No separate warm-up sets: ${w} is too close to the ${r.lift === 'dumbbell' ? 'lightest step' : 'empty bar'} for one to help, so the first reps of the set warm you up.`;
    else summary = `${bar && loaded ? 'The empty bar, then ' : bar ? 'The empty bar, ' : ''}${loaded ? `${loaded} warm-up set${loaded === 1 ? '' : 's'}, ` : ''}then your working set: ${w} × ${r.reps}.`;
    summary = summary.charAt(0).toUpperCase() + summary.slice(1);
    set('[data-wu-summary]', summary);
    const body = $('[data-wu-rows]');
    if (body) {
      const each = r.lift === 'dumbbell' ? ' each' : '';
      body.replaceChildren(
        ...r.sets.map((s) => row([stepText(s), `${num(s.load)} ${u}${each}`, String(s.reps), sideCell(s.perSide)])),
        row(['Working set', `${num(r.weight)} ${u}${each}`, String(r.reps), r.lift === 'dumbbell' ? '' : r.work.exact ? sideCell(r.work.perSide) : '—'])
      );
    }
    let note = '';
    if (r.lift === 'barbell' && !r.work.exact && !r.onlyBar)
      note = `${w} can’t be loaded exactly with ${u === 'kg' ? '1.25 kg' : '2.5 lb'} as the smallest plate; the nearest loadable weights are ${r.work.nearest.map((x) => `${num(x)} ${u}`).join(' and ')}.`;
    const n = $('[data-wu-note]');
    if (n) { n.textContent = note; n.hidden = !note; }
    speak(`${summary} ${r.sets.map((s) => `${stepText(s)}: ${num(s.load)} ${u} for ${s.reps}.`).join(' ')}`);
  };

  fields.addEventListener('input', () => render(false));
  fields.addEventListener('change', () => render(false));
  fields.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); render(true); } });
  root.classList.add('is-ready');
  render(null); // quietly, in case the browser restored typed values (Back): nothing is announced on load
}

if (typeof document !== 'undefined') document.querySelectorAll('[data-wu]').forEach(init);
