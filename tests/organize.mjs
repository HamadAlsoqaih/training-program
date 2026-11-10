// Week organizer: one-week and every-week arrangements, past weeks untouched.
// Run: node tests/organize.mjs
globalThis.localStorage = { _v: null, getItem() { return this._v; }, setItem(_k, v) { this._v = v; }, removeItem() { this._v = null; } };

const store = await import('../js/state.js');
const sched = await import('../js/schedule.js');
const { PROGRAM_LIST, getWeek, getProgram } = await import('../js/program.js');

let fails = 0;
const eq = (label, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) { fails++; console.error(`FAIL ${label}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); } };

store.update((s) => {
  s.activeProgram = 'p15';
  const b = s.programs.p15;
  b.started = true; b.setup.dayMap = { ...sched.DEFAULT_DAY_MAP };
  b.setup.anchorDay = 'w1d1'; b.setup.anchorDate = '2026-01-07';   // a Wednesday
});
const base = { ...sched.DEFAULT_DAY_MAP };
const swapped = { ...base, 1: base[2], 2: base[1] };                 // Day 1 <-> Day 2
const dates = (w) => [1, 2, 3, 4, 5, 6, 7].map((d) => sched.toISO(sched.dateForId(`w${w}d${d}`, 'p15')));
const before = { w2: dates(2), w3: dates(3), w4: dates(4), w6: dates(6) };

// --- week only: only that week moves
sched.saveWeekArrangement('p15', 3, swapped, 'week');
eq('week-only: week 2 untouched', dates(2), before.w2);
eq('week-only: week 4 untouched', dates(4), before.w4);
eq('week-only: week 3 d1 takes d2 date', dates(3)[0], before.w3[1]);
eq('week-only: week 3 d2 takes d1 date', dates(3)[1], before.w3[0]);
eq('week-only: flagged custom', sched.isCustomWeek(3, 'p15'), true);
sched.clearWeekArrangement('p15', 3);
eq('usual again', dates(3), before.w3);
eq('no longer custom', sched.isCustomWeek(3, 'p15'), false);

// --- every week from week 4: weeks 1-3 keep the old layout
sched.saveWeekArrangement('p15', 4, swapped, 'every');
eq('every: week 2 untouched', dates(2), before.w2);
eq('every: week 3 untouched', dates(3), before.w3);
eq('every: week 4 swapped', [dates(4)[0], dates(4)[1]], [before.w4[1], before.w4[0]]);
eq('every: week 6 swapped too', [dates(6)[0], dates(6)[1]], [before.w6[1], before.w6[0]]);
eq('every: dayMap is the new usual', store.setupOf('p15').dayMap, swapped);
// a later "every week" replaces history from that week on, earlier entries stay
sched.saveWeekArrangement('p15', 6, base, 'every');
eq('every again: week 4 keeps swap', dates(4)[0], before.w4[1]);
eq('every again: week 6 back to base', dates(6), before.w6);
eq('history entries', store.setupOf('p15').mapHistory.map((h) => h.from), [1, 4, 6]);
// saving a week-only that equals the usual week stores nothing
sched.saveWeekArrangement('p15', 7, base, 'week');
eq('week-only equal to usual: not custom', sched.isCustomWeek(7, 'p15'), false);
// old one-off swaps are still honoured, and a new arrangement replaces them
store.update((s) => { s.programs.p15.setup.weekSwaps = { 8: [[1, 2]] }; });
eq('old swap still read', sched.isCustomWeek(8, 'p15'), true);
sched.saveWeekArrangement('p15', 8, swapped, 'week');
eq('old swap replaced', store.setupOf('p15').weekSwaps[8], undefined);

// --- every program's own default week passes the back-to-back rule the organizer enforces
const HARD = new Set(['upper', 'strength', 'plyo', 'lower']);
for (const p of PROGRAM_LIST) {
  const m = getProgram(p.id).defaultDayMap || sched.DEFAULT_DAY_MAP;
  const days = getWeek(p.id, 1).days;
  const order = [1, 2, 3, 4, 5, 6, 7].sort((a, b) => ((m[a] - m[1] + 7) % 7) - ((m[b] - m[1] + 7) % 7));
  for (let i = 0; i < 6; i++) {
    const a = days[order[i] - 1].kind, b = days[order[i + 1] - 1].kind;
    eq(`${p.id}: default day ${i + 1}/${i + 2} not ${a} twice`, a === b && HARD.has(a), false);
  }
}

if (fails) { console.error(`\n${fails} check(s) failed`); process.exit(1); }
console.log('✓ All organize checks passed');
