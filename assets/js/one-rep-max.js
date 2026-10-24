// One-rep max calculator (/tools/one-rep-max-calculator/, tracker X-04-1). Loaded by main.js only where [data-orm] is on the
// page. Everything runs in the browser: nothing is stored or sent (tools/check.mjs holds this file to the same rule as apply.js).
// The page itself renders a worked example as plain HTML, so it reads the same without this script; the script only recomputes
// the result and the two tables from the visitor's numbers. The math is exported so tools/orm.test.mjs can check it in Node.

// The formulas as the cited comparison papers state them (seo-geo/factsheets/X-04-1rm-calculator.md, rows A3 and A4):
//   Epley:   1RM = weight x (1 + 0.0333 x reps)
//   Brzycki: 1RM = weight / (1.0278 - 0.0278 x reps)
export const EPLEY_K = 0.0333;
export const BRZYCKI_A = 1.0278;
export const BRZYCKI_B = 0.0278;
export const MAX_REPS = 12; // the reps box accepts 1 to 12
export const LOOSE_ABOVE = 10; // above 10 reps to failure the page warns that estimates get loose
export const MAX_RIR = 4; // RPE 6 to 10 = 0 to 4 reps in reserve (RPE = 10 - RIR, as on /learn/reps-in-reserve/)
export const PERCENTS = [95, 90, 85, 80, 75, 70, 65, 60];
export const RPES = [10, 9, 8, 7, 6];

/** A single to failure is already a one-rep max, so 1 rep returns the weight itself (both formulas). */
export const epley = (w, r) => (r <= 1 ? w : w * (1 + EPLEY_K * r));
export const brzycki = (w, r) => (r <= 1 ? w : w / (BRZYCKI_A - BRZYCKI_B * r));
/** The weight that the two formulas, averaged, expect for `r` reps to failure from a one-rep max of `max`. */
export const loadFor = (max, r) => (r <= 1 ? max : (max / (1 + EPLEY_K * r) + max * (BRZYCKI_A - BRZYCKI_B * r)) / 2);
/** Nearest 1 lb, or nearest 0.5 kg. */
export const roundTo = (x, unit) => (unit === 'kg' ? Math.round(x * 2) / 2 : Math.round(x));

/**
 * { weight, reps, rir = 0, unit = 'lb' } -> { ok: true, ... } or { ok: false, error }.
 * Reps in reserve are added to the reps done: 5 reps with 2 left counts as 5 + 2 = 7 reps to failure.
 */
export function estimate({ weight, reps, rir = 0, unit = 'lb' } = {}) {
  if (!(Number.isFinite(weight) && weight > 0 && weight <= 5000)) return { ok: false, error: 'Enter the weight you lifted.' };
  if (!(Number.isInteger(reps) && reps >= 1 && reps <= MAX_REPS)) return { ok: false, error: `Enter whole reps from 1 to ${MAX_REPS}.` };
  if (!(Number.isInteger(rir) && rir >= 0 && rir <= MAX_RIR)) return { ok: false, error: 'Pick how many reps were left.' };
  const u = unit === 'kg' ? 'kg' : 'lb';
  const n = reps + rir;
  const e = epley(weight, n);
  const b = brzycki(weight, n);
  const avg = (e + b) / 2;
  return {
    ok: true,
    unit: u,
    reps,
    rir,
    repsToFailure: n,
    loose: n > LOOSE_ABOVE,
    epley: roundTo(e, u),
    brzycki: roundTo(b, u),
    average: roundTo(avg, u),
    percents: PERCENTS.map((pct) => ({ pct, load: roundTo((avg * pct) / 100, u) })),
    atRpe: RPES.map((rpe) => ({ rpe, rir: 10 - rpe, repsToFailure: reps + 10 - rpe, load: roundTo(loadFor(avg, reps + 10 - rpe), u) })),
  };
}

const fmt = (x, unit) => `${x.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${unit}`;

function init(root) {
  // A plain group of fields, not a <form>: there is nothing to submit, and Enter never sends the numbers anywhere.
  const fields = root.querySelector('[data-orm-form]');
  if (!fields) return;
  const $ = (sel) => root.querySelector(sel);
  const set = (sel, text) => { const el = $(sel); if (el) el.textContent = text; };
  // The percentage table and the RPE table are their own sections below the box, not inside it, so their cells are looked up
  // on the whole page. Each data-orm-pct, data-orm-rpe and data-orm-rpe-reps value appears once on the page.
  const setOnPage = (sel, text) => { const el = document.querySelector(sel); if (el) el.textContent = text; };
  const field = (name) => fields.querySelector(`[name="${name}"]`);
  const live = $('[data-orm-live]');
  let timer = 0;

  const read = () => ({
    weight: parseFloat(String(field('weight').value).replace(',', '.')),
    reps: Number(field('reps').value),
    rir: Number(field('rir').value),
    unit: (fields.querySelector('input[name="unit"]:checked') || {}).value || 'lb',
  });

  const render = (announce) => {
    const input = read();
    const r = estimate(input);
    root.classList.toggle('is-invalid', !r.ok);
    clearTimeout(timer);
    if (!r.ok) {
      set('[data-orm-error]', r.error);
      if (live) timer = setTimeout(() => { live.textContent = r.error; }, announce ? 0 : 700);
      return;
    }
    set('[data-orm-error]', '');
    const left = r.rir === 0 ? 'no reps left' : `${r.rir} rep${r.rir === 1 ? '' : 's'} left`;
    set('[data-orm-basis]', `Your set: ${fmt(input.weight, r.unit)} for ${r.reps} rep${r.reps === 1 ? '' : 's'}, ${left} (${r.repsToFailure} to failure).`);
    set('[data-orm-avg]', fmt(r.average, r.unit));
    set('[data-orm-epley]', fmt(r.epley, r.unit));
    set('[data-orm-brzycki]', fmt(r.brzycki, r.unit));
    const warn = $('[data-orm-warn]');
    if (warn) warn.hidden = !r.loose;
    r.percents.forEach((p) => setOnPage(`[data-orm-pct="${p.pct}"]`, fmt(p.load, r.unit)));
    setOnPage('[data-orm-rpe-reps]', `${r.reps} rep${r.reps === 1 ? '' : 's'}`);
    r.atRpe.forEach((x) => setOnPage(`[data-orm-rpe="${x.rpe}"]`, fmt(x.load, r.unit)));
    const say = `Estimated one-rep max ${fmt(r.average, r.unit)}: Epley ${fmt(r.epley, r.unit)}, Brzycki ${fmt(r.brzycki, r.unit)}.${r.loose ? ' Above 10 reps, the estimate gets loose.' : ''}`;
    if (live) timer = setTimeout(() => { live.textContent = say; }, announce ? 0 : 700);
  };

  fields.addEventListener('input', () => render(false));
  fields.addEventListener('change', () => render(false));
  fields.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); render(true); } });
  root.classList.add('is-ready');
}

if (typeof document !== 'undefined') document.querySelectorAll('[data-orm]').forEach(init);
