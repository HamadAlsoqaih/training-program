// Schedule maths: anchors, future starts, finished programs.
// Runs in Node with a tiny localStorage stub. Run: node tests/schedule.mjs
globalThis.localStorage = {
  _v: null,
  getItem() { return this._v; },
  setItem(_k, v) { this._v = v; },
  removeItem() { this._v = null; },
};

const { default: p15 } = await import('../js/programs/p15.js');
const store = await import('../js/state.js');
const sched = await import('../js/schedule.js');

let fails = 0;
const eq = (label, actual, expected) => {
  if (actual !== expected) { fails++; console.error(`FAIL ${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`); }
};

const DAY = 86400000;
const iso = (d) => sched.toISO(d);
const shift = (days) => new Date(Date.now() + days * DAY);

// anchor helper: put `anchorDay` on the date `days` from today
function anchorAt(days, anchorDay = 'w1d1') {
  store.update((s) => {
    s.activeProgram = 'p15';
    const b = s.programs.p15;
    b.started = true;
    b.setup.dayMap = sched.DEFAULT_DAY_MAP;
    b.setup.anchorDay = anchorDay;
    b.setup.anchorDate = iso(shift(days));
  });
}

// --- a start date in the FUTURE is a countdown, not a fake "today" ----------
// Put Day 1 on its own weekday 6 days out so the anchor is genuinely future.
{
  const target = shift(6);
  const day1Weekday = sched.DEFAULT_DAY_MAP[1];
  // walk forward to the next Day-1 weekday at least 3 days out
  let d = shift(3);
  while (d.getDay() !== day1Weekday) d = new Date(d.getTime() + DAY);
  store.update((s) => {
    s.activeProgram = 'p15';
    const b = s.programs.p15;
    b.started = true;
    b.setup.dayMap = sched.DEFAULT_DAY_MAP;
    b.setup.anchorDay = 'w1d1';
    b.setup.anchorDate = iso(d);
  });
  const st = sched.programStatus('p15');
  eq('future anchor → state "before"', st.state, 'before');
  eq('future anchor → positive countdown', st.daysUntil > 0, true);
  eq('future anchor → start date is the anchor', sched.toISO(st.startDate), sched.toISO(d));
  eq('future anchor → raw index is negative', st.rawIndex < 0, true);
}

// --- an anchor in the past, inside the program, is active -------------------
{
  anchorAt(-7);
  const st = sched.programStatus('p15');
  eq('week-old anchor → state "active"', st.state, 'active');
  eq('week-old anchor → index in range', st.rawIndex >= 0 && st.rawIndex < 105, true);
}

// --- past the end of the program -------------------------------------------
{
  anchorAt(-(105 + 14));
  const st = sched.programStatus('p15');
  eq('long-past anchor → state "over"', st.state, 'over');
  eq('long-past anchor → days over is positive', st.daysOver > 0, true);
}

// --- today always maps to the real weekday ---------------------------------
{
  anchorAt(-7);
  const today = sched.realToday('p15');
  const shown = sched.dateForIndex(sched.todayIndex(), 'p15');
  eq('today’s day carries today’s real date', sched.toISO(shown), sched.toISO(today));
  eq('today’s slot matches today’s weekday',
     sched.weekdayName((sched.todayIndex() % 7) + 1, null, 'p15'),
     sched.WEEKDAY_NAMES[today.getDay()]);
}

// --- a custom weekday map still lands on today -----------------------------
{
  const custom = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 0 }; // Day1 = Monday
  store.update((s) => {
    const b = s.programs.p15;
    b.setup.dayMap = custom;
    b.setup.anchorDay = 'w2d1';
    b.setup.anchorDate = iso(shift(-14));
  });
  const today = sched.realToday('p15');
  const shown = sched.dateForIndex(sched.todayIndex(), 'p15');
  eq('custom map: today keeps the real date', sched.toISO(shown), sched.toISO(today));
  eq('custom map: state is active', sched.programStatus('p15').state, 'active');
}

if (fails === 0) console.log('✓ All schedule checks passed');
else { console.error(`✗ ${fails} schedule check(s) failed`); process.exit(1); }
