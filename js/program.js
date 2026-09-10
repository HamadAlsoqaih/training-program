// ============================================================================
// program.js — program registry + facade.
//
// Everything the app renders comes from here. Each program module (js/programs/*)
// exposes `buildWeek(week)`; this file wraps that with caching and gives every
// day a stable identity: { pid, week, d, id: "w3d6", sections }.
//
// Re-exports the shared exercise catalog and scheme helpers so views only ever
// import from one place.
// ============================================================================
import p15 from './programs/p15.js';
import p12 from './programs/p12.js';

export {
  EX, ytUrl, hasVideo, muxHls, muxPoster, displayName, cableName,
} from './exercises.js';
export { fmtSecs, schemeLabel, schemeSets } from './schemes.js';

import { schemeSets } from './schemes.js';

export const PROGRAM_LIST = [p15, p12];
export const PROGRAMS = Object.fromEntries(PROGRAM_LIST.map((p) => [p.id, p]));
export const DEFAULT_PROGRAM = p15.id;

export const getProgram = (pid) => PROGRAMS[pid] || p15;
export const totalWeeks = (pid) => getProgram(pid).weeks;
export const totalDays = (pid) => getProgram(pid).weeks * 7;
export const phaseOf = (pid, week) =>
  getProgram(pid).phases.find((p) => week >= p.weeks[0] && week <= p.weeks[1]);

// --- week resolution (cached: building a week allocates a lot of objects) ---
const weekCache = new Map();

export function getWeek(pid, week) {
  const key = `${pid}:${week}`;
  const hit = weekCache.get(key);
  if (hit) return hit;

  const program = getProgram(pid);
  if (week < 1 || week > program.weeks) return null;

  const days = program.buildWeek(week).map((day) => ({
    ...day, pid, week, id: `w${week}d${day.d}`,
  }));
  const result = {
    pid, week, program,
    phase: phaseOf(pid, week),
    badge: program.badges[week] || null,
    days,
  };
  weekCache.set(key, result);
  return result;
}

export function getDay(pid, dayId) {
  const m = /^w(\d+)d([1-7])$/.exec(dayId || '');
  if (!m) return null;
  const week = getWeek(pid, +m[1]);
  return week ? week.days[+m[2] - 1] : null;
}

export function allDayIds(pid) {
  const ids = [];
  for (let w = 1; w <= totalWeeks(pid); w++) for (let d = 1; d <= 7; d++) ids.push(`w${w}d${d}`);
  return ids;
}

// --- flat exercise list for a day (cached per day object) ------------------
// Each entry: { key: "s0i2", section, item, sets }
const exCache = new WeakMap();

export function dayExercises(day) {
  const hit = exCache.get(day);
  if (hit) return hit;
  const out = [];
  day.sections.forEach((sec, si) => sec.items.forEach((item, ii) => {
    out.push({ key: `s${si}i${ii}`, si, ii, section: sec, item, sets: schemeSets(item.sch) });
  }));
  exCache.set(day, out);
  return out;
}

// Program-level meta (per program)
export const nutritionFor = (pid) => getProgram(pid).nutrition;
export const notesFor = (pid) => getProgram(pid).notes;
export const daySlotsFor = (pid) => getProgram(pid).daySlots;
