// Running pace calculator (/tools/running-pace-calculator/, tracker P20-T5, Plan 20 lane E). Loaded by a script tag on its own page
// only, not through main.js's lazy() (F-53, as the other tools). Everything runs in the browser: nothing is stored or sent
// (tools/check.mjs holds this file to the same rule as apply.js). The page renders a worked example as plain HTML (a 5 km run in
// 25:00, its splits and its race-time estimates), so it reads the same without this script; the script only recomputes from the
// visitor's numbers. The math is exported so tools/running-pace.test.mjs can check it in Node.
//
// Scope (Clayton's ruling, decisions/log.md 2026-10-31; seo-geo/factsheets/P20-T5-running-pace-calculator.md):
//   pace = time / distance, and the two rearrangements; splits are even splits (practical, labelled so on the page);
//   the race-time estimate is Riegel's formula, T2 = T1 x (D2 / D1)^1.06, labelled an estimate on the page, with the exponent,
//   its source and its limits stated. No steps-to-miles mode (no stride source), no training-zone, health or outcome output.
export const KM_PER_MILE = 1609.344 / 1000; // the international mile, exact (NIST SP 811 Appendix B.8: 1.609 344 E+03 m)
export const KM = { km: 1, mi: KM_PER_MILE }; // km in one unit
export const EXPONENT = 1.06; // Riegel's exponent as the studies cited on the page state it
// Roughly the times the formula was described for: about 3 to 230 minutes (van der Zwaard 2021, citing Riegel 1981), in seconds.
export const RANGE = [180, 13800];
// The distances the estimate table shows, in km. The marathon is 42.195 km; the half marathon is half of that.
export const TARGETS = [['1 mile', KM_PER_MILE], ['5 km', 5], ['10 km', 10], ['Half marathon', 21.0975], ['Marathon', 42.195]];
// Accepted inputs. Not a claim about anyone: the bounds only keep typos from printing a number (and cap the split table).
export const LIMITS = { distance: { km: [0.4, 50], mi: [0.25, 31] }, time: [60, 36000], pace: [60, 1800] };

const NUM = /^\d+(?:\.\d+)?$/;

/** "25:00", "1:55:30", "4:59.5" or a lone number of minutes ("25") -> seconds, or null when it is not a time. */
export function parseClock(text) {
  const parts = String(text ?? '').trim().split(':');
  if (parts.length > 3 || parts.some((p) => !NUM.test(p.trim()))) return null;
  const n = parts.map((p) => parseFloat(p));
  if (n.length === 1) return n[0] * 60;
  const sec = n[n.length - 1];
  const min = n[n.length - 2];
  if (sec >= 60) return null;
  if (n.length === 2) return min * 60 + sec;
  if (min >= 60) return null;
  return n[0] * 3600 + min * 60 + sec;
}

/** Seconds -> "m:ss" under an hour, "h:mm:ss" from an hour up, rounded to the nearest second. */
export function fmtClock(seconds) {
  const t = Math.round(seconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

const unitWord = (u) => (u === 'mi' ? 'miles' : 'km');
const range = (u) => LIMITS.distance[u].map((n) => n.toLocaleString('en-US')).join(' to ');

/**
 * { solve: 'pace' | 'time' | 'distance', distance, unit = 'km', time (seconds), pace (seconds per unit) }
 *   -> { ok: true, km, time, paceKm, paceMi } (all in km and seconds, unrounded) or { ok: false, error }.
 * Only the two quantities that are not being solved for are read.
 */
export function solve({ solve: what = 'pace', distance, unit = 'km', time, pace } = {}) {
  const u = unit === 'mi' ? 'mi' : 'km';
  const need = { pace: ['distance', 'time'], time: ['distance', 'pace'], distance: ['time', 'pace'] }[what];
  if (!need) return { ok: false, error: 'Choose what to work out.' };
  const [dMin, dMax] = LIMITS.distance[u];
  if (need.includes('distance') && !(Number.isFinite(distance) && distance >= dMin && distance <= dMax)) return { ok: false, error: `Enter a distance from ${range(u)} ${unitWord(u)}.` };
  if (need.includes('time') && !(Number.isFinite(time) && time >= LIMITS.time[0] && time <= LIMITS.time[1])) return { ok: false, error: 'Enter a time from 1:00 to 10:00:00, as m:ss or h:mm:ss.' };
  if (need.includes('pace') && !(Number.isFinite(pace) && pace >= LIMITS.pace[0] && pace <= LIMITS.pace[1])) return { ok: false, error: `Enter a pace from 1:00 to 30:00 per ${unitWord(u)}, as m:ss.` };
  let km = distance * KM[u];
  let t = time;
  let paceKm = pace / KM[u];
  if (what === 'pace') paceKm = t / km;
  else if (what === 'time') t = paceKm * km;
  else {
    km = t / paceKm;
    if (km < LIMITS.distance.km[0] || km > LIMITS.distance.km[1]) return { ok: false, error: `That works out to ${(km / KM[u]).toLocaleString('en-US', { maximumFractionDigits: 1 })} ${unitWord(u)}, outside this tool's ${range(u)} ${unitWord(u)}.` };
  }
  return { ok: true, km, time: t, paceKm, paceMi: paceKm * KM_PER_MILE };
}

/**
 * Even splits. (distance in km, pace in seconds per km, unit) -> [{ label, split, total }] with one row for every whole unit
 * and a last row for the part left over, if any. split is the time for that row's stretch, total the time at its mark.
 */
export function splits(km, paceKm, unit = 'km') {
  const u = unit === 'mi' ? 'mi' : 'km';
  const dist = km / KM[u];
  const whole = Math.floor(dist + 1e-6);
  const per = paceKm * KM[u];
  const rows = [];
  for (let n = 1; n <= whole; n++) rows.push({ label: `${n} ${u}`, split: per, total: per * n });
  if (dist - whole > 1e-6) rows.push({ label: `${(Math.round(dist * 1000) / 1000).toLocaleString('en-US')} ${u}`, split: per * (dist - whole), total: paceKm * km });
  return rows;
}

/** Riegel's estimate: T2 = T1 x (D2 / D1)^1.06. Times in seconds, distances in any one unit. */
export const riegel = (t1, d1, d2, k = EXPONENT) => t1 * Math.pow(d2 / d1, k);

/**
 * (time in seconds, distance in km) -> { inRange, rows: [{ label, km, time, paceKm, paceMi, inRange }] }.
 * inRange is false for a time outside RANGE, the roughly 3 to 230 minutes the formula was described for.
 */
export function predictions(t1, d1) {
  const inside = (t) => t >= RANGE[0] && t <= RANGE[1];
  return {
    inRange: inside(t1),
    rows: TARGETS.map(([label, km]) => {
      const time = riegel(t1, d1, km);
      return { label, km, time, paceKm: time / km, paceMi: (time / km) * KM_PER_MILE, inRange: inside(time) };
    }),
  };
}

const cell = (t) => `<td>${t}</td>`;
const splitHtml = (rows) => rows.map((r) => `<tr>${cell(r.label)}${cell(fmtClock(r.split))}${cell(fmtClock(r.total))}</tr>`).join('');
const predictHtml = (rows) => rows.map((r) => `<tr>${cell(r.label)}${cell(fmtClock(r.time) + (r.inRange ? '' : ' †'))}${cell(fmtClock(r.paceKm))}${cell(fmtClock(r.paceMi))}</tr>`).join('');
const dist = (n) => (Math.round(n * 1000) / 1000).toLocaleString('en-US');

function init(root) {
  // A plain group of fields, not a <form>: there is nothing to submit, and Enter never sends the numbers anywhere.
  const fields = root.querySelector('[data-rp-form]');
  if (!fields) return;
  const set = (sel, text) => { const el = root.querySelector(sel); if (el) el.textContent = text; };
  const html = (sel, markup) => { const el = root.querySelector(sel); if (el) el.innerHTML = markup; };
  const live = root.querySelector('[data-rp-live]');
  const field = (name) => fields.querySelector(`[name="${name}"]`);
  const checked = (name, fallback) => (fields.querySelector(`input[name="${name}"]:checked`) || {}).value || fallback;
  let timer = 0;

  const render = (announce) => {
    const what = checked('solve', 'pace');
    const unit = checked('unit', 'km');
    const r = solve({
      solve: what,
      unit,
      distance: parseFloat(String(field('distance').value).replace(',', '.')),
      time: parseClock(field('time').value),
      pace: parseClock(field('pace').value),
    });
    root.classList.toggle('is-invalid', !r.ok);
    clearTimeout(timer);
    if (!r.ok) {
      set('[data-rp-error]', r.error);
      if (live) timer = setTimeout(() => { live.textContent = r.error; }, announce ? 0 : 700);
      return;
    }
    set('[data-rp-error]', '');
    const per = unitWord(unit); // 'km' or 'miles'
    const one = unit === 'mi' ? 'mile' : 'km'; // 'per mile', 'per km'
    const inUnit = r.km / KM[unit];
    const paceHere = fmtClock(r.paceKm * KM[unit]);
    const big = what === 'pace' ? `${paceHere} per ${one}` : what === 'time' ? fmtClock(r.time) : `${dist(inUnit)} ${per}`;
    set('[data-rp-basis]', `${dist(inUnit)} ${per} in ${fmtClock(r.time)}, at ${paceHere} per ${one}.`);
    set('[data-rp-out]', big);
    const mph = (r.km / KM_PER_MILE) / (r.time / 3600);
    set('[data-rp-also]', `${fmtClock(r.paceKm)} per km, ${fmtClock(r.paceMi)} per mile; ${(r.km / (r.time / 3600)).toFixed(1)} km/h, ${mph.toFixed(1)} mph.`);
    set('[data-rp-splits-head]', `Even splits, every ${unit === 'mi' ? 'mile' : 'kilometre'}`);
    html('[data-rp-splits]', splitHtml(splits(r.km, r.paceKm, unit)));
    const p = predictions(r.time, r.km);
    html('[data-rp-predict]', predictHtml(p.rows));
    const notes = [];
    if (!p.inRange) notes.push('Your time is outside the roughly 3 to 230 minutes the formula was described for, so read these as rough.');
    if (p.rows.some((row) => !row.inRange)) notes.push('† marks an estimate outside that same range.');
    set('[data-rp-warn]', notes.join(' '));
    const say = `${big}. ${fmtClock(r.paceKm)} per kilometre, ${fmtClock(r.paceMi)} per mile.`;
    if (live) timer = setTimeout(() => { live.textContent = say; }, announce ? 0 : 700);
  };

  // Choosing a race distance fills the distance box in the unit that is selected; typing a distance puts the list back on Custom.
  const fillPreset = () => {
    const km = parseFloat(field('preset').value);
    if (Number.isFinite(km)) field('distance').value = String(Math.round((km / KM[checked('unit', 'km')]) * 1000) / 1000);
  };
  fields.addEventListener('input', (e) => {
    if (e && e.target && e.target.name === 'distance') field('preset').value = 'custom';
    render(false);
  });
  fields.addEventListener('change', (e) => {
    const name = e && e.target ? e.target.name : '';
    if (name === 'preset' || name === 'unit') fillPreset();
    render(false);
  });
  fields.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); render(true); } });
  root.classList.add('is-ready');
}

if (typeof document !== 'undefined') document.querySelectorAll('[data-rp]').forEach(init);
