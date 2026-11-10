// Forgotten workouts close by themselves; backups merge newest-wins; a failed
// save is reported. Runs in Node with a tiny localStorage stub.
// Run: node tests/fixes.mjs
let failNext = false;
globalThis.localStorage = {
  _v: null,
  getItem() { return this._v; },
  setItem(_k, v) { if (failNext) throw new Error('QuotaExceededError'); this._v = v; },
  removeItem() { this._v = null; },
};

const store = await import('../js/state.js');
const sched = await import('../js/schedule.js');
const comp = await import('../js/completion.js');

let fails = 0;
const eq = (label, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fails++; console.error(`FAIL ${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
  }
};
const H = 3600e3, M = 60e3;

// p15 anchored so that today is w1 of the program
store.update((s) => {
  s.activeProgram = 'p15'; s.onboarded = true;
  const b = s.programs.p15;
  b.started = true;
  b.setup.dayMap = sched.DEFAULT_DAY_MAP;
  b.setup.anchorDay = 'w2d1';
  b.setup.anchorDate = sched.toISO(new Date());
});
const today = sched.todayId(undefined, 'p15');
const past = 'w1d2';
const withSession = (dayId, startedAt, setsAt, extra = {}) => store.update((s) => {
  const d = s.programs.p15.days[dayId] = { status: null, ex: {} };
  if (setsAt.length) d.ex.s0i0 = { sets: setsAt.map((t) => ({ done: true, loggedAt: t })) };
  s.session = { pid: 'p15', dayId, startedAt, pausedAt: null, pausedMs: 0, ...extra };
});

// --- a past day's workout, quiet for 1h+, closes; clock stops 5 min after the last set
{
  const now = Date.now();
  withSession(past, now - 20 * H, [now - 20 * H + 30 * M, now - 20 * H + 50 * M]);
  const r = comp.closeStaleSession(now);
  eq('past: closed', !!r, true);
  eq('past: elapsed = last set + 5 min', r.elapsed, 55 * M);
  eq('past: saved on the day', store.day(past, 'p15').elapsedMs, 55 * M);
  eq('past: session gone', store.get().session, null);
}
// --- never more than 3 hours
{
  const now = Date.now();
  withSession(past, now - 30 * H, [now - 30 * H + M, now - 24 * H]);
  eq('cap: 3 hours', comp.closeStaleSession(now).elapsed, 3 * H);
}
// --- nothing ticked: dropped, no time saved
{
  const now = Date.now();
  withSession(past, now - 5 * H, []);
  const r = comp.closeStaleSession(now);
  eq('empty: closed', r.kept, false);
  eq('empty: no time', store.day(past, 'p15').elapsedMs, undefined);
}
// --- today's workout is left alone for up to 3 hours of quiet
{
  const now = Date.now();
  withSession(today, now - 2 * H, [now - 2 * H + 10 * M]);
  eq('today 1h50 quiet: still open', comp.closeStaleSession(now), null);
  eq('today: session kept', store.get().session?.dayId, today);
  eq('today 3h+ quiet: closes', !!comp.closeStaleSession(now + 2 * H), true);
}
// --- an active session on a past day (still ticking) stays open
{
  const now = Date.now();
  withSession(past, now - 40 * M, [now - 5 * M]);
  eq('past but active: open', comp.closeStaleSession(now), null);
  store.update((s) => { s.session = null; });
}

// --- merge: newer day wins, missing days are added, a tie keeps this phone's
{
  store.update((s) => {
    s.programs.p15.days = {
      w1d1: { status: 'done', ex: {}, note: 'mine-old', updatedAt: 1000 },
      w1d3: { status: null, ex: {}, note: 'mine-new', updatedAt: 5000 },
      w1d4: { status: null, ex: {}, note: 'mine-tie', updatedAt: 3000 },
    };
  });
  const backup = JSON.parse(store.exportJson());
  const d = backup.state.programs.p15.days;
  d.w1d1 = { status: 'done', ex: {}, note: 'theirs-new', updatedAt: 2000 };
  d.w1d3 = { status: null, ex: {}, note: 'theirs-old', updatedAt: 4000 };
  d.w1d4 = { status: null, ex: {}, note: 'theirs-tie', updatedAt: 3000 };
  d.w1d5 = { status: 'done', ex: {}, note: 'theirs-only' };
  const text = JSON.stringify(backup);
  eq('preview', store.previewBackup(text), { exportedAt: backup.exportedAt, days: 4, added: 1, newer: 1 });
  store.importJson(text, 'merge');
  const got = store.get().programs.p15.days;
  eq('merge: newer backup day wins', got.w1d1.note, 'theirs-new');
  eq('merge: newer phone day kept', got.w1d3.note, 'mine-new');
  eq('merge: tie keeps phone', got.w1d4.note, 'mine-tie');
  eq('merge: missing day added', got.w1d5.note, 'theirs-only');
  // an old record without updatedAt is dated by its set timestamps
  eq('stamp from sets', store.dayStamp({ ex: { a: { sets: [{ loggedAt: 7 }, { loggedAt: 9 }] } } }), 9);
}
// --- not a backup
{
  let threw = false;
  try { store.previewBackup('{"hello":1}'); } catch { threw = true; }
  eq('rejects non-backup', threw, true);
}
// --- a failed save is reported once, then again only after a good save
{
  let n = 0;
  store.onSaveError(() => n++);
  failNext = true;
  store.update(() => {}); store.update(() => {});
  eq('save error reported once', n, 1);
  failNext = false; store.update(() => {});
  failNext = true; store.update(() => {});
  eq('reported again after a good save', n, 2);
  failNext = false;
}
// --- every change through the rules layer stamps the day
{
  comp.setNote('p15', 'w3d1', 'x');
  eq('setNote stamps updatedAt', typeof store.day('w3d1', 'p15').updatedAt, 'number');
}

// --- easy start: weeks 1-2 run at 2 working sets where the program says 3+
{
  const sets = (id) => comp.plannedDay('p15', id).entries.map((e) => (e.sch.t === 'wuws' ? e.sch.ws : e.sch.sets));
  store.update((s) => { s.programs.p15.setup.easyStart = false; });
  const id = [1, 2, 3, 4, 5, 6, 7].map((d) => `w1d${d}`).find((x) => sets(x).some((n) => n >= 3));
  const normal = sets(id);
  store.update((s) => { s.programs.p15.setup.easyStart = true; });
  const easy = sets(id);
  eq('easy: capped at 2', easy.every((n, k) => n === (normal[k] >= 3 ? 2 : normal[k])), true);
  eq('easy: something was capped', normal.some((n) => n >= 3), true);
  eq('easy: week 3 is normal', comp.isEasyDay('p15', 'w3d1'), false);
  eq('easy: deload days are not easy days', comp.isEasyDay('p15', 'k1d3'), false);
  store.update((s) => { s.programs.p15.setup.easyStart = false; });
}

if (fails) { console.error(`\n${fails} check(s) failed`); process.exit(1); }
console.log('✓ All fix checks passed');
