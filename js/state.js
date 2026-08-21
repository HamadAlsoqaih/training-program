// ============================================================================
// state.js — localStorage-backed store with pub/sub, export/import.
// ============================================================================
const KEY = 't15.state.v1';

const DEFAULTS = () => ({
  version: 1,
  setup: { done: false, anchorDate: null, anchorDay: 'w1d1', rolloverHour: 4, dayMap: null },
  settings: {
    sound: true, wakeLock: true, autoRest: true,
    reminderTime: '17:00', remindersOn: false,
    vo2SwapAck: false, squatVariation: '',
    backupPromptWeek: 0,
    durOv: {},   // sticky hold-timer overrides, key "exId@prescribedSecs"
    restOv: {},  // sticky rest overrides, key "exId@prescribedRest"
  },
  days: {},        // dayId -> { status, auto, ex: {key:{sets:[{done,weight,reps}]}}, note, skipReason, cardioDone, elapsedMs, finishedAt, contacts }
  fatigue: [],     // { week, rating, note, at }
  session: null,   // { dayId, startedAt, pausedAt, pausedMs }
});

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS();
    const parsed = JSON.parse(raw);
    const base = DEFAULTS();
    return {
      ...base, ...parsed,
      setup: { ...base.setup, ...parsed.setup },
      settings: { ...base.settings, ...parsed.settings },
      days: parsed.days || {},
      fatigue: parsed.fatigue || [],
    };
  } catch {
    return DEFAULTS();
  }
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.error('persist failed', e); }
}

export const get = () => state;

export function update(fn) {
  fn(state);
  persist();
  listeners.forEach((l) => { try { l(state); } catch (e) { console.error(e); } });
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function day(dayId) {
  return state.days[dayId] || null;
}

export function ensureDay(dayId) {
  if (!state.days[dayId]) state.days[dayId] = { status: null, ex: {} };
  return state.days[dayId];
}

// ---------------------------------------------------------------------------
// Export / import
// ---------------------------------------------------------------------------
export function exportJson() {
  return JSON.stringify({ app: '15-week-program', exportedAt: new Date().toISOString(), state }, null, 2);
}

export function importJson(text, mode /* 'replace' | 'merge' */) {
  const parsed = JSON.parse(text);
  const incoming = parsed.state || parsed; // accept raw state too
  if (!incoming || typeof incoming !== 'object' || !incoming.setup) {
    throw new Error('Not a valid backup file');
  }
  update((s) => {
    if (mode === 'replace') {
      Object.assign(s, DEFAULTS(), incoming, {
        setup: { ...DEFAULTS().setup, ...incoming.setup },
        settings: { ...DEFAULTS().settings, ...incoming.settings },
      });
    } else {
      // merge: incoming days win only where local has no entry
      s.days = { ...incoming.days, ...s.days };
      s.fatigue = [...(incoming.fatigue || []), ...s.fatigue]
        .filter((f, i, a) => a.findIndex((x) => x.week === f.week) === i);
      if (!s.setup.done && incoming.setup?.done) s.setup = { ...s.setup, ...incoming.setup };
    }
  });
}

export function resetAll() {
  state = DEFAULTS();
  persist();
  listeners.forEach((l) => l(state));
}
