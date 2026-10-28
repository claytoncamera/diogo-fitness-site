// Protein intake calculator (/tools/protein-intake-calculator/, tracker EX-01a, the sixth /tools/ page). Loaded by a script tag
// on its own page only, not through main.js's lazy() (F-53, as the other tools). Everything runs in the browser: nothing is
// stored or sent (tools/check.mjs holds this file to the same rule as apply.js). The page renders a worked example as plain
// HTML, so it reads the same without this script; the script only recomputes the numbers from the visitor's bodyweight.
// The math is exported so tools/protein-intake.test.mjs can check it in Node.
//
// Scope is exactly what /learn/calories-and-protein/ already publishes (seo-geo/factsheets/EX-01a-protein-intake-calculator.md):
//   0.7 to 1 gram of protein per pound of bodyweight a day, about 1.6 to 2.2 g per kg, for people who lift
//   (morton-2018, jager-2017), split across three or four meals. No calories, no weight-loss, body-fat or goal-weight output.
// The pound and kilogram ranges are each the site's own published numbers, applied as written: a pound input uses 0.7 to 1 g/lb,
// a kilogram input 1.6 to 2.2 g/kg. They are rounded versions of each other, so the low end differs by a few grams (the page says so).
export const PER_LB = [0.7, 1];
export const PER_KG = [1.6, 2.2];
export const MEALS = [3, 4];
// Accepted bodyweights. Not a claim about anyone: the bounds only keep typos (1,800 lb, 8 kg) from printing a number.
export const LIMITS = { lb: [66, 660], kg: [30, 300] };

/** Nearest whole gram. */
export const grams = (x) => Math.round(x);

/**
 * { weight, unit = 'lb' } -> { ok: true, unit, weight, low, high, perMeal: [{ meals, low, high }] } or { ok: false, error }.
 * The per-meal split divides the unrounded daily range, then rounds, so 3 x a meal can differ from the day by a gram.
 */
export function protein({ weight, unit = 'lb' } = {}) {
  const u = unit === 'kg' ? 'kg' : 'lb';
  const [min, max] = LIMITS[u];
  if (!(Number.isFinite(weight) && weight >= min && weight <= max)) return { ok: false, error: `Enter a bodyweight from ${min} to ${max} ${u}.` };
  const [a, b] = u === 'kg' ? PER_KG : PER_LB;
  // trimmed to 6 decimals so binary float drift (180 x 0.7 = 125.99999999999999) cannot flip a .5 when it is rounded
  const exact = (x) => Math.round(x * 1e6) / 1e6;
  const lo = exact(weight * a);
  const hi = exact(weight * b);
  return {
    ok: true,
    unit: u,
    weight,
    low: grams(lo),
    high: grams(hi),
    perMeal: MEALS.map((meals) => ({ meals, low: grams(exact(lo / meals)), high: grams(exact(hi / meals)) })),
  };
}

const fmtW = (x, unit) => `${x.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${unit}`;
const range = (lo, hi) => `${lo} to ${hi} g`;

function init(root) {
  // A plain group of fields, not a <form>: there is nothing to submit, and Enter never sends the number anywhere.
  const fields = root.querySelector('[data-pi-form]');
  if (!fields) return;
  const set = (sel, text) => { const el = root.querySelector(sel); if (el) el.textContent = text; };
  const live = root.querySelector('[data-pi-live]');
  let timer = 0;

  const read = () => ({
    weight: parseFloat(String(fields.querySelector('[name="weight"]').value).replace(',', '.')),
    unit: (fields.querySelector('input[name="unit"]:checked') || {}).value || 'lb',
  });

  const render = (announce) => {
    const input = read();
    const r = protein(input);
    root.classList.toggle('is-invalid', !r.ok);
    clearTimeout(timer);
    if (!r.ok) {
      set('[data-pi-error]', r.error);
      if (live) timer = setTimeout(() => { live.textContent = r.error; }, announce ? 0 : 700);
      return;
    }
    set('[data-pi-error]', '');
    const rate = r.unit === 'kg' ? '1.6 to 2.2 g per kg' : '0.7 to 1 g per lb';
    set('[data-pi-basis]', `Your bodyweight: ${fmtW(input.weight, r.unit)}, at ${rate}.`);
    set('[data-pi-day]', range(r.low, r.high));
    r.perMeal.forEach((m) => set(`[data-pi-meals="${m.meals}"]`, range(m.low, m.high)));
    const say = `About ${range(r.low, r.high)} of protein a day: ${r.perMeal.map((m) => `${range(m.low, m.high)} a meal over ${m.meals} meals`).join(', or ')}.`;
    if (live) timer = setTimeout(() => { live.textContent = say; }, announce ? 0 : 700);
  };

  fields.addEventListener('input', () => render(false));
  fields.addEventListener('change', () => render(false));
  fields.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); render(true); } });
  root.classList.add('is-ready');
}

if (typeof document !== 'undefined') document.querySelectorAll('[data-pi]').forEach(init);
