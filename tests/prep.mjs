// Prep weeks before Week 1, and phones on the old easy start converting to them.
// Run: node tests/prep.mjs
globalThis.localStorage = { _v: null, getItem() { return this._v; }, setItem(_k, v) { this._v = v; }, removeItem() { this._v = null; } };
const store = await import('../js/state.js');
const sched = await import('../js/schedule.js');
const comp = await import('../js/completion.js');
const { getDay } = await import('../js/program.js');

let fails = 0;
const eq = (label, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) { fails++; console.error(`FAIL ${label}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); } };
const DAY = 86400000, iso = (d) => sched.toISO(d), shift = (n) => new Date(Date.now() + n * DAY);
const wd = new Date().getDay();
const map = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((d) => [d, (wd + d - 1) % 7]));   // Day 1 = today's weekday
const setup = (extra) => store.update((s) => {
  s.activeProgram = 'p15';
  const b = s.programs.p15;
  b.started = true; b.days = {};
  b.setup = { ...b.setup, dayMap: map, weekStart: wd, anchorDay: 'w1d1', rolloverHour: 0, deloads: [], ...extra };
  delete b.setup.prepWeeks; delete b.setup.easyStart;
  Object.assign(b.setup, extra);
});

// --- new start with prep: today is Prep 1 · Day 1, Week 1 is in 14 days
setup({ anchorDate: iso(shift(14)), prepWeeks: 2 });
eq('prep: status active', sched.programStatus('p15').state, 'active');
eq('prep: today is e1d1', sched.todayId(undefined, 'p15'), 'e1d1');
eq('prep: todaySlot says prep 1', sched.todaySlot('p15').prep?.n, 1);
eq('prep: nothing of the program due', sched.elapsedIndex('p15'), -1);
eq('prep: e1d1 is today', iso(sched.dateForId('e1d1', 'p15')), iso(new Date()));
eq('prep: e2d1 is in 7 days', iso(sched.dateForId('e2d1', 'p15')), iso(shift(7)));
eq('prep: w1d1 is in 14 days', iso(sched.dateForId('w1d1', 'p15')), iso(shift(14)));
eq('prep: walking back from Week 1 lands on Prep 2', sched.dayIdAtCal('p15', sched.calIndexOfDayId('p15', 'w1d1') - 1), sched.prepWeekIds(2, 'p15')[6]);
eq('prep: walking forward from Prep 2 lands on Week 1', sched.dayIdAtCal('p15', sched.calIndexOfDayId('p15', sched.prepWeekIds(2, 'p15')[6]) + 1), 'w1d1');
eq('prep: prep day mirrors Week 1', getDay('p15', 'e1d6')?.title, getDay('p15', 'w1d6')?.title);
const sets = (id) => comp.plannedDay('p15', id).entries.map((e) => (e.sch.t === 'wuws' ? e.sch.ws : e.sch.sets));
const full = sets('w1d6'), light = sets('e1d6');
eq('prep: capped at 2', light.every((n, k) => n === (full[k] >= 3 ? 2 : full[k])), true);
eq('prep: Week 1 itself is full', comp.isEasyDay('p15', 'w1d1'), false);
eq('prep: no deload during prep', comp.deloadPlanFor('p15'), null);
// countdown before prep starts runs to the first prep day
setup({ anchorDate: iso(shift(21)), prepWeeks: 2 });
eq('before prep: status before', sched.programStatus('p15').state, 'before');
eq('before prep: counts down 7 days', sched.programStatus('p15').daysUntil, 7);

// --- old easy start, now in Week 2: converts to prep, logs move, dates stay
setup({ anchorDate: iso(shift(-7)), easyStart: true });
store.update((s) => { s.programs.p15.days = { w1d1: { status: 'done', ex: {}, note: 'day1' }, w1d2: { status: 'done', ex: {}, note: 'day2' }, w5d1: { note: 'later' } };
  s.session = { pid: 'p15', dayId: 'w2d1', startedAt: Date.now(), pausedAt: null, pausedMs: 0 }; });
const before = iso(sched.dateForId('w1d1', 'p15'));
eq('migrate: converted', comp.migrateEasyStart(), ['p15']);
const b = store.prog('p15');
eq('migrate: prep weeks on', b.setup.prepWeeks, 2);
eq('migrate: easyStart gone', b.setup.easyStart, undefined);
eq('migrate: logs moved', [b.days.e1d1?.note, b.days.e1d2?.note, b.days.w1d1, b.days.w5d1?.note], ['day1', 'day2', undefined, 'later']);
eq('migrate: same date for the moved day', iso(sched.dateForId('e1d1', 'p15')), before);
eq('migrate: today is prep 2 day 1', sched.todayId(undefined, 'p15'), 'e2d1');
eq('migrate: running session follows', store.get().session.dayId, 'e2d1');
eq('migrate: Week 1 starts 14 days after old start', iso(sched.dateForId('w1d1', 'p15')), iso(shift(7)));
eq('migrate: runs once', comp.migrateEasyStart(), []);
store.update((s) => { s.session = null; });

// --- old easy start already past Week 2: left as it was
setup({ anchorDate: iso(shift(-20)), easyStart: true });
eq('migrate: past week 2 untouched', comp.migrateEasyStart(), []);
eq('migrate: still legacy easy', [store.prog('p15').setup.easyStart, store.prog('p15').setup.prepWeeks], [true, undefined]);

// --- restart clears prep
setup({ anchorDate: iso(shift(14)), prepWeeks: 2 });
comp.restartProgram('p15');
eq('restart: prep cleared', store.prog('p15').setup.prepWeeks, undefined);

if (fails) { console.error(`\n${fails} check(s) failed`); process.exit(1); }
console.log('✓ All prep-week checks passed');
