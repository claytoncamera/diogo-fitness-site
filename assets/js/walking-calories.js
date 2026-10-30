// Walking calorie calculator (/tools/walking-calorie-calculator/, tracker BP-T4, Plan 19 lane E). Loaded by a script tag on its
// own page only, not through main.js's lazy() (F-53, as the other tools). Everything runs in the browser: nothing is stored or
// sent (tools/check.mjs holds this file to the same rule as apply.js). The page renders a worked example as plain HTML, so it
// reads the same without this script; the script only recomputes the estimate from the visitor's numbers.
// The math is exported so tools/walking-calories.test.mjs can check it in Node.
//
// Scope (rail 4 ruling, decisions/log.md 2026-10-30; seo-geo/factsheets/BP-T4-walking-calorie-calculator.md):
//   calories = MET x bodyweight in kg x hours, using the Compendium's own definition of a MET as about 1.0 kcal per kg per hour
//   (herrmann-2024) and the Compendium's level-walking MET values exactly as its walking table lists them (pacompendium-walking).
//   An estimate, labelled as one. No weight-loss, pounds-lost, deficit or goal output.
// [code, MET, the Compendium's speed band] for level walking on a firm surface, and on a treadmill at 0% grade.
export const PACES = {
  outdoor: [
    ['17151', 2.3, 'under 2.0 mph'],
    ['17152', 2.8, '2.0 to 2.4 mph'],
    ['17170', 3.0, '2.5 mph'],
    ['17190', 3.8, '2.8 to 3.4 mph'],
    ['17200', 4.8, '3.5 to 3.9 mph'],
    ['17220', 5.5, '4.0 to 4.4 mph'],
    ['17230', 7.0, '4.5 to 4.9 mph'],
    ['17231', 8.5, '5.0 to 5.5 mph'],
  ],
  treadmill: [
    ['17340', 2.1, 'under 1.0 mph'],
    ['17343', 2.3, '1.0 mph'],
    ['17346', 2.8, '1.2 to 1.9 mph'],
    ['17349', 3.0, '2.0 to 2.4 mph'],
    ['17352', 3.5, '2.5 to 2.9 mph'],
    ['17355', 3.8, '3.0 to 3.4 mph'],
    ['17358', 4.8, '3.5 to 3.9 mph'],
    ['17361', 5.8, '4.0 to 4.4 mph'],
    ['17364', 6.8, '4.5 to 4.9 mph'],
    ['17367', 8.3, '5.0 to 5.5 mph'],
  ],
};
export const LB = 0.45359237; // kg in one pound (the international pound)
// Accepted inputs. Not a claim about anyone: the bounds only keep typos from printing a number.
export const LIMITS = { weight: { lb: [66, 660], kg: [30, 300] }, minutes: [1, 600] };

/** Finds a Compendium row by its code, in either list. */
export const pace = (code) => [...PACES.outdoor, ...PACES.treadmill].find((p) => p[0] === code) || null;

/**
 * { weight, unit = 'lb', minutes, code } -> { ok: true, kcal, met, kg, band } or { ok: false, error }.
 * kcal is rounded to the nearest whole calorie.
 */
export function walkingCalories({ weight, unit = 'lb', minutes, code } = {}) {
  const u = unit === 'kg' ? 'kg' : 'lb';
  const [wMin, wMax] = LIMITS.weight[u];
  const [mMin, mMax] = LIMITS.minutes;
  const p = pace(code);
  if (!p) return { ok: false, error: 'Pick a walking pace.' };
  if (!(Number.isFinite(weight) && weight >= wMin && weight <= wMax)) return { ok: false, error: `Enter a bodyweight from ${wMin} to ${wMax} ${u}.` };
  if (!(Number.isFinite(minutes) && minutes >= mMin && minutes <= mMax)) return { ok: false, error: `Enter from ${mMin} to ${mMax} minutes.` };
  const kg = u === 'lb' ? weight * LB : weight;
  // trimmed to 6 decimals so binary float drift cannot flip a .5 when it is rounded
  const exact = Math.round(p[1] * kg * (minutes / 60) * 1e6) / 1e6;
  return { ok: true, kcal: Math.round(exact), met: p[1], kg, band: p[2] };
}

function init(root) {
  // A plain group of fields, not a <form>: there is nothing to submit, and Enter never sends the numbers anywhere.
  const fields = root.querySelector('[data-wc-form]');
  if (!fields) return;
  const set = (sel, text) => { const el = root.querySelector(sel); if (el) el.textContent = text; };
  const live = root.querySelector('[data-wc-live]');
  let timer = 0;
  const num = (name) => parseFloat(String(fields.querySelector(`[name="${name}"]`).value).replace(',', '.'));

  const render = (announce) => {
    const input = {
      weight: num('weight'),
      minutes: num('minutes'),
      unit: (fields.querySelector('input[name="unit"]:checked') || {}).value || 'lb',
      code: fields.querySelector('[name="pace"]').value,
    };
    const r = walkingCalories(input);
    root.classList.toggle('is-invalid', !r.ok);
    clearTimeout(timer);
    if (!r.ok) {
      set('[data-wc-error]', r.error);
      if (live) timer = setTimeout(() => { live.textContent = r.error; }, announce ? 0 : 700);
      return;
    }
    set('[data-wc-error]', '');
    const where = pace(input.code) && PACES.treadmill.some((p) => p[0] === input.code) ? 'on a treadmill at 0% grade' : 'on level ground';
    set('[data-wc-basis]', `${input.weight.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${input.unit}, ${input.minutes.toLocaleString('en-US', { maximumFractionDigits: 0 })} minutes at ${r.band} ${where}: ${r.met} METs.`);
    set('[data-wc-out]', `about ${r.kcal.toLocaleString('en-US')} calories`);
    const say = `About ${r.kcal} calories, an estimate.`;
    if (live) timer = setTimeout(() => { live.textContent = say; }, announce ? 0 : 700);
  };

  fields.addEventListener('input', () => render(false));
  fields.addEventListener('change', () => render(false));
  fields.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); render(true); } });
  root.classList.add('is-ready');
}

if (typeof document !== 'undefined') document.querySelectorAll('[data-wc]').forEach(init);
