// ============================================================================
// deload.js — inserted deload weeks: the block list and the two index spaces.
//
// A deload block is ONE extra calendar week slot spliced in ahead of the week
// you are training. Program indices never move, so nothing renumbers and no
// completion total changes; only the calendar shifts, by exactly 7 days per
// block, because the interrupted week then replays in full.
//
//   block = { id, week, at, d0, startedAt }
//     at  = (week - 1) * 7   — Day 1 index of the week it interrupts
//     d0  = the day slot the button was pressed on (1–7)
//
// The block owns all 7 calendar slots of its week. Slots before d0 are the
// sessions you had already trained that week, kept at FULL volume (their day
// records are moved across on insert). Slots from d0 on are the deload days,
// every exercise capped to one set. So a Wednesday press gives 7 deload days,
// a Friday press 5, a Monday press 2 — exactly as the week has left to run.
//
// This module is deliberately dependency-light (state only) so both
// schedule.js and program.js can use it without an import cycle.
// ============================================================================
import { setupOf, activePid, rev } from './state.js';

// Program day ids are "w3d6"; deload day ids are "k1d6" — block 1, day slot 6.
export const isDeloadId = (dayId) => typeof dayId === 'string' && dayId[0] === 'k';
export const deloadDayId = (blockId, d) => `k${blockId}d${d}`;
export const deloadIdParts = (dayId) => {
  const m = /^k(\d+)d([1-7])$/.exec(dayId || '');
  return m ? { block: +m[1], d: +m[2] } : null;
};

// number of days in the block that are actual deload sessions
export const deloadLength = (b) => 8 - b.d0;
// is this slot a deload session, or one of the full-volume days before it?
export const isDeloadSlot = (b, d) => d >= b.d0;

let cache = { rev: -1, byPid: null };
export function deloadBlocks(pid = activePid()) {
  if (cache.rev !== rev()) cache = { rev: rev(), byPid: {} };
  let list = cache.byPid[pid];
  if (!list) {
    list = (setupOf(pid).deloads || []).slice().sort((a, b) => a.at - b.at || a.id - b.id);
    cache.byPid[pid] = list;
  }
  return list;
}
export const deloadBlock = (blockId, pid = activePid()) =>
  deloadBlocks(pid).find((b) => b.id === blockId) || null;

// calendar index of a block's first slot (its Day-1 weekday)
export function blockCalStart(block, pid = activePid()) {
  let shift = 0;
  for (const b of deloadBlocks(pid)) {
    if (b.id === block.id) return b.at + shift;
    shift += 7;
  }
  return block.at;
}

// program index → calendar index
export function calIndexOf(i, pid = activePid()) {
  const blocks = deloadBlocks(pid);
  if (!blocks.length) return i;
  let shift = 0;
  for (const b of blocks) { if (b.at <= i) shift += 7; else break; }
  return i + shift;
}

// calendar index → { kind:'program', index } | { kind:'deload', block, d }
export function slotAtCal(c, pid = activePid()) {
  let shift = 0;
  for (const b of deloadBlocks(pid)) {
    const calStart = b.at + shift;
    if (c < calStart) break;
    if (c < calStart + 7) return { kind: 'deload', block: b, d: (c - calStart) + 1 };
    shift += 7;
  }
  return { kind: 'program', index: c - shift };
}
