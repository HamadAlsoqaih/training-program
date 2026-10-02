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

// --- free arrangement: any session on any day, week starts on any day ------
// Re:Zero, starting TODAY with Lower A (slot 7) as Day 1, the pull day (slot 4)
// as Day 2, then Lower B (3), Upper A (1), and the three rest days.
{
  const comp = await import('../js/completion.js');
  const prog = await import('../js/program.js');
  const today = new Date();
  const wd = today.getDay();
  const order = [7, 4, 3, 1, 2, 5, 6];             // your Day 1..7, as session slots
  const map = {};
  order.forEach((slot, p) => { map[slot] = (wd + p) % 7; });
  store.update((s) => {
    s.activeProgram = 'rz';
    const b = s.programs.rz;
    b.started = true;
    b.days = {};
    b.setup.dayMap = map;
    b.setup.weekStart = wd;
    b.setup.anchorDay = 'w1d7';                     // Lower A
    b.setup.anchorDate = iso(today);
  });
  const tomorrow = new Date(today.getTime() + DAY);
  const day7 = new Date(today.getTime() + 6 * DAY);
  const next = new Date(today.getTime() + 7 * DAY);

  eq('arranged: today is Lower A', sched.todayId(today, 'rz'), 'w1d7');
  eq('arranged: today is Day 1 of week 1', sched.todayIndexRaw(today, 'rz'), 0);
  eq('arranged: tomorrow is the pull day', sched.todayId(tomorrow, 'rz'), 'w1d4');
  eq('arranged: the 7th day is still week 1', sched.todayIndexRaw(day7, 'rz'), 6);
  eq('arranged: a week later is week 2 Day 1', sched.todayId(next, 'rz'), 'w2d7');
  eq('arranged: Lower A is dated today', iso(sched.dateForId('w1d7', 'rz')), iso(today));
  eq('arranged: the pull day is dated tomorrow', iso(sched.dateForId('w1d4', 'rz')), iso(tomorrow));
  eq('arranged: nothing is "behind" on day one',
    sched.todayIndex(today, 'rz') - comp.firstOpenIndex('rz'), 0);
  eq('arranged: the week lists in YOUR order',
    sched.weekIdsInOrder(1, 'rz').join(','), 'w1d7,w1d4,w1d3,w1d1,w1d2,w1d5,w1d6');
  const end = sched.programStatus('rz', today).endDate;
  eq('arranged: the program ends the day before your start weekday',
    end.getDay(), (wd + 6) % 7);
  eq('arranged: index ↔ id round-trips for every day',
    Array.from({ length: prog.totalDays('rz') }, (_, i) => sched.idToIndex(sched.indexToId(i, 'rz'), 'rz') === i)
      .every(Boolean), true);
  // the same session across a phase is still the same SESSION, whatever its day
  eq('arranged: phase scope follows the session, not the position',
    comp.dayIdsForScope('rz', 'w1d7', 'phase').join(','), 'w1d7,w2d7,w3d7,w4d7');
}

if (fails === 0) console.log('✓ All schedule checks passed');
else { console.error(`✗ ${fails} schedule check(s) failed`); process.exit(1); }
