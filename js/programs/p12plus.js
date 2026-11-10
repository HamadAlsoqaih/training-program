// ============================================================================
// p12plus.js — "12-Week+" — plyometrics + a strength day + push/pull twice a
// week + shoulder rehab. Encoded exactly from the source tables.
//
// Weekly template (the week runs Friday → Thursday):
//   D1 Fri  LB Plyo → Leg Press + Hip Thrust          → cardio
//   D2 Sat  Full Push + Mini Pull + Arms → Core       → cardio
//   D3 Sun  LB Plyo → Nordics + Calf Raises
//   D4 Mon  Cardio only
//   D5 Tue  Full Pull + Mini Push + Arms
//   D6 Wed  Strength → Core                           → cardio
//   D7 Thu  Full rest
//
// The plyo, core and cooldown blocks are IMPORTED from p12.js rather than
// copied: the two programs run the same PJF progressions, so sharing the source
// is what stops them drifting apart.
// ============================================================================
import { sr, time, wuws, it } from '../schemes.js';
import {
  SHOULDER_WARMUP, REHAB, armsPush, armsPull, cardio,
  day1Accessories, day3Accessories,
  p1Main, p1Cool, p1Core, p2Main, p2Cool, p2Core,
  p3TypeA, p3TypeB, p3Cool, p3Core, p4Main, p4Cool, p4Core,
} from './p12.js';

// --- the two mixed upper-body days -----------------------------------------
// A "mini" exercise is 2 working sets with no warm-up — you are already warm
// from the full session — slotted into the first two sets of the lift it is
// supersetted with. The third set of the main lift rests normally.
const MINI_PULL = 'Mini pull — 2 working sets, no warm-up needed';
const MINI_PUSH = 'Mini push — 2 working sets, no warm-up needed';

const pushMiniPull = () => ({
  title: 'Push + Mini Pull (supersetted)', tag: 'strength', items: [
    it('lateral_raise', sr(3, 10), 0, { ss: 'mp1' }),
    it('face_pull', wuws(0, 2), 60, { ss: 'mp1', note: MINI_PULL }),
    it('banded_complex', sr(3, 10), 60),
    it('chest_press', sr(3, 10), 0, { ss: 'mp2' }),
    it('seated_row', wuws(0, 2), 60, { ss: 'mp2', note: MINI_PULL }),
    it('pushup', sr(3, 10), 0, { ss: 'mp3' }),
    it('low_row', wuws(0, 2), 60, { ss: 'mp3', note: MINI_PULL }),
    it('pec_deck', sr(3, 10), 60),
  ],
});

const pullMiniPush = () => ({
  title: 'Pull + Mini Push (supersetted)', tag: 'strength', items: [
    it('low_row', sr(3, 10), 0, { ss: 'mp1' }),
    it('chest_press', wuws(0, 2), 60, { ss: 'mp1', note: MINI_PUSH }),
    it('mid_row', sr(3, 10), 60),
    it('face_pull', sr(3, 10), 0, { ss: 'mp2' }),
    it('lateral_raise', wuws(0, 2), 60, { ss: 'mp2', note: MINI_PUSH }),
    it('bo_sa_raise', sr(3, 10), 60),
    it('seated_row', sr(3, 10), 0, { ss: 'mp3' }),
    it('pushup', wuws(0, 2), 60, { ss: 'mp3', note: MINI_PUSH }),
  ],
});

// --- Wednesday strength ------------------------------------------------------
const strengthDay = () => ({
  title: 'Lower Body Strength', tag: 'strength', items: [
    it('squat', wuws(2, 2), 120),
    it('nordics', wuws(2, 2), 90),
    it('leg_ext', wuws(2, 2), 90),
    it('ham_curl', wuws(2, 2), 90),
    it('adduction', wuws(0, 2), 60, { ss: 'addabd' }),
    it('abduction', wuws(0, 2), 60, { ss: 'addabd' }),
    it('tibia_raise', wuws(0, 2), 60, { ss: 'tibcalf' }),
    it('calf_raise', wuws(0, 2), 60, { ss: 'tibcalf' }),
    it('hip_thrust', wuws(2, 2), 90),
  ],
});

// --- resolvers ---------------------------------------------------------------
// Day 1 is Friday, Day 3 is Sunday. Phase 3 alternates Type B (Fri) and
// Type A / Freestyle (Sun); week 5 Friday is a full deload.
function plyoFor(week, dayNum) {
  if (week <= 2) return p1Main(week);
  if (week <= 4) return p2Main(week);
  if (week <= 8) {
    if (week === 5 && dayNum === 1) return null;
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
  (dayNum === 1 ? day1Accessories() : day3Accessories());

// A lower-body day: plyo → accessories → cooldown (→ cardio on Friday only)
function lbDay(week, dayNum) {
  const main = plyoFor(week, dayNum);
  if (!main) {
    return [
      { title: 'Deload', tag: 'deload', items: [it('deload', sr(1, 1), 0,
        { note: 'No plyo, no accessories. Light movement only.' })] },
      cardio(),
    ];
  }
  const out = [main, accessoriesFor(dayNum), coolFor(week)];
  if (dayNum === 1) out.push(cardio());
  return out;
}

export const PHASES = [
  { n: 1, weeks: [1, 2], name: 'Phase 1 — Base', color: 'var(--ph1)' },
  { n: 2, weeks: [3, 4], name: 'Phase 2 — Elastic', color: 'var(--ph2)' },
  { n: 3, weeks: [5, 8], name: 'Phase 3 — Max Approach', color: 'var(--ph3)' },
  { n: 4, weeks: [9, 12], name: 'Phase 4 — Reactive', color: 'var(--ph4)' },
];

const BADGES = {
  5: 'DELOAD START — Friday is a full deload (no plyo, no accessories) and Saturday drops the core session. Push + Arms and cardio carry on as normal.',
  7: 'Drach Jumps drop out of Type A (Freestyle) from this week onward.',
  9: 'Phase 4 — no Seven Eleven Breathing from here; the exercise selection shifts to reactive work.',
};

function buildWeek(week) {
  const w5 = week === 5;
  const label = (dayNum) => {
    if (w5 && dayNum === 1) return 'Deload — light movement + cardio';
    if (week >= 5 && week <= 8) {
      return dayNum === 3 ? 'Plyo Type A (Freestyle) + Nordics & Calf Raises'
        : 'Plyo Type B (Max Approach) + Leg Press & Hip Thrust';
    }
    return dayNum === 1 ? 'LB Plyo + Leg Press & Hip Thrust'
      : 'LB Plyo + Nordics & Calf Raises';
  };

  return [
    { d: 1, title: label(1), kind: w5 ? 'rest' : 'plyo', sections: lbDay(week, 1) },
    { d: 2, title: w5 ? 'Full Push + Mini Pull + Arms (core deloaded)'
                      : 'Full Push + Mini Pull + Arms → Core & Mobility',
      kind: 'upper',
      sections: w5
        ? [SHOULDER_WARMUP(), REHAB(), pushMiniPull(), armsPush(), cardio()]
        : [SHOULDER_WARMUP(), REHAB(), pushMiniPull(), armsPush(), coreFor(week), cardio()] },
    { d: 3, title: label(3), kind: 'plyo', sections: lbDay(week, 3) },
    { d: 4, title: 'Cardio only', kind: 'rest', sections: [cardio()] },
    { d: 5, title: 'Full Pull + Mini Push + Arms', kind: 'upper',
      sections: [SHOULDER_WARMUP(), REHAB(), pullMiniPush(), armsPull()] },
    { d: 6, title: 'Strength → Core & Mobility', kind: 'strength',
      sections: [strengthDay(), coreFor(week), cardio()] },
    { d: 7, title: 'Full Rest', kind: 'off', sections: [] },
  ];
}

export default {
  id: 'p12p',
  name: '12-Week+',
  subtitle: 'Plyo + strength day + push/pull twice a week + shoulder rehab',
  weeks: 12,
  phases: PHASES,
  badges: BADGES,
  buildWeek,
  // The week runs Friday → Thursday, so Day 1 lands on a Friday by default.
  defaultDayMap: { 1: 5, 2: 6, 3: 0, 4: 1, 5: 2, 6: 3, 7: 4 },
  daySlots: [
    'LB Plyo + Leg Press & Hip Thrust',
    'Full Push + Mini Pull → Core',
    'LB Plyo + Nordics & Calf Raises',
    'Cardio only',
    'Full Pull + Mini Push',
    'Strength → Core',
    'Full Rest',
  ],
  nutrition: [
    ['Calories', '2,500 / day'],
    ['Protein', '180–200 g / day'],
    ['Creatine', '5 g / day'],
    ['Omega-3', 'Continue current dose'],
    ['Ashwagandha', 'Continue current dose'],
    ['Magnesium Glycinate', 'Continue current dose'],
  ],
  notes: [
    'Muscle frequency: push 2×/week (Sat full + Tue mini), pull 2×/week (Tue full + Sat mini), core 2×/week (Sat + Wed), plyo 2×/week (Fri + Sun), Nordics 2×/week (Sun accessories + Wed strength), strength 1×/week (Wed).',
    'Cardio: 30 min incline walk (7% incline, 4.5 km/h) 4 days/week — Fri, Sat, Mon and Wed — plus daily steps.',
    'Mini superset rule: 2 working sets only, no warm-up — you are already warm from the full session. Slot them into the first two sets of the lift they are paired with; the third set rests normally.',
    'Arms: triceps first on push day (Sat), biceps first on pull day (Tue). 2 working sets each, supersetted.',
    'Leg Press + Hip Thrust (Fri): after the last plyo strength/hold exercise, before the cooldown. 2 WU + 2 WS each, supersetted.',
    'Nordics + Calf Raises (Sun): same placement. 2 WU + 2 WS each, supersetted. Nordics: slow 3–5 sec eccentric, progress ROM before adding load. Calf raises: 3s up / 3s down.',
    'Warm-up reps: stick to 10 per set. No pyramiding.',
    'Progressive overload: add weight when both working sets are completed cleanly.',
    'Freestyle Jumping: cap at 40–50 ground contacts per 10-minute block.',
    'Phase 3 deload (week 5): Friday and Saturday are deload days. Push + Arms on Saturday proceed normally with no core. Sunday onward resumes Phase 3 content.',
    'Phase 4 note: no Seven Eleven Breathing.',
    'Consecutive Hurdle Jump intent: sets 1–2 small double hop between jumps, sets 3–4 rapid and land low, sets 5–6 pogo style with minimal knee bend.',
    'Spacing: push Sat → Tue is 3 days, pull Tue → Sat is 4 days, rehab Sat → Tue is 3 days, plyo Fri → Sun is 1 day, plyo → strength Sun → Wed is 3 days. No back-to-back upper body and no back-to-back rehab.',
  ],
};
