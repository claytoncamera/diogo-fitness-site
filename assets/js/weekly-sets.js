// Weekly sets planner (/tools/weekly-sets-planner/, tracker P20-T6, Plan 20 lane E). Loaded by a script tag on its own page only, not
// through main.js's lazy() (F-53, as the other tools). Everything runs in the browser: nothing is stored or sent (tools/check.mjs holds
// this file to the same rule as apply.js). The page renders a worked example week as plain HTML, so it reads the same without this
// script; the script only recomputes it from the visitor's choices. The math is exported so tools/weekly-sets.test.mjs can check it in Node.
//
// Scope (Clayton's rail-4 ruling, decisions/log.md 2026-10-31; seo-geo/factsheets/P20-T6-weekly-sets-planner.md):
//   every weekly set count is a number inside a range the live /learn/how-many-sets-per-week/ page already states and cites:
//     new to lifting 6 to 10 (that page's own range for beginners; the 4-set floor and the 10-set line it cites sit under and at its ends),
//     trained a year or more 10 to 20 (the page's range; ACSM 2026's "10 or more", diminishing returns past about 18 to 20, and
//     Baz-Valle 2022's 12 to 20 in young trained men).
//   Labelled practical on the page, no outcome promise: no muscle, strength, fat or timeline output of any kind.
//   How the sets are split is practical too: at least two sessions per muscle, about five sets or fewer per muscle per session
//   (the sets page's own examples: ten sets over two sessions is five each, over three sessions three or four).

// id, label, the live page that has that muscle's exercises
export const MUSCLES = [
  { id: 'chest', label: 'Chest', href: '/learn/chest-workout/' },
  { id: 'back', label: 'Back', href: '/learn/back-workout/' },
  { id: 'shoulders', label: 'Shoulders', href: '/learn/shoulder-workout/' },
  { id: 'quads', label: 'Quads', href: '/learn/leg-day-workout/' },
  { id: 'hamstrings', label: 'Hamstrings', href: '/learn/hamstring-workout/' },
  { id: 'glutes', label: 'Glutes', href: '/learn/glute-workout/' },
  { id: 'biceps', label: 'Biceps', href: '/learn/arm-workout/' },
  { id: 'triceps', label: 'Triceps', href: '/learn/arm-workout/' },
  { id: 'calves', label: 'Calves', href: '/learn/calf-workout/' },
  { id: 'abs', label: 'Abs', href: '/learn/core-workout/' },
];
// Weekly hard sets per muscle: [low end, middle, high end] of each range.
export const RANGES = { new: [6, 8, 10], trained: [10, 15, 20] };
export const PRIORITIES = ['low', 'mid', 'high'];
export const LEVEL_LABEL = { new: 'new to lifting', trained: 'trained a year or more' };
export const DAYS = [2, 6];
export const PER_SESSION = 5; // practical: about five sets or fewer per muscle per session

/** Weekly hard sets for a level and a priority, or null. */
export const weeklySets = (level, priority) => (RANGES[level] && PRIORITIES.includes(priority) ? RANGES[level][PRIORITIES.indexOf(priority)] : null);

/** How many days a muscle trains: at least two, enough that a session holds about five sets or fewer, never more than the days available. */
export const sessionsFor = (sets, days) => Math.min(days, Math.max(2, Math.ceil(sets / PER_SESSION)));

/** Splits sets over sessions as evenly as whole sets allow, the extra sets going to the earlier sessions: 10 over 3 is 4, 3, 3. */
export const splitSets = (sets, sessions) => Array.from({ length: sessions }, (_, k) => Math.floor(sets / sessions) + (k < sets % sessions ? 1 : 0));

/** The days (0-based, ascending) of one evenly spaced pattern of f sessions over d days, rotated by shift. */
export const pattern = (d, f, shift) => Array.from({ length: f }, (_, k) => (shift + Math.floor((k * d) / f)) % d).sort((a, b) => a - b);

/**
 * { days (2 to 6), level ('new' | 'trained'), picks: [{ id, priority }] }
 *   -> { ok: true, muscles: [{ id, label, href, priority, sets, sessions, perSession, days }], days: [{ day, items: [{ id, label, sets }], total }], total, heavy }
 *   or { ok: false, error }.
 * Muscles are placed in list order; each takes the evenly spaced pattern of days (rotated) whose days carry the least so far,
 * the lowest rotation winning a tie. heavy is true when any muscle has more than five sets in one session.
 */
export function plan({ days, level, picks } = {}) {
  if (!Number.isInteger(days) || days < DAYS[0] || days > DAYS[1]) return { ok: false, error: `Choose from ${DAYS[0]} to ${DAYS[1]} training days.` };
  if (!RANGES[level]) return { ok: false, error: 'Choose your experience.' };
  const chosen = MUSCLES.map((m) => ({ ...m, priority: (picks || []).find((p) => p && p.id === m.id)?.priority })).filter((m) => m.priority);
  if (!chosen.length) return { ok: false, error: 'Choose at least one muscle.' };
  if (chosen.some((m) => !PRIORITIES.includes(m.priority))) return { ok: false, error: 'Choose the low end, middle or high end for each muscle.' };
  const load = Array(days).fill(0);
  const muscles = chosen.map((m) => {
    const sets = weeklySets(level, m.priority);
    const sessions = sessionsFor(sets, days);
    let best = null;
    for (let shift = 0; shift < days; shift++) {
      const d = pattern(days, sessions, shift);
      const cost = d.reduce((sum, x) => sum + load[x], 0);
      if (!best || cost < best.cost) best = { d, cost };
    }
    const perSession = splitSets(sets, sessions);
    best.d.forEach((x, k) => { load[x] += perSession[k]; });
    return { id: m.id, label: m.label, href: m.href, priority: m.priority, sets, sessions, perSession, days: best.d };
  });
  const byDay = Array.from({ length: days }, (_, i) => ({ day: i + 1, items: [], total: 0 }));
  for (const m of muscles) m.days.forEach((x, k) => { byDay[x].items.push({ id: m.id, label: m.label, sets: m.perSession[k] }); byDay[x].total += m.perSession[k]; });
  return {
    ok: true,
    muscles,
    days: byDay,
    total: muscles.reduce((sum, m) => sum + m.sets, 0),
    heavy: muscles.some((m) => Math.max(...m.perSession) > PER_SESSION),
  };
}

const cell = (t) => `<td>${t}</td>`;
const weeklyHtml = (muscles) => muscles.map((m) => `<tr>${cell(`<a href="${m.href}">${m.label}</a>`)}${cell(String(m.sets))}${cell(String(m.sessions))}${cell(m.perSession.join(' + '))}</tr>`).join('');
const daysHtml = (days) => days.map((d) => `<tr>${cell(`Day ${d.day}`)}${cell(d.items.length ? d.items.map((i) => `${i.label} ${i.sets}`).join(', ') : 'Rest from lifting these')}${cell(String(d.total))}</tr>`).join('');

function init(root) {
  // A plain group of fields, not a <form>: there is nothing to submit, and Enter never sends the choices anywhere.
  const fields = root.querySelector('[data-ws-form]');
  if (!fields) return;
  const set = (sel, text) => { const el = root.querySelector(sel); if (el) el.textContent = text; };
  const html = (sel, markup) => { const el = root.querySelector(sel); if (el) el.innerHTML = markup; };
  const live = root.querySelector('[data-ws-live]');
  const checked = (name, fallback) => (fields.querySelector(`input[name="${name}"]:checked`) || {}).value || fallback;
  let timer = 0;

  const render = (announce) => {
    const level = checked('level', 'new');
    const days = parseInt(checked('days', '3'), 10);
    const picks = MUSCLES.map((m) => ({ id: m.id, priority: (fields.querySelector(`[name="m-${m.id}"]`) || {}).value || '' }));
    const r = plan({ days, level, picks });
    root.classList.toggle('is-invalid', !r.ok);
    clearTimeout(timer);
    if (!r.ok) {
      set('[data-ws-error]', r.error);
      if (live) timer = setTimeout(() => { live.textContent = r.error; }, announce ? 0 : 700);
      return;
    }
    set('[data-ws-error]', '');
    set('[data-ws-basis]', `${days} training days, ${LEVEL_LABEL[level]}: ${r.total} hard sets across the week.`);
    html('[data-ws-weekly]', weeklyHtml(r.muscles));
    html('[data-ws-days]', daysHtml(r.days));
    set('[data-ws-warn]', r.heavy ? 'On this many days, some muscles get more than five sets in one session. More training days, or a lower priority for that muscle, spreads them out.' : '');
    const say = `${r.total} hard sets across ${days} days.`;
    if (live) timer = setTimeout(() => { live.textContent = say; }, announce ? 0 : 700);
  };

  fields.addEventListener('input', () => render(false));
  fields.addEventListener('change', () => render(false));
  fields.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); render(true); } });
  root.classList.add('is-ready');
}

if (typeof document !== 'undefined') document.querySelectorAll('[data-ws]').forEach(init);
