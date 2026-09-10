// Jump-volume analytics: calendar-week bucketing across both programs,
// contact multipliers, "each side" doubling, tapped Freestyle blocks and the
// spike warning. Run: node tests/analytics.mjs
globalThis.localStorage = {
  _v: null,
  getItem() { return this._v; },
  setItem(_k, v) { this._v = v; },
  removeItem() { this._v = null; },
};

const store = await import('../js/state.js');
const { allDayIds } = await import('../js/program.js');
const comp = await import('../js/completion.js');
const an = await import('../js/analytics.js');

let fails = 0;
const eq = (label, actual, expected) => {
  if (actual !== expected) { fails++; console.error(`FAIL ${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`); }
  else console.log(`ok: ${label}`);
};

const DAY = 86400000;
const thisWeek = an.weekStart(Date.now());
const lastWeek = an.weekStart(thisWeek - 7 * DAY);

// first day of `pid` that prescribes `exId` with at least `minSets` sets —
// early weeks cap volume, so a day that only prescribes one set would silently
// swallow the rest of what we log.
function findDay(pid, exId, minSets = 1) {
  for (const dayId of allDayIds(pid)) {
    const planned = comp.plannedDay(pid, dayId);
    const e = planned?.entries.find((x) => x.item.ex === exId && x.sets >= minSets);
    if (e) return { dayId, entry: e };
  }
  throw new Error(`${exId} is not in ${pid} with ${minSets}+ sets`);
}

// log `sets` against that exercise, stamped into a chosen calendar week
function log(pid, exId, sets, { at, taps } = {}) {
  const { dayId, entry } = findDay(pid, exId, Math.max(sets.length, taps?.length || 0));
  store.update((s) => {
    const days = s.programs[pid].days;
    const d = days[dayId] || (days[dayId] = { ex: {} });
    d.ex = d.ex || {};
    d.ex[entry.key] = { sets: sets.map((x) => ({ done: true, loggedAt: at, ...x })) };
    if (taps) {
      d.contacts = d.contacts || {};
      taps.forEach((v, i) => { if (v) d.contacts[`${entry.key}:${i}`] = v; });
    }
  });
  return entry;
}

const weekOf = (ms, buckets) => buckets.find((b) => b.weekStart === ms);

// --- the counting rule, in isolation ---------------------------------------
eq('reps × sets, doubled for an "each side" drill',
  an.contactsForRecord('lat_bounds', {
    sets: [{ i: 0, done: true, reps: 6 }, { i: 1, done: true, reps: 6 }],
    defReps: 6, side: true, taps: null,
  }), 24);

eq('an unticked set counts for nothing',
  an.contactsForRecord('lat_bounds', {
    sets: [{ i: 0, done: true, reps: 6 }, { i: 1, done: false, reps: 6 }],
    defReps: 6, side: true, taps: null,
  }), 12);

eq('prescribed reps fill in when you logged none',
  an.contactsForRecord('lat_bounds', {
    sets: [{ i: 0, done: true }], defReps: 6, side: true, taps: null,
  }), 12);

eq('3 hurdles = 1 rep is honoured',
  an.contactsForRecord('consec_hurdle', {
    sets: [{ i: 0, done: true, reps: 3 }, { i: 1, done: true, reps: 3 }],
    defReps: 3, side: false, taps: null,
  }), 18);

eq('tapped Freestyle contacts beat the estimate, per block',
  an.contactsForRecord('freestyle_jump', {
    sets: [{ i: 0, done: true }, { i: 1, done: true }],
    defReps: null, side: false, taps: [46],
  }), 46 + 45);   // block 1 tapped, block 2 falls back to the 40–50 midpoint

eq('a non-jump exercise contributes nothing',
  an.isJump('squat'), false);

// --- calendar weeks, across both programs ----------------------------------
log('p15', 'lat_bounds', [{ reps: 6 }, { reps: 6 }, { reps: 6 }], { at: thisWeek + 2 * DAY });
log('p12', 'consec_hurdle', [{ reps: 3 }, { reps: 3 }], { at: thisWeek + 3 * DAY });
log('p15', 'squat', [{ reps: 5, weight: 80 }], { at: thisWeek + 2 * DAY });

{
  const buckets = an.jumpVolumeByWeek({ weeks: 12 });
  eq('exactly 12 weekly buckets', buckets.length, 12);
  eq('the last bucket is the current calendar week', buckets[11].weekStart, thisWeek);
  // 3×6 lateral bounds each side = 36, plus 2×3 hurdle reps ×3 hurdles = 18
  eq('both programs land in the same calendar week', weekOf(thisWeek, buckets).contacts, 36 + 18);
  eq('two jump sessions counted', weekOf(thisWeek, buckets).sessions, 2);
  eq('lifting is not jump volume', weekOf(thisWeek, buckets).byExercise.squat, undefined);
  eq('an untrained week reads as zero, not a gap', weekOf(lastWeek, buckets).contacts, 0);
}

// --- the spike warning ------------------------------------------------------
const bk = (...v) => v.map((contacts, i) => ({ weekStart: thisWeek - (v.length - 1 - i) * 7 * DAY, contacts }));

eq('a steep rise on real volume is a spike', an.spikeCheck(bk(100, 140)).level, 'spike');
eq('the spike reports the percentage', Math.round(an.spikeCheck(bk(100, 140)).pct * 100), 40);
eq('a gentle rise is only worth watching', an.spikeCheck(bk(100, 120)).level, 'watch');
eq('a normal week is fine', an.spikeCheck(bk(100, 105)).level, 'ok');
eq('a drop is fine', an.spikeCheck(bk(200, 100)).level, 'ok');
eq('small numbers never trigger a warning', an.spikeCheck(bk(8, 40)).level, 'ok');
eq('coming straight off a rest week says watch', an.spikeCheck(bk(0, 120)).level, 'watch');

// --- Freestyle cap adherence -------------------------------------------------
log('p15', 'freestyle_jump', [{}, {}], { at: thisWeek + DAY, taps: [46, 58] });
{
  const fs = an.freestyleBlocks({ weeks: 12 });
  eq('both tapped blocks counted', fs.total, 2);
  eq('one block inside the 40–50 cap', fs.inRange, 1);
  eq('one block over the cap', fs.over, 1);
}

console.log(fails ? `\n${fails} failing check(s)` : '\nAll analytics checks passed.');
process.exit(fails ? 1 : 0);
