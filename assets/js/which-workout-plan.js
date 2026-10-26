// Which workout plan? (/tools/which-workout-plan/, tracker CG-09, the fifth /tools/ page). Loaded by a script tag on its own
// page only, not through main.js's lazy() (F-53, as the other tools). Everything runs in the browser: nothing is stored or
// sent (tools/check.mjs holds this file to the same rule as apply.js). The page renders a worked example and a plain table of
// every answer as HTML, so it reads the same without this script; the script only re-reads the visitor's answers.
//
// The routing is the "How to pick one" table on /learn/workout-plans/ (the plans hub), row by row: the beginner row first (the
// hub's FAQ sends every beginner to the first four weeks, whatever the days), then the situation rows, then the days. Every cell
// carries its own reason, so the reason always describes the plan actually linked. It is exported so
// tools/which-workout-plan.test.mjs can check every answer combination in Node, and the page's own table, against it and
// against the hub's table.

// The twelve live plans: the link text and the one-line description from the hub's cards (/learn/workout-plans/).
export const PLANS = {
  'how-to-start-lifting-weights': { name: 'How to start lifting weights', line: 'The first four weeks of lifting, written out: six movements, short full-body sessions, weights that feel too easy at first, and a rule for when to add more.' },
  'dumbbell-workout-plan': { name: 'The dumbbell workout plan', line: 'Three full-body sessions of about forty minutes, six dumbbell movements each, and what to change once the dumbbells start to feel light.' },
  'bodyweight-workout': { name: 'The bodyweight workout', line: 'A full-body plan for a living room, with an easier and a harder version of every movement.' },
  '30-minute-workout': { name: 'The 30-minute workout', line: 'One full-body session that fits thirty minutes, a gym and a home option for every exercise, and what to cut first.' },
  'college-workout-routine': { name: 'The college workout routine', line: 'Three full-body sessions fitted around your classes, with a two-day version for exam weeks. Each exercise has a campus-gym and a dorm-room version.' },
  'hotel-workout': { name: 'The hotel workout', line: 'One full-body session for a hotel room with nothing in it, and the same session for a hotel gym with dumbbells.' },
  'full-body-workout-plan': { name: 'The full-body workout plan', line: 'Three sessions of six movements with the sets, reps and rests written out, an eight-week rule for adding weight, and a two-day version for bad weeks. The step after the first four weeks.' },
  'upper-lower-split-workout-plan': { name: 'The upper/lower split workout plan', line: 'Two upper-body and two lower-body sessions, so every muscle is trained twice a week, and what to do when the week only holds three days.' },
  'push-pull-legs-routine': { name: 'The push/pull/legs routine', line: 'Push, pull and legs sessions, each written out twice, for a six-day week with one day off, plus the three-day version.' },
  'workout-plan-for-new-dads': { name: 'The workout plan for new dads', line: 'Three short full-body sessions with a home and a gym version of every slot, a one-session floor for the weeks that fall apart, and a rule for the morning after a short night.' },
  'workout-plan-for-shift-workers': { name: 'The workout plan for shift workers', line: 'Two full-body sessions anchored to the shift instead of the clock, a schedule for day, evening, night, twelve-hour and rotating patterns, and a floor for a long run of shifts.' },
  'wedding-workout-plan': { name: 'The wedding workout plan', line: 'Three full-body days in a twelve-week block that repeats until the date, and a list of what not to change in the last month.' },
};

// The answers, in the order the page lists them (the value is what the radio carries).
export const OPTIONS = {
  situation: ['none', 'newborn', 'shifts', 'date', 'travel', 'classes'],
  place: ['gym', 'dumbbells', 'none'],
  days: ['2-3', '4', '5-6', 'unsure'],
  experience: ['new', 'past'],
  length: ['short', 'long'],
  goal: ['fat', 'muscle', 'recomp', 'strength', 'general', 'performance', 'unsure'],
};

const fewDays = (d) => d === '2-3' || d === 'unsure';

// The rows of the hub's table, in the order they are tried: the first row whose `when` holds decides. Each cell is
// [plan slug, the note the hub's cell carries after the link (its punctuation kept), the reason for that cell] for a gym,
// dumbbells at home, and no equipment. Reasons restate the hub's cards.
export const RULES = [
  {
    id: 'beginner',
    label: 'Never lifted, or in your first month (the plan runs two or three days)',
    when: (a) => a.experience === 'new',
    cells: {
      gym: ['how-to-start-lifting-weights', '', 'Starting from zero in a gym goes to the first four weeks: six movements, short full-body sessions, weights that feel too easy at first, and a rule for when to add more.'],
      dumbbells: ['dumbbell-workout-plan', '', 'Starting from zero with dumbbells goes to the dumbbell plan: three full-body sessions of about forty minutes, and what to change once the dumbbells start to feel light.'],
      none: ['bodyweight-workout', '', 'Starting from zero with no equipment goes to the bodyweight workout: a floor, a chair and a doorway, with an easier and a harder version of every movement.'],
    },
  },
  {
    id: 'newborn',
    label: 'A newborn at home',
    when: (a) => a.situation === 'newborn',
    cells: {
      gym: ['workout-plan-for-new-dads', ', gym version', 'A week with a newborn in it goes to the plan written for one, in its gym version: sessions anchored to a nap or a commute instead of a clock, and one session as the floor.'],
      dumbbells: ['workout-plan-for-new-dads', ', home version', 'A week with a newborn in it goes to the plan written for one, in its home version: sessions anchored to a nap or a commute instead of a clock, and one session as the floor.'],
      none: ['workout-plan-for-new-dads', ', bodyweight options', 'A week with a newborn in it goes to the plan written for one, using its bodyweight options: sessions anchored to a nap or a commute instead of a clock, and one session as the floor.'],
    },
  },
  {
    id: 'shifts',
    label: 'Shifts that change every week',
    when: (a) => a.situation === 'shifts',
    cells: {
      gym: ['workout-plan-for-shift-workers', '', 'Hours that change every week go to the plan counted per rota week, not per calendar week: two full-body sessions anchored to the shift instead of the clock.'],
      dumbbells: ['workout-plan-for-shift-workers', ', home version', 'Hours that change every week go to the plan counted per rota week, not per calendar week, in its home version: two full-body sessions anchored to the shift instead of the clock.'],
      none: ['bodyweight-workout', ", on the shift plan's schedule", "With no equipment, hours that change every week go to the bodyweight workout, run on the shift plan's schedule: the sessions from one page, the rota from the other."],
    },
  },
  {
    id: 'date',
    label: 'A wedding or another date',
    when: (a) => a.situation === 'date',
    cells: {
      gym: ['wedding-workout-plan', '', 'Training toward a date goes to the plan built around one: a twelve-week block that repeats until the date, and what not to change in the last month.'],
      dumbbells: ['wedding-workout-plan', ", with the dumbbell plan's exercises", "Training toward a date with dumbbells goes to the plan built around one, with the dumbbell plan's exercises in its slots: a twelve-week block that repeats until the date."],
      none: ['bodyweight-workout', ", on the wedding plan's twelve weeks", "With no equipment, training toward a date goes to the bodyweight workout, run on the wedding plan's twelve weeks: the movements from one page, the block from the other."],
    },
  },
  {
    id: 'travel',
    label: 'A travel week',
    when: (a) => a.situation === 'travel',
    cells: {
      gym: ['hotel-workout', ', gym version', "A travel week goes to the hotel workout's gym version: one full-body session for a hotel gym with a few dumbbells. Two short sessions hold a travel week together."],
      dumbbells: ['hotel-workout', ', gym version', "A travel week goes to the hotel workout's gym version: one full-body session for a hotel gym with a few dumbbells. Two short sessions hold a travel week together."],
      none: ['hotel-workout', ', room version', "A travel week goes to the hotel workout's room version: one full-body session for a hotel room with nothing in it. Two short sessions hold a travel week together."],
    },
  },
  {
    id: 'classes',
    label: 'Three days around classes',
    when: (a) => a.situation === 'classes',
    cells: {
      gym: ['college-workout-routine', '', 'A week built from a class schedule goes to the college routine: three full-body sessions fitted around classes, with a two-day version for exam weeks.'],
      dumbbells: ['college-workout-routine', ', dorm version', 'A week built from a class schedule goes to the college routine in its dorm-room version: three full-body sessions fitted around classes, with a two-day version for exam weeks.'],
      none: ['college-workout-routine', ', dorm version', 'A week built from a class schedule goes to the college routine in its dorm-room version: three full-body sessions fitted around classes, with a two-day version for exam weeks.'],
    },
  },
  {
    id: 'short',
    label: 'Two or three days, short sessions',
    when: (a) => fewDays(a.days) && a.length === 'short',
    cells: {
      gym: ['30-minute-workout', '', 'Two or three short sessions go to the 30-minute workout: the session that fits thirty minutes, and what to cut first.'],
      dumbbells: ['30-minute-workout', ', home options', 'Two or three short sessions with dumbbells go to the 30-minute workout, taking its home option for every exercise.'],
      none: ['bodyweight-workout', '', 'Two or three short sessions with no equipment go to the bodyweight workout: a full-body plan for a living room, with an easier and a harder version of every movement.'],
    },
  },
  {
    id: 'three',
    label: 'Three days, past the first month',
    when: (a) => fewDays(a.days),
    cells: {
      gym: ['full-body-workout-plan', '', 'Three days past the first month in a gym go to the full-body plan: six movements a session with the sets, reps and rests written out. The step after the first four weeks.'],
      dumbbells: ['dumbbell-workout-plan', '', 'Three days past the first month with dumbbells go to the dumbbell plan: three full-body sessions of about forty minutes, and what to change once the dumbbells start to feel light.'],
      none: ['bodyweight-workout', '', 'Three days past the first month with no equipment go to the bodyweight workout, moving each movement to its harder version once 20 good reps gets easy.'],
    },
  },
  {
    id: 'four',
    label: 'Four days',
    when: (a) => a.days === '4',
    cells: {
      gym: ['upper-lower-split-workout-plan', '', 'Four days in a gym go to the upper/lower split: every muscle trained twice a week, with a plan for the weeks that only hold three days.'],
      dumbbells: ['upper-lower-split-workout-plan', ', with the home versions on the body-part pages', 'Four days with dumbbells go to the upper/lower split, with the home versions on the body-part pages filling its slots.'],
      none: ['bodyweight-workout', ' (written for two or three days)', 'Four days with no equipment go to the bodyweight workout, which is written for two or three days: the plans page has no four-day plan without equipment.'],
    },
  },
  {
    id: 'six',
    label: 'Five or six days',
    when: (a) => a.days === '5-6',
    cells: {
      gym: ['push-pull-legs-routine', '', 'Five or six days in a gym go to push/pull/legs: each session written out twice, with one day off.'],
      dumbbells: ['push-pull-legs-routine', ', with the home versions on the body-part pages', 'Five or six days with dumbbells go to push/pull/legs, with the home versions on the body-part pages filling its slots.'],
      none: ['bodyweight-workout', ' (written for two or three days)', 'Five or six days with no equipment go to the bodyweight workout, which is written for two or three days: the plans page has no six-day plan without equipment.'],
    },
  },
];

// The goal does not change the plan (the hub: the plan that fits your week matters more than a clever one). It picks which
// coaching page the result links beside Apply.
export const COACHING = {
  fat: ['/coaching/fat-loss/', 'coaching for fat loss'],
  muscle: ['/coaching/build-muscle/', 'coaching to build muscle'],
  strength: ['/coaching/strength/', 'coaching for strength'],
  recomp: ['/coaching/', 'how coaching works'],
  general: ['/coaching/', 'how coaching works'],
  performance: ['/coaching/', 'how coaching works'],
  unsure: ['/coaching/', 'how coaching works'],
};

export const UNSURE_LINE = 'Not sure how many days you have? Start with fewer. A plan you finish every week beats a bigger one you finish every other week.';

/**
 * { situation, place, days, experience, length, goal } -> { ok: true, rule, plan, slug, note, why, extra, coaching } or { ok: false, error }.
 * `rule` is the id of the hub-table row that decided; `note` is that row's cell text after the plan link, punctuation included
 * ('' when the cell is the plain plan); `why` is that cell's reason; `extra` is the hub's "start with fewer" line when the
 * days were "not sure".
 */
export function route(a = {}) {
  for (const k of Object.keys(OPTIONS)) if (!OPTIONS[k].includes(a[k])) return { ok: false, error: 'Answer every question.' };
  const rule = RULES.find((r) => r.when(a));
  const [slug, note, why] = rule.cells[a.place];
  const [coachingPath, coachingLabel] = COACHING[a.goal];
  return {
    ok: true,
    rule: rule.id,
    label: rule.label,
    slug,
    plan: PLANS[slug].name,
    line: PLANS[slug].line,
    note,
    why,
    extra: a.days === 'unsure' ? UNSURE_LINE : '',
    coaching: { path: coachingPath, label: coachingLabel },
    path: `/learn/${slug}/`,
    pdf: `/pdf/${slug}.pdf`,
  };
}

/** "The hotel workout, gym version" / "The bodyweight workout (written for two or three days)" / "The bodyweight workout" */
export const planText = (r) => `${r.plan}${r.note}`;
/** The download line: "Print the hotel workout (PDF)" / "Print how to start lifting weights (PDF)" */
export const pdfLabel = (r) => `Print ${r.plan.charAt(0).toLowerCase()}${r.plan.slice(1)} (PDF)`;

function init(root) {
  // A plain group of fields, not a <form>: there is nothing to submit, and Enter never sends the answers anywhere.
  const fields = root.querySelector('[data-wq-form]');
  if (!fields) return;
  const $ = (sel) => root.querySelector(sel);
  const set = (sel, text) => { const el = $(sel); if (el) el.textContent = text; };
  const checked = (name) => (fields.querySelector(`input[name="${name}"]:checked`) || {}).value;
  const live = $('[data-wq-live]');
  let timer = 0;

  const read = () => ({ situation: checked('situation'), place: checked('place'), days: checked('days'), experience: checked('experience'), length: checked('length'), goal: checked('goal') });

  const render = (announce) => {
    const r = route(read());
    root.classList.toggle('is-invalid', !r.ok);
    clearTimeout(timer);
    const speak = (msg) => { if (live && announce !== null) timer = setTimeout(() => { live.textContent = msg; }, announce ? 0 : 700); };
    if (!r.ok) {
      set('[data-wq-error]', r.error);
      speak(r.error);
      return;
    }
    set('[data-wq-error]', '');
    const basis = $('[data-wq-basis]');
    if (basis) basis.hidden = true;
    const planEl = $('[data-wq-plan]');
    if (planEl) {
      const link = document.createElement('a');
      link.href = r.path;
      link.textContent = r.plan;
      planEl.replaceChildren(link, document.createTextNode(r.note));
    }
    set('[data-wq-why]', r.why);
    set('[data-wq-line]', r.line);
    const extra = $('[data-wq-extra]');
    if (extra) { extra.textContent = r.extra; extra.hidden = !r.extra; }
    const pdf = $('[data-wq-pdf] a');
    if (pdf) { pdf.href = r.pdf; pdf.textContent = pdfLabel(r); }
    const coaching = $('[data-wq-coaching]');
    if (coaching) { coaching.href = r.coaching.path; coaching.textContent = r.coaching.label; }
    speak(`${planText(r)}. ${r.why}`);
  };

  fields.addEventListener('change', () => render(false));
  fields.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); render(true); } });
  root.classList.add('is-ready');
  render(null); // quietly, in case the browser restored picked answers (Back): nothing is announced on load
}

if (typeof document !== 'undefined') document.querySelectorAll('[data-wq]').forEach(init);
