// Fidelity spot-checks: resolved program vs hand-transcribed source tables.
// Run: node tests/fidelity.mjs
import { getWeek, getDay, EX, schemeLabel, dayExercises } from '../js/program.js';

let fails = 0;
const eq = (label, actual, expected) => {
  if (actual !== expected) { fails++; console.error(`FAIL ${label}: got "${actual}", want "${expected}"`); }
};
const find = (day, exId, nth = 0) =>
  dayExercises(day).filter((e) => e.item.ex === exId)[nth] || null;
const sch = (day, exId, nth = 0) => {
  const f = find(day, exId, nth);
  return f ? schemeLabel(f.item.sch) : '(missing)';
};
const rest = (day, exId, nth = 0) => {
  const f = find(day, exId, nth);
  return f ? f.item.rest : -1;
};

// --- Phase 1 ramp ---
eq('wk1 d1 lateral bounds (ramp 1 set)', sch(getDay('w1d1'), 'lat_bounds'), '1×6');
eq('wk2 d3 lateral bounds (ramp 2 sets)', sch(getDay('w2d3'), 'lat_bounds'), '2×6');
eq('wk3 d1 lateral bounds (full)', sch(getDay('w3d1'), 'lat_bounds'), '3×6');
eq('wk4 d1 long duration jump', sch(getDay('w4d1'), 'long_dur_jump'), '3×0:30');
eq('wk1 d2 rocking deadbug (ramp)', sch(getDay('w1d2'), 'rocking_deadbug'), '1×8');
eq('wk3 d2 rocking deadbug (full)', sch(getDay('w3d2'), 'rocking_deadbug'), '3×8');
eq('wk3 d1 mechanics primer rest', rest(getDay('w3d1'), 'mech_primer'), 30);
eq('wk3 d1 rapid decel rest', rest(getDay('w3d1'), 'rapid_decel'), 45);

// --- Phase 2 ---
eq('wk5 d1 speed drop lateral push', sch(getDay('w5d1'), 'sd_lat_push'), '2×4');
eq('wk6 d1 speed drop lateral push', sch(getDay('w6d1'), 'sd_lat_push'), '3×4');
eq('wk5 d3 long duration jump', sch(getDay('w5d3'), 'long_dur_jump'), '2×0:40');
eq('wk6 d3 long duration jump', sch(getDay('w6d3'), 'long_dur_jump'), '3×0:40');
eq('wk5 d2 rocking plank', sch(getDay('w5d2'), 'rocking_plank'), '3×0:35');
eq('wk6 d4 side plank hip abduction', sch(getDay('w6d4'), 'splank_abd'), '3×8');

// --- Week 7 full deload: 1 set everywhere ---
eq('wk7 d1 power skip (deload)', sch(getDay('w7d1'), 'power_skip'), '1×8');
eq('wk7 d2 pushup (deload)', sch(getDay('w7d2'), 'pushup'), '1×10');
eq('wk7 d6 squat (deload)', sch(getDay('w7d6'), 'squat'), '1 WU + 1 WS');
eq('wk7 d2 rocking deadbug (deload)', sch(getDay('w7d2'), 'rocking_deadbug'), '1×10');

// --- Phase 3 Type A (Day 3) ---
eq('wk8 d3 speed drop one foot jump', sch(getDay('w8d3'), 'sd_of_jump'), '3×4');
eq('wk11 d3 speed drop one foot jump', sch(getDay('w11d3'), 'sd_of_jump'), '3×7');
eq('wk9 d3 drach jumps', sch(getDay('w9d3'), 'drach_jumps'), '3×5');
eq('wk10 d3 drach dropped from Type A', find(getDay('w10d3'), 'drach_jumps'), null);
eq('wk8 d3 freestyle 1 block', sch(getDay('w8d3'), 'freestyle_jump'), '1×10:00');
eq('wk10 d3 freestyle 2 blocks', sch(getDay('w10d3'), 'freestyle_jump'), '2×10:00');
eq('wk9 d3 oscillating RFESS', sch(getDay('w9d3'), 'osc_rfess'), '3×0:40');
eq('wk11 d3 oscillating RFESS', sch(getDay('w11d3'), 'osc_rfess'), '4×0:50');
eq('wk11 d3 achilles spring', sch(getDay('w11d3'), 'achilles_spring'), '3×10');

// --- Phase 3 Type B (Day 1) ---
eq('wk8 d1 penultimate hurdle', sch(getDay('w8d1'), 'penult_hurdle'), '3×2');
eq('wk10 d1 one foot max approach', sch(getDay('w10d1'), 'of_max_approach'), '4×4');
eq('wk8 d1 no freestyle in Type B', find(getDay('w8d1'), 'freestyle_jump'), null);
eq('wk11 d1 drach stays in Type B', sch(getDay('w11d1'), 'drach_jumps'), '3×5');
eq('wk8 d1 penult hurdle rest', rest(getDay('w8d1'), 'penult_hurdle'), 90);

// --- Phase 3 core ---
eq('wk8 d2 hand walk out', sch(getDay('w8d2'), 'hand_walkout'), '3×5');
eq('wk11 d4 hand walk out', sch(getDay('w11d4'), 'hand_walkout'), '3×8');
eq('wk10 d2 side plank', sch(getDay('w10d2'), 'side_plank_p3'), '3×0:40');
eq('wk11 d2 leg lowers', sch(getDay('w11d2'), 'leg_lowers'), '3×11');

// --- Week 12 deload / familiarization ---
eq('wk12 d1 freestyle agility (1 set)', sch(getDay('w12d1'), 'free_agility'), '1×0:25');
eq('wk12 d1 consecutive hurdle (1 set)', sch(getDay('w12d1'), 'consec_hurdle'), '1×3');
eq('wk12 d2 rolling cross touch (1 set)', sch(getDay('w12d2'), 'roll_cross_touch'), '1×2');
eq('wk12 d6 squat (normal in wk12)', sch(getDay('w12d6'), 'squat'), '2 WU + 2 WS');

// --- Phase 4 weeks 13–15, both plyo days identical ---
eq('wk13 d1 freestyle agility', sch(getDay('w13d1'), 'free_agility'), '4×0:25');
eq('wk15 d3 freestyle agility', sch(getDay('w15d3'), 'free_agility'), '4×0:40');
eq('wk15 d1 freestyle agility rest 1:00', rest(getDay('w15d1'), 'free_agility'), 60);
eq('wk14 d1 freestyle agility rest 0:45', rest(getDay('w14d1'), 'free_agility'), 45);
eq('wk14 d3 consecutive hurdle', sch(getDay('w14d3'), 'consec_hurdle'), '6×3');
eq('wk15 d1 consecutive hurdle', sch(getDay('w15d1'), 'consec_hurdle'), '6×4');
eq('wk13 d1 one two drop jump', sch(getDay('w13d1'), 'ot_drop_jump'), '4×3');
eq('wk15 d3 ball of foot one leg turn', sch(getDay('w15d3'), 'bof_ol_turn'), '3×7');
eq('plyo identical d1 vs d3 wk14',
  JSON.stringify(getDay('w14d1').sections[0]), JSON.stringify(getDay('w14d3').sections[0]));

// --- Phase 4 core ---
eq('wk15 d2 cross touch extension', sch(getDay('w15d2'), 'cross_touch_ext'), '3×6');
eq('wk15 d4 lower back angels', sch(getDay('w15d4'), 'lb_angels'), '3×0:30');
eq('wk13 d2 leg lowers', sch(getDay('w13d2'), 'leg_lowers'), '3×10');

// --- Consistent blocks ---
eq('wk9 d6 squat', sch(getDay('w9d6'), 'squat'), '2 WU + 2 WS');
eq('wk9 d6 squat rest', rest(getDay('w9d6'), 'squat'), 120);
eq('wk3 d1 leg press accessory', sch(getDay('w3d1'), 'leg_press'), '2 WU + 2 WS');
eq('wk3 d3 nordics accessory', sch(getDay('w3d3'), 'nordics'), '2 WU + 2 WS');
eq('wk4 d2 face pull absent on push day', find(getDay('w4d2'), 'face_pull'), null);
eq('wk4 d4 face pull on pull day', sch(getDay('w4d4'), 'face_pull'), '3×10');
eq('wk4 d2 lateral raise', sch(getDay('w4d2'), 'lateral_raise'), '3×10');
eq('wk4 d4 seated row', sch(getDay('w4d4'), 'seated_row'), '3×10');

// Arms order: triceps before biceps on push, biceps before triceps on pull
{
  const flat2 = dayExercises(getDay('w4d2')).map((e) => e.item.ex);
  const flat4 = dayExercises(getDay('w4d4')).map((e) => e.item.ex);
  eq('push day triceps first', flat2.indexOf('triceps') < flat2.indexOf('biceps'), true);
  eq('pull day biceps first', flat4.indexOf('biceps') < flat4.indexOf('triceps'), true);
}

// Cardio: on days 1–6, none on day 7
for (let w of [1, 7, 12]) {
  for (let d = 1; d <= 6; d++) {
    const day = getDay(`w${w}d${d}`);
    eq(`wk${w} d${d} has cardio`, !!find(day, 'incline_walk'), true);
    eq(`wk${w} d${d} cardio 30 min`, sch(day, 'incline_walk'), '1×30:00');
  }
  eq(`wk${w} d7 no cardio`, getDay(`w${w}d7`).sections.length, 0);
}

// Warm-up (8) + rehab (6) present on both upper days
{
  const day = getDay('w5d4');
  const warm = day.sections.find((s) => s.title === 'Shoulder Band Warm-Up');
  const rehab = day.sections.find((s) => s.title === 'Rehab');
  eq('pull day warm-up 8 exercises', warm.items.length, 8);
  eq('pull day rehab 6 exercises', rehab.items.length, 6);
  eq('pull day rehab all 3×10', rehab.items.every((i) => schemeLabel(i.sch) === '3×10'), true);
}

// Strength day contents (wk 3)
{
  const day = getDay('w3d6');
  eq('strength day squat', sch(day, 'squat'), '2 WU + 2 WS');
  eq('strength day nordics rest', rest(day, 'nordics'), 90);
  eq('strength day adduction 2 WS', sch(day, 'adduction'), '2 WS');
  eq('strength day tibia 2 WS', sch(day, 'tibia_raise'), '2 WS');
  eq('strength day hip thrust', sch(day, 'hip_thrust'), '2 WU + 2 WS');
  const flat = dayExercises(day).map((e) => e.item.ex);
  eq('strength day has volleyball', flat.includes('volleyball'), true);
  const ss = dayExercises(day).filter((e) => e.item.ss === 'addabd');
  eq('adduction/abduction superset pair', ss.length, 2);
}

// Freestyle jumping counter config
{
  const f = find(getDay('w9d3'), 'freestyle_jump');
  eq('freestyle counter warn', f.item.counter.warn, 40);
  eq('freestyle counter cap', f.item.counter.cap, 50);
}

// All 105 days resolve
import { allDayIds } from '../js/program.js';
eq('105 day ids', allDayIds().length, 105);
for (const id of allDayIds()) {
  const d = getDay(id);
  if (!d) { fails++; console.error(`FAIL day ${id} did not resolve`); }
}

if (fails === 0) console.log('✓ All fidelity checks passed');
else { console.error(`✗ ${fails} check(s) failed`); process.exit(1); }
