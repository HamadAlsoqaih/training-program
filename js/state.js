// ============================================================================
// state.js — localStorage-backed store.
//
// Schema v2 (multi-program). Everything a program owns — schedule anchor,
// day records, fatigue log — lives in its own bucket under `programs`, so two
// programs never collide and you can switch between them without losing data.
//
// {
//   version: 2,
//   activeProgram: 'p15',
//   programs: {
//     p15: {
//       started, startedAt,
//       setup:   { anchorDate, anchorDay, rolloverHour, dayMap, weekSwaps,
//                  deloads: [ { id, week, at, d0, startedAt } ] },
//       days:    { "w3d6": DayRecord, "k1d3": DayRecord (inserted deload) },
//       fatigue: [ { week, rating, at } ],
//     },
//     p12: { ... },
//   },
//   session:  { pid, dayId, startedAt, pausedAt, pausedMs } | null,
//   settings: { ...global preferences... },
// }
//
// DayRecord = {
//   status: 'done'|'skipped'|null, auto: true (back-filled), finishedAt,
//   ex: { "s0i2": { sets: [{done, weight, reps}], alt, mode } },
//   plan: {                       // per-day customisation (see completion.js)
//     secOrder: [1,0,2], exOrder: { "0": [2,0,1] },
//     ex: { "s0i2": { sets, reps, secs, rest, skipped } },
//   },
//   note, skipReason, cardioDone, startedAt, elapsedMs, contacts
// }
// ============================================================================
import { PROGRAM_LIST, DEFAULT_PROGRAM } from './registry.js';

const KEY = 't15.state.v1'; // key kept stable so existing installs migrate in place

const emptyProgram = () => ({
  started: false,
  startedAt: null,
  setup: { anchorDate: null, anchorDay: 'w1d1', rolloverHour: 4, dayMap: null, weekSwaps: {}, deloads: [] },
  days: {},
  fatigue: [],
  runs: [],   // earlier runs put aside by "Restart": { startedAt, endedAt, setup, days, fatigue }
});

const DEFAULTS = () => ({
  version: 2,
  activeProgram: DEFAULT_PROGRAM,
  programs: Object.fromEntries(PROGRAM_LIST.map((p) => [p.id, emptyProgram()])),
  session: null,
  settings: {
    sound: true, wakeLock: true, autoRest: true,
    reminderTime: '17:00', remindersOn: false,
    vo2SwapAck: false, squatVariation: '',
    backupPromptWeek: 0,
    accent: '#fbbf24',      // theme colour (settings → appearance)
    durOv: {}, restOv: {},  // sticky timer/rest overrides, key "exId@prescribed"
  },
  onboarded: false,
});

let state = load();
let revision = 0;           // bumped on every write — memo caches key off this
const listeners = new Set();

function load() {
  let parsed = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) parsed = JSON.parse(raw);
  } catch { /* corrupt storage → start clean */ }
  if (!parsed) return DEFAULTS();
  return parsed.version >= 2 ? hydrate(parsed) : migrateV1(parsed);
}

// Fill in anything a newer app version added that an older save lacks.
function hydrate(saved) {
  const base = DEFAULTS();
  const programs = {};
  for (const p of PROGRAM_LIST) {
    const s = saved.programs?.[p.id] || {};
    programs[p.id] = {
      ...emptyProgram(), ...s,
      setup: { ...emptyProgram().setup, ...(s.setup || {}) },
      days: s.days || {},
      fatigue: s.fatigue || [],
      runs: Array.isArray(s.runs) ? s.runs : [],
    };
  }
  return {
    ...base, ...saved,
    programs,
    settings: { ...base.settings, ...(saved.settings || {}) },
    activeProgram: PROGRAM_LIST.some((p) => p.id === saved.activeProgram)
      ? saved.activeProgram : DEFAULT_PROGRAM,
  };
}

// v1 → v2: the old single-program save becomes the 15-week program's bucket.
function migrateV1(old) {
  const next = DEFAULTS();
  next.programs[DEFAULT_PROGRAM] = {
    ...emptyProgram(),
    started: !!old.setup?.done,
    startedAt: old.setup?.done ? Date.now() : null,
    setup: {
      ...emptyProgram().setup,
      anchorDate: old.setup?.anchorDate ?? null,
      anchorDay: old.setup?.anchorDay ?? 'w1d1',
      rolloverHour: old.setup?.rolloverHour ?? 4,
      dayMap: old.setup?.dayMap ?? null,
      weekSwaps: old.setup?.weekSwaps ?? {},
    },
    days: old.days || {},
    fatigue: old.fatigue || [],
  };
  next.settings = { ...next.settings, ...(old.settings || {}) };
  next.session = old.session ? { ...old.session, pid: DEFAULT_PROGRAM } : null;
  next.onboarded = !!old.setup?.done;
  next.activeProgram = DEFAULT_PROGRAM;
  return next;
}

// A failed save (storage full, private mode) used to be silent: you kept
// logging and lost it all on the next reload. The app now hears about it once,
// and again only after a save has worked in between.
let saveFailed = false;
const saveErrorListeners = new Set();
export const onSaveError = (fn) => { saveErrorListeners.add(fn); return () => saveErrorListeners.delete(fn); };

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    saveFailed = false;
  } catch (e) {
    console.error('persist failed', e);
    if (!saveFailed) saveErrorListeners.forEach((l) => { try { l(e); } catch { /* ignore */ } });
    saveFailed = true;
  }
}

export const get = () => state;
export const rev = () => revision;

export function update(fn) {
  fn(state);
  revision++;
  persist();
  listeners.forEach((l) => { try { l(state); } catch (e) { console.error(e); } });
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// --- program-scoped accessors ----------------------------------------------
export const activePid = () => state.activeProgram;
export const prog = (pid = state.activeProgram) =>
  state.programs[pid] || (state.programs[pid] = emptyProgram());
export const setupOf = (pid = state.activeProgram) => prog(pid).setup;
export const day = (dayId, pid = state.activeProgram) => prog(pid).days[dayId] || null;

export function ensureDay(dayId, pid = state.activeProgram) {
  const p = prog(pid);
  if (!p.days[dayId]) p.days[dayId] = { status: null, ex: {} };
  return p.days[dayId];
}

export function setActiveProgram(pid) {
  update((s) => {
    s.activeProgram = pid;
    const p = s.programs[pid] || (s.programs[pid] = emptyProgram());
    if (!p.started) { p.started = true; p.startedAt = Date.now(); }
    if (s.session && s.session.pid !== pid) s.session = null;
  });
}

// --- export / import --------------------------------------------------------
export function exportJson() {
  return JSON.stringify({ app: '15-week-program', exportedAt: new Date().toISOString(), state }, null, 2);
}

// When a day was last touched. Older records predate `updatedAt`, so fall back
// to the newest timestamp the record carries anywhere.
export function dayStamp(rec) {
  if (!rec || typeof rec !== 'object') return 0;
  let t = Math.max(rec.updatedAt || 0, rec.lastLoggedAt || 0, rec.finishedAt || 0, rec.startedAt || 0);
  for (const x of Object.values(rec.ex || {})) {
    for (const v of x?.sets || []) if (v?.loggedAt > t) t = v.loggedAt;
  }
  return t;
}

function parseBackup(text) {
  const parsed = JSON.parse(text);
  let incoming = parsed.state || parsed;
  if (!incoming || typeof incoming !== 'object' || (!incoming.programs && !incoming.days)) {
    throw new Error('That file is not a training backup');
  }
  if (!incoming.version || incoming.version < 2) incoming = migrateV1(incoming);
  else incoming = hydrate(incoming);
  return { incoming, exportedAt: parsed.exportedAt || null };
}

// What a backup holds, for the "Import this backup?" question.
export function previewBackup(text) {
  const { incoming, exportedAt } = parseBackup(text);
  let days = 0, newer = 0, added = 0;
  for (const p of PROGRAM_LIST) {
    const theirs = incoming.programs[p.id]?.days || {};
    const mine = state.programs[p.id]?.days || {};
    for (const [id, rec] of Object.entries(theirs)) {
      days++;
      if (!mine[id]) added++;
      else if (dayStamp(rec) > dayStamp(mine[id])) newer++;
    }
  }
  return { exportedAt, days, added, newer };
}

// mode 'merge': days only in the backup are added; a day on both sides keeps
// whichever was changed more recently (a tie keeps this phone's).
// mode 'replace': everything becomes the backup.
export function importJson(text, mode /* 'replace' | 'merge' */) {
  const { incoming } = parseBackup(text);

  update((s) => {
    if (mode === 'replace') {
      Object.assign(s, incoming);
    } else {
      for (const p of PROGRAM_LIST) {
        const mine = s.programs[p.id], theirs = incoming.programs[p.id];
        if (!theirs) continue;
        const days = { ...mine.days };
        for (const [id, rec] of Object.entries(theirs.days || {})) {
          if (!days[id] || dayStamp(rec) > dayStamp(days[id])) days[id] = rec;
        }
        mine.days = days;
        const seen = new Set((mine.runs || []).map((r) => `${r.startedAt}:${r.endedAt}`));
        mine.runs = [...(mine.runs || []), ...(theirs.runs || []).filter((r) => !seen.has(`${r.startedAt}:${r.endedAt}`))];
        mine.fatigue = [...(theirs.fatigue || []), ...mine.fatigue]
          .filter((f, i, a) => a.findIndex((x) => x.week === f.week) === i);
        if (!mine.started && theirs.started) {
          mine.started = true; mine.startedAt = theirs.startedAt; mine.setup = theirs.setup;
        }
      }
      if (!s.onboarded && incoming.onboarded) {
        s.onboarded = true;
        s.activeProgram = incoming.activeProgram;
      }
    }
  });
}

export function resetAll() {
  state = DEFAULTS();
  revision++;
  persist();
  listeners.forEach((l) => l(state));
}
