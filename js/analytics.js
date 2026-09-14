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
import { getProgram } from './program.js';
import { currentWeek, deloadBlocks, timeForDayId } from './schedule.js';
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

// ---------------------------------------------------------------------------
// "Should I deload?" — reactive, inside a planned window
// ---------------------------------------------------------------------------
// The evidence points at a planned window of roughly 4–8 weeks, with the
// stronger signal being reactive: performance falling off across consecutive
// sessions. So: nothing before 4 trained weeks, a suggestion from 4 if
// something is actually sagging, and a suggestion at 6 regardless.
export const DELOAD_MIN_WEEKS = 4;
export const DELOAD_MAX_WEEKS = 6;

// Total weight × reps of the completed sets on one day.
function sessionLoad(pid, dayId) {
  const rec = store.prog(pid).days[dayId];
  if (!rec || rec.auto || !rec.ex) return 0;
  let v = 0;
  for (const ex of Object.values(rec.ex)) {
    for (const set of ex.sets || []) {
      if (set?.done && set.weight != null && set.reps != null) v += +set.weight * +set.reps;
    }
  }
  return v;
}

// Two consecutive falls in session volume-load across the last three sessions
// you actually loaded — the classic "back off" signal.
function loadIsFalling(pid) {
  const days = store.prog(pid).days;
  const loads = Object.keys(days)
    .map((id) => ({ id, t: timeForDayId(pid, id), v: sessionLoad(pid, id) }))
    .filter((x) => x.v > 0)
    .sort((a, b) => a.t - b.t)
    .slice(-3);
  return loads.length === 3 && loads[2].v < loads[1].v && loads[1].v < loads[0].v;
}

// The week training resumed after the most recent deload of any kind.
function weekAfterLastDeload(pid, curWeek) {
  const badges = getProgram(pid).badges || {};
  let resume = 1;
  for (const w of Object.keys(badges)) {
    if (+w <= curWeek && String(badges[w]).includes('DELOAD')) resume = Math.max(resume, +w + 1);
  }
  for (const b of deloadBlocks(pid)) {
    if (b.week <= curWeek) resume = Math.max(resume, b.week);   // the week replays after it
  }
  return resume;
}

export function deloadAdvice(pid = store.activePid()) {
  const curWeek = currentWeek(pid);
  const from = weekAfterLastDeload(pid, curWeek);
  const days = store.prog(pid).days;
  const trained = (w) => {
    for (let d = 1; d <= 7; d++) {
      const rec = days[`w${w}d${d}`];
      if (rec && !rec.auto && (rec.status === 'done'
        || Object.values(rec.ex || {}).some((x) => (x.sets || []).some((v) => v?.done)))) return true;
    }
    return false;
  };
  let weeks = 0;
  for (let w = from; w <= curWeek; w++) if (trained(w)) weeks++;

  if (weeks < DELOAD_MIN_WEEKS) return { show: false, weeks };

  const fatigue = store.prog(pid).fatigue || [];
  const lastRating = fatigue.length ? fatigue[fatigue.length - 1] : null;
  const flat = !!lastRating && lastRating.rating <= 2;
  const falling = loadIsFalling(pid);
  const spike = spikeCheck(jumpVolumeByWeek({ weeks: 12 })).level === 'spike';

  if (weeks < DELOAD_MAX_WEEKS && !flat && !falling && !spike) return { show: false, weeks };

  const reason = falling ? 'your last two sessions both dropped in volume'
    : flat ? 'you rated your jumps flat in the last check-in'
    : spike ? 'your jump volume spiked this week'
    : `${weeks} straight weeks of training with no let-up`;
  return { show: true, weeks, reason, signal: falling ? 'load' : flat ? 'fatigue' : spike ? 'jumps' : 'weeks' };
}
