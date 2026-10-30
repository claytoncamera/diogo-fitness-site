// Strength score (DOTS) calculator (/tools/strength-score-calculator/, tracker BP-T2, Plan 19 lane E). Loaded by a script tag
// on its own page only, not through main.js's lazy() (F-53, as the other tools). Everything runs in the browser: nothing is
// stored or sent (tools/check.mjs holds this file to the same rule as apply.js). The page renders a worked example as plain
// HTML, so it reads the same without this script; the script only recomputes the score from the visitor's numbers.
// The math is exported so tools/strength-score.test.mjs can check it in Node.
//
// Scope (rail 4 ruling, decisions/log.md 2026-10-30; seo-geo/factsheets/BP-T2-strength-score-calculator.md):
//   DOTS = total x 500 / (A*bw^4 + B*bw^3 + C*bw^2 + D*bw + E), bodyweight in kg, clamped to 40-210 kg (men's formula) or
//   40-150 kg (women's formula), with the coefficients exactly as the OpenPowerlifting project's reference code publishes them
//   (openpowerlifting-dots). No percentile, "strength standard", level or ranking output: the score and the formula only.
export const COEF = {
  m: [-0.000001093, 0.0007391293, -0.1918759221, 24.0900756, -307.75076],
  f: [-0.0000010706, 0.0005158568, -0.1126655495, 13.6175032, -57.96288],
};
export const CLAMP = { m: [40, 210], f: [40, 150] };
export const LB = 0.45359237; // kg in one pound (the international pound)
// Accepted inputs. Not a claim about anyone: the bounds only keep typos (a 9,000 lb total, a 3 kg lifter) from printing a score.
export const LIMITS = { bw: { kg: [30, 300], lb: [66, 660] }, total: { kg: [1, 1500], lb: [2, 3300] } };

/** The polynomial in the denominator, a*x^4 + b*x^3 + c*x^2 + d*x + e. */
export const poly4 = ([a, b, c, d, e], x) => (((a * x + b) * x + c) * x + d) * x + e;

/**
 * { bodyweight, total, unit = 'kg', sex = 'm' } -> { ok: true, score, bwKg, totalKg, clamped, sex } or { ok: false, error }.
 * score is rounded to two decimals, as OpenPowerlifting prints it.
 */
export function dots({ bodyweight, total, unit = 'kg', sex = 'm' } = {}) {
  const u = unit === 'lb' ? 'lb' : 'kg';
  const s = sex === 'f' ? 'f' : 'm';
  const [bwMin, bwMax] = LIMITS.bw[u];
  const [tMin, tMax] = LIMITS.total[u];
  if (!(Number.isFinite(bodyweight) && bodyweight >= bwMin && bodyweight <= bwMax)) return { ok: false, error: `Enter a bodyweight from ${bwMin} to ${bwMax} ${u}.` };
  if (!(Number.isFinite(total) && total >= tMin && total <= tMax)) return { ok: false, error: `Enter a total from ${tMin} to ${tMax.toLocaleString('en-US')} ${u}.` };
  const k = u === 'lb' ? LB : 1;
  const bwKg = bodyweight * k;
  const totalKg = total * k;
  const [lo, hi] = CLAMP[s];
  const x = Math.min(Math.max(bwKg, lo), hi);
  const score = Math.round(((totalKg * 500) / poly4(COEF[s], x)) * 100) / 100;
  return { ok: true, score, bwKg, totalKg, sex: s, clamped: x !== bwKg ? x : 0 };
}

const fmt = (x, d = 1) => x.toLocaleString('en-US', { maximumFractionDigits: d });

function init(root) {
  // A plain group of fields, not a <form>: there is nothing to submit, and Enter never sends the numbers anywhere.
  const fields = root.querySelector('[data-ss-form]');
  if (!fields) return;
  const set = (sel, text) => { const el = root.querySelector(sel); if (el) el.textContent = text; };
  const live = root.querySelector('[data-ss-live]');
  let timer = 0;
  const num = (name) => parseFloat(String(fields.querySelector(`[name="${name}"]`).value).replace(',', '.'));
  const radio = (name, fallback) => (fields.querySelector(`input[name="${name}"]:checked`) || {}).value || fallback;

  const render = (announce) => {
    const input = { bodyweight: num('bodyweight'), total: num('total'), unit: radio('unit', 'kg'), sex: radio('sex', 'm') };
    const r = dots(input);
    root.classList.toggle('is-invalid', !r.ok);
    clearTimeout(timer);
    if (!r.ok) {
      set('[data-ss-error]', r.error);
      if (live) timer = setTimeout(() => { live.textContent = r.error; }, announce ? 0 : 700);
      return;
    }
    set('[data-ss-error]', '');
    const formula = r.sex === 'f' ? 'women’s' : 'men’s';
    const inKg = input.unit === 'lb' ? ` (${fmt(r.bwKg)} kg)` : '';
    set('[data-ss-basis]', `Bodyweight ${fmt(input.bodyweight)} ${input.unit}${inKg}, total ${fmt(input.total)} ${input.unit}, ${formula} formula.`);
    set('[data-ss-score]', r.score.toFixed(2));
    set('[data-ss-note]', r.clamped ? `The formula stops at ${r.clamped} kg of bodyweight, so it used ${r.clamped} kg.` : '');
    const say = `DOTS score ${r.score.toFixed(2)}.`;
    if (live) timer = setTimeout(() => { live.textContent = say; }, announce ? 0 : 700);
  };

  fields.addEventListener('input', () => render(false));
  fields.addEventListener('change', () => render(false));
  fields.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); render(true); } });
  root.classList.add('is-ready');
}

if (typeof document !== 'undefined') document.querySelectorAll('[data-ss]').forEach(init);
