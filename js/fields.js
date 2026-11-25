// ============================================================================
// fields.js — which boxes an exercise card shows, and what "better" means.
//
// Fields:
//   weight  kg per set (higher is better)
//   reps    reps per set
//   box     box height in cm per set — "up" (higher is better: box jump) or
//           "down" (lower is better: box push-up, where the box goes down a
//           step until the floor)
//   timer   a countdown on the card (holds); its seconds live in `secs`
//
// Where a card's fields come from, later wins:
//   1. the default for the exercise type (and the catalog's `fields`)
//   2. settings.fieldOv[exId]        — changed "everywhere"
//   3. the day's plan.ex[key].fields — changed "only for this day"
// Logged values sit on each set next to `done`: { weight, reps, box }.
// ============================================================================
import { EX } from './exercises.js';
import * as store from './state.js';

export const FIELD_KEYS = ['weight', 'reps', 'box', 'timer'];
export const BOX_STEP = 5;   // cm per − / + tap

export function defaultFields(item, sch) {
  const ex = EX[item.ex] || {};
  // a timed item always has its timer (warm-ups, breathing and stretches too)
  const base = sch.t === 'time'
    ? { weight: false, reps: false, box: false, timer: true }
    : ex.noload
      ? { weight: false, reps: false, box: false, timer: false }
      : { weight: true, reps: true, box: false, timer: false };
  return { ...base, ...(ex.fields || {}) };
}

// Clean up anything stored so a broken value can never break a card.
function clean(o) {
  if (!o || typeof o !== 'object') return {};
  const out = {};
  for (const k of ['weight', 'reps', 'timer']) if (typeof o[k] === 'boolean') out[k] = o[k];
  if (o.box === false || o.box === 'up' || o.box === 'down') out.box = o.box;
  if (Number.isFinite(o.secs) && o.secs > 0) out.secs = Math.round(o.secs);
  return out;
}

export const everywhereFields = (exId) => clean(store.get().settings.fieldOv?.[exId]);
export const dayFields = (pid, dayId, key) => clean(store.day(dayId, pid)?.plan?.ex?.[key]?.fields);

// The fields this card shows today.
export function fieldsFor(pid, dayId, entry) {
  return {
    ...defaultFields(entry.item, entry.sch),
    ...everywhereFields(entry.item.ex),
    ...dayFields(pid, dayId, entry.key),
  };
}
export const hasInputs = (f) => !!(f.weight || f.reps || f.box);

// "Everywhere": stored per exercise. Passing null resets to the default.
export function saveFieldsEverywhere(exId, fields) {
  store.update((s) => {
    const all = s.settings.fieldOv || (s.settings.fieldOv = {});
    if (fields) all[exId] = clean(fields); else delete all[exId];
  });
}

// --- best values, either direction ------------------------------------------
// Best box across history records (deload sessions left out, like weight).
// up → the highest box, down → the lowest. null when nothing is logged.
export function bestBox(list, dir) {
  let best = null;
  for (const r of list) {
    if (r.deload) continue;
    for (const s of r.sets) {
      if (s.box == null || s.box === '' || !s.done) continue;
      const v = +s.box;
      if (!Number.isFinite(v)) continue;
      if (best === null || (dir === 'down' ? v < best : v > best)) best = v;
    }
  }
  return best;
}
export const boxBetter = (a, b, dir) => (dir === 'down' ? a < b : a > b);
export const boxDir = (exId, pid, dayId, key) => {
  const f = { ...(EX[exId]?.fields || {}), ...everywhereFields(exId), ...(pid ? dayFields(pid, dayId, key) : {}) };
  return f.box || null;
};

// --- numbers ------------------------------------------------------------------
// Arabic-Indic (٠-٩) and Persian (۰-۹) digits become 0-9; the Arabic decimal
// separator and a comma become a point. Anything else is not a number.
export const toLatin = (v) => String(v ?? '')
  .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
  .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06F0))
  .replace(/[٫،,]/g, '.');

// '' → null; otherwise a number (rounded to 2 decimals), or NaN if it isn't one
export function parseNum(v) {
  const s = toLatin(v).trim();
  if (s === '') return null;
  if (!/^\d*\.?\d*$/.test(s) || s === '.') return NaN;
  return Math.round(parseFloat(s) * 100) / 100;
}
