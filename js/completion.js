// ============================================================================
// completion.js — cascade logic: set ticks → exercise → day → week.
// Optional exercises (volleyball, static stretch) never block completion.
// ============================================================================
import { getDay, getWeek, dayExercises } from './program.js';
import * as store from './state.js';
import { idToIndex, indexToId } from './schedule.js';

export function setState(dayId, exKey, setIdx) {
  const d = store.day(dayId);
  return d?.ex?.[exKey]?.sets?.[setIdx] || null;
}

export function exerciseDone(dayId, entry) {
  const d = store.day(dayId);
  const ex = d?.ex?.[entry.key];
  if (!ex) return false;
  let done = 0;
  for (let i = 0; i < entry.sets; i++) if (ex.sets?.[i]?.done) done++;
  return done >= entry.sets;
}

export function exerciseSetsDone(dayId, entry) {
  const d = store.day(dayId);
  const ex = d?.ex?.[entry.key];
  if (!ex) return 0;
  let done = 0;
  for (let i = 0; i < entry.sets; i++) if (ex.sets?.[i]?.done) done++;
  return done;
}

// Required exercises for a day (optional items excluded)
export const requiredEntries = (day) => dayExercises(day).filter((e) => !e.item.opt);

export function dayProgress(dayId) {
  const day = getDay(dayId);
  const rec = store.day(dayId);
  if (rec?.status === 'done') return { pct: 1, status: 'done', auto: rec.auto };
  if (rec?.status === 'skipped') return { pct: 0, status: 'skipped' };
  const req = requiredEntries(day);
  if (req.length === 0) {
    // pure rest day: done when explicitly marked (or auto)
    return { pct: rec?.status === 'done' ? 1 : 0, status: rec?.status || null };
  }
  let total = 0, done = 0;
  for (const e of req) { total += e.sets; done += exerciseSetsDone(dayId, e); }
  const pct = total ? done / total : 0;
  return { pct, status: pct > 0 ? 'partial' : null, done, total };
}

export function weekProgress(week) {
  const w = getWeek(week);
  let doneDays = 0, skipped = 0, partial = 0;
  for (const d of w.days) {
    const p = dayProgress(d.id);
    if (p.status === 'done') doneDays++;
    else if (p.status === 'skipped') skipped++;
    else if (p.pct > 0) partial++;
  }
  return {
    doneDays, skipped, partial,
    closed: doneDays + skipped === 7,
    complete: doneDays === 7,
    pct: (doneDays + skipped) / 7,
  };
}

// First day that is neither done nor skipped
export function firstOpenIndex() {
  for (let i = 0; i <= 104; i++) {
    const rec = store.day(indexToId(i));
    if (!rec || (rec.status !== 'done' && rec.status !== 'skipped')) return i;
  }
  return 105;
}

// --- mutations -------------------------------------------------------------

// Tick/untick one set. Returns { dayJustCompleted }
export function toggleSet(dayId, entry, setIdx, extras = {}) {
  let justCompleted = false;
  store.update((s) => {
    const d = s.days[dayId] || (s.days[dayId] = { status: null, ex: {} });
    const ex = d.ex[entry.key] || (d.ex[entry.key] = { sets: [] });
    const cur = ex.sets[setIdx];
    if (cur?.done) {
      ex.sets[setIdx] = { ...cur, done: false };
      if (d.status === 'done') { d.status = null; delete d.finishedAt; }
    } else {
      ex.sets[setIdx] = { ...(cur || {}), done: true, ...extras };
      justCompleted = maybeCompleteDay(s, dayId);
    }
  });
  return { dayJustCompleted: justCompleted };
}

export function setLog(dayId, entry, setIdx, { weight, reps }) {
  store.update((s) => {
    const d = s.days[dayId] || (s.days[dayId] = { status: null, ex: {} });
    const ex = d.ex[entry.key] || (d.ex[entry.key] = { sets: [] });
    const cur = ex.sets[setIdx] || {};
    ex.sets[setIdx] = { ...cur, weight, reps };
  });
}

function maybeCompleteDay(s, dayId) {
  const day = getDay(dayId);
  const req = requiredEntries(day);
  const rec = s.days[dayId];
  const allDone = req.every((e) => {
    const ex = rec.ex?.[e.key];
    if (!ex) return false;
    for (let i = 0; i < e.sets; i++) if (!ex.sets?.[i]?.done) return false;
    return true;
  });
  if (allDone && rec.status !== 'done') {
    rec.status = 'done';
    rec.finishedAt = Date.now();
    return true;
  }
  return false;
}

// Tick every set of every non-optional exercise in a section at once.
// Returns true if this completed the whole day.
export function completeSection(dayId, entries) {
  let just = false;
  store.update((s) => {
    const d = s.days[dayId] || (s.days[dayId] = { status: null, ex: {} });
    for (const e of entries) {
      if (e.item.opt) continue;
      const ex = d.ex[e.key] || (d.ex[e.key] = { sets: [] });
      for (let i = 0; i < e.sets; i++) ex.sets[i] = { ...(ex.sets[i] || {}), done: true };
    }
    just = maybeCompleteDay(s, dayId);
  });
  return just;
}

export function markDay(dayId, status /* 'done' | 'skipped' | null */, extra = {}) {
  store.update((s) => {
    const d = s.days[dayId] || (s.days[dayId] = { status: null, ex: {} });
    d.status = status;
    if (status === 'done') d.finishedAt = d.finishedAt || Date.now();
    if (status === 'skipped') d.skipReason = extra.reason || '';
    if (status === null) { delete d.finishedAt; delete d.skipReason; delete d.auto; }
    Object.assign(d, extra.fields || {});
  });
}

export function setNote(dayId, note) {
  store.update((s) => {
    const d = s.days[dayId] || (s.days[dayId] = { status: null, ex: {} });
    d.note = note;
  });
}

export function toggleCardio(dayId) {
  store.update((s) => {
    const d = s.days[dayId] || (s.days[dayId] = { status: null, ex: {} });
    d.cardioDone = !d.cardioDone;
  });
}

// Seed everything before an index as auto-done (onboarding)
export function seedBefore(index) {
  store.update((s) => {
    for (let i = 0; i < index; i++) {
      const id = indexToId(i);
      const existing = s.days[id];
      if (existing?.status === 'done' || existing?.status === 'skipped') continue;
      s.days[id] = { ...(existing || { ex: {} }), status: 'done', auto: true, cardioDone: true };
    }
  });
}

// --- exercise history ------------------------------------------------------
// All logged sets for an exercise id across days, oldest → newest.
// Each record is WU/WS-aware: sets keep their original index `i`, and the
// record carries prescribed totals so partial sessions are distinguishable.
export function historyFor(exId) {
  const out = [];
  const s = store.get();
  for (let idx = 0; idx <= 104; idx++) {
    const id = indexToId(idx);
    const rec = s.days[id];
    if (!rec || rec.auto) continue;
    const day = getDay(id);
    for (const e of dayExercises(day)) {
      if (e.item.ex !== exId) continue;
      const ex = rec.ex?.[e.key];
      if (!ex) continue;
      const sch = e.item.sch;
      const wu = sch.t === 'wuws' ? sch.wu : 0;
      const total = e.sets;
      const raw = ex.sets || [];
      const sets = [];
      let doneCount = 0, wsDone = 0;
      for (let si = 0; si < total; si++) {
        const x = raw[si];
        if (!x || (!x.done && x.weight == null)) continue;
        sets.push({ ...x, i: si });
        if (x.done) { doneCount++; if (si >= wu) wsDone++; }
      }
      if (!sets.length && !ex.alt) continue;
      // defReps: prescribed reps — shown when a done set has no reps typed
      out.push({
        dayId: id, index: idx, sets, note: rec.note,
        defReps: sch.reps ?? null, alt: ex.alt || null,
        total, doneCount, wu, wsTotal: total - wu, wsDone,
      });
    }
  }
  return out;
}

// Best (heaviest) working-set weight from a history snapshot
export function bestWeight(hist) {
  let best = null;
  for (const h of hist) for (const s of h.sets) {
    if (s.weight != null && (best === null || +s.weight > best)) best = +s.weight;
  }
  return best;
}

// Last session's sets for prefill: most recent history entry before dayIndex
export function lastSessionFor(exId, beforeIndex) {
  const hist = historyFor(exId).filter((h) => h.index < beforeIndex);
  return hist.length ? hist[hist.length - 1] : null;
}

// Progressive-overload hint — the program's own rule: "add weight when both
// WORKING sets are completed cleanly". Warm-up sets are ignored entirely, and
// a partial session (not all working sets done + weighted) never triggers it.
export function overloadHint(exId, beforeIndex) {
  const last = lastSessionFor(exId, beforeIndex);
  if (!last || last.wsTotal <= 0) return null;
  if (last.wsDone < last.wsTotal) return null;
  const wsLogged = last.sets.filter((s) => s.i >= last.wu && s.done && s.weight != null);
  if (wsLogged.length < last.wsTotal) return null;
  const w = Math.max(...wsLogged.map((s) => +s.weight));
  return { lastWeight: w };
}
