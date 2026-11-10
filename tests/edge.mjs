// Edge cases found in review: Restart + backups, archived deload weeks,
// "Save weekdays" mid-week, reminders, labels. Run: node tests/edge.mjs
globalThis.localStorage = { _v: null, getItem() { return this._v; }, setItem(_k, v) { this._v = v; }, removeItem() { this._v = null; } };
const store = await import('../js/state.js');
const sched = await import('../js/schedule.js');
const comp = await import('../js/completion.js');

let fails = 0;
const eq = (label, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) { fails++; console.error(`FAIL ${label}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); } };
const DAY = 86400000, iso = (d) => sched.toISO(d), shift = (n) => new Date(Date.now() + n * DAY);
const wd = new Date().getDay();
const map = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((d) => [d, (wd + d - 1) % 7]));
// anchor so that today is Week `w`, Day `d` (positions = days since week start)
const startAt = (w, d, extra = {}) => store.update((s) => {
  s.activeProgram = 'p15'; s.session = null;
  const b = s.programs.p15;
  b.started = true; b.startedAt = 1000; b.days = {}; b.runs = []; b.fatigue = [];
  const ws = (wd - (d - 1) + 7) % 7;
  b.setup = { anchorDay: `w${w}d1`, anchorDate: iso(shift(-(d - 1))), rolloverHour: 0, deloads: [], weekStart: ws,
    dayMap: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((k) => [k, (ws + k - 1) % 7])), ...extra };
});

// --- 3. Save weekdays mid-week: trained days keep their dates
{
  startAt(3, 4);
  eq('setup: today is w3d4', sched.todayId(undefined, 'p15'), 'w3d4');
  store.update((s) => { for (const d of [1, 2, 3]) s.programs.p15.days[`w3d${d}`] = { status: 'done', ex: {} }; });
  const before = [1, 2, 3].map((d) => iso(sched.dateForId(`w3d${d}`, 'p15')));
  const m = { ...store.setupOf('p15').dayMap }; const t = m[1]; m[1] = m[5]; m[5] = t;
  eq('save weekdays: applies from next week', comp.saveUsualWeek('p15', m), 4);
  eq('save weekdays: trained days keep their dates', [1, 2, 3].map((d) => iso(sched.dateForId(`w3d${d}`, 'p15'))), before);
  eq('save weekdays: next week changed', sched.mapForWeek(4, 'p15')[1], m[1]);
  // a week with nothing gone by or logged changes right away
  startAt(3, 1);
  eq('save weekdays: fresh week applies now', comp.saveUsualWeek('p15', { ...store.setupOf('p15').dayMap }), 3);
}

// --- 4. merging a backup from before a Restart keeps it as an earlier run
{
  startAt(2, 3);
  store.update((s) => { s.programs.p15.startedAt = 111; s.programs.p15.days = { w1d1: { status: 'done', ex: {}, note: 'old run' } }; });
  const backup = store.exportJson();
  comp.restartProgram('p15');
  store.update((s) => { s.programs.p15.days = { w1d1: { status: null, ex: {}, note: 'new run' } }; });
  store.importJson(backup, 'merge');
  const b = store.prog('p15');
  eq('restart+merge: new run day untouched', b.days.w1d1.note, 'new run');
  eq('restart+merge: old day lives in the earlier run', b.runs.map((r) => r.days.w1d1?.note), ['old run']);
  // same with a backup that never recorded a start time
  const j = JSON.parse(backup); j.state.programs.p15.startedAt = null;
  store.importJson(JSON.stringify(j), 'merge');
  eq('restart+merge (no start time): still not in the new run', store.prog('p15').days.w1d1.note, 'new run');
}

// --- 5. archived deload days stay in history and ids never repeat across runs
{
  startAt(3, 2);
  const block = comp.insertDeload('p15');
  eq('deload inserted', !!block, true);
  const id = sched.deloadDayId(block.id, block.d0);
  const e = comp.plannedDay('p15', id).entries.find((x) => x.sch.t !== 'time');
  store.update((s) => { s.programs.p15.days[id] = { status: 'done', ex: { [e.key]: { sets: [{ done: true, weight: 40, reps: 8, loggedAt: Date.now() }] } } }; });
  comp.restartProgram('p15');
  const h = comp.historyFor(e.item.ex).filter((r) => r.run);
  eq('archived deload: still in history', h.map((r) => r.dayId), [id]);
  eq('archived deload: marked light', h[0]?.deload, true);
  startAt(3, 2);
  store.update((s) => { s.programs.p15.runs = store.get().programs.p15.runs.length ? s.programs.p15.runs : s.programs.p15.runs; });
}
{
  // a new run's first deload doesn't reuse an archived id
  startAt(3, 2);
  store.update((s) => { s.programs.p15.runs = [{ startedAt: 1, endedAt: 2, setup: { deloads: [{ id: 1, week: 2, at: 7, d0: 1 }] }, days: {} }]; });
  eq('deload ids continue past archived runs', comp.insertDeload('p15').id, 2);
}

// --- restart resets the per-run flags
{
  startAt(2, 1);
  store.update((s) => { s.settings.celebrated = { p15: 1 }; s.settings.deloadDismissed = { p15: 4 }; s.settings.backupPromptWeek = 9; });
  comp.restartProgram('p15');
  const st = store.get().settings;
  eq('restart: flags reset', [st.celebrated.p15, st.deloadDismissed.p15, st.backupPromptWeek], [undefined, undefined, 0]);
}

// --- 6. labels for every kind of day
{
  startAt(3, 2);
  const blk = comp.insertDeload('p15');
  eq('label: deload', /^Deload · /.test(sched.dayLabel('p15', sched.deloadDayId(blk.id, blk.d0))), true);
  eq('label: week', /^Week 3 · /.test(sched.dayLabel('p15', 'w3d1')), true);
  store.update((s) => { s.programs.p15.setup.prepWeeks = 2; });
  eq('label: prep', /^Prep 1 · /.test(sched.dayLabel('p15', 'e1d1')), true);
}

if (fails) { console.error(`\n${fails} check(s) failed`); process.exit(1); }
console.log('✓ All edge-case checks passed');
