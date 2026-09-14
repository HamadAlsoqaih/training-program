// Inserted deload weeks: block geometry, the calendar shift, mirrored content
// and the boundary cases at week 1 and the final week.
// Run: node tests/deload.mjs
globalThis.localStorage = {
  _v: null,
  getItem() { return this._v; },
  setItem(_k, v) { this._v = v; },
  removeItem() { this._v = null; },
};

const store = await import('../js/state.js');
const sched = await import('../js/schedule.js');
const prog = await import('../js/program.js');
const comp = await import('../js/completion.js');
const { schemeLabel, schemeSets } = await import('../js/schemes.js');

let fails = 0;
const eq = (label, actual, expected) => {
  if (actual !== expected) { fails++; console.error(`FAIL ${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`); }
  else console.log(`ok: ${label}`);
};
const DAY = 86400000;
const days = (a, b) => Math.round((a - b) / DAY);

// Put "today" on week `week`, day slot `d0`, by rotating the weekday map so the
// real weekday lines up with the slot we want to test.
function setupAt(pid, week, d0) {
  store.resetAll();
  const now = new Date();
  const wd = now.getDay();
  const map = {};
  for (let d = 1; d <= 7; d++) map[d] = (wd + (d - d0) + 14) % 7;
  store.update((s) => {
    s.activeProgram = pid;
    const b = s.programs[pid];
    b.started = true;
    b.setup.dayMap = map;
    b.setup.anchorDay = `w${week}d${d0}`;
    b.setup.anchorDate = sched.toISO(now);
    b.setup.deloads = [];
  });
  return sched.todaySlot(pid);
}

// ---------------------------------------------------------------------------
// Block length: today through the end of the week
// ---------------------------------------------------------------------------
for (const [d0, len] of [[1, 7], [3, 5], [6, 2]]) {
  setupAt('p12', 5, d0);
  const plan = comp.deloadPlanFor('p12');
  eq(`day ${d0}: plan says ${len} deload days`, plan.deloadDays, len);
  eq(`day ${d0}: block interrupts week 5`, plan.week, 5);

  const before = sched.dateForIndex(28, 'p12');      // w5d1
  const beforePrev = sched.dateForIndex(27, 'p12');  // w4d7
  comp.insertDeload('p12');
  eq(`day ${d0}: week 5 Day 1 moves exactly 7 days`,
    days(sched.dateForIndex(28, 'p12'), before), 7);
  eq(`day ${d0}: the week before does not move`,
    days(sched.dateForIndex(27, 'p12'), beforePrev), 0);
  eq(`day ${d0}: today is now a deload day`, sched.todaySlot('p12').deload?.d, d0);
  eq(`day ${d0}: the program day still due is week 5 Day 1`,
    sched.todayIndexRaw(undefined, 'p12'), 28);
  eq(`day ${d0}: totalDays unchanged`, prog.totalDays('p12'), 84);

  // every slot from d0 on is a deload session; the earlier ones are not
  for (let d = 1; d <= 7; d++) {
    const day = prog.getDay('p12', `k1d${d}`);
    eq(`day ${d0}: slot ${d} light=${d >= d0}`, !!day.light, d >= d0);
  }
}

// ---------------------------------------------------------------------------
// Mirrored content: the SAME weekday of the week being interrupted, at 1 set
// ---------------------------------------------------------------------------
setupAt('p12', 5, 1);
comp.insertDeload('p12');
{
  const src = prog.getDay('p12', 'w5d6');           // strength day
  const dl = prog.getDay('p12', 'k1d6');
  eq('deload day mirrors the same weekday', dl.title, `Deload — ${src.title}`);
  eq('deload day keeps the section list',
    dl.sections.map((x) => x.title).join('|'), src.sections.map((x) => x.title).join('|'));
  const sq = (day) => prog.dayExercises(day).find((e) => e.item.ex === 'squat');
  eq('2 WU + 2 WS becomes 1 WU + 1 WS', schemeLabel(sq(dl).item.sch), '1 WU + 1 WS');
  eq('the replayed week is still full volume', schemeLabel(sq(src).item.sch), '2 WU + 2 WS');
  const cardio = (day) => day.sections.find((x) => x.tag === 'cardio').items[0];
  eq('cardio is not capped', schemeSets(cardio(dl).sch), schemeSets(cardio(src).sch));
  eq('a 3-set plyo item drops to 1',
    schemeSets(prog.dayExercises(prog.getDay('p12', 'k1d3'))
      .find((e) => e.item.ex === 'sd_of_jump').item.sch), 1);
  eq('Day 5 stays a rest + cardio day', prog.getDay('p12', 'k1d5').kind, 'rest');
  eq('Day 7 stays a full rest day', prog.getDay('p12', 'k1d7').kind, 'off');
}

// ---------------------------------------------------------------------------
// Days already trained this week move onto the block
// ---------------------------------------------------------------------------
setupAt('p12', 5, 3);
store.update((s) => {
  s.programs.p12.days['w5d1'] = { status: 'done', ex: { s0i2: { sets: [{ done: true, weight: 40 }] } } };
});
comp.insertDeload('p12');
eq('the finished day moved onto the block', !!store.day('k1d1', 'p12'), true);
eq('its sets came with it', store.day('k1d1', 'p12').ex.s0i2.sets[0].weight, 40);
eq('the replayed week starts clean', store.day('w5d1', 'p12'), null);
eq('a carried-over day is NOT a deload session', prog.getDay('p12', 'k1d1').light, false);
eq('and keeps its full-volume prescription',
  prog.dayExercises(prog.getDay('p12', 'k1d1')).map((e) => schemeSets(e.item.sch)).join(','),
  prog.dayExercises(prog.getDay('p12', 'w5d1')).map((e) => schemeSets(e.item.sch)).join(','));

// removing it puts everything back
comp.removeDeload('p12', 1);
eq('removing the block restores the day', store.day('w5d1', 'p12')?.ex.s0i2.sets[0].weight, 40);
eq('and drops the block', sched.deloadBlocks('p12').length, 0);

// ---------------------------------------------------------------------------
// Two deloads stack, without renumbering
// ---------------------------------------------------------------------------
setupAt('p12', 3, 1);
const base10 = sched.dateForIndex(70, 'p12');   // w11d1, far downstream
comp.insertDeload('p12');
eq('one block shifts a later week 7 days', days(sched.dateForIndex(70, 'p12'), base10), 7);
// four calendar weeks on: the deload week, then weeks 3, 4 and 5 — so "today"
// is week 6 Day 1 without touching the anchor
const later = new Date(Date.now() + 28 * DAY);
eq('four weeks on, allowing for the deload, is week 6 Day 1',
  sched.todayIndexRaw(later, 'p12'), 35);
comp.insertDeload('p12', later);
eq('two blocks stack to 14 days', days(sched.dateForIndex(70, 'p12'), base10), 14);
eq('two blocks recorded', sched.deloadBlocks('p12').length, 2);
eq('no week was renumbered', prog.getDay('p12', 'w6d1').week, 6);
eq('totalDays still 84', prog.totalDays('p12'), 84);

// ---------------------------------------------------------------------------
// Boundary: week 1, day 1 — every day in the program shifts
// ---------------------------------------------------------------------------
setupAt('p12', 1, 1);
{
  const start = sched.programStatus('p12').startDate;
  const end = sched.programStatus('p12').endDate;
  comp.insertDeload('p12');
  eq('w1d1 insert: the start date moves 7 days',
    days(sched.programStatus('p12').startDate, start), 7);
  eq('w1d1 insert: the end date moves 7 days too',
    days(sched.programStatus('p12').endDate, end), 7);
  eq('w1d1 insert: today is a deload day', !!sched.todaySlot('p12').deload, true);
  eq('w1d1 insert: the program is still active', sched.programStatus('p12').state, 'active');
  eq('w1d1 insert: week 1 replays in full',
    schemeSets(prog.dayExercises(prog.getDay('p12', 'w1d1'))
      .find((e) => e.item.ex === 'lat_bounds').item.sch), 3);
  // dates before the block must still read as "not started yet"
  eq('w1d1 insert: the day before the block is still a negative index',
    sched.slotAtCal(-1, 'p12').index < 0, true);
}

// ---------------------------------------------------------------------------
// Boundary: the final week — the program must not finish a week early
// ---------------------------------------------------------------------------
setupAt('p12', 12, 3);
{
  const end = sched.programStatus('p12').endDate;
  comp.insertDeload('p12');
  eq('final week: end date moves 7 days', days(sched.programStatus('p12').endDate, end), 7);
  eq('final week: still active during the deload', sched.programStatus('p12').state, 'active');
  eq('final week: today is a deload day', !!sched.todaySlot('p12').deload, true);
  eq('final week: the day due is week 12 Day 1', sched.todayIndexRaw(undefined, 'p12'), 77);
  eq('final week: clampIndex still holds the last day',
    sched.clampIndex(999, 'p12'), 83);
  // once the replayed week has passed, the program reports over
  const past = new Date(Date.now() + 21 * DAY);
  eq('final week: over only after the replay', sched.programStatus('p12', past).state, 'over');
}

// ---------------------------------------------------------------------------
// The suggestion rule: reactive inside a 4–6 week window
// ---------------------------------------------------------------------------
const an = await import('../js/analytics.js');
const trainWeeks = (pid, from, to) => store.update((s) => {
  for (let w = from; w <= to; w++) {
    s.programs[pid].days[`w${w}d1`] = { status: 'done', ex: { s0i2: { sets: [{ done: true }] } } };
  }
});

setupAt('p12', 3, 1); trainWeeks('p12', 1, 3);
eq('3 trained weeks: no suggestion', an.deloadAdvice('p12').show, false);
eq('3 trained weeks: counted', an.deloadAdvice('p12').weeks, 3);

setupAt('p12', 4, 1); trainWeeks('p12', 1, 4);
eq('4 trained weeks and nothing wrong: still quiet', an.deloadAdvice('p12').show, false);
store.update((s) => { s.programs.p12.fatigue = [{ week: 4, rating: 1, at: Date.now() }]; });
eq('4 weeks + flat jumps: suggest', an.deloadAdvice('p12').show, true);
eq('and it names the signal', an.deloadAdvice('p12').signal, 'fatigue');

// p15 has no built-in deload before week 7, so six weeks really is six weeks
setupAt('p15', 6, 1); trainWeeks('p15', 1, 6);
eq('6 trained weeks: suggest regardless', an.deloadAdvice('p15').show, true);
eq('6 weeks: the reason is the streak', an.deloadAdvice('p15').signal, 'weeks');

// the program's OWN deload week resets the count too
setupAt('p12', 6, 1); trainWeeks('p12', 1, 6);
eq("p12's built-in week-5 deload resets the counter", an.deloadAdvice('p12').weeks, 1);

// and so does an inserted one
setupAt('p15', 6, 1); trainWeeks('p15', 1, 6);
store.update((s) => {
  s.programs.p15.setup.deloads = [{ id: 1, week: 5, at: 28, d0: 1, startedAt: Date.now() }];
});
// the block also pushes the calendar back a week, so today is week 5 replaying
eq('an inserted deload resets the counter', an.deloadAdvice('p15').weeks, 1);
eq('and silences the suggestion', an.deloadAdvice('p15').show, false);

console.log(fails ? `\n${fails} failing check(s)` : '\nAll deload checks passed.');
process.exit(fails ? 1 : 0);
