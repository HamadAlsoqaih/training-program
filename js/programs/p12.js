// ============================================================================
// p12.js — "12-Week Vert Code" (PJF Performance "The Vert Code — Bodyweight"
// adapted to the same weekly template). Encoded exactly from the source tables.
//
// Weekly template:
//   D1 Wed  LB Plyo → Leg Press + Hip Thrust
//   D2 Thu  Push Upper Body → Core
//   D3 Fri  LB Plyo → Nordics + Calf Raises
//   D4 Sat  Pull Upper Body → Core
//   D5 Sun  Rest + cardio
//   D6 Mon  LB Plyo → Shoulder Band Warm-Up → Volleyball (optional)
//   D7 Tue  Full rest
// ============================================================================
import { sr, time, wuws, it } from '../schemes.js';

// --- consistent blocks (note: p12 uses LOWER warm-up/rehab volumes than p15)
const SHOULDER_WARMUP = () => ({
  title: 'Shoulder Band Warm-Up', tag: 'warmup', items: [
    it('sa_pulldown', sr(1, 10)),
    it('cb_sa_pulldown', sr(1, 10)),
    it('band_er', sr(2, 10)),
    it('band_ir', sr(2, 10)),
    it('band_pullapart', sr(2, 10)),
    it('oh_pullapart', sr(2, 10)),
    it('spike_pull', sr(2, 10)),
    it('oh_iso_hold', time(2, 30)),
  ],
});
const REHAB = () => ({
  title: 'Rehab', tag: 'rehab', items: [
    it('bu_kb_press', sr(2, 10)),
    it('bu_kb_hold', sr(2, 10)),
    it('kb_bu_walk', time(2, 30)),
    it('steering_wheels', sr(2, 10)),
    it('wall_slide', sr(2, 10)),
    it('wall_clock', sr(2, 10)),
    it('scap_pushup', sr(2, 10)),
  ],
});
const pushStrength = () => ({
  title: 'Strength — Push', tag: 'strength', items: [
    it('lateral_raise', sr(3, 10)),
    it('banded_complex', sr(3, 10)),
    it('chest_press', sr(3, 10)),
    it('pushup', sr(3, 10)),
    it('pec_deck', sr(3, 10)),
  ],
});
const pullStrength = () => ({
  title: 'Strength — Pull', tag: 'strength', items: [
    it('low_row', sr(3, 10)),
    it('mid_row', sr(3, 10)),
    it('face_pull', sr(3, 10)),
    it('bo_sa_raise', sr(3, 10)),
    it('seated_row', sr(3, 10)),
  ],
});
const armsPush = () => ({
  title: 'Arms — Triceps first (superset)', tag: 'arms', items: [
    it('triceps', wuws(0, 2), 0, { ss: 'arms' }),
    it('biceps', wuws(0, 2), 60, { ss: 'arms' }),
  ],
});
const armsPull = () => ({
  title: 'Arms — Biceps first (superset)', tag: 'arms', items: [
    it('biceps', wuws(0, 2), 0, { ss: 'arms' }),
    it('triceps', wuws(0, 2), 60, { ss: 'arms' }),
  ],
});
const day1Accessories = () => ({
  title: 'Accessories — after the last strength/hold, before cooldown', tag: 'strength', items: [
    it('leg_press', wuws(2, 2), 0, { ss: 'acc' }),
    it('hip_thrust', wuws(2, 2), 90, { ss: 'acc' }),
  ],
});
const day3Accessories = () => ({
  title: 'Accessories — after the last strength/hold, before cooldown', tag: 'strength', items: [
    it('nordics', wuws(2, 2), 0, { ss: 'acc' }),
    it('calf_raise', wuws(2, 2), 90, { ss: 'acc' }),
  ],
});
const cardio = () => ({
  title: 'Cardio', tag: 'cardio', items: [it('incline_walk', time(1, 1800))],
});
const volleyball = () => ({
  title: 'Volleyball', tag: 'skill', items: [it('volleyball', sr(1, 1), 0, { opt: true })],
});
const cooldown = (items) => ({ title: 'Cooldown', tag: 'cooldown', items });

// pair items (1,2) (3,4) (5,6) (7,8) into supersets A–D (source marks these ⤸)
const pairSupersets = (items) =>
  items.map((item, i) => ({ ...item, ss: `ss${Math.floor(i / 2)}` }));

// ---------------------------------------------------------------------------
// PHASE 1 — weeks 1–2
// ---------------------------------------------------------------------------
const p1Main = (week) => {
  const w2 = week === 2;
  return { title: 'Lower Body Plyo', tag: 'plyo', items: [
    it('dyn_warmup', sr(1, 1), 0, { note: 'No static stretching before the workout' }),
    it('mech_primer', sr(2, 4), 30),
    it('ol_speed_drop', sr(w2 ? 3 : 2, w2 ? 7 : 6), 30, { side: true }),
    it('rapid_decel', sr(w2 ? 3 : 2, w2 ? 8 : 6), 45, { side: true }),
    it('lat_bounds', sr(3, w2 ? 8 : 6), 60, { side: true }),
    it('standing_jump', sr(3, w2 ? 8 : 6), 60),
    it('rfess_iso', sr(3, w2 ? 4 : 3), 0, { ss: 'rfess', side: true, note: 'Superset straight into Hip Flexor Tilt' }),
    it('hip_flexor_tilt', sr(3, 4), 60, { ss: 'rfess', side: true }),
    it('se_bridge_march', sr(3, w2 ? 6 : 5), 60, { side: true }),
  ]};
};
const p1Cool = (week) => cooldown([
  it('long_dur_jump', time(3, week === 2 ? 35 : 30), 90),
  it('ind_toe_raise', sr(3, week === 2 ? 10 : 8), 45, { side: true }),
  it('breathing_711', time(1, 180)),
  it('static_stretch', time(1, 15), 0, { opt: true }),
]);
const p1Core = (week) => ({
  title: 'Core & Mobility', tag: 'core', items: pairSupersets([
    it('rocking_deadbug', sr(3, 8), 0, { side: true }),
    it('ham_floss', sr(3, week === 2 ? 7 : 5), 30),
    it('rocking_plank', time(week === 2 ? 3 : 1, week === 2 ? 30 : 25)),
    it('hip_car', sr(3, week === 2 ? 4 : 3), 30),
    it('side_plank', time(3, week === 2 ? 30 : 25)),
    it('hip_flexor_tilt', sr(3, week === 2 ? 4 : 3), 30),
    it('reach_through', sr(3, week === 2 ? 5 : 4)),
    it('oh_deep_squat', sr(3, week === 2 ? 4 : 3), 30),
  ]),
});

// ---------------------------------------------------------------------------
// PHASE 2 — weeks 3–4
// ---------------------------------------------------------------------------
const p2Main = (week) => {
  const i = week - 3; // 0 | 1
  return { title: 'Lower Body Plyo', tag: 'plyo', items: [
    it('dyn_warmup', sr(1, 1)),
    it('sd_lat_push', sr(3, [4, 5][i]), 45, { side: true }),
    it('angle_bounds', sr(3, [4, 5][i]), 60, { side: true }),
    it('penult_jumps', sr(3, [3, 4][i]), 60, { side: true }),
    it('tf_max_touch', sr(3, 2), 60, { side: true }),
    it('power_skip', sr(3, [8, 10][i]), 60, { side: true }),
    it('sl_ecc_stepdown', sr(3, [10, 12][i]), 60, { side: true,
      note: 'MAX reps on the last set — stop at technical failure or 20 reps' }),
    it('reverse_plank', time(3, [30, 40][i]), 60, {
      note: 'MAX time on the last set — stop at 9/10 burn or 1:30. If two legs is easy, switch to one leg.' }),
  ]};
};
const p2Cool = (week) => cooldown([
  it('long_dur_jump', time(3, week === 4 ? 45 : 40), 90),
  it('breathing_711', time(1, 180)),
  it('static_stretch', time(1, 15), 0, { opt: true }),
]);
const p2Core = () => ({
  title: 'Core & Mobility', tag: 'core', items: pairSupersets([
    it('rocking_deadbug', sr(3, 10)),
    it('ham_floss', sr(3, 10), 30),
    it('rocking_plank', time(3, 35)),
    it('hip_car', sr(3, 4), 30),
    it('splank_abd', sr(3, 8)),
    it('hip_flexor_tilt', sr(3, 5), 30),
    it('reach_through', sr(3, 5)),
    it('oh_deep_squat', sr(3, 4), 30),
  ]),
});

// ---------------------------------------------------------------------------
// PHASE 3 — weeks 5–8  (Type A = Freestyle, Type B = Max Approach)
// ---------------------------------------------------------------------------
const p3Head = (i) => [
  it('dyn_warmup', sr(1, 1)),
  it('sd_of_jump', sr(3, [4, 5, 6, 7][i]), 60, { side: true }),
  it('accel_jump', sr(2, [3, 4, 5, 6][i]), 45, { side: true }),
];
const p3Tail = (i) => [
  it('osc_rfess', time([3, 3, 3, 4][i], [30, 40, 50, 50][i]), 60, { side: true,
    note: `${[15, 20, 25, 25][i]}s bottom-half ROM + ${[15, 20, 25, 25][i]}s top half` }),
  it('ham_chair_hold', sr(3, [6, 7, 8, 9][i]), 60, { side: true }),
  it('achilles_spring', sr(3, [7, 8, 9, 10][i]), 60, { side: true,
    note: 'Forward/back, side-to-side, diagonal each way per leg, then calf raises — that is 1 set' }),
];
const p3TypeA = (week) => {
  const i = week - 5;
  const drach = i <= 1 ? [it('drach_jumps', sr(3, [4, 5][i]), 60, { side: true })] : [];
  return { title: 'Lower Body Plyo — Type A (Freestyle)', tag: 'plyo', items: [
    ...p3Head(i),
    it('freestyle_jump', time([1, 1, 2, 2][i], 600), 120, { counter: { warn: 40, cap: 50 },
      note: 'Cap 40–50 ground contacts per block. Use a court or low hoop if possible.' }),
    ...drach,
    ...p3Tail(i),
  ]};
};
const p3TypeB = (week) => {
  const i = week - 5;
  return { title: 'Lower Body Plyo — Type B (Max Approach)', tag: 'plyo', items: [
    ...p3Head(i),
    it('penult_hurdle', sr(3, [2, 3, 3, 3][i]), 90, { side: true }),
    it('of_max_approach', sr(4, [2, 3, 4, 4][i]), 60, { side: true }),
    it('drach_jumps', sr(3, [4, 5, 6, 7][i]), 60, { side: true }),
    ...p3Tail(i),
  ]};
};
const p3Cool = () => cooldown([
  it('breathing_711', time(1, 180)),
  it('static_stretch', time(1, 15), 0, { opt: true }),
]);
const p3Core = (week) => {
  const i = week - 5;
  return { title: 'Core & Mobility', tag: 'core', items: pairSupersets([
    it('hand_walkout', sr(3, [5, 6, 7, 8][i])),
    it('kneel_hip_mob', sr(3, 4), 30, { side: true }),
    it('leg_climb', sr(3, [5, 6, 7, 7][i]), 0, { side: true }),
    it('add_stretch', sr(3, 5), 30, { side: true }),
    it('side_plank', time(3, [35, 35, 40, 40][i])),
    it('hip_9090', sr(3, 4), 30, { side: true,
      note: '4 reps each side on the reach through AND 4 each side on the hip opener' }),
    it('leg_lowers', sr(3, [8, 9, 10, 11][i])),
    it('elastic_kicks', sr(3, 10), 30, { side: true }),
  ]) };
};

// ---------------------------------------------------------------------------
// PHASE 4 — weeks 9–12  (no Seven Eleven Breathing in this phase)
// ---------------------------------------------------------------------------
const p4Main = (week) => {
  const i = week - 9;
  return { title: 'Lower Body Plyo', tag: 'plyo', items: [
    it('dyn_warmup', sr(1, 1)),
    it('free_agility', time(4, [25, 30, 35, 40][i]), [45, 45, 60, 60][i], {
      note: ['Freestyle 25s OR baseline to half court', 'Freestyle 30s OR baseline to 3/4 court',
             'Freestyle 35s OR baseline to 3/4 court', 'Freestyle 40s OR baseline to opposite baseline'][i] }),
    it('lb_of_jump', sr(3, [4, 4, 5, 5][i]), 60),
    it('consec_hurdle', sr(6, [3, 3, 3, 4][i]), 60, {
      note: '3 hurdles = 1 rep. Sets 1–2: small double hop between. Sets 3–4: rapid, land low, bend knees. Sets 5–6: pogo style, minimal knee bend, short ground contact.' }),
    it('prog_bounding', sr(2, 1), 120, {
      note: 'Court: baseline to half court on all combos (R-L-R-L, RR-LL, RRR-LLL, all R / all L). No court: 12 reps each leg on all combos.' }),
    it('ot_drop_jump', sr(4, [3, 4, 4, 4][i]), 90, { side: true }),
    it('versatile_jump', sr(3, [2, 3, 3, 3][i]), 90, { side: true }),
    it('splank_abd', sr(3, [10, 11, 12, 12][i]), 45),
    it('bof_ol_turn', sr(3, [4, 5, 6, 7][i]), 45),
  ]};
};
const p4Cool = () => cooldown([it('static_stretch', time(1, 15), 0, { opt: true })]);
const p4Core = (week) => {
  const i = week - 9;
  return { title: 'Core & Mobility', tag: 'core', items: pairSupersets([
    it('roll_cross_touch', sr(3, [2, 3, 3, 4][i]), 0, { side: true }),
    it('oh_deep_squat', sr(3, 3), 30),
    it('cross_touch_ext', sr(3, [4, 4, 5, 6][i]), 0, { side: true }),
    it('pnf_vsit', sr(3, 3), 30),
    it('leg_lowers', sr(3, [10, 10, 12, 12][i])),
    it('knee_hug', sr(3, 5), 30, { side: true }),
    it('lb_angels', time(3, [25, 25, 30, 30][i])),
    it('supine_kickover', sr(3, 10), 30, { side: true }),
  ]) };
};

// ---------------------------------------------------------------------------
// Resolvers
// ---------------------------------------------------------------------------
// Which plyo variant a given day uses. Phase 3 alternates Type A / Type B;
// week 5 Day 1 is a full deload (no plyo at all).
function plyoFor(week, dayNum) {
  if (week <= 2) return p1Main(week);
  if (week <= 4) return p2Main(week);
  if (week <= 8) {
    if (week === 5 && dayNum === 1) return null;      // deload day
    return dayNum === 3 ? p3TypeA(week) : p3TypeB(week);
  }
  return p4Main(week);
}
function coolFor(week) {
  if (week <= 2) return p1Cool(week);
  if (week <= 4) return p2Cool(week);
  if (week <= 8) return p3Cool();
  return p4Cool();
}
function coreFor(week) {
  if (week <= 2) return p1Core(week);
  if (week <= 4) return p2Core();
  if (week <= 8) return p3Core(week);
  return p4Core(week);
}
const accessoriesFor = (dayNum) =>
  dayNum === 1 ? day1Accessories() : dayNum === 3 ? day3Accessories() : null;

// A lower-body day: plyo main work → accessories → cooldown (→ extras) → cardio
function lbDay(week, dayNum) {
  const main = plyoFor(week, dayNum);
  if (!main) {
    // Week 5 Day 1 — full deload
    return [
      { title: 'Deload', tag: 'deload', items: [it('deload', sr(1, 1), 0,
        { note: 'No plyo, no accessories. Light movement only.' })] },
      cardio(),
    ];
  }
  const acc = accessoriesFor(dayNum);
  const out = [main];
  if (acc) out.push(acc);
  out.push(coolFor(week));
  if (dayNum === 6) { out.push(SHOULDER_WARMUP()); out.push(volleyball()); }
  out.push(cardio());
  return out;
}

export const PHASES = [
  { n: 1, weeks: [1, 2], name: 'Phase 1 — Base', color: 'var(--ph1)' },
  { n: 2, weeks: [3, 4], name: 'Phase 2 — Elastic', color: 'var(--ph2)' },
  { n: 3, weeks: [5, 8], name: 'Phase 3 — Max Approach', color: 'var(--ph3)' },
  { n: 4, weeks: [9, 12], name: 'Phase 4 — Reactive', color: 'var(--ph4)' },
];

const BADGES = {
  5: 'DELOAD START — Day 1 is a full deload (no plyo, no accessories) and Day 2 drops the core session. Cardio continues as normal.',
  7: 'Drach Jumps drop out of Type A (Freestyle) from this week onward.',
  9: 'Phase 4 — no Seven Eleven Breathing from here; the exercise selection shifts to reactive work.',
};

function buildWeek(week) {
  const w5 = week === 5;
  const label = (dayNum) => {
    if (week === 5 && dayNum === 1) return 'Deload — light movement + cardio';
    if (week >= 5 && week <= 8) {
      return dayNum === 3 ? 'Plyo Type A (Freestyle) + Nordics & Calf Raises'
        : dayNum === 1 ? 'Plyo Type B (Max Approach) + Leg Press & Hip Thrust'
        : 'Plyo Type B (Max Approach) → Band Warm-Up → Volleyball';
    }
    return dayNum === 1 ? 'LB Plyo + Leg Press & Hip Thrust'
      : dayNum === 3 ? 'LB Plyo + Nordics & Calf Raises'
      : 'LB Plyo → Band Warm-Up → Volleyball';
  };

  return [
    { d: 1, title: label(1), kind: w5 ? 'rest' : 'plyo', sections: lbDay(week, 1) },
    { d: 2, title: w5 ? 'Push Upper Body (core deloaded)' : 'Push Upper Body → Core & Mobility', kind: 'upper',
      sections: w5
        ? [SHOULDER_WARMUP(), REHAB(), pushStrength(), armsPush(), cardio()]
        : [SHOULDER_WARMUP(), REHAB(), pushStrength(), armsPush(), coreFor(week), cardio()] },
    { d: 3, title: label(3), kind: 'plyo', sections: lbDay(week, 3) },
    { d: 4, title: 'Pull Upper Body → Core & Mobility', kind: 'upper',
      sections: [SHOULDER_WARMUP(), REHAB(), pullStrength(), armsPull(), coreFor(week), cardio()] },
    { d: 5, title: 'Rest + Cardio', kind: 'rest', sections: [cardio()] },
    { d: 6, title: label(6), kind: 'plyo', sections: lbDay(week, 6) },
    { d: 7, title: 'Full Rest', kind: 'off', sections: [] },
  ];
}

export default {
  id: 'p12',
  name: '12-Week Vert Code',
  subtitle: 'PJF Vert Code (bodyweight) on your weekly template',
  weeks: 12,
  phases: PHASES,
  badges: BADGES,
  buildWeek,
  daySlots: [
    'LB Plyo + Leg Press & Hip Thrust',
    'Push Upper Body → Core',
    'LB Plyo + Nordics & Calf Raises',
    'Pull Upper Body → Core',
    'Rest + Cardio',
    'LB Plyo → Band Warm-Up → Volleyball',
    'Full Rest',
  ],
  nutrition: [
    ['Calories', '2,500 / day'],
    ['Protein', '180–200 g / day'],
    ['Creatine', '5 g / day (maintenance)'],
    ['Omega-3', 'Continue current dose'],
    ['Ashwagandha', 'Continue current dose'],
    ['Magnesium Glycinate', 'Continue current dose'],
  ],
  notes: [
    'Cardio: 30 min incline walk (7% incline, 4.5 km/h), 6 days/week (Days 1–6). Day 7 full rest. After month 1–2, swap one session for VO2 max.',
    'Warm-up reps: stick to 10 reps per set. No pyramiding.',
    'Leg Press + Hip Thrust (Day 1): after the last strength/hold exercise, before cooldown. 2 WU + 2 WS each, supersetted.',
    'Nordics + Calf Raises (Day 3): same placement. 2 WU + 2 WS each, supersetted. Nordics: slow 3–5 sec eccentric, progress ROM before adding load. Calf raises: 3s up / 3s down.',
    'Arms: triceps first on push day (Day 2), biceps first on pull day (Day 4). 2 working sets each, supersetted.',
    'Freestyle Jumping: cap at 40–50 ground contacts per 10-minute block.',
    'Volleyball wall practice: optional on Day 6 after the band warm-up. Skip if fatigued.',
    'Fatigue check: if plyo performance drops, reduce cardio to 5 days or lower the incline temporarily.',
    'Progressive overload: add weight on strength/accessory exercises when both working sets are completed cleanly.',
    'Phase 3 note: Week 5 Day 6 Acceleration Jump Start rest was not specified in the original — 0:45 is used.',
    'Phase 4 note: no Seven Eleven Breathing (replaced by the shift in exercise selection).',
    'Consecutive Hurdle Jump intent: sets 1–2 small double hop between jumps, sets 3–4 rapid and land low, sets 5–6 pogo style with minimal knee bend.',
  ],
};
