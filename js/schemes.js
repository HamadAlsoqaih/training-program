// ============================================================================
// schemes.js — shared prescription builders + formatting, used by every
// program module. A "scheme" describes sets and reps/duration for one item.
// ============================================================================

export const sr = (sets, reps) => ({ t: 'sr', sets, reps });
export const time = (sets, secs) => ({ t: 'time', sets, secs });
export const wuws = (wu, ws) => ({ t: 'wuws', wu, ws });

// Item: { ex, sch, rest, note?, opt?, ss? (superset group), counter?, side? }
export const it = (ex, sch, rest, extra) => ({ ex, sch, rest: rest ?? 0, ...(extra || {}) });

export const fmtSecs = (s) => {
  const m = Math.floor(s / 60), r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `0:${String(r).padStart(2, '0')}`;
};

export function schemeSets(sch) {
  if (sch.t === 'wuws') return sch.wu + sch.ws;
  return sch.sets;
}

export function schemeLabel(sch) {
  if (sch.t === 'sr') return `${sch.sets}×${sch.reps}`;
  if (sch.t === 'time') return `${sch.sets}×${fmtSecs(sch.secs)}`;
  const parts = [];
  if (sch.wu) parts.push(`${sch.wu} WU`);
  if (sch.ws) parts.push(`${sch.ws} WS`);
  return parts.join(' + ');
}

// Cap every item in a section to at most `cap` sets (deloads / volume ramps)
export function capSets(section, cap) {
  return {
    ...section,
    items: section.items.map((item) => {
      const sch = { ...item.sch };
      if (sch.t === 'sr' || sch.t === 'time') sch.sets = Math.min(sch.sets, cap);
      else if (sch.t === 'wuws') {
        sch.wu = Math.min(sch.wu, cap === 1 ? 1 : sch.wu);
        sch.ws = Math.min(sch.ws, cap);
      }
      return { ...item, sch };
    }),
  };
}
