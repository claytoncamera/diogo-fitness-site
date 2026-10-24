// Plate calculator (/tools/plate-calculator/, tracker X-04-2). Loaded by a script tag on its own page only, not through
// main.js's lazy() (tools/check.mjs counts every lazy() module toward every page's first-view budget, F-53); warm-up-sets.js
// imports plan() for its plates-per-side column. Everything runs in the browser: nothing is stored or sent (tools/check.mjs
// holds this file to the same rule as apply.js). The page itself renders a worked example and a table of common weights as
// plain HTML, so it reads the same without this script; the script only recomputes from the visitor's numbers. The math is
// exported so tools/plate-calculator.test.mjs can check it in Node (seo-geo/factsheets/X-04-plate-calculator.md, section B).

// The plate sizes the page offers, with the default number of pairs. A third value of false = listed but unticked (the
// fractional plates). Every size is a whole number of quarter-pounds or quarter-kilos, so the search below runs on integers.
export const PLATES = {
  lb: [[45, 8], [35, 2], [25, 2], [10, 2], [5, 2], [2.5, 2], [1.25, 2, false]],
  kg: [[25, 8], [20, 2], [15, 2], [10, 2], [5, 2], [2.5, 2], [1.25, 2], [0.5, 2, false]],
};
export const BARS = { lb: [45, 35, 15], kg: [20, 15, 10] };
export const MAX = { lb: 2000, kg: 1000 };
const Q = 4; // quarter units

const unitOf = (unit) => (unit === 'kg' ? 'kg' : 'lb');
/** The default plates for a unit as [{ w, n }] (n = pairs; an unticked size has n = 0). */
export const defaultPlates = (unit) => PLATES[unitOf(unit)].map(([w, n, on = true]) => ({ w, n: on ? n : 0 }));
/** Two decimals at most, as a number. */
const r2 = (x) => Math.round(x * 100) / 100;
/** "45", "2.5", "1.25", "44.1". */
export const num = (x) => r2(x).toLocaleString('en-US', { maximumFractionDigits: 2 });

// For every sum s up to cap (in quarter units) that one side can reach, the count vector that uses as many of the biggest
// plate as possible, then as many of the next, and so on (largest first, compared size by size). Each pair is one 0/1 item;
// the order is the same whatever is added to both sides of a comparison, so keeping the best vector per sum is exact.
function sides(kinds, cap) {
  const best = new Array(cap + 1).fill(null);
  best[0] = kinds.map(() => 0);
  const beats = (from, i, cur) => {
    for (let j = 0; j < cur.length; j++) {
      const a = from[j] + (j === i ? 1 : 0);
      if (a !== cur[j]) return a > cur[j];
    }
    return false;
  };
  kinds.forEach((k, i) => {
    for (let c = 0; c < k.n; c++)
      for (let s = cap; s >= k.u; s--) {
        const from = best[s - k.u];
        if (!from || (best[s] && !beats(from, i, best[s]))) continue;
        const next = from.slice();
        next[i]++;
        best[s] = next;
      }
  });
  return best;
}

/**
 * { target, unit = 'lb', bar, collar = 0, plates } -> { ok: true, ... } or { ok: false, error }.
 * bar = the bar's weight; collar = the weight of ONE collar (two are counted); plates = [{ w, n }] with n = pairs available
 * (defaults to the unit's default set). The load is bar + 2 x collar + 2 x one side. When the target cannot be made exactly,
 * the side is the heaviest one at or below it, and nextUp is the lightest loadable total above it (null if none).
 */
export function plan({ target, unit = 'lb', bar, collar = 0, plates } = {}) {
  const u = unitOf(unit);
  if (!(Number.isFinite(target) && target > 0 && target <= MAX[u])) return { ok: false, error: `Enter a target weight from 1 to ${MAX[u]} ${u}.` };
  if (!(Number.isFinite(bar) && bar >= 0 && bar <= MAX[u])) return { ok: false, error: 'Enter the weight of the bar.' };
  if (!(Number.isFinite(collar) && collar >= 0 && collar <= 50)) return { ok: false, error: 'Enter the weight of one collar, or 0.' };
  const base = bar + 2 * collar;
  if (target < base - 1e-9) return { ok: false, error: `That is lighter than the bar${collar ? ' and collars' : ''} alone (${num(base)} ${u}).` };
  const kinds = (plates || defaultPlates(u))
    .filter((p) => p.w > 0 && p.n > 0)
    .map((p) => ({ w: p.w, u: Math.round(p.w * Q), n: Math.min(Math.floor(p.n), 50) }))
    .sort((a, b) => b.u - a.u);
  const goal = Math.floor(((target - base) * Q) / 2 + 1e-9);
  const total = kinds.reduce((t, k) => t + k.u * k.n, 0);
  const cap = Math.min(total, goal + (kinds.length ? kinds[0].u : 0));
  const best = sides(kinds, cap);
  let below = Math.min(goal, cap);
  while (!best[below]) below--;
  let above = goal + 1;
  while (above <= cap && !best[above]) above++;
  const perSide = [];
  best[below].forEach((c, i) => {
    for (let k = 0; k < c; k++) perSide.push(kinds[i].w);
  });
  const loaded = r2(base + (2 * below) / Q);
  const exact = Math.abs(loaded - target) < 0.005;
  return {
    ok: true,
    unit: u,
    target,
    bar,
    collar,
    perSide,
    side: below / Q,
    loaded,
    exact,
    short: exact ? 0 : r2(target - loaded),
    nextUp: !exact && above <= cap ? r2(base + (2 * above) / Q) : null,
  };
}

/** The diagram's plate height, in percent of the bar's box: bigger plates are taller (square root of the size ratio). */
export const plateHeight = (w, unit) => Math.round(28 + 72 * Math.sqrt(Math.min(1, w / PLATES[unitOf(unit)][0][0])));
/** "45 + 25 + 5 + 2.5" (one side, biggest first), or "" for the bare bar. */
export const sideText = (perSide) => perSide.map(num).join(' + ');

function init(root) {
  // A plain group of fields, not a <form>: there is nothing to submit, and Enter never sends the numbers anywhere.
  const fields = root.querySelector('[data-plates-form]');
  if (!fields) return;
  const $ = (sel) => root.querySelector(sel);
  const set = (sel, text) => { const el = $(sel); if (el) el.textContent = text; };
  const field = (name) => fields.querySelector(`[name="${name}"]`);
  const live = $('[data-plates-live]');
  const custom = $('[data-plates-custom]');
  let timer = 0;
  const unitNow = () => (fields.querySelector('input[name="unit"]:checked') || {}).value || 'lb';
  const parse = (v) => parseFloat(String(v).replace(',', '.'));

  const read = () => {
    const unit = unitOf(unitNow());
    const pick = field('bar').value;
    const box = fields.querySelector(`[data-plates-set="${unit}"]`);
    const plates = box
      ? [...box.querySelectorAll('input[type="checkbox"][data-w]')].map((c) => {
          const n = box.querySelector(`input[data-n="${c.dataset.w}"]`);
          return { w: Number(c.dataset.w), n: c.checked && n ? Number(n.value) || 0 : 0 };
        })
      : defaultPlates(unit);
    return {
      unit,
      target: parse(field('target').value),
      bar: pick === 'custom' ? parse(field('custom').value) : BARS[unit][Number(pick)] ?? BARS[unit][0],
      collar: field('collar').value === '' ? 0 : parse(field('collar').value),
      plates,
    };
  };

  // The unit decides the plate list and the bar menu's labels; the menu keeps its position (45 lb <-> 20 kg).
  const syncUnit = () => {
    const unit = unitOf(unitNow());
    fields.querySelectorAll('[data-plates-set]').forEach((b) => { b.hidden = b.dataset.platesSet !== unit; });
    field('bar').querySelectorAll('option').forEach((o) => { if (o.value !== 'custom') o.textContent = `${BARS[unit][Number(o.value)]} ${unit}`; });
    fields.querySelectorAll('[data-plates-unit]').forEach((el) => { el.textContent = unit; });
    if (custom) custom.hidden = field('bar').value !== 'custom';
  };

  const drawBar = (perSide, unit) => {
    const bar = $('[data-plates-bar]');
    if (!bar) return;
    bar.replaceChildren(
      ...perSide.map((w) => {
        const i = document.createElement('i');
        i.style.setProperty('--h', plateHeight(w, unit));
        return i;
      })
    );
  };

  const render = (announce) => {
    syncUnit();
    const input = read();
    const r = plan(input);
    root.classList.toggle('is-invalid', !r.ok);
    clearTimeout(timer);
    if (!r.ok) {
      set('[data-plates-error]', r.error);
      if (live && announce !== null) timer = setTimeout(() => { live.textContent = r.error; }, announce ? 0 : 700);
      return;
    }
    const u = r.unit;
    set('[data-plates-error]', '');
    const side = r.perSide.length ? `${sideText(r.perSide)} ${u}` : 'no plates, just the bar';
    set('[data-plates-side]', side);
    set('[data-plates-loaded]', `${num(r.loaded)} ${u}`);
    const collars = r.collar ? ` + collars 2 × ${num(r.collar)}` : '';
    set('[data-plates-sum]', `Bar ${num(r.bar)}${collars} + ${num(r.side)} a side × 2 = ${num(r.loaded)} ${u}.`);
    let gap = '';
    if (!r.exact) {
      gap = `${num(r.target)} ${u} can’t be made exactly with these plates: this is ${num(r.short)} ${u} short.`;
      gap += r.nextUp ? ` The next weight up is ${num(r.nextUp)} ${u}.` : ' That is every plate ticked.';
    }
    const g = $('[data-plates-gap]');
    if (g) { g.textContent = gap; g.hidden = !gap; }
    drawBar(r.perSide, u);
    const say = `Each side: ${side}. On the bar: ${num(r.loaded)} ${u}.${gap ? ` ${gap}` : ''}`;
    if (live && announce !== null) timer = setTimeout(() => { live.textContent = say; }, announce ? 0 : 700);
  };

  fields.addEventListener('input', () => render(false));
  fields.addEventListener('change', () => render(false));
  fields.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); render(true); } });
  root.classList.add('is-ready');
  render(null); // quietly, in case the browser restored typed values (Back): nothing is announced on load
}

if (typeof document !== 'undefined') document.querySelectorAll('[data-plates]').forEach(init);
