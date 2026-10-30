// VO2 max calculator, Cooper 12-minute run (/tools/vo2-max-calculator/, tracker BP-T3, Plan 19 lane E). Loaded by a script tag
// on its own page only, not through main.js's lazy() (F-53, as the other tools). Everything runs in the browser: nothing is
// stored or sent (tools/check.mjs holds this file to the same rule as apply.js). The page renders a worked example as plain
// HTML, so it reads the same without this script; the script only recomputes the estimate from the visitor's distance.
// The math is exported so tools/vo2-max.test.mjs can check it in Node.
//
// Scope (rail 4 ruling, decisions/log.md 2026-10-30; seo-geo/factsheets/BP-T3-vo2-max-calculator.md):
//   VO2 max (ml/kg/min) = 22.351 x distance in km - 11.288, Cooper's equation as bandyopadhyay-2015 states it.
//   A fitness estimate only: no category, norm, age band, percentile, health-outcome or longevity output.
export const SLOPE = 22.351;
export const INTERCEPT = -11.288;
export const KM = { m: 0.001, km: 1, mi: 1.609344 }; // km in one unit (the international mile)
// Accepted distances. Not a claim about anyone: the bounds only keep typos (12 km, 300 m) from printing a number.
export const LIMITS = { m: [1000, 5000], km: [1, 5], mi: [0.62, 3.11] };

/** { distance, unit = 'm' } -> { ok: true, vo2, km } or { ok: false, error }. vo2 is rounded to one decimal. */
export function vo2max({ distance, unit = 'm' } = {}) {
  const u = unit in KM ? unit : 'm';
  const [min, max] = LIMITS[u];
  if (!(Number.isFinite(distance) && distance >= min && distance <= max)) return { ok: false, error: `Enter a distance from ${min.toLocaleString('en-US')} to ${max.toLocaleString('en-US')} ${u === 'mi' ? 'miles' : u}.` };
  const km = distance * KM[u];
  return { ok: true, km, vo2: Math.round((SLOPE * km + INTERCEPT) * 10) / 10 };
}

function init(root) {
  // A plain group of fields, not a <form>: there is nothing to submit, and Enter never sends the number anywhere.
  const fields = root.querySelector('[data-vo-form]');
  if (!fields) return;
  const set = (sel, text) => { const el = root.querySelector(sel); if (el) el.textContent = text; };
  const live = root.querySelector('[data-vo-live]');
  let timer = 0;

  const render = (announce) => {
    const input = {
      distance: parseFloat(String(fields.querySelector('[name="distance"]').value).replace(',', '.')),
      unit: (fields.querySelector('input[name="unit"]:checked') || {}).value || 'm',
    };
    const r = vo2max(input);
    root.classList.toggle('is-invalid', !r.ok);
    clearTimeout(timer);
    if (!r.ok) {
      set('[data-vo-error]', r.error);
      if (live) timer = setTimeout(() => { live.textContent = r.error; }, announce ? 0 : 700);
      return;
    }
    set('[data-vo-error]', '');
    const shown = input.distance.toLocaleString('en-US', { maximumFractionDigits: 2 });
    const unitWord = input.unit === 'mi' ? 'miles' : input.unit;
    const inKm = input.unit === 'km' ? '' : ` (${r.km.toLocaleString('en-US', { maximumFractionDigits: 2 })} km)`;
    set('[data-vo-basis]', `${shown} ${unitWord}${inKm} in 12 minutes.`);
    set('[data-vo-out]', `${r.vo2.toFixed(1)} ml/kg/min`);
    const say = `Estimated VO2 max ${r.vo2.toFixed(1)} millilitres per kilogram per minute.`;
    if (live) timer = setTimeout(() => { live.textContent = say; }, announce ? 0 : 700);
  };

  fields.addEventListener('input', () => render(false));
  fields.addEventListener('change', () => render(false));
  fields.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); render(true); } });
  root.classList.add('is-ready');
}

if (typeof document !== 'undefined') document.querySelectorAll('[data-vo]').forEach(init);
