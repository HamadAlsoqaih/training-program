// ============================================================================
// completion.js — the rules layer.
//
//  * plannedDay()  applies a day's personal edits (reorder / skip / added or
//                  deleted sets / changed reps, durations, rest) on top of the
//                  program's prescription. Cached per (program, day, revision).
//  * historyIndex() walks every logged day of every program ONCE per state
//                  change and indexes it by exercise. Cards read from that
//                  index instead of re-scanning the whole program each render
//                  (this is what keeps a 25-exercise day fast on a phone).
//  * completion cascade: set → exercise → day → week.
// ============================================================================
import { getDay, getWeek, dayExercises, phaseOf, totalDays, totalWeeks, PROGRAM_LIST } from './program.js';
import { schemeSets } from './schemes.js';
import * as store from './state.js';
import { indexToId, idToIndex, dateForIndex, todayId } from './schedule.js';

const DAY_MS = 24 * 3600 * 1000;

// ---------------------------------------------------------------------------
// Planned (personalised) day
// ---------------------------------------------------------------------------
// entry = { key, item, sch, sets, rest, skipped, mode, wu }
function applyOverride(item, ov) {
  if (!ov) return { sch: item.sch, rest: item.rest };
  const sch = { ...item.sch };
  if (sch.t === 'sr') {
    if (ov.sets != null) sch.sets = Math.max(1, ov.sets);
    if (ov.reps != null) sch.reps = Math.max(1, ov.reps);
  } else if (sch.t === 'time') {
    if (ov.sets != null) sch.sets = Math.max(1, ov.sets);
    if (ov.secs != null) sch.secs = Math.max(1, ov.secs);
  } else { // wuws
    if (ov.wu != null) sch.wu = Math.max(0, ov.wu);
    if (ov.ws != null) sch.ws = Math.max(0, ov.ws);
  }
  return { sch, rest: ov.rest != null ? ov.rest : item.rest };
}

const planCache = new Map(); // `${pid}:${dayId}` → { rev, value }

export function plannedDay(pid, dayId) {
  const cacheKey = `${pid}:${dayId}`;
  const hit = planCache.get(cacheKey);
  if (hit && hit.rev === store.rev()) return hit.value;

  const day = getDay(pid, dayId);
  if (!day) return null;
  const rec = store.day(dayId, pid);
  const plan = rec?.plan || {};
  const byKey = new Map(dayExercises(day).map((e) => [e.key, e]));

  // section order (personal order first, then any sections it doesn't mention)
  const secIdx = day.sections.map((_, si) => si);
  const secOrder = (plan.secOrder || []).filter((si) => secIdx.includes(si));
  for (const si of secIdx) if (!secOrder.includes(si)) secOrder.push(si);

  const sections = secOrder.map((si) => {
    const sec = day.sections[si];
    const itemIdx = sec.items.map((_, ii) => ii);
    const order = (plan.exOrder?.[si] || []).filter((ii) => itemIdx.includes(ii));
    for (const ii of itemIdx) if (!order.includes(ii)) order.push(ii);

    const entries = order.map((ii) => {
      const base = byKey.get(`s${si}i${ii}`);
      const ov = plan.ex?.[base.key];
      const { sch, rest } = applyOverride(base.item, ov);
      return {
        key: base.key, si, ii, item: base.item, sch, rest,
        sets: schemeSets(sch),
        wu: sch.t === 'wuws' ? sch.wu : 0,
        skipped: !!ov?.skipped,
        mode: rec?.ex?.[base.key]?.mode || 'band',
        edited: !!ov && Object.keys(ov).some((k) => k !== 'skipped'),
      };
    });
    return { si, sec, entries };
  });

  const all = sections.flatMap((s) => s.entries);
  const value = { day, sections, entries: all, byKey: new Map(all.map((e) => [e.key, e])) };
  planCache.set(cacheKey, { rev: store.rev(), value });
  return value;
}

export const plannedEntry = (pid, dayId, key) => plannedDay(pid, dayId)?.byKey.get(key) || null;

// ---------------------------------------------------------------------------
// History index — built once per state change, across ALL programs
// ---------------------------------------------------------------------------
let histCache = { rev: -1, index: null };

function buildHistoryIndex() {
  const index = new Map(); // exId → records[]
  for (const program of PROGRAM_LIST) {
    const pid = program.id;
    const days = store.prog(pid).days;
    for (const dayId of Object.keys(days)) {
      const rec = days[dayId];
      if (!rec || rec.auto || !rec.ex) continue;
      const planned = plannedDay(pid, dayId);
      if (!planned) continue;
      const index0 = idToIndex(dayId);
      const t = dateForIndex(index0, pid)?.getTime() ?? index0 * DAY_MS;
      for (const e of planned.entries) {
        const exRec = rec.ex[e.key];
        if (!exRec) continue;
        const raw = exRec.sets || [];
        const sets = [];
        let doneCount = 0, wsDone = 0;
        for (let si = 0; si < e.sets; si++) {
          const x = raw[si];
          if (!x || (!x.done && x.weight == null)) continue;
          sets.push({ ...x, i: si });
          if (x.done) { doneCount++; if (si >= e.wu) wsDone++; }
        }
        if (!sets.length && !exRec.alt) continue;
        const list = index.get(e.item.ex) || index.set(e.item.ex, []).get(e.item.ex);
        list.push({
          pid, dayId, index: index0, t, sets,
          total: e.sets, doneCount, wu: e.wu, wsTotal: e.sets - e.wu, wsDone,
          defReps: e.sch.reps ?? null,
          alt: exRec.alt || null, mode: exRec.mode || 'band',
          note: rec.note || null,
        });
      }
    }
  }
  for (const list of index.values()) list.sort((a, b) => a.t - b.t);
  return index;
}

export function historyIndex() {
  if (histCache.rev !== store.rev()) {
    histCache = { rev: store.rev(), index: buildHistoryIndex() };
  }
  return histCache.index;
}

export const historyFor = (exId) => historyIndex().get(exId) || [];

// Timestamp of a given day — used to ask "what did I do BEFORE this session?"
export const dayTime = (pid, dayId) => {
  const i = idToIndex(dayId);
  return dateForIndex(i, pid)?.getTime() ?? i * DAY_MS;
};

export function lastSessionFor(exId, beforeT, mode) {
  const list = historyFor(exId);
  for (let i = list.length - 1; i >= 0; i--) {
    const r = list[i];
    if (r.t >= beforeT) continue;
    if (mode && r.mode !== mode) continue;
    return r;
  }
  return null;
}

export function bestWeight(list) {
  let best = null;
  for (const h of list) for (const s of h.sets) {
    if (s.weight != null && (best === null || +s.weight > best)) best = +s.weight;
  }
  return best;
}

// Program rule: add weight once every WORKING set was completed cleanly.
// Warm-up sets are ignored; a partial session never triggers the hint.
export function overloadHint(exId, beforeT, mode) {
  const last = lastSessionFor(exId, beforeT, mode);
  if (!last || last.wsTotal <= 0) return null;
  if (last.wsDone < last.wsTotal) return null;
  const wsLogged = last.sets.filter((s) => s.i >= last.wu && s.done && s.weight != null);
  if (wsLogged.length < last.wsTotal) return null;
  return { lastWeight: Math.max(...wsLogged.map((s) => +s.weight)) };
}

// ---------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------
export const requiredEntries = (planned) =>
  planned.entries.filter((e) => !e.item.opt && !e.skipped);

export function exerciseSetsDone(pid, dayId, entry) {
  const ex = store.day(dayId, pid)?.ex?.[entry.key];
  if (!ex) return 0;
  let n = 0;
  for (let i = 0; i < entry.sets; i++) if (ex.sets?.[i]?.done) n++;
  return n;
}
export const exerciseDone = (pid, dayId, entry) =>
  exerciseSetsDone(pid, dayId, entry) >= entry.sets;

export function dayProgress(pid, dayId) {
  const rec = store.day(dayId, pid);
  if (rec?.status === 'done') return { pct: 1, status: 'done', auto: rec.auto };
  if (rec?.status === 'skipped') return { pct: 0, status: 'skipped' };
  const planned = plannedDay(pid, dayId);
  if (!planned) return { pct: 0, status: null };
  const req = requiredEntries(planned);
  if (!req.length) return { pct: rec?.status === 'done' ? 1 : 0, status: rec?.status || null };
  let total = 0, done = 0;
  for (const e of req) { total += e.sets; done += exerciseSetsDone(pid, dayId, e); }
  const pct = total ? done / total : 0;
  return { pct, status: pct > 0 ? 'partial' : null, done, total };
}

export function weekProgress(pid, week) {
  const w = getWeek(pid, week);
  let doneDays = 0, skipped = 0, partial = 0;
  for (const d of w.days) {
    const p = dayProgress(pid, d.id);
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

export function firstOpenIndex(pid) {
  const n = totalDays(pid);
  for (let i = 0; i < n; i++) {
    const rec = store.day(indexToId(i), pid);
    if (!rec || (rec.status !== 'done' && rec.status !== 'skipped')) return i;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------
const dayRec = (s, pid, dayId) => {
  const p = s.programs[pid];
  return p.days[dayId] || (p.days[dayId] = { status: null, ex: {} });
};
const exRec = (d, key) => d.ex[key] || (d.ex[key] = { sets: [] });

function maybeCompleteDay(s, pid, dayId) {
  const planned = plannedDay(pid, dayId);
  const rec = s.programs[pid].days[dayId];
  const allDone = requiredEntries(planned).every((e) => {
    const ex = rec.ex?.[e.key];
    if (!ex) return false;
    for (let i = 0; i < e.sets; i++) if (!ex.sets?.[i]?.done) return false;
    return true;
  });
  if (allDone && rec.status !== 'done') {
    rec.status = 'done';
    rec.finishedAt = Date.now();
    delete rec.auto;
    return true;
  }
  return false;
}

export function toggleSet(pid, dayId, entry, setIdx, extras = {}) {
  let justCompleted = false;
  store.update((s) => {
    const d = dayRec(s, pid, dayId);
    const ex = exRec(d, entry.key);
    const cur = ex.sets[setIdx];
    if (cur?.done) {
      ex.sets[setIdx] = { ...cur, done: false };
      if (d.status === 'done') { d.status = null; delete d.finishedAt; }
    } else {
      ex.sets[setIdx] = { ...(cur || {}), done: true, ...extras };
      justCompleted = maybeCompleteDay(s, pid, dayId);
    }
  });
  return { dayJustCompleted: justCompleted };
}

export function setLog(pid, dayId, entry, setIdx, { weight, reps }) {
  store.update((s) => {
    const ex = exRec(dayRec(s, pid, dayId), entry.key);
    ex.sets[setIdx] = { ...(ex.sets[setIdx] || {}), weight, reps };
  });
}

export function completeSection(pid, dayId, entries) {
  let just = false;
  store.update((s) => {
    const d = dayRec(s, pid, dayId);
    for (const e of entries) {
      if (e.item.opt || e.skipped) continue;
      const ex = exRec(d, e.key);
      for (let i = 0; i < e.sets; i++) ex.sets[i] = { ...(ex.sets[i] || {}), done: true };
    }
    just = maybeCompleteDay(s, pid, dayId);
  });
  return just;
}

export function markDay(pid, dayId, status, extra = {}) {
  store.update((s) => {
    const d = dayRec(s, pid, dayId);
    d.status = status;
    if (status === 'done') d.finishedAt = d.finishedAt || Date.now();
    if (status === 'skipped') d.skipReason = extra.reason || '';
    if (status === null) { delete d.finishedAt; delete d.skipReason; delete d.auto; }
    Object.assign(d, extra.fields || {});
  });
}

export function setNote(pid, dayId, note) {
  store.update((s) => { dayRec(s, pid, dayId).note = note; });
}

export function setExerciseField(pid, dayId, key, patch) {
  store.update((s) => { Object.assign(exRec(dayRec(s, pid, dayId), key), patch); });
}

export function seedBefore(pid, index) {
  store.update((s) => {
    const p = s.programs[pid];
    for (let i = 0; i < index; i++) {
      const id = indexToId(i);
      const existing = p.days[id];
      if (existing?.status === 'done' || existing?.status === 'skipped') continue;
      p.days[id] = { ...(existing || { ex: {} }), status: 'done', auto: true, cardioDone: true };
    }
  });
}

// --- per-day plan edits -----------------------------------------------------
// A "live" day is the one you are training right now: the active program's
// today, or any day with a running session. Edits there apply immediately to
// that day only and never ask about scope — nothing must interrupt a workout.
export function isLiveDay(pid, dayId) {
  const s = store.get();
  if (s.session?.pid === pid && s.session?.dayId === dayId) return true;
  return pid === s.activeProgram && dayId === todayId(undefined, pid);
}

// scope: 'day' (this day only) | 'phase' (same day-slot across this phase,
// skipping days already completed so history is never rewritten).
export function dayIdsForScope(pid, dayId, scope) {
  if (scope !== 'phase') return [dayId];
  const idx = idToIndex(dayId);
  const week = Math.floor(idx / 7) + 1;
  const d = (idx % 7) + 1;
  const phase = phaseOf(pid, week);
  if (!phase) return [dayId];
  const ids = [];
  for (let w = phase.weeks[0]; w <= Math.min(phase.weeks[1], totalWeeks(pid)); w++) {
    const id = `w${w}d${d}`;
    const st = store.day(id, pid)?.status;
    if (id !== dayId && (st === 'done' || st === 'skipped')) continue;
    ids.push(id);
  }
  return ids;
}

export function patchPlan(pid, dayId, key, patch, scope = 'day') {
  const ids = dayIdsForScope(pid, dayId, scope);
  store.update((s) => {
    for (const id of ids) {
      const d = dayRec(s, pid, id);
      const plan = d.plan || (d.plan = {});
      const ex = plan.ex || (plan.ex = {});
      const cur = ex[key] || (ex[key] = {});
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) delete cur[k]; else cur[k] = v;
      }
      if (!Object.keys(cur).length) delete ex[key];
    }
  });
  return ids.length;
}

export const toggleSkipExercise = (pid, dayId, key, skipped, scope = 'day') =>
  patchPlan(pid, dayId, key, { skipped: skipped || null }, scope);

// Delete one set row: drop its logged data and shrink the prescription.
export function deleteSet(pid, dayId, entry, setIdx) {
  const isWU = entry.sch.t === 'wuws' && setIdx < entry.wu;
  const patch = entry.sch.t === 'wuws'
    ? (isWU ? { wu: Math.max(0, entry.sch.wu - 1) } : { ws: Math.max(0, entry.sch.ws - 1) })
    : { sets: Math.max(1, entry.sch.sets - 1) };
  store.update((s) => {
    const d = dayRec(s, pid, dayId);
    const ex = d.ex[entry.key];
    if (ex?.sets) ex.sets.splice(setIdx, 1);
    const plan = d.plan || (d.plan = {});
    const pex = plan.ex || (plan.ex = {});
    pex[entry.key] = { ...(pex[entry.key] || {}), ...patch };
  });
}

export function addSet(pid, dayId, entry) {
  const patch = entry.sch.t === 'wuws'
    ? { ws: entry.sch.ws + 1 }
    : { sets: entry.sch.sets + 1 };
  patchPlan(pid, dayId, entry.key, patch, 'day');
}

function currentOrders(pid, dayId) {
  const day = getDay(pid, dayId);
  const rec = store.day(dayId, pid);
  const plan = rec?.plan || {};
  const secOrder = [];
  for (const si of (plan.secOrder || [])) if (day.sections[si]) secOrder.push(si);
  day.sections.forEach((_, si) => { if (!secOrder.includes(si)) secOrder.push(si); });
  return { day, secOrder, plan };
}

export function moveSection(pid, dayId, si, dir) {
  const { secOrder } = currentOrders(pid, dayId);
  const at = secOrder.indexOf(si), to = at + dir;
  if (at < 0 || to < 0 || to >= secOrder.length) return false;
  [secOrder[at], secOrder[to]] = [secOrder[to], secOrder[at]];
  store.update((s) => {
    const d = dayRec(s, pid, dayId);
    (d.plan || (d.plan = {})).secOrder = secOrder;
  });
  return true;
}

export function moveExercise(pid, dayId, si, ii, dir) {
  const { day, plan } = currentOrders(pid, dayId);
  const sec = day.sections[si];
  const order = [];
  for (const x of (plan.exOrder?.[si] || [])) if (sec.items[x] !== undefined) order.push(x);
  sec.items.forEach((_, x) => { if (!order.includes(x)) order.push(x); });
  const at = order.indexOf(ii), to = at + dir;
  if (at < 0 || to < 0 || to >= order.length) return false;
  [order[at], order[to]] = [order[to], order[at]];
  store.update((s) => {
    const d = dayRec(s, pid, dayId);
    const plan2 = d.plan || (d.plan = {});
    (plan2.exOrder || (plan2.exOrder = {}))[si] = order;
  });
  return true;
}

export function resetDayPlan(pid, dayId) {
  store.update((s) => { delete dayRec(s, pid, dayId).plan; });
}
export const hasCustomPlan = (pid, dayId) => {
  const p = store.day(dayId, pid)?.plan;
  return !!p && (p.secOrder?.length || p.exOrder || (p.ex && Object.keys(p.ex).length));
};
