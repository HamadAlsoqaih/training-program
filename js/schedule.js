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
//
// Inserted deload weeks live HERE and nowhere else. A deload is one extra
// CALENDAR week slot spliced in ahead of the week you are in; program indices
// never move, so nothing renumbers and no completion total changes. Two spaces
// exist:
//   program index  — 0 … totalDays-1, the program's own content, never shifts
//   calendar index — the same thing plus 7 slots per inserted deload
// calIndexOf() goes one way, slotAtCal() the other, and every date in the app
// comes from dateForCal().
// ============================================================================
import { get, setupOf, activePid } from './state.js';
import { totalDays, totalWeeks } from './program.js';
import {
  deloadBlocks, deloadBlock, blockCalStart, calIndexOf, slotAtCal,
  deloadDayId, deloadIdParts, isDeloadId, deloadLength,
} from './deload.js';

// re-exported so callers have one place to import schedule-ish things from
export {
  deloadBlocks, deloadBlock, blockCalStart, calIndexOf, slotAtCal,
  deloadDayId, deloadIdParts, isDeloadId, deloadLength,
};

export const DEFAULT_DAY_MAP = { 1: 3, 2: 4, 3: 5, 4: 6, 5: 0, 6: 1, 7: 2 }; // Wed…Tue
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_MS = 24 * 3600 * 1000;

// null for anything that is not a program day id (a deload id, or junk)
export const idToIndex = (dayId) => {
  const m = /^w(\d+)d([1-7])$/.exec(dayId || '');
  return m ? (+m[1] - 1) * 7 + (+m[2] - 1) : null;
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
// The calendar slot today lands on, before any program/deload interpretation.
function calToday(now = new Date(), pid = activePid()) {
  const { anchorDate, anchorDay } = setupOf(pid);
  if (!anchorDate) return 0;
  const anchor = parseISO(anchorDate);
  const anchorIdx = idToIndex(anchorDay) ?? 0;
  const eff = effectiveDate(now, pid);
  const weeksElapsed = Math.round((weekStartOf(eff, pid) - weekStartOf(anchor, pid)) / (7 * DAY_MS));
  const week = Math.floor(anchorIdx / 7) + weeksElapsed + 1;
  return (week - 1) * 7 + (progOfWeekdayIn(mapForWeek(week, pid), eff.getDay()) - 1);
}

// Everything today: which program day is due, and whether a deload is running.
//   { state: 'before'|'active'|'over', index, deload?: { block, d, id } }
export function todaySlot(pid = activePid(), now = new Date()) {
  const slot = slotAtCal(calToday(now, pid), pid);
  const index = slot.kind === 'deload' ? slot.block.at : slot.index;
  const n = totalDays(pid);
  const state = index < 0 ? 'before' : index >= n ? 'over' : 'active';
  if (slot.kind === 'deload' && state === 'active') {
    return { state, index, deload: { block: slot.block, d: slot.d, id: deloadDayId(slot.block.id, slot.d) } };
  }
  return { state, index };
}

// The program day due today. Inside a deload block this is Day 1 of the week
// about to replay — the deload itself is reported by todaySlot().
export function todayIndexRaw(now = new Date(), pid = activePid()) {
  const slot = slotAtCal(calToday(now, pid), pid);
  return slot.kind === 'deload' ? slot.block.at : slot.index;
}
// todayIndex is CLAMPED so browsing always lands on a real day. Anything that
// calls a day "today" must check programStatus() first — a clamped index is not
// today, it is just the nearest day that exists.
export const todayIndex = (now, pid = activePid()) => clampIndex(todayIndexRaw(now, pid), pid);
export function todayId(now, pid = activePid()) {
  const slot = todaySlot(pid, now);
  return slot.deload ? slot.deload.id : indexToId(clampIndex(slot.index, pid));
}
// Days that have actually come due. During a deload nothing new has, so this
// stops at the day before the week being replayed — adherence must not dip
// just because you took a planned light week.
export function elapsedIndex(pid = activePid(), now = new Date()) {
  const slot = todaySlot(pid, now);
  return slot.deload ? slot.index - 1 : clampIndex(slot.index, pid);
}
export const isProgramOver = (now, pid = activePid()) => todayIndexRaw(now, pid) >= totalDays(pid);
export const isBeforeStart = (now, pid = activePid()) => todayIndexRaw(now, pid) < 0;

// Where the real calendar sits relative to this program.
//   before → the program starts in the future (countdown)
//   active → today maps onto a real program day
//   over   → the program's last day has passed
export function programStatus(pid = activePid(), now = new Date()) {
  const raw = todayIndexRaw(now, pid);
  const n = totalDays(pid);
  const startDate = dateForIndex(0, pid);
  const endDate = dateForIndex(n - 1, pid);
  const eff = effectiveDate(now, pid);
  const dayDiff = (a, b) => Math.round((a - b) / DAY_MS);
  if (raw < 0) {
    return { state: 'before', rawIndex: raw, startDate, endDate,
      daysUntil: startDate ? Math.max(1, dayDiff(startDate, eff)) : 1 };
  }
  if (raw >= n) {
    return { state: 'over', rawIndex: raw, startDate, endDate,
      daysOver: endDate ? Math.max(1, dayDiff(eff, endDate)) : 1 };
  }
  return { state: 'active', rawIndex: raw, startDate, endDate };
}

// The real calendar date right now (respecting the rollover hour).
export const realToday = (pid = activePid(), now = new Date()) => effectiveDate(now, pid);
export const currentWeek = (pid = activePid()) =>
  Math.min(totalWeeks(pid), Math.floor(todayIndex(undefined, pid) / 7) + 1);

// --- dates ------------------------------------------------------------------
// A calendar slot's real date. `swapWeek` is the program week whose one-off
// day swaps apply — null for a deload slot, which uses the standing map.
function dateForCal(c, pid = activePid(), swapWeek = null) {
  const { anchorDate, anchorDay } = setupOf(pid);
  if (!anchorDate) return null;
  const anchor = parseISO(anchorDate);
  const anchorIdx = idToIndex(anchorDay) ?? 0;
  const weekDelta = Math.floor(c / 7) - Math.floor(anchorIdx / 7);
  return new Date(weekStartOf(anchor, pid).getTime()
    + (weekDelta * 7 + progOffset((c % 7) + 1, swapWeek, pid)) * DAY_MS);
}

// Program index → date. Signature unchanged: every caller shifts for free once
// a deload is inserted, because calIndexOf() moves the whole week along.
export function dateForIndex(i, pid = activePid()) {
  return dateForCal(calIndexOf(i, pid), pid, Math.floor(i / 7) + 1);
}

// Works for both id shapes.
export function dateForId(id, pid = activePid()) {
  const k = deloadIdParts(id);
  if (k) {
    const b = deloadBlock(k.block, pid);
    if (!b) return null;
    return dateForCal(blockCalStart(b, pid) + (k.d - 1), pid, null);
  }
  const i = idToIndex(id);
  return i == null ? null : dateForIndex(i, pid);
}
// --- walking the calendar ----------------------------------------------------
// Day id → its calendar slot, and back. Used for prev/next navigation, which
// must step through inserted deload days as if they were ordinary days.
export function calIndexOfDayId(pid, dayId) {
  const k = deloadIdParts(dayId);
  if (k) {
    const b = deloadBlock(k.block, pid);
    return b ? blockCalStart(b, pid) + (k.d - 1) : 0;
  }
  const i = idToIndex(dayId);
  return i == null ? 0 : calIndexOf(i, pid);
}

export function dayIdAtCal(pid, c) {
  const slot = slotAtCal(c, pid);
  if (slot.kind === 'deload') return deloadDayId(slot.block.id, slot.d);
  return indexToId(clampIndex(slot.index, pid));
}

// The last calendar slot the program occupies (deload weeks included).
export const lastCalIndex = (pid = activePid()) => calIndexOf(totalDays(pid) - 1, pid);

// Sort key for history: a real date when we have an anchor, else the index.
export const timeForDayId = (pid, dayId) => {
  const d = dateForId(dayId, pid);
  if (d) return d.getTime();
  const i = idToIndex(dayId);
  return (i ?? 0) * DAY_MS;
};

export function fmtDate(date) {
  if (!date) return '';
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export const behindDays = (firstOpenIndex, now = new Date(), pid = activePid()) =>
  todayIndex(now, pid) - firstOpenIndex;
