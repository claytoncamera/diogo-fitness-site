// Heart rate zone calculator (/tools/heart-rate-zone-calculator/, tracker X-04-4). Loaded by a script tag on its own page only,
// not through main.js's lazy() (F-53, as the other tools). Everything runs in the browser: nothing is stored or sent
// (tools/check.mjs holds this file to the same rule as apply.js). The page renders a worked example (age 30, resting heart
// rate 60) as plain HTML, so it reads the same without this script; the script only recomputes it from the visitor's numbers.
// Every element it updates sits inside the [data-hr] box. The math is exported so tools/heart-rate-zones.test.mjs can check it
// in Node (seo-geo/factsheets/X-04-hr-zones.md, section B).

// Max heart rate from age, as the cited papers state the two equations (fact sheet rows A1, A2):
//   208 - 0.7 x age (the 2001 meta-analysis; the one the tables use, as /learn/zone-2-cardio/ does)
//   220 - age (the traditional one, shown beside it)
export const TANAKA = { a: 208, b: 0.7 };
export const TRADITIONAL = 220;
export const TYPICAL_MISS = 11; // about one standard error of the estimate, 11.4 beats (fact sheet A4)
export const AGE = { min: 18, max: 80 };
export const MAX_HR = { min: 100, max: 230 };
export const REST_HR = { min: 30, max: 120 };

// The five-zone scale, as percent of max (fact sheet A6 to A9). Each edge is shared by the two zones it separates.
export const ZONES = [
  { zone: 1, lo: 60, hi: 72, talk: 'Talking is easy' },
  { zone: 2, lo: 72, hi: 82, talk: 'Full sentences, but not effortless' },
  { zone: 3, lo: 82, hi: 87, talk: 'Talking turns uncertain' },
  { zone: 4, lo: 87, hi: 92, talk: 'Talking is uncomfortable' },
  { zone: 5, lo: 92, hi: 100, talk: 'A few words at a time' },
];
// Zone 2 three ways, the three ranges /learn/zone-2-cardio/ prints (fact sheet A6, A10).
export const MODERATE_OF_MAX = [64, 76];
export const MODERATE_OF_RESERVE = [40, 59];

/** Whole beats, halves up (the small offset keeps 134.5 from landing on 134 through floating-point error). */
export const beats = (x) => Math.round(x + 1e-9);
export const tanaka = (age) => beats(TANAKA.a - TANAKA.b * age);
export const traditional = (age) => TRADITIONAL - age;
/** A share of the max: pct x max. */
export const ofMax = (max, pct) => beats((max * pct) / 100);
/** A share of the reserve, added to the resting rate: rest + pct x (max - rest). */
export const ofReserve = (max, rest, pct) => beats(rest + ((max - rest) * pct) / 100);

const blank = (v) => v === null || v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v));

/**
 * { age, max?, rest? } -> { ok: true, ... } or { ok: false, error }.
 * max = a measured max heart rate (overrides the estimate); rest = resting heart rate (adds the reserve method).
 */
export function zones({ age, max, rest } = {}) {
  if (!(Number.isInteger(age) && age >= AGE.min && age <= AGE.max)) return { ok: false, error: `Enter your age, from ${AGE.min} to ${AGE.max}.` };
  const measured = !blank(max);
  if (measured && !(Number.isFinite(max) && max >= MAX_HR.min && max <= MAX_HR.max))
    return { ok: false, error: `Enter a measured max from ${MAX_HR.min} to ${MAX_HR.max}, or leave it blank.` };
  const hasRest = !blank(rest);
  if (hasRest && !(Number.isFinite(rest) && rest >= REST_HR.min && rest <= REST_HR.max))
    return { ok: false, error: `Enter a resting heart rate from ${REST_HR.min} to ${REST_HR.max}, or leave it blank.` };
  const estimate = tanaka(age);
  const used = measured ? beats(max) : estimate;
  const r = hasRest ? beats(rest) : null;
  if (hasRest && r >= used - 20) return { ok: false, error: 'Resting heart rate has to be well below the max.' };
  const range = (lo, hi) => ({ lo, hi });
  const z2 = {
    max: range(ofMax(used, ZONES[1].lo), ofMax(used, ZONES[1].hi)),
    moderate: range(ofMax(used, MODERATE_OF_MAX[0]), ofMax(used, MODERATE_OF_MAX[1])),
    reserve: hasRest ? range(ofReserve(used, r, MODERATE_OF_RESERVE[0]), ofReserve(used, r, MODERATE_OF_RESERVE[1])) : null,
  };
  const all = [z2.max, z2.moderate, z2.reserve].filter(Boolean);
  const overlap = range(Math.max(...all.map((x) => x.lo)), Math.min(...all.map((x) => x.hi)));
  return {
    ok: true,
    age,
    measured,
    estimate,
    traditional: traditional(age),
    max: used,
    rest: r,
    miss: measured ? null : range(used - TYPICAL_MISS, used + TYPICAL_MISS),
    zones: ZONES.map((z) => ({ ...z, from: ofMax(used, z.lo), to: z.hi === 100 ? used : ofMax(used, z.hi) })),
    zone2: z2,
    ranges: all.length,
    overlap: overlap.lo <= overlap.hi ? overlap : null,
  };
}

export const span = (x) => `${x.lo} to ${x.hi}`;

/** The line under the zone 2 table. */
export function overlapText(r) {
  const n = r.ranges === 3 ? 'three' : 'two';
  if (!r.overlap) return `For these numbers the ${n} ranges don’t all overlap. Start low in the 72 to 82% range and let the talk test decide.`;
  const where = r.overlap.lo === r.overlap.hi ? `at about ${r.overlap.lo}` : `from ${span(r.overlap)}`;
  return `The ${n} ranges overlap ${where} beats a minute: start there and let the talk test decide.`;
}

/** The line under the big number: both equations, and which one the tables use. */
export function formulasText(r) {
  const both = `208 − 0.7 × age gives ${r.estimate}; 220 − age gives ${r.traditional}.`;
  return r.measured ? `For age ${r.age}, ${both} The tables use your measured max.` : `${both} The tables use the first.`;
}

function init(root) {
  // A plain group of fields, not a <form>: there is nothing to submit, and Enter never sends the numbers anywhere.
  const fields = root.querySelector('[data-hr-form]');
  if (!fields) return;
  const $ = (sel) => root.querySelector(sel);
  const set = (sel, text) => { const el = $(sel); if (el) el.textContent = text; };
  const show = (sel, on) => { const el = $(sel); if (el) el.hidden = !on; };
  const field = (name) => fields.querySelector(`[name="${name}"]`);
  const num = (name) => { const v = String(field(name).value).trim().replace(',', '.'); return v === '' ? null : Number(v); };
  const live = $('[data-hr-live]');
  let timer = 0;

  const render = (announce) => {
    const input = { age: num('age'), max: num('max'), rest: num('rest') };
    const r = zones(input);
    root.classList.toggle('is-invalid', !r.ok);
    clearTimeout(timer);
    const speak = (msg) => { if (live && announce !== null) timer = setTimeout(() => { live.textContent = msg; }, announce ? 0 : 700); };
    if (!r.ok) {
      set('[data-hr-error]', r.error);
      speak(r.error);
      return;
    }
    set('[data-hr-error]', '');
    set('[data-hr-basis]', `Your numbers: age ${r.age}, ${r.rest === null ? 'no resting heart rate' : `resting heart rate ${r.rest}`}, ${r.measured ? `measured max ${r.max}` : 'no measured max'}.`);
    set('[data-hr-max-label]', r.measured ? 'Your measured max heart rate' : 'Estimated max heart rate');
    set('[data-hr-max]', String(r.max));
    set('[data-hr-formulas]', formulasText(r));
    show('[data-hr-miss]', !r.measured);
    if (r.miss) set('[data-hr-miss]', `A typical miss is about ${TYPICAL_MISS} beats either way: ${span(r.miss)} here.`);
    r.zones.forEach((z) => set(`[data-hr-zone="${z.zone}"]`, `${z.from} to ${z.to}`));
    set('[data-hr-z2="max"]', span(r.zone2.max));
    set('[data-hr-z2="moderate"]', span(r.zone2.moderate));
    show('[data-hr-reserve-row]', !!r.zone2.reserve);
    if (r.zone2.reserve) set('[data-hr-z2="reserve"]', span(r.zone2.reserve));
    show('[data-hr-reserve-note]', !r.zone2.reserve);
    set('[data-hr-overlap]', overlapText(r));
    speak(`${r.measured ? 'Measured' : 'Estimated'} max ${r.max} beats a minute. Zone 2, 72 to 82% of max: ${span(r.zone2.max)}. ${overlapText(r)}`);
  };

  fields.addEventListener('input', () => render(false));
  fields.addEventListener('change', () => render(false));
  fields.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); render(true); } });
  root.classList.add('is-ready');
  render(null); // quietly, in case the browser restored typed values (Back): nothing is announced on load
}

if (typeof document !== 'undefined') document.querySelectorAll('[data-hr]').forEach(init);
