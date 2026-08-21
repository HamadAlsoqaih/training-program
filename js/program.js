// ============================================================================
// program.js — the entire 15-week program encoded as data + week resolver.
// Source of truth: the user's program document. Zero information loss.
// ============================================================================

// ---------------------------------------------------------------------------
// Exercise catalog
//   log:  true → weight/reps logging inputs on working sets
//   note: technique cue shown on the card
//   yq:   YouTube search query override (defaults to name + "exercise")
// ---------------------------------------------------------------------------
export const EX = {
  // --- Shoulder band warm-up (8) ---
  sa_pulldown:       { name: 'Straight-Arm Pulldown' },
  cb_sa_pulldown:    { name: 'Cross-Body Straight-Arm Pulldown', yq: 'cross body straight arm pulldown band' },
  band_er:           { name: 'Band External Rotation' },
  band_ir:           { name: 'Band Internal Rotation' },
  band_pullapart:    { name: 'Band Pull-Apart' },
  oh_pullapart:      { name: 'Overhead Band Pull-Apart' },
  spike_pull:        { name: 'Band Straight-Arm Spike Pull', note: 'High anchor', yq: 'band straight arm pulldown high anchor volleyball spike' },
  oh_iso_hold:       { name: 'Band Overhead Iso Hold', note: 'Resist backward pull — timed hold', yq: 'band overhead isometric hold shoulder' },
  // --- Rehab (6) ---
  bu_kb_press:       { name: 'Bottoms-Up KB Press', log: true, yq: 'bottoms up kettlebell press' },
  bu_kb_hold:        { name: 'Bottoms-Up KB Anti-Rotation Hold', yq: 'bottoms up kettlebell anti rotation hold' },
  steering_wheels:   { name: 'Plate Steering Wheels', log: true, yq: 'plate steering wheel exercise' },
  wall_slide:        { name: 'Banded Wall Slide / Y-Raise', yq: 'banded wall slide y raise shoulder' },
  wall_clock:        { name: 'Banded Wall Plank Clock Reach', yq: 'wall plank clock reach shoulder stability' },
  scap_pushup:       { name: 'Scapular Push-Up' },
  // --- Push strength ---
  lateral_raise:     { name: 'Lateral Raise', log: true },
  banded_complex:    { name: 'Banded Complex (Row → ER → Press)', yq: 'band row external rotation press complex shoulder' },
  pushup:            { name: 'Push-Up', log: true },
  pec_deck:          { name: 'Pec Deck Fly', log: true },
  // --- Pull strength ---
  low_row:           { name: 'Low Cable Row', log: true },
  mid_row:           { name: 'Mid Cable Row', log: true },
  face_pull:         { name: 'Face Pull', log: true },
  bo_sa_raise:       { name: 'Bent-Over Straight-Arm Raise', log: true, yq: 'bent over straight arm rear delt raise' },
  seated_row:        { name: 'Seated Cable Row', log: true },
  // --- Arms ---
  triceps:           { name: 'Triceps (exercise of choice)', log: true, yq: 'best triceps cable exercises' },
  biceps:            { name: 'Biceps (exercise of choice)', log: true, yq: 'best biceps exercises' },
  // --- Strength day / accessories ---
  squat:             { name: 'Squat', log: true, note: 'Belt / goblet / back — per PT clearance for your shoulder', yq: 'belt squat goblet squat tutorial' },
  nordics:           { name: 'Nordics', log: true, note: 'Slow 3–5 sec eccentric. Progress range of motion before adding load.', yq: 'nordic hamstring curl' },
  leg_ext:           { name: 'Leg Extension', log: true },
  ham_curl:          { name: 'Hamstring Curl', log: true },
  adduction:         { name: 'Adduction (machine)', log: true, yq: 'hip adduction machine' },
  abduction:         { name: 'Abduction (machine)', log: true, yq: 'hip abduction machine' },
  tibia_raise:       { name: 'Tibia Raises', log: true, yq: 'tibialis raise' },
  calf_raise:        { name: 'Calf Raises', log: true, note: '3s up / 3s down tempo' },
  hip_thrust:        { name: 'Hip Thrust', log: true },
  leg_press:         { name: 'Leg Press', log: true },
  volleyball:        { name: 'Volleyball Wall Practice', note: 'Optional — skip if fatigued', yq: 'volleyball wall drills' },
  // --- Phase 1 plyo ---
  dyn_warmup:        { name: 'Dynamic Warmup', yq: 'dynamic warm up routine jumping athletes' },
  mech_primer:       { name: 'Mechanics Primer', yq: 'jump mechanics primer drill' },
  ol_speed_drop:     { name: 'One Leg Speed Drop Stick', yq: 'single leg drop stick landing drill' },
  rapid_decel:       { name: 'Rapid Deceleration', yq: 'rapid deceleration drill jumping' },
  lat_bounds:        { name: 'Lateral Bounds' },
  standing_jump:     { name: 'Standing Jump', yq: 'standing vertical jump technique' },
  rfess_iso:         { name: 'RFESS Iso Reps', yq: 'rear foot elevated split squat isometric' },
  hip_flexor_tilt:   { name: 'Hip Flexor Tilt', yq: 'hip flexor posterior pelvic tilt march' },
  se_bridge_march:   { name: 'Shoulder Elevated Bridge March', yq: 'shoulder elevated glute bridge march' },
  long_dur_jump:     { name: 'Long Duration Jump', yq: 'long duration isometric jump hold' },
  ind_toe_raise:     { name: 'Independent Toe Raises', yq: 'independent toe raises foot strengthening' },
  breathing_711:     { name: 'Seven Eleven Breathing', note: 'Inhale 7s, exhale 11s — downregulation', yq: '7-11 breathing technique' },
  static_stretch:    { name: 'Optional Static Stretch', yq: 'post workout static stretching legs' },
  // --- Phase 1 core ---
  rocking_deadbug:   { name: 'Rocking Deadbug' },
  ham_floss:         { name: 'Hamstring Floss', yq: 'hamstring floss nerve glide' },
  rocking_plank:     { name: 'Rocking Plank' },
  hip_car:           { name: 'Standing Hip CAR', yq: 'standing hip controlled articular rotation' },
  side_plank:        { name: 'Side Plank / Modified Side Plank' },
  reach_through:     { name: 'Reach Through Turn', yq: 'reach through thoracic rotation' },
  oh_deep_squat:     { name: 'Overhead Deep Squat Progression', yq: 'overhead deep squat mobility progression' },
  // --- Phase 2 plyo ---
  sd_lat_push:       { name: 'Speed Drop Lateral Push', yq: 'speed drop lateral push jump drill' },
  angle_bounds:      { name: 'Angle Bounds', yq: 'angled bounds plyometric' },
  penult_jumps:      { name: 'Penultimate Jumps', yq: 'penultimate step jump volleyball' },
  tf_max_touch:      { name: 'Two Foot Max Approach Touch', yq: 'two foot approach jump max touch volleyball' },
  power_skip:        { name: 'Power Skip' },
  sl_ecc_stepdown:   { name: 'Single Leg Eccentric Box Step Down', yq: 'single leg eccentric step down' },
  reverse_plank:     { name: 'Bodyweight Reverse Plank' },
  splank_abd:        { name: 'Side Plank Hip Abduction' },
  // --- Phase 3 plyo ---
  sd_of_jump:        { name: 'Speed Drop One Foot Jump', yq: 'speed drop single leg jump' },
  accel_jump:        { name: 'Acceleration Jump Start', yq: 'acceleration jump start drill' },
  freestyle_jump:    { name: 'Freestyle Jumping', note: 'Cap: 40–50 ground contacts per 10-min block. Once you hit the cap, stop.', yq: 'freestyle jumping practice vertical jump' },
  drach_jumps:       { name: 'Drach Jumps', yq: 'drach jumps plyometric' },
  osc_rfess:         { name: 'Oscillating RFESS', yq: 'oscillating rear foot elevated split squat' },
  ham_chair_hold:    { name: 'Hamstring Chair Holds', yq: 'hamstring chair hold isometric' },
  achilles_spring:   { name: 'Achilles Spring', yq: 'achilles spring ankle stiffness pogo' },
  penult_hurdle:     { name: 'Penultimate Hurdle Jumps', yq: 'penultimate hurdle jump volleyball' },
  of_max_approach:   { name: 'One Foot Max Approach', yq: 'one foot approach jump volleyball' },
  // --- Phase 3 core ---
  hand_walkout:      { name: 'Hand Walk Out', yq: 'hand walkout inchworm' },
  kneel_hip_mob:     { name: 'Kneeling Hip Mobility' },
  leg_climb:         { name: 'Leg Climb', yq: 'leg climb core exercise' },
  add_stretch:       { name: 'Adductor Stretch' },
  side_plank_p3:     { name: 'Side Plank' },
  hip_9090:          { name: '90/90 Hip Opener' },
  leg_lowers:        { name: 'Leg Lowers' },
  elastic_kicks:     { name: 'Elastic Leg Kicks', yq: 'elastic band leg kicks' },
  // --- Phase 4 plyo ---
  free_agility:      { name: 'Freestyle Agility', yq: 'freestyle agility footwork drill' },
  lb_of_jump:        { name: 'Lateral Bound One Foot Jump', yq: 'lateral bound into single leg jump' },
  consec_hurdle:     { name: 'Consecutive Hurdle Jump' },
  prog_bounding:     { name: 'Progressive Bounding Series', yq: 'progressive bounding series plyometric' },
  ot_drop_jump:      { name: 'One Two Drop Jump', yq: 'one two drop jump plyometric' },
  versatile_jump:    { name: 'Versatile Jump Drill', yq: 'versatile jump drill multi directional' },
  bof_ol_turn:       { name: 'Ball of Foot One Leg Turn', yq: 'ball of foot single leg turn balance' },
  // --- Phase 4 core ---
  roll_cross_touch:  { name: 'Rolling Cross Touch', yq: 'rolling cross touch core' },
  cross_touch_ext:   { name: 'Cross Touch Extension', yq: 'cross touch extension core' },
  pnf_vsit:          { name: 'PNF V Sit', yq: 'pnf v sit stretch' },
  knee_hug:          { name: 'Knee Hug' },
  lb_angels:         { name: 'Lower Back Angels', yq: 'lower back angels exercise' },
  supine_kickover:   { name: 'Supine Kick Over', yq: 'supine kick over mobility' },
  // --- Cardio ---
  incline_walk:      { name: 'Incline Walk', note: '7% incline · 4.5 km/h · treadmill', yq: 'incline treadmill walking benefits' },
};

// ---------------------------------------------------------------------------
// Prescription helpers.
// Schemes:  sr(sets, reps)  time(sets, secs)  wuws(wu, ws)
// Item: { ex, sch, rest?, note?, opt?, ss? (superset group), counter? }
// ---------------------------------------------------------------------------
const sr   = (sets, reps) => ({ t: 'sr', sets, reps });
const time = (sets, secs) => ({ t: 'time', sets, secs });
const wuws = (wu, ws)     => ({ t: 'wuws', wu, ws });
const it = (ex, sch, rest, extra) => ({ ex, sch, rest: rest ?? 0, ...(extra || {}) });

export const fmtSecs = (s) => {
  const m = Math.floor(s / 60), r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `0:${String(r).padStart(2, '0')}`;
};

// ---------------------------------------------------------------------------
// Shared building blocks (consistent across all 15 weeks)
// ---------------------------------------------------------------------------
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
    it('leg_press', wuws(2, 2), 90),
    it('hip_thrust', wuws(2, 2), 90),
  ],
});
const day3Accessories = () => ({
  title: 'Accessories — after plyo, before cardio', tag: 'strength', items: [
    it('nordics', wuws(2, 2), 90),
    it('calf_raise', wuws(2, 2), 90),
  ],
});

const cardioSection = () => ({
  title: 'Cardio', tag: 'cardio', items: [
    it('incline_walk', time(1, 1800)),
  ],
});

// ---------------------------------------------------------------------------
// Phase 1 (weeks 1–4)
// ---------------------------------------------------------------------------
const p1Plyo = () => ({
  title: 'Lower Body Plyo', tag: 'plyo', items: [
    it('dyn_warmup', sr(1, 1)),
    it('mech_primer', sr(2, 4), 30),
    it('ol_speed_drop', sr(2, 6), 30),
    it('rapid_decel', sr(2, 6), 45),
    it('lat_bounds', sr(3, 6), 60),
    it('standing_jump', sr(3, 6), 60),
    it('rfess_iso', sr(3, 3), 0, { ss: 'rfess_hft', note: 'Superset with Hip Flexor Tilt' }),
    it('hip_flexor_tilt', sr(3, 4), 60, { ss: 'rfess_hft' }),
    it('se_bridge_march', sr(3, 5), 60),
    it('long_dur_jump', time(3, 30), 90, { note: 'Hold position' }),
    it('ind_toe_raise', sr(3, 8), 45),
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

// ---------------------------------------------------------------------------
// Phase 2 (weeks 5–6). Week 5 = 2-set familiarization, week 6 = full sets.
// ---------------------------------------------------------------------------
const p2Plyo = (full) => ({
  title: 'Lower Body Plyo', tag: 'plyo', items: [
    it('dyn_warmup', sr(1, 1)),
    it('sd_lat_push', sr(full ? 3 : 2, 4), 45),
    it('angle_bounds', sr(full ? 3 : 2, 4), 60),
    it('penult_jumps', sr(full ? 3 : 2, 3), 60),
    it('tf_max_touch', sr(full ? 3 : 2, 2), 60),
    it('power_skip', sr(full ? 3 : 2, 8), 60),
    it('sl_ecc_stepdown', sr(full ? 3 : 2, 10), 60),
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

// ---------------------------------------------------------------------------
// Phase 3 (weeks 8–11). Type A = Day 3, Type B = Day 1.
// Per-week columns from the tables. w = 8..11 (index 0..3).
// ---------------------------------------------------------------------------
const p3Common = (i) => [
  it('dyn_warmup', sr(1, 1)),
  it('sd_of_jump', sr(3, [4, 5, 6, 7][i]), 60),
  it('accel_jump', sr(2, [3, 4, 5, 6][i]), 45),
];
const p3Tail = (i) => [
  it('osc_rfess', time([3, 3, 3, 4][i], [30, 40, 50, 50][i]), 60),
  it('ham_chair_hold', sr(3, [6, 7, 8, 9][i]), 60),
  it('achilles_spring', sr(3, [7, 8, 9, 10][i]), 60),
  it('breathing_711', time(1, 180)),
  it('static_stretch', time(1, 15), 0, { opt: true }),
];

const p3TypeA = (week) => {
  const i = week - 8;
  const items = [
    ...p3Common(i),
    it('freestyle_jump', time(i >= 2 ? 2 : 1, 600), 120, { counter: { warn: 40, cap: 50 } }),
    // Drach Jumps drop from Type A in weeks 10–11 (— in the source table)
    ...(i <= 1 ? [it('drach_jumps', sr(3, [4, 5][i]), 60)] : []),
    ...p3Tail(i),
  ];
  return { title: 'Lower Body Plyo — Type A', tag: 'plyo', items };
};

const p3TypeB = (week) => {
  const i = week - 8;
  const items = [
    ...p3Common(i),
    it('penult_hurdle', sr(3, [2, 3, 3, 3][i]), 90),
    it('of_max_approach', sr(4, [2, 3, 4, 4][i]), 60),
    // Drach Jumps remain in Type B all weeks (held at week-9 volume for 10–11)
    it('drach_jumps', sr(3, [4, 5, 5, 5][i]), 60, i >= 2 ? { note: 'Held at Week 9 volume (remains in Type B all weeks)' } : undefined),
    ...p3Tail(i),
  ];
  return { title: 'Lower Body Plyo — Type B', tag: 'plyo', items };
};

const p3Core = (week) => {
  const i = week - 8;
  return { title: 'Core & Mobility', tag: 'core', items: [
    it('hand_walkout', sr(3, [5, 6, 7, 8][i])),
    it('kneel_hip_mob', sr(3, 4), 30),
    it('leg_climb', sr(3, [5, 6, 7, 7][i])),
    it('add_stretch', sr(3, 5), 30),
    it('side_plank_p3', time(3, [35, 35, 40, 40][i])),
    it('hip_9090', sr(3, 4), 30),
    it('leg_lowers', sr(3, [8, 9, 10, 11][i])),
    it('elastic_kicks', sr(3, 10), 30),
  ]};
};

// ---------------------------------------------------------------------------
// Phase 4 (weeks 12–15). Week 12 = deload/familiarization at 1 set.
// Both plyo days identical. w13..15 → index 0..2; week 12 uses wk13 reps @ 1 set.
// ---------------------------------------------------------------------------
const p4Plyo = (week) => {
  const deload = week === 12;
  const i = deload ? 0 : week - 13;
  const S = (n) => (deload ? 1 : n); // sets
  return { title: 'Lower Body Plyo', tag: 'plyo', items: [
    it('dyn_warmup', sr(1, 1)),
    it('free_agility', time(S(4), [25, 30, 40][i]), week >= 15 ? 60 : 45),
    it('lb_of_jump', sr(S(3), [4, 4, 5][i])),
    it('consec_hurdle', sr(S(6), [3, 3, 4][i])),
    it('prog_bounding', sr(S(2), 1), 120),
    it('ot_drop_jump', sr(S(4), [3, 4, 4][i])),
    it('versatile_jump', sr(S(3), [2, 3, 3][i])),
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
    it('roll_cross_touch', sr(S(3), [2, 3, 4][i])),
    it('oh_deep_squat', sr(S(3), 3), 30),
    it('cross_touch_ext', sr(S(3), [4, 4, 6][i])),
    it('pnf_vsit', sr(S(3), 3), 30),
    it('leg_lowers', sr(S(3), [10, 10, 12][i])),
    it('knee_hug', sr(S(3), 5), 30),
    it('lb_angels', time(S(3), [25, 25, 30][i])),
    it('supine_kickover', sr(S(3), 10), 30),
  ]};
};

// ---------------------------------------------------------------------------
// Volume transforms
// ---------------------------------------------------------------------------
function capSets(section, cap) {
  return { ...section, items: section.items.map((item) => {
    const sch = { ...item.sch };
    if (sch.t === 'sr' || sch.t === 'time') sch.sets = Math.min(sch.sets, cap);
    else if (sch.t === 'wuws') { sch.wu = Math.min(sch.wu, cap === 1 ? 1 : sch.wu); sch.ws = Math.min(sch.ws, cap); }
    return { ...item, sch };
  })};
}
const deloadSections = (sections) => sections.map((s) => s.tag === 'cardio' ? s : capSets(s, 1));

// ---------------------------------------------------------------------------
// Phases & week metadata
// ---------------------------------------------------------------------------
export const PHASES = [
  { n: 1, weeks: [1, 4],  name: 'Phase 1 — Foundation',   color: 'var(--ph1)' },
  { n: 2, weeks: [5, 6],  name: 'Phase 2 — Build',        color: 'var(--ph2)' },
  { n: 3, weeks: [7, 11], name: 'Phase 3 — Power',        color: 'var(--ph3)' },
  { n: 4, weeks: [12, 15],name: 'Phase 4 — Peak',         color: 'var(--ph4)' },
];
export const phaseOf = (week) => PHASES.find((p) => week >= p.weeks[0] && week <= p.weeks[1]);

export const WEEK_BADGES = {
  1: 'Volume ramp — 1 set of everything this week',
  2: 'Volume ramp — 2 sets of everything this week',
  5: 'Familiarization — 2 sets, learn the new movements',
  6: 'Full sets — hold Week 5 reps',
  7: 'FULL DELOAD — every session at 1 set, reduced intensity. Cardio continues as normal.',
  12: 'DELOAD / FAMILIARIZATION — all Phase 4 movements at 1 set only. Learn the new patterns at low volume. Cardio continues.',
};

export const DAY_NAMES = ['Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Monday', 'Tuesday'];

// ---------------------------------------------------------------------------
// Week resolver — getWeek(n) → { week, phase, badge, days: [ {d, name, title,
//   rest, sections, cardio} x7 ] }
// ---------------------------------------------------------------------------
function plyoFor(week, dayNum) {
  // dayNum 1 or 3
  if (week <= 4) {
    const s = p1Plyo();
    return week <= 2 ? capSets(s, week) : s;
  }
  if (week === 5) return p2Plyo(false);
  if (week === 6) return p2Plyo(true);
  if (week === 7) return capSets(p2Plyo(true), 1); // deload on known Phase-2 movements
  if (week <= 11) return dayNum === 1 ? p3TypeB(week) : p3TypeA(week);
  return p4Plyo(week);
}

function coreFor(week) {
  if (week <= 4) {
    const s = p1Core();
    return week <= 2 ? capSets(s, week) : s;
  }
  if (week <= 6) return p2Core();
  if (week === 7) return capSets(p2Core(), 1);
  if (week <= 11) return p3Core(week);
  return p4Core(week);
}

const cache = new Map();
export function getWeek(week) {
  if (cache.has(week)) return cache.get(week);
  const deload7 = week === 7;
  const d = (sections) => (deload7 ? deloadSections(sections) : sections);
  const plyoLabel = (n) => week >= 8 && week <= 11 ? (n === 1 ? 'Plyo Type B' : 'Plyo Type A') : 'Lower Body Plyo';

  const days = [
    { d: 1, title: `${plyoLabel(1)} + Leg Press & Hip Thrust`, kind: 'plyo',
      sections: d([plyoFor(week, 1), day1Accessories(), cardioSection()]) },
    { d: 2, title: 'Push Upper Body → Core & Mobility', kind: 'upper',
      sections: d([...pushDay(), coreFor(week), cardioSection()]) },
    { d: 3, title: `${plyoLabel(3)} + Nordics & Calf Raises`, kind: 'plyo',
      sections: d([plyoFor(week, 3), day3Accessories(), cardioSection()]) },
    { d: 4, title: 'Pull Upper Body → Core & Mobility', kind: 'upper',
      sections: d([...pullDay(), coreFor(week), cardioSection()]) },
    { d: 5, title: 'Rest + Cardio', kind: 'rest',
      sections: [cardioSection()] },
    { d: 6, title: 'Strength Day', kind: 'strength',
      sections: d([...strengthDay(), cardioSection()]) },
    { d: 7, title: 'Full Rest', kind: 'off', sections: [] },
  ].map((day) => ({ ...day, name: DAY_NAMES[day.d - 1], week, id: `w${week}d${day.d}` }));

  const result = { week, phase: phaseOf(week), badge: WEEK_BADGES[week] || null, days };
  cache.set(week, result);
  return result;
}

export function getDay(id) {
  const m = /^w(\d+)d([1-7])$/.exec(id);
  if (!m) return null;
  const week = +m[1];
  if (week < 1 || week > 15) return null;
  return getWeek(week).days[+m[2] - 1];
}

export const allDayIds = () => {
  const ids = [];
  for (let w = 1; w <= 15; w++) for (let d = 1; d <= 7; d++) ids.push(`w${w}d${d}`);
  return ids;
};

// Number of tickable "sets" in a scheme (for progress + set circles)
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

// Flat list of exercise instances for a day (for completion math)
export function dayExercises(day) {
  const out = [];
  day.sections.forEach((sec, si) => sec.items.forEach((item, ii) => {
    out.push({ key: `s${si}i${ii}`, section: sec, item, sets: schemeSets(item.sch) });
  }));
  return out;
}

// ---------------------------------------------------------------------------
// Meta: nutrition + program notes (rendered in Program view / sheets)
// ---------------------------------------------------------------------------
export const NUTRITION = [
  ['Calories', '2,500 / day'],
  ['Protein', '180–200 g / day'],
  ['Creatine', '5 g / day (maintenance)'],
  ['Omega-3', 'Continue current dose'],
  ['Ashwagandha', 'Continue current dose'],
  ['Magnesium Glycinate', 'Continue current dose'],
];

export const PROGRAM_NOTES = [
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
];

export const ytUrl = (exId) => {
  const ex = EX[exId];
  const q = ex.yq || `${ex.name} exercise how to`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
};
