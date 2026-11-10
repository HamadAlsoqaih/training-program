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
// A program index is a CALENDAR POSITION: (week - 1) * 7 + p, where p = 0 is
// the weekday your week starts on. Which session sits at each position comes
// from your arrangement, so you can put any session on any day and start the
// week on any weekday — and "before today" always means earlier in real time.
// A day id ("w3d7") names the session's CONTENT and never changes meaning.
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
import { get, setupOf, activePid, update } from './state.js';
import { totalDays, totalWeeks, getProgram, getDay } from './program.js';
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
// A program may ship its own weekday layout — 12-Week+ runs Friday → Thursday —
// which is the starting point until you set your own in the start flow.
export const dayMap = (pid = activePid()) =>
  setupOf(pid).dayMap || getProgram(pid).defaultDayMap || DEFAULT_DAY_MAP;
export const weekdayOfProg = (d, pid = activePid()) => dayMap(pid)[d];
const progOfWeekdayIn = (m, wd) => {
  for (let d = 1; d <= 7; d++) if (m[d] === wd) return d;
  return 1;
};
export const progOfWeekday = (wd, pid = activePid()) => progOfWeekdayIn(dayMap(pid), wd);

// Which session sits on which weekday can change over time without touching
// weeks that already happened:
//   setup.mapHistory = [ { from: week, map } ]  the usual week, from that week on
//   setup.weekMaps   = { [week]: map }          one week arranged differently
//   setup.weekSwaps  = { [week]: [[a,b]] }      older one-off swaps (still read)
// With no history the current dayMap applies to every week, exactly as before.
export const weekSwaps = (week, pid = activePid()) => setupOf(pid).weekSwaps?.[week] || [];
export function usualMapForWeek(week, pid = activePid()) {
  const hist = setupOf(pid).mapHistory;
  if (!week || !hist?.length) return dayMap(pid);
  let m = hist[0].map;
  for (const h of hist) if (h.from <= week) m = h.map;
  return m;
}
export function mapForWeek(week, pid = activePid()) {
  const one = week && setupOf(pid).weekMaps?.[week];
  if (one) return one;
  const base = usualMapForWeek(week, pid);
  const swaps = weekSwaps(week, pid);
  if (!swaps.length) return base;
  const m = { ...base };
  for (const [a, b] of swaps) { const t = m[a]; m[a] = m[b]; m[b] = t; }
  return m;
}
export const isSwapped = (week, progDay, pid = activePid()) =>
  mapForWeek(week, pid)[progDay] !== usualMapForWeek(week, pid)[progDay];
export const isCustomWeek = (week, pid = activePid()) =>
  !!setupOf(pid).weekMaps?.[week] || weekSwaps(week, pid).length > 0;

const sameMap = (a, b) => [1, 2, 3, 4, 5, 6, 7].every((d) => a[d] === b[d]);

// Arrange ONE week (week-only) or the usual week from `week` on (every week).
// Earlier weeks keep the layout they really had.
export function saveWeekArrangement(pid, week, map, scope /* 'week' | 'every' */) {
  update((s) => {
    const su = s.programs[pid].setup;
    if (su.weekSwaps?.[week]) { delete su.weekSwaps[week]; }
    su.weekMaps = { ...(su.weekMaps || {}) };
    if (scope === 'week') {
      if (sameMap(map, usualMapForWeek(week, pid))) delete su.weekMaps[week];
      else su.weekMaps[week] = { ...map };
      return;
    }
    // Older saves never stored the week start; it was read off the current map.
    // Pin it before the map changes, or every week would slide to a new start.
    if (su.weekStart == null) su.weekStart = weekStartWd(pid);
    const hist = su.mapHistory?.length
      ? su.mapHistory.slice()
      : [{ from: 1, map: { ...(su.dayMap || getProgram(pid).defaultDayMap || DEFAULT_DAY_MAP) } }];
    su.mapHistory = hist.filter((h) => h.from < week).concat([{ from: week, map: { ...map } }])
      .sort((a, b) => a.from - b.from);
    su.dayMap = { ...map };
    delete su.weekMaps[week];
  });
}
// Back to the usual week for one week.
export function clearWeekArrangement(pid, week) {
  update((s) => {
    const su = s.programs[pid].setup;
    if (su.weekMaps) delete su.weekMaps[week];
    if (su.weekSwaps) delete su.weekSwaps[week];
  });
}
export const weekdayName = (progDay, week, pid = activePid()) =>
  WEEKDAY_NAMES[(week ? mapForWeek(week, pid) : dayMap(pid))[progDay]];

// The weekday your week starts on. Older saves never set it, so it falls back
// to Day 1's weekday — exactly how the app behaved before.
export const weekStartWd = (pid = activePid()) => setupOf(pid).weekStart ?? dayMap(pid)[1];

// position in the week (0 = start day) ↔ session slot (1..7)
const posOfSlot = (d, week, pid) =>
  ((week ? mapForWeek(week, pid) : dayMap(pid))[d] - weekStartWd(pid) + 7) % 7;
const slotAtPos = (p, week, pid) => {
  const m = week ? mapForWeek(week, pid) : dayMap(pid);
  const ws = weekStartWd(pid);
  for (let d = 1; d <= 7; d++) if ((m[d] - ws + 7) % 7 === p) return d;
  return p + 1;
};

// day id ↔ program index. null for anything that isn't a program day id.
export const idToIndex = (dayId, pid = activePid()) => {
  const m = /^w(\d+)d([1-7])$/.exec(dayId || '');
  if (!m) return null;
  const week = +m[1];
  return (week - 1) * 7 + posOfSlot(+m[2], week, pid);
};
export const indexToId = (i, pid = activePid()) => {
  const week = Math.floor(i / 7) + 1;
  return `w${week}d${slotAtPos(((i % 7) + 7) % 7, week, pid)}`;
};

// the seven content ids of a week, in calendar order
export const weekIdsInOrder = (week, pid = activePid()) =>
  Array.from({ length: 7 }, (_, p) => `w${week}d${slotAtPos(p, week, pid)}`);
// the weekday a position falls on
export const weekdayOfPos = (p, pid = activePid()) => (weekStartWd(pid) + p) % 7;

const dowOffset = (date, pid) => (date.getDay() - weekStartWd(pid) + 7) % 7;
const weekStartOf = (date, pid) => new Date(date.getTime() - dowOffset(date, pid) * DAY_MS);

// --- today ------------------------------------------------------------------
// The calendar slot today lands on, before any program/deload interpretation.
function calToday(now = new Date(), pid = activePid()) {
  const { anchorDate, anchorDay } = setupOf(pid);
  if (!anchorDate) return 0;
  const anchor = parseISO(anchorDate);
  const anchorIdx = idToIndex(anchorDay, pid) ?? 0;
  const eff = effectiveDate(now, pid);
  const weeksElapsed = Math.round((weekStartOf(eff, pid) - weekStartOf(anchor, pid)) / (7 * DAY_MS));
  return (Math.floor(anchorIdx / 7) + weeksElapsed) * 7 + dowOffset(eff, pid);
}

// Everything today: which program day is due, and whether a deload is running.
//   { state: 'before'|'active'|'over', index, deload?: { block, d, id } }
// --- prep weeks ---------------------------------------------------------------
// "Ease in with 2 prep weeks" puts extra weeks on the calendar BEFORE Week 1.
// They replay your Week 1 sessions lightly (see isEasyDay in completion.js) and
// sit outside the program's own weeks: the program itself is untouched and
// simply starts later. They live at calendar slots -7·P … -1, before index 0.
//   prep day id: "e1d3" = prep week 1, the session in slot 3 of Week 1
export const prepWeeks = (pid = activePid()) => setupOf(pid).prepWeeks || 0;
export const prepIdParts = (id) => {
  const m = /^e([1-9])d([1-7])$/.exec(id || '');
  return m ? { n: +m[1], slot: +m[2] } : null;
};
export const isPrepId = (id) => !!prepIdParts(id);
// The prep layout is frozen when the program starts (setup.prepMap), so
// rearranging Week 1 later never moves a prep day you already logged.
export const prepMap = (pid = activePid()) => setupOf(pid).prepMap || mapForWeek(1, pid);
const prepSlotAt = (p, pid) => {
  const m = prepMap(pid), ws = weekStartWd(pid);
  for (let d = 1; d <= 7; d++) if ((m[d] - ws + 7) % 7 === p) return d;
  return p + 1;
};
export function prepIdAtCal(c, pid = activePid()) {
  const P = prepWeeks(pid) * 7;
  if (!(c < 0 && c >= -P)) return null;
  const k = c + P;
  return `e${Math.floor(k / 7) + 1}d${prepSlotAt(k % 7, pid)}`;
}
export function calOfPrepId(id, pid = activePid()) {
  const k = prepIdParts(id);
  if (!k) return null;
  const pos = (prepMap(pid)[k.slot] - weekStartWd(pid) + 7) % 7;
  return (k.n - 1) * 7 + pos - prepWeeks(pid) * 7;
}
// the seven prep day ids of prep week n, in calendar order
export const prepWeekIds = (n, pid = activePid()) =>
  Array.from({ length: 7 }, (_, p) => prepIdAtCal((n - 1) * 7 + p - prepWeeks(pid) * 7, pid));

export function todaySlot(pid = activePid(), now = new Date()) {
  const slot = slotAtCal(calToday(now, pid), pid);
  const index = slot.kind === 'deload' ? slot.block.at : slot.index;
  const n = totalDays(pid);
  const prepId = slot.kind === 'program' ? prepIdAtCal(index, pid) : null;
  if (prepId) return { state: 'active', index, prep: { id: prepId, n: prepIdParts(prepId).n } };
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
  if (slot.prep) return slot.prep.id;
  return slot.deload ? slot.deload.id : indexToId(clampIndex(slot.index, pid), pid);
}
// Days that have actually come due. During a deload nothing new has, so this
// stops at the day before the week being replayed — adherence must not dip
// just because you took a planned light week.
export function elapsedIndex(pid = activePid(), now = new Date()) {
  const slot = todaySlot(pid, now);
  if (slot.prep) return -1;               // nothing of the program itself is due yet
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
  const P = prepWeeks(pid) * 7;
  // the countdown runs to the first prep day when there are prep weeks
  const startDate = P ? dateForCal(-P, pid) : dateForIndex(0, pid);
  const endDate = dateForIndex(n - 1, pid);
  const eff = effectiveDate(now, pid);
  const dayDiff = (a, b) => Math.round((a - b) / DAY_MS);
  if (raw < 0 && raw >= -P) return { state: 'active', rawIndex: raw, startDate, endDate, prep: true };
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
// A calendar slot's real date. Indices are positions, so the date is simply
// the week's start day plus the position — no weekday lookup needed.
function dateForCal(c, pid = activePid()) {
  const { anchorDate, anchorDay } = setupOf(pid);
  if (!anchorDate) return null;
  const anchor = parseISO(anchorDate);
  const anchorIdx = idToIndex(anchorDay, pid) ?? 0;
  const weekDelta = Math.floor(c / 7) - Math.floor(anchorIdx / 7);
  return new Date(weekStartOf(anchor, pid).getTime()
    + (weekDelta * 7 + (((c % 7) + 7) % 7)) * DAY_MS);
}

// Program index → date. Every caller shifts for free once a deload is inserted,
// because calIndexOf() moves the whole week along.
export function dateForIndex(i, pid = activePid()) {
  return dateForCal(calIndexOf(i, pid), pid);
}

// Works for both id shapes.
export function dateForId(id, pid = activePid()) {
  if (isPrepId(id)) return dateForCal(calOfPrepId(id, pid), pid);
  const k = deloadIdParts(id);
  if (k) {
    const b = deloadBlock(k.block, pid);
    if (!b) return null;
    return dateForCal(blockCalStart(b, pid) + (k.d - 1), pid);
  }
  const i = idToIndex(id, pid);
  return i == null ? null : dateForIndex(i, pid);
}
// --- walking the calendar ----------------------------------------------------
// Day id → its calendar slot, and back. Used for prev/next navigation, which
// must step through inserted deload days as if they were ordinary days.
export function calIndexOfDayId(pid, dayId) {
  if (isPrepId(dayId)) return calOfPrepId(dayId, pid);
  const k = deloadIdParts(dayId);
  if (k) {
    const b = deloadBlock(k.block, pid);
    return b ? blockCalStart(b, pid) + (k.d - 1) : 0;
  }
  const i = idToIndex(dayId, pid);
  return i == null ? 0 : calIndexOf(i, pid);
}

export function dayIdAtCal(pid, c) {
  const prep = prepIdAtCal(c, pid);
  if (prep) return prep;
  const slot = slotAtCal(c, pid);
  if (slot.kind === 'deload') return deloadDayId(slot.block.id, slot.d);
  return indexToId(clampIndex(slot.index, pid), pid);
}

// The last calendar slot the program occupies (deload weeks included).
export const lastCalIndex = (pid = activePid()) => calIndexOf(totalDays(pid) - 1, pid);

// Sort key for history: a real date when we have an anchor, else the index.
export const timeForDayId = (pid, dayId) => {
  const d = dateForId(dayId, pid);
  if (d) return d.getTime();
  const i = idToIndex(dayId, pid);
  return (i ?? 0) * DAY_MS;
};

export function fmtDate(date) {
  if (!date) return '';
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export const behindDays = (firstOpenIndex, now = new Date(), pid = activePid()) =>
  todayIndex(now, pid) - firstOpenIndex;

// "Week 3 · Tuesday", "Prep 1 · Tuesday" or "Deload · Tuesday" for any day id.
export function dayLabel(pid, dayId) {
  const d = getDay(pid, dayId);
  if (!d) return '';
  const date = dateForId(dayId, pid);
  const wd = date ? WEEKDAY_NAMES[date.getDay()] : weekdayName(d.d, d.week, pid);
  if (d.prep) return `Prep ${d.prep} · ${wd}`;
  if (d.deload) return `Deload · ${wd}`;
  return `Week ${d.week} · ${wd}`;
}
