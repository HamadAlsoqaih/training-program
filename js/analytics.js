// ============================================================================
// analytics.js — jump / ground-contact volume, across BOTH programs.
//
// Why calendar weeks and not program weeks: the 15-week and the 12-week
// programs number their weeks differently, but your legs only know the
// calendar. Bucketing by real Monday-to-Sunday weeks is what lets plyo work
// from either program land in the same bar.
//
// Everything is read off historyIndex() from completion.js, which is already
// built once per state change — this module never re-scans the programs, and
// memoises its own result on the same revision counter.
// ============================================================================
import { EX } from './exercises.js';
import { historyIndex } from './completion.js';
import * as store from './state.js';

const DAY_MS = 24 * 3600 * 1000;
const WEEK_MS = 7 * DAY_MS;

// The program's own Freestyle Jumping rule.
export const FREESTYLE = { ex: 'freestyle_jump', warn: 40, cap: 50 };

// A week counts as a spike when it clears this floor AND rises steeply. Below
// the floor a big percentage is just noise (8 → 12 contacts is not a warning).
export const SPIKE_FLOOR = 60;
const SPIKE_PCT = 0.30;
const WATCH_PCT = 0.15;

export const isJump = (exId) => !!EX[exId]?.jump;
const perRep = (exId) => EX[exId]?.contacts ?? 1;

// Monday 00:00 local time of the week containing t.
export function weekStart(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));   // Mon = 0 … Sun = 6
  return d.getTime();
}

// Ground contacts in one logged session of one exercise.
//   * a tapped block (Freestyle) counts verbatim — it is a real count
//   * otherwise: reps you logged, else the prescribed reps, × contacts-per-rep
//   * "each side" items are doubled, because you do them on both legs
export function contactsForRecord(exId, r) {
  const mult = r.side ? 2 : 1;
  const each = perRep(exId);
  let n = 0;
  const tapped = new Set();
  if (r.taps) {
    for (let i = 0; i < r.taps.length; i++) {
      const v = r.taps[i];
      if (v) { n += v; tapped.add(i); }
    }
  }
  for (const s of r.sets) {
    if (!s.done || tapped.has(s.i)) continue;
    const reps = s.reps != null && s.reps !== '' ? +s.reps : (r.defReps ?? 1);
    if (!Number.isFinite(reps) || reps <= 0) continue;
    n += reps * each * mult;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Weekly buckets
// ---------------------------------------------------------------------------
let cache = { rev: -1, weeks: 0, cur: 0, value: null };

// → [{ weekStart, contacts, sessions, byExercise }] oldest first, always
// exactly `weeks` long and always ending on the current week (empty weeks
// included, so a rest week reads as a gap rather than disappearing).
export function jumpVolumeByWeek({ weeks = 12, now = Date.now() } = {}) {
  const rev = store.rev();
  const cur = weekStart(now);
  if (cache.rev === rev && cache.weeks === weeks && cache.cur === cur) return cache.value;

  const byWeek = new Map();
  for (const [exId, list] of historyIndex()) {
    if (!isJump(exId)) continue;
    for (const r of list) {
      const c = contactsForRecord(exId, r);
      if (!c) continue;
      const ws = weekStart(r.at);
      let b = byWeek.get(ws);
      if (!b) byWeek.set(ws, (b = { weekStart: ws, contacts: 0, byExercise: {}, days: new Set() }));
      b.contacts += c;
      b.byExercise[exId] = (b.byExercise[exId] || 0) + c;
      b.days.add(`${r.pid}:${r.dayId}`);
    }
  }

  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = weekStart(cur - i * WEEK_MS);   // re-normalised, so DST can't drift
    const b = byWeek.get(ws);
    out.push(b
      ? { weekStart: ws, contacts: b.contacts, sessions: b.days.size, byExercise: b.byExercise }
      : { weekStart: ws, contacts: 0, sessions: 0, byExercise: {} });
  }
  cache = { rev, weeks, cur, value: out };
  return out;
}

// This week against last week.
//   spike — steep rise on real volume: back off before it costs you
//   watch — rising, worth noticing
export function spikeCheck(buckets) {
  const n = buckets.length;
  const cur = buckets[n - 1]?.contacts || 0;
  const prev = buckets[n - 2]?.contacts || 0;
  if (cur < SPIKE_FLOOR) return { level: 'ok', pct: null, prev, cur };
  if (prev <= 0) return { level: 'watch', pct: null, prev, cur };   // straight off a rest week
  const pct = (cur - prev) / prev;
  return { level: pct > SPIKE_PCT ? 'spike' : pct > WATCH_PCT ? 'watch' : 'ok', pct, prev, cur };
}

// ---------------------------------------------------------------------------
// Freestyle Jumping: did the tapped blocks respect the 40–50 cap?
// ---------------------------------------------------------------------------
export function freestyleBlocks({ weeks = 12, now = Date.now() } = {}) {
  const from = weekStart(now) - (weeks - 1) * WEEK_MS;
  const res = { total: 0, inRange: 0, under: 0, over: 0 };
  for (const r of historyIndex().get(FREESTYLE.ex) || []) {
    if (!r.taps || r.at < from) continue;
    for (const v of r.taps) {
      if (!v) continue;
      res.total++;
      if (v > FREESTYLE.cap) res.over++;
      else if (v < FREESTYLE.warn) res.under++;
      else res.inRange++;
    }
  }
  return res;
}

// Ground contacts in one day — for the post-session summary.
export function jumpContactsForDay(pid, dayId) {
  let n = 0;
  for (const [exId, list] of historyIndex()) {
    if (!isJump(exId)) continue;
    for (const r of list) if (r.pid === pid && r.dayId === dayId) n += contactsForRecord(exId, r);
  }
  return n;
}
