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
//       setup:   { anchorDate, anchorDay, rolloverHour, dayMap, weekSwaps },
//       days:    { "w3d6": DayRecord },
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
import { PROGRAM_LIST, DEFAULT_PROGRAM } from './program.js';

const KEY = 't15.state.v1'; // key kept stable so existing installs migrate in place

const emptyProgram = () => ({
  started: false,
  startedAt: null,
  setup: { anchorDate: null, anchorDay: 'w1d1', rolloverHour: 4, dayMap: null, weekSwaps: {} },
  days: {},
  fatigue: [],
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

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.error('persist failed', e); }
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

export function importJson(text, mode /* 'replace' | 'merge' */) {
  const parsed = JSON.parse(text);
  let incoming = parsed.state || parsed;
  if (!incoming || typeof incoming !== 'object') throw new Error('Not a valid backup file');
  if (!incoming.version || incoming.version < 2) incoming = migrateV1(incoming);
  else incoming = hydrate(incoming);

  update((s) => {
    if (mode === 'replace') {
      Object.assign(s, incoming);
    } else {
      for (const p of PROGRAM_LIST) {
        const mine = s.programs[p.id], theirs = incoming.programs[p.id];
        if (!theirs) continue;
        mine.days = { ...theirs.days, ...mine.days };   // local wins on conflict
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
