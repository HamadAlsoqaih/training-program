// ============================================================================
// schedule.js — real-calendar ↔ program-day mapping (per program).
//
// Two rules make "today" always correct:
//   1. Program day-slots are pinned to REAL weekdays through a user-editable
//      map (day 1..7 → weekday 0..6). Whatever weekday it is, you get the slot
//      you assigned to that weekday.
//   2. The anchor (a date ↔ program position) only decides which WEEK it is.
//
// A late-night rollover hour (default 4 AM) keeps 1 AM sessions on the
// previous day. One-off swaps can exchange two day-slots for a single week.
// ============================================================================
import { get, setupOf, activePid } from './state.js';
import { totalDays, totalWeeks } from './program.js';

export const DEFAULT_DAY_MAP = { 1: 3, 2: 4, 3: 5, 4: 6, 5: 0, 6: 1, 7: 2 }; // Wed…Tue
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_MS = 24 * 3600 * 1000;

export const idToIndex = (dayId) => {
  const m = /^w(\d+)d([1-7])$/.exec(dayId);
  return (+m[1] - 1) * 7 + (+m[2] - 1);
};
export const indexToId = (i) => `w${Math.floor(i / 7) + 1}d${(i % 7) + 1}`;
export const clampIndex = (i, pid = activePid()) =>
  Math.max(0, Math.min(totalDays(pid) - 1, i));

export const toISO = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parseISO = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12); // noon keeps DST shifts from moving the day
};

// "effective date" — shifted back by the rollover hour, at local noon
function effectiveDate(now = new Date(), pid = activePid()) {
  const roll = setupOf(pid).rolloverHour ?? 4;
  const d = new Date(now.getTime() - roll * 3600 * 1000);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
}

// --- weekday mapping --------------------------------------------------------
export const dayMap = (pid = activePid()) => setupOf(pid).dayMap || DEFAULT_DAY_MAP;
export const weekdayOfProg = (d, pid = activePid()) => dayMap(pid)[d];
const progOfWeekdayIn = (m, wd) => {
  for (let d = 1; d <= 7; d++) if (m[d] === wd) return d;
  return 1;
};
export const progOfWeekday = (wd, pid = activePid()) => progOfWeekdayIn(dayMap(pid), wd);

export const weekSwaps = (week, pid = activePid()) => setupOf(pid).weekSwaps?.[week] || [];
export function mapForWeek(week, pid = activePid()) {
  const swaps = weekSwaps(week, pid);
  if (!swaps.length) return dayMap(pid);
  const m = { ...dayMap(pid) };
  for (const [a, b] of swaps) { const t = m[a]; m[a] = m[b]; m[b] = t; }
  return m;
}
export const isSwapped = (week, progDay, pid = activePid()) =>
  mapForWeek(week, pid)[progDay] !== dayMap(pid)[progDay];
export const weekdayName = (progDay, week, pid = activePid()) =>
  WEEKDAY_NAMES[(week ? mapForWeek(week, pid) : dayMap(pid))[progDay]];

// days after this program week's Day-1 weekday (standing map — swaps never
// move week boundaries)
const dowOffset = (date, pid) => (date.getDay() - weekdayOfProg(1, pid) + 7) % 7;
const weekStartOf = (date, pid) => new Date(date.getTime() - dowOffset(date, pid) * DAY_MS);
const progOffset = (progDay, week, pid) =>
  ((week ? mapForWeek(week, pid) : dayMap(pid))[progDay] - weekdayOfProg(1, pid) + 7) % 7;

// --- today ------------------------------------------------------------------
export function todayIndexRaw(now = new Date(), pid = activePid()) {
  const { anchorDate, anchorDay } = setupOf(pid);
  if (!anchorDate) return 0;
  const anchor = parseISO(anchorDate);
  const anchorIdx = idToIndex(anchorDay);
  const eff = effectiveDate(now, pid);
  const weeksElapsed = Math.round((weekStartOf(eff, pid) - weekStartOf(anchor, pid)) / (7 * DAY_MS));
  const week = Math.floor(anchorIdx / 7) + weeksElapsed + 1;
  return (week - 1) * 7 + (progOfWeekdayIn(mapForWeek(week, pid), eff.getDay()) - 1);
}
export const todayIndex = (now, pid = activePid()) => clampIndex(todayIndexRaw(now, pid), pid);
export const todayId = (now, pid = activePid()) => indexToId(todayIndex(now, pid));
export const isProgramOver = (now, pid = activePid()) => todayIndexRaw(now, pid) >= totalDays(pid);
export const isBeforeStart = (now, pid = activePid()) => todayIndexRaw(now, pid) < 0;
export const currentWeek = (pid = activePid()) =>
  Math.min(totalWeeks(pid), Math.floor(todayIndex(undefined, pid) / 7) + 1);

// --- dates ------------------------------------------------------------------
export function dateForIndex(i, pid = activePid()) {
  const { anchorDate, anchorDay } = setupOf(pid);
  if (!anchorDate) return null;
  const anchor = parseISO(anchorDate);
  const anchorIdx = idToIndex(anchorDay);
  const weekDelta = Math.floor(i / 7) - Math.floor(anchorIdx / 7);
  const week = Math.floor(i / 7) + 1;
  return new Date(weekStartOf(anchor, pid).getTime()
    + (weekDelta * 7 + progOffset((i % 7) + 1, week, pid)) * DAY_MS);
}
export const dateForId = (id, pid = activePid()) => dateForIndex(idToIndex(id), pid);

export function fmtDate(date) {
  if (!date) return '';
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export const behindDays = (firstOpenIndex, now = new Date(), pid = activePid()) =>
  todayIndex(now, pid) - firstOpenIndex;
