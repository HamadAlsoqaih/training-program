// Card fields, box heights (higher / lower is better), Arabic numbers, and
// adding / deleting / removing sets. Run: node tests/fields.mjs
globalThis.localStorage = { _v: null, getItem() { return this._v; }, setItem(_k, v) { this._v = v; }, removeItem() { this._v = null; } };
const store = await import('../js/state.js');
const sched = await import('../js/schedule.js');
const comp = await import('../js/completion.js');
const F = await import('../js/fields.js');

let fails = 0;
const eq = (label, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) { fails++; console.error(`FAIL ${label}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); } };
store.update((s) => {
  s.activeProgram = 'rz';
  const b = s.programs.rz; b.started = true; b.days = {};
  b.setup = { ...b.setup, anchorDay: 'w1d1', anchorDate: sched.toISO(new Date()), rolloverHour: 0 };
});
// find the Box Push-Up entry in week 1
let day = null, bp = null, plain = null;
for (let d = 1; d <= 7 && !bp; d++) {
  const pl = comp.plannedDay('rz', `w1d${d}`);
  const e = pl?.entries.find((x) => x.item.ex === 'box_pushup');
  if (e) { day = `w1d${d}`; bp = e; plain = pl.entries.find((x) => x.sch.t === 'sr' && !x.item.ss && x.item.ex !== 'box_pushup'); }
}

// --- defaults
eq('box push-up: box down, no kg', [F.fieldsFor('rz', day, bp).box, F.fieldsFor('rz', day, bp).weight], ['down', false]);
eq('plain lift: kg + reps', [F.fieldsFor('rz', day, plain).weight, F.fieldsFor('rz', day, plain).reps, F.fieldsFor('rz', day, plain).box], [true, true, false]);
eq('timed item: timer only', F.defaultFields({ ex: 'plank' in {} ? 'plank' : 'oh_iso_hold' }, { t: 'time', sets: 2, secs: 30 }), { weight: false, reps: false, box: false, timer: true });
eq('box jump default up', F.boxDir('box_jump'), 'up');

// --- everywhere vs only this day (day wins)
F.saveFieldsEverywhere(plain.item.ex, { weight: true, reps: true, box: 'up', timer: false });
eq('everywhere: box on', F.fieldsFor('rz', day, plain).box, 'up');
comp.saveDayFields('rz', day, plain.key, { weight: false, reps: true, box: false, timer: true });
eq('only this day wins', [F.fieldsFor('rz', day, plain).weight, F.fieldsFor('rz', day, plain).timer], [false, true]);
comp.saveDayFields('rz', day, plain.key, null);
eq('day override cleared', F.fieldsFor('rz', day, plain).weight, true);
F.saveFieldsEverywhere(plain.item.ex, null);
eq('reset to default', F.fieldsFor('rz', day, plain).box, false);
eq('junk in storage is ignored', (store.update((s) => { s.settings.fieldOv = { [plain.item.ex]: { weight: 'yes', box: 'sideways' } }; }), F.fieldsFor('rz', day, plain).weight), true);
store.update((s) => { s.settings.fieldOv = {}; });

// --- numbers
eq('arabic digits', F.parseNum('٤٥'), 45);
eq('persian digits + arabic decimal', F.parseNum('۱۲٫۵'), 12.5);
eq('comma decimal', F.parseNum('12,5'), 12.5);
eq('empty is null', F.parseNum(''), null);
eq('letters are not a number', Number.isNaN(F.parseNum('12kg')), true);

// --- partial saves never wipe a hidden field
comp.setLog('rz', day, plain, 0, { weight: 40, reps: 8 });
comp.setLog('rz', day, plain, 0, { reps: 9, weight: undefined });
eq('hidden field kept', store.day(day, 'rz').ex[plain.key].sets[0], { weight: 40, reps: 9 });

// --- best box, both directions; box-only sets reach history
comp.setLog('rz', day, bp, 0, { box: 40 }); comp.toggleSet('rz', day, bp, 0, { box: 40 });
comp.setLog('rz', day, bp, 1, { box: 30 }); comp.toggleSet('rz', day, bp, 1, { box: 30 });
const hist = comp.historyFor('box_pushup');
eq('box sets in history', hist.length, 1);
eq('lower is better -> 30', F.bestBox(hist, 'down'), 30);
eq('higher is better -> 40', F.bestBox(hist, 'up'), 40);
eq('better compare', [F.boxBetter(25, 30, 'down'), F.boxBetter(25, 30, 'up')], [true, false]);

// --- add / delete / remove
const p0 = comp.plannedEntry('rz', day, plain.key);
comp.addSet('rz', day, p0);
const p1 = comp.plannedEntry('rz', day, plain.key);
eq('add set', p1.sets, p0.sets + 1);
store.update((s) => { s.programs.rz.days[day].contacts = { [`${plain.key}:0`]: 5, [`${plain.key}:1`]: 7, [`${plain.key}:2`]: 9 }; });
comp.deleteSet('rz', day, p1, 0);
eq('delete set shrinks', comp.plannedEntry('rz', day, plain.key).sets, p1.sets - 1);
eq('contacts shift down with the sets', store.day(day, 'rz').contacts, { [`${plain.key}:0`]: 7, [`${plain.key}:1`]: 9 });
comp.removeExercise('rz', day, plain.key);
const pr = comp.plannedEntry('rz', day, plain.key);
eq('removed: flagged and settled like a skip', [pr.removed, pr.skipped, comp.exerciseDone('rz', day, pr)], [true, true, false]);
eq('removed: not required to finish the day', comp.requiredEntries(comp.plannedDay('rz', day)).some((e) => e.key === plain.key), false);
eq('removed: its sets and contacts are gone', [store.day(day, 'rz').ex[plain.key].sets.length, store.day(day, 'rz').contacts], [0, {}]);
comp.restoreExercise('rz', day, plain.key);
eq('restored', comp.plannedEntry('rz', day, plain.key).removed, false);
eq('removed/fields don\'t count as "edited"', (comp.saveDayFields('rz', day, bp.key, { box: 'up' }), comp.plannedEntry('rz', day, bp.key).edited), false);

if (fails) { console.error(`\n${fails} check(s) failed`); process.exit(1); }
console.log('✓ All field checks passed');
