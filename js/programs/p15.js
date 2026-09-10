// ============================================================================
// p15.js — "15-Week Program" (volleyball strength & plyometrics).
// The original program. Encoded exactly from the source tables.
// ============================================================================
import { sr, time, wuws, it, capSets } from '../schemes.js';

// --- shared building blocks (consistent across all 15 weeks) ---------------
const SHOULDER_WARMUP = () => [
  it('sa_pulldown', sr(3, 10)), it('cb_sa_pulldown', sr(3, 10)),
  it('band_er', sr(3, 10)), it('band_ir', sr(3, 10)),
  it('band_pullapart', sr(3, 10)), it('oh_pullapart', sr(3, 10)),
  it('spike_pull', sr(3, 10)), it('oh_iso_hold', time(3, 30)),
];
const REHAB = () => [
  it('bu_kb_press', sr(3, 10)), it('bu_kb_hold', sr(3, 10)),
  it('steering_wheels', sr(3, 10)), it('wall_slide', sr(3, 10)),
  it('wall_clock', sr(3, 10)), it('scap_pushup', sr(3, 10)),
];

const pushDay = () => [
  { title: 'Shoulder Band Warm-Up', tag: 'warmup', items: SHOULDER_WARMUP() },
  { title: 'Rehab', tag: 'rehab', items: REHAB() },
  { title: 'Strength — Push', tag: 'strength', items: [
    it('lateral_raise', sr(3, 10)), it('banded_complex', sr(3, 10)),
    it('pushup', sr(3, 10)), it('pec_deck', sr(3, 10)),
  ]},
  { title: 'Arms — Triceps first', tag: 'arms', items: [
    it('triceps', wuws(0, 2)), it('biceps', wuws(0, 2)),
  ]},
];

const pullDay = () => [
  { title: 'Shoulder Band Warm-Up', tag: 'warmup', items: SHOULDER_WARMUP() },
  { title: 'Rehab', tag: 'rehab', items: REHAB() },
  { title: 'Strength — Pull', tag: 'strength', items: [
    it('low_row', sr(3, 10)), it('mid_row', sr(3, 10)), it('face_pull', sr(3, 10)),
    it('bo_sa_raise', sr(3, 10)), it('seated_row', sr(3, 10)),
  ]},
  { title: 'Arms — Biceps first', tag: 'arms', items: [
    it('biceps', wuws(0, 2)), it('triceps', wuws(0, 2)),
  ]},
];

const strengthDay = () => [
  { title: 'Shoulder Band Warm-Up', tag: 'warmup', items: SHOULDER_WARMUP() },
  { title: 'Lower Body Strength', tag: 'strength', items: [
    it('squat', wuws(2, 2), 120),
    it('nordics', wuws(2, 2), 90),
    it('leg_ext', wuws(2, 2), 90),
    it('ham_curl', wuws(2, 2), 90),
    it('adduction', wuws(0, 2), 60, { ss: 'addabd' }),
    it('abduction', wuws(0, 2), 60, { ss: 'addabd' }),
    it('tibia_raise', wuws(0, 2), 60, { ss: 'tibcalf' }),
    it('calf_raise', wuws(0, 2), 60, { ss: 'tibcalf' }),
    it('hip_thrust', wuws(2, 2), 90),
  ]},
  { title: 'Volleyball', tag: 'skill', items: [
    it('volleyball', sr(1, 1), 0, { opt: true }),
  ]},
];

const day1Accessories = () => ({
  title: 'Accessories — after plyo, before cardio', tag: 'strength', items: [
    it('leg_press', wuws(2, 2), 90), it('hip_thrust', wuws(2, 2), 90),
  ],
});
const day3Accessories = () => ({
  title: 'Accessories — after plyo, before cardio', tag: 'strength', items: [
    it('nordics', wuws(2, 2), 90), it('calf_raise', wuws(2, 2), 90),
  ],
});
const cardioSection = () => ({
  title: 'Cardio', tag: 'cardio', items: [it('incline_walk', time(1, 1800))],
});

// --- Phase 1 (weeks 1–4) ---------------------------------------------------
const p1Plyo = () => ({
  title: 'Lower Body Plyo', tag: 'plyo', items: [
    it('dyn_warmup', sr(1, 1)),
    it('mech_primer', sr(2, 4), 30),
    it('ol_speed_drop', sr(2, 6), 30, { side: true }),
    it('rapid_decel', sr(2, 6), 45, { side: true }),
    it('lat_bounds', sr(3, 6), 60, { side: true }),
    it('standing_jump', sr(3, 6), 60),
    it('rfess_iso', sr(3, 3), 0, { ss: 'rfess_hft', side: true, note: 'Superset with Hip Flexor Tilt' }),
    it('hip_flexor_tilt', sr(3, 4), 60, { ss: 'rfess_hft', side: true }),
    it('se_bridge_march', sr(3, 5), 60, { side: true }),
    it('long_dur_jump', time(3, 30), 90, { note: 'Hold position' }),
    it('ind_toe_raise', sr(3, 8), 45, { side: true }),
    it('breathing_711', time(1, 180)),
    it('static_stretch', time(1, 15), 0, { opt: true }),
  ],
});
const p1Core = () => ({
  title: 'Core & Mobility', tag: 'core', items: [
    it('rocking_deadbug', sr(3, 8)),
    it('ham_floss', sr(3, 5), 30),
    it('rocking_plank', time(1, 25)),
    it('hip_car', sr(3, 3), 30),
    it('side_plank', time(3, 25)),
    it('hip_flexor_tilt', sr(3, 3), 30),
    it('reach_through', sr(3, 4)),
    it('oh_deep_squat', sr(3, 3), 30),
  ],
});

// --- Phase 2 (weeks 5–6) ---------------------------------------------------
const p2Plyo = (full) => ({
  title: 'Lower Body Plyo', tag: 'plyo', items: [
    it('dyn_warmup', sr(1, 1)),
    it('sd_lat_push', sr(full ? 3 : 2, 4), 45, { side: true }),
    it('angle_bounds', sr(full ? 3 : 2, 4), 60, { side: true }),
    it('penult_jumps', sr(full ? 3 : 2, 3), 60, { side: true }),
    it('tf_max_touch', sr(full ? 3 : 2, 2), 60),
    it('power_skip', sr(full ? 3 : 2, 8), 60, { side: true }),
    it('sl_ecc_stepdown', sr(full ? 3 : 2, 10), 60, { side: true }),
    it('reverse_plank', time(full ? 3 : 2, 30), 60),
    it('long_dur_jump', time(full ? 3 : 2, 40), 90),
    it('breathing_711', time(1, 180)),
    it('static_stretch', time(1, 15), 0, { opt: true }),
  ],
});
const p2Core = () => ({
  title: 'Core & Mobility', tag: 'core', items: [
    it('rocking_deadbug', sr(3, 10)),
    it('ham_floss', sr(3, 10), 30),
    it('rocking_plank', time(3, 35)),
    it('hip_car', sr(3, 4), 30),
    it('splank_abd', sr(3, 8)),
    it('hip_flexor_tilt', sr(3, 5), 30),
    it('reach_through', sr(3, 5)),
    it('oh_deep_squat', sr(3, 4), 30),
  ],
});

// --- Phase 3 (weeks 8–11): Type A = Day 3, Type B = Day 1 ------------------
const p3Common = (i) => [
  it('dyn_warmup', sr(1, 1)),
  it('sd_of_jump', sr(3, [4, 5, 6, 7][i]), 60, { side: true }),
  it('accel_jump', sr(2, [3, 4, 5, 6][i]), 45, { side: true }),
];
const p3Tail = (i) => [
  it('osc_rfess', time([3, 3, 3, 4][i], [30, 40, 50, 50][i]), 60, { side: true }),
  it('ham_chair_hold', sr(3, [6, 7, 8, 9][i]), 60, { side: true }),
  it('achilles_spring', sr(3, [7, 8, 9, 10][i]), 60, { side: true }),
  it('breathing_711', time(1, 180)),
  it('static_stretch', time(1, 15), 0, { opt: true }),
];
const p3TypeA = (week) => {
  const i = week - 8;
  return { title: 'Lower Body Plyo — Type A', tag: 'plyo', items: [
    ...p3Common(i),
    it('freestyle_jump', time(i >= 2 ? 2 : 1, 600), 120, { counter: { warn: 40, cap: 50 } }),
    ...(i <= 1 ? [it('drach_jumps', sr(3, [4, 5][i]), 60, { side: true })] : []),
    ...p3Tail(i),
  ]};
};
const p3TypeB = (week) => {
  const i = week - 8;
  return { title: 'Lower Body Plyo — Type B', tag: 'plyo', items: [
    ...p3Common(i),
    it('penult_hurdle', sr(3, [2, 3, 3, 3][i]), 90, { side: true }),
    it('of_max_approach', sr(4, [2, 3, 4, 4][i]), 60, { side: true }),
    it('drach_jumps', sr(3, [4, 5, 5, 5][i]), 60,
      i >= 2 ? { side: true, note: 'Held at Week 9 volume (remains in Type B all weeks)' } : { side: true }),
    ...p3Tail(i),
  ]};
};
const p3Core = (week) => {
  const i = week - 8;
  return { title: 'Core & Mobility', tag: 'core', items: [
    it('hand_walkout', sr(3, [5, 6, 7, 8][i])),
    it('kneel_hip_mob', sr(3, 4), 30, { side: true }),
    it('leg_climb', sr(3, [5, 6, 7, 7][i]), 0, { side: true }),
    it('add_stretch', sr(3, 5), 30, { side: true }),
    it('side_plank_p3', time(3, [35, 35, 40, 40][i])),
    it('hip_9090', sr(3, 4), 30, { side: true }),
    it('leg_lowers', sr(3, [8, 9, 10, 11][i])),
    it('elastic_kicks', sr(3, 10), 30, { side: true }),
  ]};
};

// --- Phase 4 (weeks 12–15); week 12 = deload at 1 set ----------------------
const p4Plyo = (week) => {
  const deload = week === 12;
  const i = deload ? 0 : week - 13;
  const S = (n) => (deload ? 1 : n);
  return { title: 'Lower Body Plyo', tag: 'plyo', items: [
    it('dyn_warmup', sr(1, 1)),
    it('free_agility', time(S(4), [25, 30, 40][i]), week >= 15 ? 60 : 45),
    it('lb_of_jump', sr(S(3), [4, 4, 5][i])),
    it('consec_hurdle', sr(S(6), [3, 3, 4][i])),
    it('prog_bounding', sr(S(2), 1), 120),
    it('ot_drop_jump', sr(S(4), [3, 4, 4][i]), 0, { side: true }),
    it('versatile_jump', sr(S(3), [2, 3, 3][i]), 0, { side: true }),
    it('splank_abd', sr(S(3), [10, 11, 12][i])),
    it('bof_ol_turn', sr(S(3), [4, 5, 7][i])),
    it('static_stretch', time(1, 15), 0, { opt: true }),
  ]};
};
const p4Core = (week) => {
  const deload = week === 12;
  const i = deload ? 0 : week - 13;
  const S = (n) => (deload ? 1 : n);
  return { title: 'Core & Mobility', tag: 'core', items: [
    it('roll_cross_touch', sr(S(3), [2, 3, 4][i]), 0, { side: true }),
    it('oh_deep_squat', sr(S(3), 3), 30),
    it('cross_touch_ext', sr(S(3), [4, 4, 6][i]), 0, { side: true }),
    it('pnf_vsit', sr(S(3), 3), 30),
    it('leg_lowers', sr(S(3), [10, 10, 12][i])),
    it('knee_hug', sr(S(3), 5), 30, { side: true }),
    it('lb_angels', time(S(3), [25, 25, 30][i])),
    it('supine_kickover', sr(S(3), 10), 30, { side: true }),
  ]};
};

// --- resolvers -------------------------------------------------------------
const deloadSections = (sections) => sections.map((s) => (s.tag === 'cardio' ? s : capSets(s, 1)));

function plyoFor(week, dayNum) {
  if (week <= 4) { const s = p1Plyo(); return week <= 2 ? capSets(s, week) : s; }
  if (week === 5) return p2Plyo(false);
  if (week === 6) return p2Plyo(true);
  if (week === 7) return capSets(p2Plyo(true), 1);
  if (week <= 11) return dayNum === 1 ? p3TypeB(week) : p3TypeA(week);
  return p4Plyo(week);
}
function coreFor(week) {
  if (week <= 4) { const s = p1Core(); return week <= 2 ? capSets(s, week) : s; }
  if (week <= 6) return p2Core();
  if (week === 7) return capSets(p2Core(), 1);
  if (week <= 11) return p3Core(week);
  return p4Core(week);
}

export const PHASES = [
  { n: 1, weeks: [1, 4], name: 'Phase 1 — Foundation', color: 'var(--ph1)' },
  { n: 2, weeks: [5, 6], name: 'Phase 2 — Build', color: 'var(--ph2)' },
  { n: 3, weeks: [7, 11], name: 'Phase 3 — Power', color: 'var(--ph3)' },
  { n: 4, weeks: [12, 15], name: 'Phase 4 — Peak', color: 'var(--ph4)' },
];

const BADGES = {
  1: 'Volume ramp — 1 set of everything this week',
  2: 'Volume ramp — 2 sets of everything this week',
  5: 'Familiarization — 2 sets, learn the new movements',
  6: 'Full sets — hold Week 5 reps',
  7: 'FULL DELOAD — every session at 1 set, reduced intensity. Cardio continues as normal.',
  12: 'DELOAD / FAMILIARIZATION — all Phase 4 movements at 1 set only. Learn the new patterns at low volume. Cardio continues.',
};

function buildWeek(week) {
  const deload7 = week === 7;
  const d = (sections) => (deload7 ? deloadSections(sections) : sections);
  const plyoLabel = (n) =>
    week >= 8 && week <= 11 ? (n === 1 ? 'Plyo Type B' : 'Plyo Type A') : 'Lower Body Plyo';

  return [
    { d: 1, title: `${plyoLabel(1)} + Leg Press & Hip Thrust`, kind: 'plyo',
      sections: d([plyoFor(week, 1), day1Accessories(), cardioSection()]) },
    { d: 2, title: 'Push Upper Body → Core & Mobility', kind: 'upper',
      sections: d([...pushDay(), coreFor(week), cardioSection()]) },
    { d: 3, title: `${plyoLabel(3)} + Nordics & Calf Raises`, kind: 'plyo',
      sections: d([plyoFor(week, 3), day3Accessories(), cardioSection()]) },
    { d: 4, title: 'Pull Upper Body → Core & Mobility', kind: 'upper',
      sections: d([...pullDay(), coreFor(week), cardioSection()]) },
    { d: 5, title: 'Rest + Cardio', kind: 'rest', sections: [cardioSection()] },
    { d: 6, title: 'Strength Day', kind: 'strength',
      sections: d([...strengthDay(), cardioSection()]) },
    { d: 7, title: 'Full Rest', kind: 'off', sections: [] },
  ];
}

export default {
  id: 'p15',
  name: '15-Week Program',
  subtitle: 'Volleyball strength, plyometrics & shoulder rehab',
  weeks: 15,
  phases: PHASES,
  badges: BADGES,
  buildWeek,
  daySlots: [
    'Plyo + Leg Press & Hip Thrust',
    'Push Upper Body → Core',
    'Plyo + Nordics & Calf Raises',
    'Pull Upper Body → Core',
    'Rest + Cardio',
    'Strength Day',
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
    'Leg Press + Hip Thrust (Day 1): after plyo, before cardio. 2 WU + 2 WS each.',
    'Nordics + Calf Raises (Day 3): after plyo, before cardio. 2 WU + 2 WS each. Nordics: slow 3–5 sec eccentric, progress ROM before adding load. Calf raises: 3s up / 3s down.',
    'Nordics also appear in the Day 6 strength session — 2 Nordic sessions per week total.',
    'Arms: triceps first on push day (Day 2), biceps first on pull day (Day 4). 2 working sets each, exercise of choice.',
    'Squat variation: confirm with your PT which variation is cleared for your shoulder.',
    'Freestyle Jumping: cap at 40–50 ground contacts per 10-minute block.',
    'Volleyball wall practice: optional on Day 6 after strength work. Skip if fatigued.',
    'Fatigue check: if plyo performance drops, reduce cardio to 5 days or lower the incline temporarily.',
    'Progressive overload: add weight on strength exercises when both working sets are completed cleanly.',
    'Front Raise: dropped — anterior delt is covered by KB press, banded complex, and push-ups. Pending PT confirmation.',
  ],
};
