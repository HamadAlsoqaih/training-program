// Fidelity spot-checks: the resolved programs vs the hand-transcribed source
// tables. Run: node tests/fidelity.mjs
import { getDay, getWeek, schemeLabel, dayExercises, allDayIds, totalWeeks, PROGRAM_LIST } from '../js/program.js';

let fails = 0;
const eq = (label, actual, expected) => {
  if (actual !== expected) { fails++; console.error(`FAIL ${label}: got "${actual}", want "${expected}"`); }
};
const find = (day, exId, nth = 0) => dayExercises(day).filter((e) => e.item.ex === exId)[nth] || null;
const sch = (day, exId, nth = 0) => { const f = find(day, exId, nth); return f ? schemeLabel(f.item.sch) : '(missing)'; };
const rest = (day, exId, nth = 0) => { const f = find(day, exId, nth); return f ? f.item.rest : -1; };
const D = (pid, id) => getDay(pid, id);

// ============================================================================
console.log('— 15-Week Program —');
// Phase 1 ramp
eq('p15 wk1 d1 lateral bounds', sch(D('p15','w1d1'), 'lat_bounds'), '1×6');
eq('p15 wk2 d3 lateral bounds', sch(D('p15','w2d3'), 'lat_bounds'), '2×6');
eq('p15 wk3 d1 lateral bounds', sch(D('p15','w3d1'), 'lat_bounds'), '3×6');
eq('p15 wk4 d1 long duration jump', sch(D('p15','w4d1'), 'long_dur_jump'), '3×0:30');
eq('p15 wk1 d2 rocking deadbug', sch(D('p15','w1d2'), 'rocking_deadbug'), '1×8');
eq('p15 wk3 d1 mech primer rest', rest(D('p15','w3d1'), 'mech_primer'), 30);
// Phase 2
eq('p15 wk5 d1 sd lateral push', sch(D('p15','w5d1'), 'sd_lat_push'), '2×4');
eq('p15 wk6 d1 sd lateral push', sch(D('p15','w6d1'), 'sd_lat_push'), '3×4');
eq('p15 wk6 d3 long duration jump', sch(D('p15','w6d3'), 'long_dur_jump'), '3×0:40');
// Week 7 deload
eq('p15 wk7 d1 power skip', sch(D('p15','w7d1'), 'power_skip'), '1×8');
eq('p15 wk7 d6 squat', sch(D('p15','w7d6'), 'squat'), '1 WU + 1 WS');
// Phase 3
eq('p15 wk8 d3 sd one foot jump', sch(D('p15','w8d3'), 'sd_of_jump'), '3×4');
eq('p15 wk11 d3 sd one foot jump', sch(D('p15','w11d3'), 'sd_of_jump'), '3×7');
eq('p15 wk9 d3 drach', sch(D('p15','w9d3'), 'drach_jumps'), '3×5');
eq('p15 wk10 d3 drach dropped (Type A)', find(D('p15','w10d3'), 'drach_jumps'), null);
eq('p15 wk11 d1 drach stays (Type B)', sch(D('p15','w11d1'), 'drach_jumps'), '3×5');
eq('p15 wk10 d3 freestyle 2 blocks', sch(D('p15','w10d3'), 'freestyle_jump'), '2×10:00');
eq('p15 wk11 d3 oscillating RFESS', sch(D('p15','w11d3'), 'osc_rfess'), '4×0:50');
// Phase 4
eq('p15 wk12 d1 freestyle agility (deload)', sch(D('p15','w12d1'), 'free_agility'), '1×0:25');
eq('p15 wk15 d3 freestyle agility', sch(D('p15','w15d3'), 'free_agility'), '4×0:40');
eq('p15 wk15 d1 agility rest 1:00', rest(D('p15','w15d1'), 'free_agility'), 60);
eq('p15 wk15 d1 consecutive hurdle', sch(D('p15','w15d1'), 'consec_hurdle'), '6×4');
eq('p15 plyo identical d1/d3 wk14',
   JSON.stringify(D('p15','w14d1').sections[0]), JSON.stringify(D('p15','w14d3').sections[0]));
// consistent blocks
eq('p15 strength day squat', sch(D('p15','w3d6'), 'squat'), '2 WU + 2 WS');
eq('p15 strength squat rest', rest(D('p15','w3d6'), 'squat'), 120);
eq('p15 iso hold timed 3×0:30', sch(D('p15','w2d2'), 'oh_iso_hold'), '3×0:30');
eq('p15 KB anti-rotation stays reps', sch(D('p15','w2d2'), 'bu_kb_hold'), '3×10');
{
  const t = D('p15','w3d2').sections.map((x) => x.title);
  eq('p15 d2 warm-up first', t[0], 'Shoulder Band Warm-Up');
  eq('p15 d2 core after arms', t.findIndex((x) => x.includes('Core')) > t.findIndex((x) => x.includes('Arms')), true);
  eq('p15 d2 cardio last', t[t.length - 1], 'Cardio');
}

// ============================================================================
console.log('— 12-Week Vert Code —');
// Phase 1
eq('p12 wk1 d1 one leg speed drop', sch(D('p12','w1d1'), 'ol_speed_drop'), '2×6');
eq('p12 wk2 d1 one leg speed drop', sch(D('p12','w2d1'), 'ol_speed_drop'), '3×7');
eq('p12 wk2 d1 rapid decel', sch(D('p12','w2d1'), 'rapid_decel'), '3×8');
eq('p12 wk1 d1 long duration jump', sch(D('p12','w1d1'), 'long_dur_jump'), '3×0:30');
eq('p12 wk2 d1 long duration jump', sch(D('p12','w2d1'), 'long_dur_jump'), '3×0:35');
eq('p12 wk1 d1 toe raises', sch(D('p12','w1d1'), 'ind_toe_raise'), '3×8');
eq('p12 wk2 d1 toe raises', sch(D('p12','w2d1'), 'ind_toe_raise'), '3×10');
eq('p12 wk1 d2 rocking plank 1×0:25', sch(D('p12','w1d2'), 'rocking_plank'), '1×0:25');
eq('p12 wk2 d2 rocking plank 3×0:30', sch(D('p12','w2d2'), 'rocking_plank'), '3×0:30');
eq('p12 wk2 d2 hamstring floss', sch(D('p12','w2d2'), 'ham_floss'), '3×7');
// Phase 2
eq('p12 wk3 d1 sd lateral push', sch(D('p12','w3d1'), 'sd_lat_push'), '3×4');
eq('p12 wk4 d1 sd lateral push', sch(D('p12','w4d1'), 'sd_lat_push'), '3×5');
eq('p12 wk4 d1 power skip', sch(D('p12','w4d1'), 'power_skip'), '3×10');
eq('p12 wk4 d1 step down', sch(D('p12','w4d1'), 'sl_ecc_stepdown'), '3×12');
eq('p12 wk3 d1 reverse plank', sch(D('p12','w3d1'), 'reverse_plank'), '3×0:30');
eq('p12 wk4 d1 reverse plank', sch(D('p12','w4d1'), 'reverse_plank'), '3×0:40');
eq('p12 wk4 d1 long duration jump', sch(D('p12','w4d1'), 'long_dur_jump'), '3×0:45');
eq('p12 wk3 d2 side plank hip abd', sch(D('p12','w3d2'), 'splank_abd'), '3×8');
// Phase 3 — week 5 deload + Type A/B assignment
eq('p12 wk5 d1 is a deload (no plyo)', find(D('p12','w5d1'), 'sd_of_jump'), null);
eq('p12 wk5 d1 has deload item', !!find(D('p12','w5d1'), 'deload'), true);
eq('p12 wk5 d2 has no core', D('p12','w5d2').sections.some((s) => s.title.includes('Core')), false);
eq('p12 wk5 d4 has core', D('p12','w5d4').sections.some((s) => s.title.includes('Core')), true);
eq('p12 wk5 d3 is Type A', D('p12','w5d3').sections[0].title.includes('Type A'), true);
eq('p12 wk5 d6 is Type B', D('p12','w5d6').sections[0].title.includes('Type B'), true);
eq('p12 wk6 d1 is Type B', D('p12','w6d1').sections[0].title.includes('Type B'), true);
eq('p12 wk5 d3 freestyle 1 block', sch(D('p12','w5d3'), 'freestyle_jump'), '1×10:00');
eq('p12 wk7 d3 freestyle 2 blocks', sch(D('p12','w7d3'), 'freestyle_jump'), '2×10:00');
eq('p12 wk5 d3 drach in Type A', sch(D('p12','w5d3'), 'drach_jumps'), '3×4');
eq('p12 wk7 d3 drach dropped from Type A', find(D('p12','w7d3'), 'drach_jumps'), null);
eq('p12 wk8 d3 drach still dropped', find(D('p12','w8d3'), 'drach_jumps'), null);
eq('p12 wk7 d1 drach stays in Type B', sch(D('p12','w7d1'), 'drach_jumps'), '3×6');
eq('p12 wk8 d1 drach Type B', sch(D('p12','w8d1'), 'drach_jumps'), '3×7');
eq('p12 wk8 d1 penult hurdle', sch(D('p12','w8d1'), 'penult_hurdle'), '3×3');
eq('p12 wk8 d1 one foot max approach', sch(D('p12','w8d1'), 'of_max_approach'), '4×4');
eq('p12 wk6 d1 one foot max approach', sch(D('p12','w6d1'), 'of_max_approach'), '4×3');
eq('p12 wk8 d1 osc RFESS 4 sets', sch(D('p12','w8d1'), 'osc_rfess'), '4×0:50');
eq('p12 wk8 d1 achilles spring', sch(D('p12','w8d1'), 'achilles_spring'), '3×10');
eq('p12 wk5 d4 hand walk out', sch(D('p12','w5d4'), 'hand_walkout'), '3×5');
eq('p12 wk8 d2 hand walk out', sch(D('p12','w8d2'), 'hand_walkout'), '3×8');
eq('p12 wk8 d2 leg lowers', sch(D('p12','w8d2'), 'leg_lowers'), '3×11');
eq('p12 wk7 d2 side plank 0:40', sch(D('p12','w7d2'), 'side_plank'), '3×0:40');
// Phase 4
eq('p12 wk9 d1 freestyle agility', sch(D('p12','w9d1'), 'free_agility'), '4×0:25');
eq('p12 wk11 d1 freestyle agility', sch(D('p12','w11d1'), 'free_agility'), '4×0:35');
eq('p12 wk12 d1 freestyle agility', sch(D('p12','w12d1'), 'free_agility'), '4×0:40');
eq('p12 wk9 agility rest 0:45', rest(D('p12','w9d1'), 'free_agility'), 45);
eq('p12 wk11 agility rest 1:00', rest(D('p12','w11d1'), 'free_agility'), 60);
eq('p12 wk12 d1 consecutive hurdle 6×4', sch(D('p12','w12d1'), 'consec_hurdle'), '6×4');
eq('p12 wk9 d1 consecutive hurdle 6×3', sch(D('p12','w9d1'), 'consec_hurdle'), '6×3');
eq('p12 wk12 d1 ball of foot turn', sch(D('p12','w12d1'), 'bof_ol_turn'), '3×7');
eq('p12 wk12 d1 side plank hip abd', sch(D('p12','w12d1'), 'splank_abd'), '3×12');
eq('p12 phase 4 has NO 711 breathing', find(D('p12','w9d1'), 'breathing_711'), null);
eq('p12 phase 3 HAS 711 breathing', !!find(D('p12','w8d1'), 'breathing_711'), true);
eq('p12 wk12 d2 rolling cross touch', sch(D('p12','w12d2'), 'roll_cross_touch'), '3×4');
eq('p12 wk12 d2 cross touch extension', sch(D('p12','w12d2'), 'cross_touch_ext'), '3×6');
eq('p12 wk11 d2 lower back angels', sch(D('p12','w11d2'), 'lb_angels'), '3×0:30');
// p12 consistent blocks (lower volumes than p15)
eq('p12 warm-up SA pulldown 1×10', sch(D('p12','w1d2'), 'sa_pulldown'), '1×10');
eq('p12 warm-up band ER 2×10', sch(D('p12','w1d2'), 'band_er'), '2×10');
eq('p12 warm-up iso hold 2×0:30', sch(D('p12','w1d2'), 'oh_iso_hold'), '2×0:30');
eq('p12 rehab has KB bottoms-up walk', sch(D('p12','w1d2'), 'kb_bu_walk'), '2×0:30');
eq('p12 push day has chest press', sch(D('p12','w1d2'), 'chest_press'), '3×10');
eq('p12 pull day has seated row', sch(D('p12','w1d4'), 'seated_row'), '3×10');
eq('p12 rehab 7 exercises', D('p12','w1d2').sections.find((s) => s.title === 'Rehab').items.length, 7);
eq('p12 push strength 5 exercises', D('p12','w1d2').sections.find((s) => s.title === 'Strength — Push').items.length, 5);
// accessory placement
eq('p12 d1 leg press accessory', sch(D('p12','w1d1'), 'leg_press'), '2 WU + 2 WS');
eq('p12 d3 nordics accessory', sch(D('p12','w1d3'), 'nordics'), '2 WU + 2 WS');
eq('p12 d6 has no accessories', find(D('p12','w1d6'), 'leg_press'), null);
eq('p12 d6 has band warm-up', !!find(D('p12','w1d6'), 'band_er'), true);
eq('p12 d6 has volleyball', !!find(D('p12','w1d6'), 'volleyball'), true);
{
  const t = D('p12','w1d1').sections.map((x) => x.title);
  eq('p12 d1 plyo → accessories → cooldown → cardio',
     `${t[0].includes('Plyo')}|${t[1].includes('Accessories')}|${t[2]}|${t[3]}`, 'true|true|Cooldown|Cardio');
}
// cardio on days 1–6, none on day 7
for (const pid of ['p15', 'p12']) {
  for (const w of [1, 5]) {
    for (let d = 1; d <= 6; d++) eq(`${pid} wk${w} d${d} cardio`, sch(D(pid, `w${w}d${d}`), 'incline_walk'), '1×30:00');
    eq(`${pid} wk${w} d7 empty`, D(pid, `w${w}d7`).sections.length, 0);
  }
}
// every day of every program resolves
for (const program of PROGRAM_LIST) {
  eq(`${program.id} day count`, allDayIds(program.id).length, program.weeks * 7);
  for (const id of allDayIds(program.id)) {
    if (!getDay(program.id, id)) { fails++; console.error(`FAIL ${program.id} ${id} did not resolve`); }
  }
  for (let w = 1; w <= totalWeeks(program.id); w++) {
    if (getWeek(program.id, w).days.length !== 7) { fails++; console.error(`FAIL ${program.id} week ${w} not 7 days`); }
  }
}

if (fails === 0) console.log('\n✓ All fidelity checks passed');
else { console.error(`\n✗ ${fails} check(s) failed`); process.exit(1); }
