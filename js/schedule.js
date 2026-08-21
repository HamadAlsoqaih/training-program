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

// Program day-of-week is locked to REAL weekdays via a user-configurable map
// (program day 1..7 → JS weekday 0..6). Default = the program's original
// schedule: D1=Wed, D2=Thu, D3=Fri, D4=Sat, D5=Sun, D6=Mon, D7=Tue.
// A given weekday therefore always shows the same slot; the anchor only
// decides which program WEEK a calendar week belongs to.
export const DEFAULT_DAY_MAP = { 1: 3, 2: 4, 3: 5, 4: 6, 5: 0, 6: 1, 7: 2 };
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const dayMap = () => get().setup.dayMap || DEFAULT_DAY_MAP;
export const weekdayOfProg = (d) => dayMap()[d];
export const progOfWeekday = (wd) => progOfWeekdayIn(dayMap(), wd);
const progOfWeekdayIn = (m, wd) => {
  for (let d = 1; d <= 7; d++) if (m[d] === wd) return d;
  return 1;
};

// One-off swaps: setup.weekSwaps = { [week]: [[dayA, dayB], ...] } — that week's
// map has the two days' weekdays exchanged; the standing schedule is untouched.
export const weekSwaps = (week) => get().setup.weekSwaps?.[week] || [];
export function mapForWeek(week) {
  const swaps = weekSwaps(week);
  if (!swaps.length) return dayMap();
  const m = { ...dayMap() };
  for (const [a, b] of swaps) { const t = m[a]; m[a] = m[b]; m[b] = t; }
  return m;
}
export const isSwapped = (week, progDay) => mapForWeek(week)[progDay] !== dayMap()[progDay];
export const weekdayName = (progDay, week) =>
  WEEKDAY_NAMES[(week ? mapForWeek(week) : dayMap())[progDay]];

// days after this program week's Day-1 weekday (standing map — swaps never move
// week boundaries)
const dowOffset = (date) => (date.getDay() - weekdayOfProg(1) + 7) % 7;
const weekStartOf = (date) => new Date(date.getTime() - dowOffset(date) * DAY_MS);
// offset (in real days) of a program day within a given week
const progOffset = (progDay, week) =>
  ((week ? mapForWeek(week) : dayMap())[progDay] - weekdayOfProg(1) + 7) % 7;

// Program-day index for "now" (may fall outside 0..104 → clamped, flagged)
export function todayIndexRaw(now = new Date()) {
  const { anchorDate, anchorDay } = get().setup;
  if (!anchorDate) return 0;
  const anchor = parseISO(anchorDate);
  const anchorIdx = idToIndex(anchorDay);
  const eff = effectiveDate(now);
  const weeksElapsed = Math.round((weekStartOf(eff) - weekStartOf(anchor)) / (7 * DAY_MS));
  const week = Math.floor(anchorIdx / 7) + weeksElapsed + 1; // 1-based program week
  return (week - 1) * 7 + (progOfWeekdayIn(mapForWeek(week), eff.getDay()) - 1);
}
export const todayIndex = (now) => clampIndex(todayIndexRaw(now));
export const todayId = (now) => indexToId(todayIndex(now));
export const isProgramOver = (now) => todayIndexRaw(now) > 104;
export const isBeforeStart = (now) => todayIndexRaw(now) < 0;

// Real calendar date for a program day (inverse of the weekday-locked mapping)
export function dateForIndex(i) {
  const { anchorDate, anchorDay } = get().setup;
  if (!anchorDate) return null;
  const anchor = parseISO(anchorDate);
  const anchorIdx = idToIndex(anchorDay);
  const weekDelta = Math.floor(i / 7) - Math.floor(anchorIdx / 7);
  const week = Math.floor(i / 7) + 1;
  return new Date(weekStartOf(anchor).getTime() + (weekDelta * 7 + progOffset((i % 7) + 1, week)) * DAY_MS);
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
