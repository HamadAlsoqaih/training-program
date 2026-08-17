// ============================================================================
// schedule.js — real-calendar ↔ program-day mapping with late-night rollover.
// The program day only advances at `rolloverHour` (default 4am): at 1am
// Tuesday you are still on Monday's workout.
// ============================================================================
import { get } from './state.js';

export const idToIndex = (dayId) => {
  const m = /^w(\d+)d([1-7])$/.exec(dayId);
  return (+m[1] - 1) * 7 + (+m[2] - 1);
};
export const indexToId = (i) => `w${Math.floor(i / 7) + 1}d${(i % 7) + 1}`;
export const clampIndex = (i) => Math.max(0, Math.min(104, i));

// "effective date" — a Date shifted back by the rollover hour, at local noon
// (noon keeps DST shifts from moving the calendar day).
function effectiveDate(now = new Date()) {
  const roll = get().setup.rolloverHour ?? 4;
  const d = new Date(now.getTime() - roll * 3600 * 1000);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
}

const parseISO = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};
export const toISO = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const DAY_MS = 24 * 3600 * 1000;

// Program-day index for "now" (may fall outside 0..104 → clamped, flagged)
export function todayIndexRaw(now = new Date()) {
  const { anchorDate, anchorDay } = get().setup;
  if (!anchorDate) return 0;
  const diff = Math.round((effectiveDate(now) - parseISO(anchorDate)) / DAY_MS);
  return idToIndex(anchorDay) + diff;
}
export const todayIndex = (now) => clampIndex(todayIndexRaw(now));
export const todayId = (now) => indexToId(todayIndex(now));
export const isProgramOver = (now) => todayIndexRaw(now) > 104;
export const isBeforeStart = (now) => todayIndexRaw(now) < 0;

// Real calendar date for a program day
export function dateForIndex(i) {
  const { anchorDate, anchorDay } = get().setup;
  if (!anchorDate) return null;
  const d = parseISO(anchorDate);
  return new Date(d.getTime() + (i - idToIndex(anchorDay)) * DAY_MS);
}
export const dateForId = (id) => dateForIndex(idToIndex(id));

export function fmtDate(date) {
  if (!date) return '';
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

// Days behind schedule: calendar position vs first not-finished day.
export function behindDays(firstOpenIndex, now = new Date()) {
  return todayIndex(now) - firstOpenIndex;
}
