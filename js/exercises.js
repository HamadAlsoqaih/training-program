// ============================================================================
// exercises.js — shared exercise catalog for all programs.
//   log:   weight/reps logging is meaningful (all rep-based items allow it now)
//   band:  band exercise → can be toggled to a cable variant for a day
//   noload: protocol item (warm-up, breathing, stretch) → no weight/reps boxes
//   note:  technique cue shown on the card
//   yq:    YouTube search query override
//   mux:   Mux playback id → in-app HLS video
// ============================================================================

export const EX = {
  // --- Shoulder band warm-up ---
  sa_pulldown:       { name: 'Straight-Arm Pulldown', band: true },
  cb_sa_pulldown:    { name: 'Cross-Body Straight-Arm Pulldown', band: true, yq: 'cross body straight arm pulldown band' },
  band_er:           { name: 'Band External Rotation', band: true },
  band_ir:           { name: 'Band Internal Rotation', band: true },
  band_pullapart:    { name: 'Band Pull-Apart', band: true },
  oh_pullapart:      { name: 'Overhead Band Pull-Apart', band: true },
  spike_pull:        { name: 'Band Straight-Arm Spike Pull', band: true, note: 'High anchor', yq: 'band straight arm pulldown high anchor volleyball spike' },
  oh_iso_hold:       { name: 'Band Overhead Iso Hold', band: true, note: 'Resist backward pull — timed hold', yq: 'band overhead isometric hold shoulder' },
  // --- Rehab ---
  bu_kb_press:       { name: 'Bottoms-Up KB Press', yq: 'bottoms up kettlebell press' },
  bu_kb_hold:        { name: 'Bottoms-Up KB Anti-Rotation Hold', yq: 'bottoms up kettlebell anti rotation hold' },
  kb_bu_walk:        { name: 'KB Bottoms-Up Walk', yq: 'bottoms up kettlebell carry walk' },
  steering_wheels:   { name: 'Plate Steering Wheels', yq: 'plate steering wheel exercise' },
  wall_slide:        { name: 'Banded Wall Slide / Y-Raise', band: true, yq: 'banded wall slide y raise shoulder' },
  wall_clock:        { name: 'Banded Wall Plank Clock Reach', band: true, yq: 'wall plank clock reach shoulder stability' },
  scap_pushup:       { name: 'Scapular Push-Up' },
  // --- Push strength ---
  lateral_raise:     { name: 'Lateral Raise' },
  banded_complex:    { name: 'Banded Complex (Row → ER → Press)', band: true, yq: 'band row external rotation press complex shoulder' },
  chest_press:       { name: 'Chest Press' },
  pushup:            { name: 'Push-Up' },
  pec_deck:          { name: 'Pec Deck Fly' },
  // --- Pull strength ---
  low_row:           { name: 'Low Cable Row' },
  mid_row:           { name: 'Mid Cable Row' },
  face_pull:         { name: 'Face Pull' },
  bo_sa_raise:       { name: 'Bent-Over Straight-Arm Raise', yq: 'bent over straight arm rear delt raise' },
  seated_row:        { name: 'Seated Cable Row' },
  // --- Arms ---
  triceps:           { name: 'Triceps (exercise of choice)', yq: 'best triceps cable exercises' },
  biceps:            { name: 'Biceps (exercise of choice)', yq: 'best biceps exercises' },
  // --- Strength day / accessories ---
  squat:             { name: 'Squat', note: 'Belt / goblet / back — per PT clearance for your shoulder', yq: 'belt squat goblet squat tutorial' },
  nordics:           { name: 'Nordics', note: 'Slow 3–5 sec eccentric. Progress range of motion before adding load.', yq: 'nordic hamstring curl' },
  leg_ext:           { name: 'Leg Extension' },
  ham_curl:          { name: 'Hamstring Curl' },
  adduction:         { name: 'Adduction (machine)', yq: 'hip adduction machine' },
  abduction:         { name: 'Abduction (machine)', yq: 'hip abduction machine' },
  tibia_raise:       { name: 'Tibia Raises', yq: 'tibialis raise' },
  calf_raise:        { name: 'Calf Raises', note: '3s up / 3s down tempo' },
  hip_thrust:        { name: 'Hip Thrust' },
  leg_press:         { name: 'Leg Press' },
  volleyball:        { name: 'Volleyball Wall Practice', noload: true, note: 'Optional — skip if fatigued', yq: 'volleyball wall drills' },
  // --- Plyo & mobility (shared) ---
  dyn_warmup:        { name: 'Dynamic Warmup', noload: true, mux: 'utOMUhIP00T2TThrZmeV3jkrhlufCNd3TxcJrOv7rXcQ', yq: 'dynamic warm up routine jumping athletes' },
  mech_primer:       { name: 'Mechanics Primer', noload: true, mux: 'SHdiVJT47xeY0122f9GCHu01cSzQhTrygzkoWOgK6kcnE', yq: 'jump mechanics primer drill' },
  ol_speed_drop:     { name: 'One Leg Speed Drop Stick', mux: '5QTKLKPEknTlbppgKJUBYR3FzynKG4014RfB2orXFoPY', yq: 'single leg drop stick landing drill' },
  rapid_decel:       { name: 'Rapid Deceleration', mux: 'T02jtc200dB6I3fbVnn5l7viDxOuLRj87dmlG6oPojqfM', yq: 'rapid deceleration drill jumping' },
  lat_bounds:        { name: 'Lateral Bounds', mux: 'ax3KRxnL201e01C533abD3VH9aZU9fPnXAC7JWXr02R3aY' },
  standing_jump:     { name: 'Standing Jump', mux: 'De2602Ug01dfpFev8Q02k5X02UjUytNuaaP02TNTvhygaMes', yq: 'standing vertical jump technique' },
  rfess_iso:         { name: 'RFESS Iso Reps', mux: 'r9ejPw3T00gln0102bZQOqvyHwRbb2JkoubaCKDtTS691I', yq: 'rear foot elevated split squat isometric' },
  hip_flexor_tilt:   { name: 'Hip Flexor Tilt', mux: 'iM00rRZm01edd5O1DkBrkAgLD9JxI00O6p4KgVM6JMyg01A', yq: 'hip flexor posterior pelvic tilt march' },
  se_bridge_march:   { name: 'Shoulder Elevated Bridge March', mux: '6i01X2XHCMFdZ8oaplsFLCvIYKWgnowl4BQiYVhnWDZg', yq: 'shoulder elevated glute bridge march' },
  long_dur_jump:     { name: 'Long Duration Jump', mux: 'yQDtzOBYloS3I7w00BgQvzifi5ixMYlgaM72btrweQBs', yq: 'long duration isometric jump hold' },
  ind_toe_raise:     { name: 'Independent Toe Raises', mux: 'Fw2264TN8abYNJLyi44Oz84xteFf3k1TEABa01GZ4IiU', yq: 'independent toe raises foot strengthening' },
  breathing_711:     { name: 'Seven Eleven Breathing', noload: true, mux: 'A016oO5X2bKU36yjKainkq5mQZvGbpZ24vVp5KJ6cSv8', note: 'Inhale 7s, exhale 11s — downregulation', yq: '7-11 breathing technique' },
  static_stretch:    { name: 'Optional Static Stretch', noload: true, mux: 'Mm3qcXeRkfhvaQvtFdBmeGS4ZYbe954M01L01u4vD9qpo', yq: 'post workout static stretching legs' },
  deload:            { name: 'Deload — light movement only', noload: true, mux: 'lsclEyBDc9tY02QeFyDUcrO7JnZcxG701969L9dypNRWs', note: 'No plyo, no accessories. Keep it easy.' },
  // --- Core (phase 1/2 style) ---
  rocking_deadbug:   { name: 'Rocking Deadbug', mux: 'LLuVZ01bvzvkrT0100x800u01INr9a3D6VNcDibRBvs5opr00' },
  ham_floss:         { name: 'Hamstring Floss', mux: 'mIMx2e2svIQ4sv9JVlfQ7V3tdIq00NojrIRTYDhqAIMA', yq: 'hamstring floss nerve glide' },
  rocking_plank:     { name: 'Rocking Plank', mux: 'tKwy7ee02Ef9sb9Jh166SyduApKHKGjrPuypau4advjg' },
  hip_car:           { name: 'Standing Hip CAR', mux: '5dD01Slvv7VScfIijWeauXdggt8StsnGyIQV00DCX6mHo', yq: 'standing hip controlled articular rotation' },
  side_plank:        { name: 'Side Plank / Modified Side Plank', mux: 's23O02iqEWLOkMls1X3hGctge02eIaqhhUzeeeZgXVNZs' },
  reach_through:     { name: 'Reach Through Turn', mux: '6BaixjdoVwmAh8SOVEei01CQOMlBLn5B9VE4dhN7FQ00M', yq: 'reach through thoracic rotation' },
  oh_deep_squat:     { name: 'Overhead Deep Squat Progression', mux: 'KEl9lM4cE4Z4hL8HbNryTP2SfuB00ljdu5LcV9ejBR1U', yq: 'overhead deep squat mobility progression' },
  // --- Phase 2 plyo ---
  sd_lat_push:       { name: 'Speed Drop Lateral Push', mux: 'Sw02cNwOfhYi8gpNkaDXbZ8YpHQnzgwFQSXGIUhlyjE4', yq: 'speed drop lateral push jump drill' },
  angle_bounds:      { name: 'Angle Bounds', mux: 'O2UlESm6IwmEadIHM5pCJg001omN46rRkCRJ01qMDDIuo', yq: 'angled bounds plyometric' },
  penult_jumps:      { name: 'Penultimate Jumps', mux: 'zMiBBjABiYk00G02mSHPovc01e6pYC01Gh8AWcXdhTT4kBk', yq: 'penultimate step jump volleyball' },
  tf_max_touch:      { name: 'Two Foot Max Approach Touch', mux: 'xUcch00qzk8kP6dkZBz7BD7FbZOVNJLio7tQ7gv3Hyi8', yq: 'two foot approach jump max touch volleyball' },
  power_skip:        { name: 'Power Skip', mux: 'jV5mGMC01ARFoqsMERt5KA9Kin00f8RF7i71mxPsdE4wU' },
  sl_ecc_stepdown:   { name: 'Single Leg Eccentric Box Step Down', mux: 'WQKZSUJnrkv8jZ3hjSGC5o3ydtzIlIxAS93xJW42xbo', yq: 'single leg eccentric step down' },
  reverse_plank:     { name: 'Bodyweight Reverse Plank', mux: 'Y8vV00q9eNqx00ABwCvlTAPR01VWuf5t5op00DUKlIWt63k' },
  splank_abd:        { name: 'Side Plank Hip Abduction', mux: 'tD8DGuIUTGLYgMqEogqPdzHTm00FJk01X02hJpcpeTdCpw' },
  // --- Phase 3 plyo ---
  sd_of_jump:        { name: 'Speed Drop One Foot Jump', mux: 'sScjUtISVkm5Qq577PFvhYoTaoSfjrRoyZh9g7LiwhU', yq: 'speed drop single leg jump' },
  accel_jump:        { name: 'Acceleration Jump Start', mux: 'q02IUuFkGZJgyMXC01je5H00FGgD00DMa84hUJ4DMj2JQ6s', yq: 'acceleration jump start drill' },
  freestyle_jump:    { name: 'Freestyle Jumping', mux: 'ntZf1IZ7Ud02CVAxagLOZyD00yhxpmyzRJJOvZ2x01tSmA', note: 'Cap: 40–50 ground contacts per 10-min block. Once you hit the cap, stop.', yq: 'freestyle jumping practice vertical jump' },
  drach_jumps:       { name: 'Drach Jumps', mux: 'S8Lo02kDBGZ02pqGjSAYHYY1slcxryk0001pc3UIvShK023c', yq: 'drach jumps plyometric' },
  osc_rfess:         { name: 'Oscillating RFESS', mux: 'dmoTQynXEkNpfots01h2vRaZGfzOv9XWNmdYZ2DKQIdY', yq: 'oscillating rear foot elevated split squat' },
  ham_chair_hold:    { name: 'Hamstring Chair Alternating Holds', mux: 'LyYLqDq01i4p4zsm8SycjrNL00eIXkcjj01NyXD02ITO005I', yq: 'hamstring chair hold isometric' },
  achilles_spring:   { name: 'Achilles Spring', mux: 'f2AV600W7M00sd95Zq7mzmpdntdLptpOBtyr95h6T1uH4', yq: 'achilles spring ankle stiffness pogo' },
  penult_hurdle:     { name: 'Penultimate Hurdle Jumps', mux: '600sBgfNFKeD64sNuRisfs9600rnmSRClB5G5rnH5GKsw', yq: 'penultimate hurdle jump volleyball' },
  of_max_approach:   { name: 'One Foot Max Approach', mux: '00UXQxGovjc1BiYnEWcp22Y4rrdcu6Ay8aZhDyRkGuBs', yq: 'one foot approach jump volleyball' },
  // --- Phase 3 core ---
  hand_walkout:      { name: 'Hand Walk Out', mux: 'V017G1xHi2Qv901Us6rZvoYlcJkC00kFU3r01RtGgv302P3g', yq: 'hand walkout inchworm' },
  kneel_hip_mob:     { name: 'Kneeling Hip Mobility', mux: 'ctfvB5r7pM6AiwqFjmvHAE3MhPGUvatjSZ4DGclvM6Y' },
  leg_climb:         { name: 'Leg Climb', mux: 'HwEh28HdHVpCVy649w3eknw02NVYl3an01lpA00vbeejtQ', yq: 'leg climb core exercise' },
  add_stretch:       { name: 'Adductor Stretch', mux: '3EGmn1PB9a7GRFQR14kBlrki3DocY5EfQQSEQSe71eo' },
  side_plank_p3:     { name: 'Side Plank', mux: 's23O02iqEWLOkMls1X3hGctge02eIaqhhUzeeeZgXVNZs' },
  hip_9090:          { name: '90/90 Hip Opener', mux: 'CgxlUZatd2QLlPtJJxtsKfy8Qp7gwFWUcPuAZN8u2es' },
  leg_lowers:        { name: 'Leg Lowers', mux: 'uV7brmpIrV9UFl9PCHfAp8FoORVkWsaLnGbqqetwtYw' },
  elastic_kicks:     { name: 'Elastic Leg Kicks', mux: 'HrlGfwtsoLvGiKZmV3102otWBt3RMfKJSACmBAPfcyu8', band: true, yq: 'elastic band leg kicks' },
  // --- Phase 4 plyo ---
  free_agility:      { name: 'Freestyle Agility', mux: 'hqrU1zRQhUGuDpQM6lKTWOoJLutK4PuQQpGr6wp017BY', yq: 'freestyle agility footwork drill' },
  lb_of_jump:        { name: 'Lateral Bound One Foot Jump', mux: 'z1EWY5POXKXs01GXsaxx00f178jCgR5iXptY85sTkhzsA', yq: 'lateral bound into single leg jump' },
  consec_hurdle:     { name: 'Consecutive Hurdle Jump', mux: 's9h2rsTVogvN4fldjwn7wJRPemI00INSiqpdmzoZ8rlU' },
  prog_bounding:     { name: 'Progressive Bounding Series', mux: 'oGcoOww00T85e1xc9Y25FYqhNH01yXndt7gRn9OK00yUhY', yq: 'progressive bounding series plyometric' },
  ot_drop_jump:      { name: 'One Two Drop Jump', mux: 'Q6zAd2WMR502fXFRv7Uja6HiX00yZ2wIBX4PG2F3cUYzA', yq: 'one two drop jump plyometric' },
  versatile_jump:    { name: 'Versatile Jump Drill', mux: 'WenHJgAjL007dPecmwmNVg0080202o397bFYZ00B5O024KrFA', yq: 'versatile jump drill multi directional' },
  bof_ol_turn:       { name: 'Ball of the Foot One Leg Turn', mux: 'soPWVDAjYb2WVvlRlwaiJPVJRcf3cleNsyYwSnC5qhQ', yq: 'ball of foot single leg turn balance' },
  // --- Phase 4 core ---
  roll_cross_touch:  { name: 'Rolling Cross Touch', mux: 'VQW8FNkLtyIxtvcA45HZADC3UU01k2Tz5WXDJiY00BBuk', yq: 'rolling cross touch core' },
  cross_touch_ext:   { name: 'Cross Touch Extension', mux: 'aixWoSlf9Q5PSJ004dmf72XwQvryNXyC4wHxgCL2CqF8', yq: 'cross touch extension core' },
  pnf_vsit:          { name: 'PNF V Sit', mux: 'dPyzSSMArXP55dectuXssEuvihjXKSIQ6kYkIdmk00ao', yq: 'pnf v sit stretch' },
  knee_hug:          { name: 'Knee Hug', mux: 'Qj2WyHoUKwBd6G99lFv8beXOdtT3f01LqEjEhAV701khw' },
  lb_angels:         { name: 'Lower Back Angels', mux: 'PJEZR3YiVmGjwzomjD1mEf00CA15aLU028zeZOluXztec', yq: 'lower back angels exercise' },
  supine_kickover:   { name: 'Supine Kick Over', mux: 'qEV9LkskTTmA8vy00ZQQE85UZ01nZkYeDu029o9J1uk301g', yq: 'supine kick over mobility' },
  // --- Cardio ---
  incline_walk:      { name: 'Incline Walk', note: '7% incline · 4.5 km/h · treadmill', yq: 'incline treadmill walking benefits' },
};

export const hasVideo = (exId) => !!EX[exId]?.mux;
export const muxHls = (exId) => `https://stream.mux.com/${EX[exId].mux}.m3u8`;
export const muxPoster = (exId, w = 640) =>
  `https://image.mux.com/${EX[exId].mux}/thumbnail.jpg?width=${w}&fit_mode=preserve`;

export const ytUrl = (exId) => {
  const ex = EX[exId];
  const q = ex.yq || `${ex.name} exercise how to`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
};

// Band exercises can be swapped to a cable variant for a single day.
export const cableName = (exId) => EX[exId].name.replace(/^Band(ed)?\s+/i, '').replace(/\bBand\b/gi, 'Cable');
export const displayName = (exId, mode) =>
  mode === 'cable' ? `${cableName(exId)} (cable)` : EX[exId].name;
