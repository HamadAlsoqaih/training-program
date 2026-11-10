// ============================================================================
// rezero.js — "Re:Zero" — a 4-day upper/lower split built around a knee and a
// back that need managing: push/pull twice a week with the shoulder rehab
// block, two lower days that move from tolerance work to power across three
// phases, and the PJF core/mobility block after each upper day.
//
// Weekly schedule (Saudi week, Saturday first):
//   D1 Sat  Upper A — Push + Mini Pull       → Core/Mobility
//   D2 Sun  Rest + steps
//   D3 Mon  Lower B — Squat focus            → Cardio
//   D4 Tue  Upper B — Pull + Mini Push       → Core/Mobility
//   D5 Wed  Rest + steps, then VO2 max from Phase 2
//   D6 Thu  Rest + steps
//   D7 Fri  Lower A — Hinge focus            → Cardio
//
// Lower-body phases: 1 = weeks 1–4, 2 = weeks 5–8, 3 = weeks 9–12. The core
// block follows PJF's own progression and is imported from p12.js for weeks
// 3–12 so the shared content cannot drift.
// ============================================================================
import { sr, time, wuws, it } from '../schemes.js';
import { p2Core, p3Core, p4Core } from './p12.js';

// Reps are written as the TOP of the prescribed range — the app's double
// progression is "add weight once every set reaches the top" — with the range
// itself on the card.
const R810 = '8–10 reps — add weight once every set hits 10';
const R812 = '8–12 reps';

// --- upper body --------------------------------------------------------------
const warmup = () => ({
  title: 'Shoulder Band Warm-Up', tag: 'warmup', items: [
    it('sa_pulldown', sr(1, 10), 15),
    it('cb_sa_pulldown', sr(1, 10), 15),
    it('band_er', sr(2, 10), 15),
    it('band_ir', sr(2, 10), 15),
    it('band_pullapart', sr(2, 10), 15),
    it('oh_pullapart', sr(2, 10), 15),
    it('spike_pull', sr(2, 10), 15),
    it('oh_iso_hold', time(2, 30), 15),
  ],
});

const rehab = () => ({
  title: 'Rehab', tag: 'rehab', items: [
    it('bu_kb_press', sr(2, 10), 45),
    it('bu_kb_hold', sr(2, 10), 45),
    it('kb_bu_walk', time(2, 30), 45),
    it('steering_wheels', sr(2, 10), 30),
    it('wall_slide', sr(2, 10), 30),
    it('wall_clock', sr(2, 10), 30),
    it('scap_pushup', sr(2, 10), 30),
    it('banded_complex', sr(2, 10), 30),
    it('bo_sa_raise', sr(2, 10), 30),
  ],
});

// A "mini" movement rides along inside sets 1–2 of the lift it is paired with;
// no separate warm-up, and the main lift's third set rests the same.
const MINI = 'Mini set — pairs with sets 1–2 of the main lift, no warm-up';

const upperA = () => ({
  title: 'Push + Mini Pull', tag: 'strength', items: [
    it('chest_press', sr(3, 10), 0, { ss: 'ua1', note: `${R810}. Until it is completely pain-free, keep 3×8–10; after that 2×6–8 at 2:00 rest.` }),
    it('lat_pulldown', sr(2, 10), 120, { ss: 'ua1', note: MINI }),
    it('box_pushup', sr(3, 10), 0, { ss: 'ua2', note: R810 }),
    it('seated_row', sr(2, 10), 90, { ss: 'ua2', note: MINI }),
    it('lateral_raise', sr(3, 10), 0, { ss: 'ua3', note: R810 }),
    it('face_pull', sr(2, 10), 60, { ss: 'ua3', note: MINI }),
    it('pec_deck', sr(3, 10), 60, { note: R810 }),
    it('cable_lat_raise', sr(3, 10), 60, { note: R810 }),
  ],
});

const upperB = () => ({
  title: 'Pull + Mini Push', tag: 'strength', items: [
    it('low_row', sr(3, 10), 0, { ss: 'ub1', note: R810 }),
    it('chest_press', sr(2, 10), 120, { ss: 'ub1', note: MINI }),
    it('lat_pulldown', sr(3, 10), 120, { note: R810 }),
    it('face_pull', sr(3, 10), 0, { ss: 'ub2', note: R810 }),
    it('lateral_raise', sr(2, 10), 60, { ss: 'ub2', note: MINI }),
    it('sa_cable_pulldown', sr(3, 10), 60, { side: true, note: `${R810}. If the shoulder complains, this is the first thing to drop.` }),
    it('seated_row', sr(3, 10), 0, { ss: 'ub3', note: R810 }),
    it('box_pushup', sr(2, 10), 90, { ss: 'ub3', note: MINI }),
  ],
});

const armsPush = () => ({
  title: 'Arms — Triceps first (superset)', tag: 'arms', items: [
    it('triceps', sr(3, 12), 0, { ss: 'arms', note: R812 }),
    it('biceps', sr(3, 12), 60, { ss: 'arms', note: R812 }),
  ],
});
const armsPull = () => ({
  title: 'Arms — Biceps first (superset)', tag: 'arms', items: [
    it('biceps', sr(3, 12), 0, { ss: 'arms', note: R812 }),
    it('triceps', sr(3, 12), 60, { ss: 'arms', note: R812 }),
  ],
});

// --- core / mobility ---------------------------------------------------------
// Weeks 1–2 follow PJF phase 1, with one correction: PJF prints 1 set of the
// Rocking Plank in week 1, which is a typo — it is 3 sets like everything else.
const core12 = (week) => {
  const w2 = week === 2;
  return { title: 'Core & Mobility', tag: 'core', items: [
    it('rocking_deadbug', sr(3, 8), 0, { ss: 'c1', side: w2 }),
    it('ham_floss', sr(3, w2 ? 7 : 5), 30, { ss: 'c1' }),
    it('rocking_plank', time(3, w2 ? 30 : 25), 0, { ss: 'c2' }),
    it('hip_car', sr(3, w2 ? 4 : 3), 30, { ss: 'c2' }),
    it('side_plank', time(3, w2 ? 30 : 25), 0, { ss: 'c3' }),
    it('hip_flexor_tilt', sr(3, w2 ? 4 : 3), 30, { ss: 'c3' }),
    it('reach_through', sr(3, w2 ? 5 : 4), 0, { ss: 'c4' }),
    it('oh_deep_squat', sr(3, w2 ? 4 : 3), 30, { ss: 'c4' }),
  ]};
};
const coreFor = (week) => {
  if (week <= 2) return core12(week);
  if (week <= 4) return p2Core();
  if (week <= 8) return p3Core(week);
  return p4Core(week);
};

// --- lower body ---------------------------------------------------------------
const phaseOfWeek = (week) => (week <= 4 ? 1 : week <= 8 ? 2 : 3);
const byPhase = (week, a, b, c) => [a, b, c][phaseOfWeek(week) - 1];

const cardio = () => ({
  title: 'Cardio', tag: 'cardio', items: [
    it('incline_walk', time(1, 1800), 0, { note: '7% incline, 4.5 km/h. Short on time before work: 20 min, or walk in the evening.' }),
  ],
});

// Friday — hinge focus
const lowerA = (week) => {
  const p = phaseOfWeek(week);
  const items = [
    it('bike_warmup', sr(1, 1)),
    p === 3 ? it('drop_to_stick', sr(3, 4), 60) : it('snap_down', sr(3, 5), 60),
    it('pogos', sr(3, byPhase(week, 10, 15, 15)), 60),
  ];
  if (p >= 2) {
    items.push(it('accel_sprint', sr(p === 2 ? 4 : 5, 1), p === 2 ? 90 : 150,
      { note: p === 2 ? '10 m per rep' : '20 m per rep' }));
  }
  if (p === 3) items.push(it('jump_squat', sr(3, 4), 120));
  items.push(
    p === 1 ? it('rdl', sr(3, 8), 150, { note: 'Light. 3 s down.' })
      : it('trap_bar_dl', sr(p === 2 ? 3 : 4, 5), 150, { note: p === 2 ? 'Light' : '3–5 reps' }),
    it('box_squat', sr(3, 5), 120, { note: p === 3 ? '3–5 reps' : null }),
    it('hip_thrust', sr(p === 3 ? 3 : 4, p === 3 ? 6 : 8), 120, { note: p === 3 ? '5–6 reps, heavy' : '6–8 reps' }),
    it('back_ext', sr(byPhase(week, 3, 3, 2), byPhase(week, 12, 10, 10)), 60),
    it('ham_curl', sr(p === 3 ? 2 : 3, 10), 60, { note: '8–10 reps' }),
    it('copenhagen', time(2, byPhase(week, 20, 25, 30)), 45, { side: true }),
    it('tibia_raise', sr(2, 15), 45),
  );
  return { title: 'Lower A — Hinge focus', tag: 'strength', items };
};

// Monday — squat focus
const lowerB = (week) => {
  const p = phaseOfWeek(week);
  return { title: 'Lower B — Squat focus', tag: 'strength', items: [
    it('bike_warmup', sr(1, 1)),
    p === 3 ? it('drop_to_stick', sr(3, 4), 60) : it('snap_down', sr(3, 5), 60),
    it('box_jump', sr(p === 1 ? 3 : 4, 3), 90),
    it('back_squat', sr(4, 5), 150, { note: p === 1 ? '5 reps' : p === 2 ? '4–5 reps' : '3–5 reps. Up to 3:00 rest on the heavy sets.' }),
    it('spanish_squat', time(p === 3 ? 2 : 3, 45), 60, { note: p === 1 ? '30–45 s' : null }),
    p === 1 ? it('step_up', sr(3, 8), 90, { side: true })
      : it('rfess', sr(3, p === 2 ? 8 : 6), 90, { side: true, note: p === 2 ? '6–8 reps' : null }),
    it('leg_ext', sr(p === 3 ? 2 : 3, 10), 60, { note: p === 1 ? 'Light to moderate' : '8–10 reps' }),
    it('nordics', sr(3, p === 1 ? 4 : 5), 90, { note: 'Slow lowering' }),
    it('calf_raise', sr(3, p === 3 ? 8 : 10), 60, { note: p === 3 ? 'Heavier' : '3 s up / 3 s down' }),
  ]};
};

// Wednesday — VO2 from Phase 2 onward
const vo2Day = (week) => ({
  title: 'VO2 Max', tag: 'cardio', items: [
    it('vo2_warmup', time(1, 540), 0),
    it('vo2_interval', time(phaseOfWeek(week) === 2 ? 3 : 4, 240), 180),
    it('vo2_cool', time(1, 300), 0),
  ],
});

// Jump test at the end of weeks 4, 8 and 12
const jumpTest = () => ({
  title: 'Jump Test', tag: 'test', items: [it('jump_test', sr(3, 1), 60, { opt: true })],
});

export const PHASES = [
  { n: 1, weeks: [1, 4], name: 'Phase 1 — Tolerance & Base', color: 'var(--ph1)' },
  { n: 2, weeks: [5, 8], name: 'Phase 2 — Strength & Speed', color: 'var(--ph2)' },
  { n: 3, weeks: [9, 12], name: 'Phase 3 — Heavy & Power', color: 'var(--ph3)' },
];

const BADGES = {
  4: 'Jump test at the end of this week — countermovement jump, best of 3.',
  5: 'PHASE 2 — only move up if squat pain stayed ≤2/10 for two straight weeks and the back is quiet. Trap bar replaces the RDL, sprints start, and the Wednesday VO2 session begins.',
  8: 'Jump test at the end of this week.',
  9: 'PHASE 3 — only move up with a pain-free back squat at 60 kg+ and no knee pain on jumps. A 1–2 week delay here is normal and fine.',
  12: 'Final jump test at the end of this week.',
};

function buildWeek(week) {
  const p = phaseOfWeek(week);
  const testWeek = week === 4 || week === 8 || week === 12;
  const upperTail = (arms) => {
    const out = [warmup(), rehab()];
    out.push(arms === 'push' ? upperA() : upperB());
    out.push(arms === 'push' ? armsPush() : armsPull());
    out.push(coreFor(week));
    return out;
  };

  return [
    { d: 1, title: 'Upper A — Push + Mini Pull → Core', kind: 'upper', sections: upperTail('push') },
    { d: 2, title: 'Rest + steps', kind: 'off', sections: [] },
    { d: 3, title: 'Lower B — Squat focus → Cardio', kind: 'strength',
      sections: [lowerB(week), cardio()] },
    { d: 4, title: 'Upper B — Pull + Mini Push → Core', kind: 'upper', sections: upperTail('pull') },
    { d: 5, title: p === 1 ? 'Rest + steps' : 'VO2 Max', kind: p === 1 ? 'off' : 'cardio',
      sections: p === 1 ? [] : [vo2Day(week)] },
    { d: 6, title: 'Rest + steps', kind: 'off', sections: [] },
    { d: 7, title: 'Lower A — Hinge focus → Cardio', kind: 'strength',
      sections: testWeek ? [lowerA(week), jumpTest(), cardio()] : [lowerA(week), cardio()] },
  ];
}

export default {
  id: 'rz',
  name: 'Re:Zero',
  subtitle: '4-day upper/lower · push/pull + shoulder rehab · lower body in three phases',
  weeks: 12,
  phases: PHASES,
  badges: BADGES,
  buildWeek,
  // Saudi week: Day 1 is Saturday.
  defaultDayMap: { 1: 6, 2: 0, 3: 1, 4: 2, 5: 3, 6: 4, 7: 5 },
  daySlots: [
    'Upper A — Push + Mini Pull → Core',
    'Rest + steps',
    'Lower B — Squat focus → Cardio',
    'Upper B — Pull + Mini Push → Core',
    'Rest + steps / VO2 Max',
    'Rest + steps',
    'Lower A — Hinge focus → Cardio',
  ],
  nutrition: [
    ['Calories', '2,500 / day'],
    ['Protein', '180–200 g / day'],
    ['Creatine', '5 g / day'],
    ['Omega-3, magnesium glycinate, ashwagandha', 'Continue current dose'],
    ['Steps', 'Daily, every day'],
  ],
  notes: [
    'Upper progression: 8–10 reps (arms 8–12), the heaviest weight with no pain. Under 8 reps means too heavy. Add weight only when every set hits the top of the range.',
    'Effort check: if you could clearly have done 3+ more reps on the last set, it was too light.',
    'Saturday Chest Press: 3×8–10 until completely pain-free, then 2×6–8 at 2:00 rest. Tuesday stays 8–10.',
    'Box Push-Up: when 3×10 is clean, lower the box a step — keep going until the floor.',
    'Overhead pulls: neutral-grip lat pulldown. If the shoulder complains, drop the Single-Arm Cable Pulldown first.',
    'Mini sets pair with sets 1–2 of the main lift and need no separate warm-up. Superset rule: both exercises back to back, then rest — and set 3 rests the same.',
    'Lower pain rule: up to 3/10 during the set is fine if it settles within 24 h and is no worse the next morning. Above that, go back to the previous load.',
    'Back Squat loading: under 50 kg add 5 kg a session; from 50 kg add 2.5 kg. Box Squat is about 80% of the latest Monday back squat and progresses separately. Other main lower lifts +2.5 kg once all sets hit the target reps.',
    'Landings: hold 2 s with the knees tracking over the toes. A sloppy landing ends the set. Jumps and sprints come first, while you are fresh — rest until you can repeat at full quality, roughly 1 min per 10 m sprinted.',
    'Knee guardrail: if the knee flares, drop the Leg Extension first, then the Step-Up.',
    'Back guardrail: any flare-up means one step back on the hinge exercises for a week. Trap bar only after 2 quiet weeks. If the lower back complains in core, modify Leg Lowers, PNF V Sit and Supine Kick Over first.',
    'Phase entry: Phase 2 needs squat pain ≤2/10 for two straight weeks with a quiet back. Phase 3 needs a pain-free 60 kg back squat and no knee pain on jumps — a 1–2 week delay is expected.',
    'Jump test: countermovement jump at the end of weeks 4, 8 and 12 (iPhone Measure, best of 3).',
    'VO2 max (Wednesday, from Phase 2): bike or rower, not running. 8–10 min easy warm-up, 4 min at 90–95% of max heart rate with 3 min easy between, 5 min cool-down. Start at 3 intervals; go to 4 once two sessions at 3 hit the target heart rate. Start it only if Phase 1 went well — otherwise wait for Phase 3.',
    'Deload week: lifts follow the app’s deload rule; jumps, landings and sprints drop to 1 easy set, and skip the VO2 session that week.',
    'Time caps: about 2 h a session, with Friday and Saturday allowed up to 2.5 h.',
  ],
};
