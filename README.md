# Hamad's Training

A phone-first, offline-capable training app. Two full programs encoded exactly
from their source tables, with progress tracking, timers, weight logging,
in-app exercise videos and a progress dashboard.
No backend, no login — everything lives on your phone.

**Open it:** https://hamadalsoqaih.github.io/personal-15week-program/
In Safari: **Share → Add to Home Screen** for a full-screen app that works
offline at the gym.

## Programs

| Program | Length | What it is |
|---|---|---|
| **15-Week Program** | 15 weeks · 4 phases | Volleyball strength, plyometrics & shoulder rehab |
| **12-Week Vert Code** | 12 weeks · 4 phases | PJF Vert Code (bodyweight) on the same weekly template |

Each program keeps its own schedule and progress; the Today tab follows whichever
one is active. Logged weights are shared, so your numbers carry across.

## Features

**Today**
- Opens on today's workout. The day shown is always the one you assigned to
  today's real weekday; a 4 AM rollover keeps 1 AM sessions on the previous day.
- Every exercise with sets, reps or duration, warm-up vs working sets, rest
  times, technique notes, "each side" markers and superset grouping.
- Tick sets → exercise → day → week completes automatically. Partial work stays
  partial.
- **Organize day**: reorder exercises and sections, add or delete sets, skip a
  single exercise, edit reps/duration/rest. Edits during a workout apply to that
  day only, silently; editing a day you're browsing asks whether to apply it to
  the whole phase.
- **Band ↔ Cable** toggle on band exercises (that day only), with separate
  weight history per mode.

**Timers**
- Workout stopwatch that survives phone locks, editable at any time.
- Rest countdowns that start automatically when you tick a set (−30/+30/skip).
- Hold and interval timers; edited durations are remembered per exercise and
  step aside when the program itself progresses them.
- Ground-contact tap counter for Freestyle Jumping with the 40–50 cap warning.

**Logging**
- Weight and reps on every set, with −/+ 2.5 kg steppers.
- Weight pre-fills from last time; each row shows **what you actually lifted
  last session — weight and reps**.
- PR detection, per-exercise history with trend charts, partial-session flags,
  substitution notes and named "exercise of choice" slots.
- "Add weight" hint that fires only when all working sets were clean.

**Video**
- Exercise videos play **inside the app** — half screen, expandable to full
  screen, with normal player controls. (Video is the only feature that needs a
  network connection.)

**Progress**
- Overall %, streak, adherence, cardio %, gym time, weeks done.
- This week vs last week: volume, sets, gym time, cardio.
- Phase timeline, full-program heatmap, duration / lift / volume charts.
- Weekly fatigue check-in that surfaces the program's own reduce-cardio rule.

**Settings**
- Active program switcher, per-program training weekdays and rollover hour,
  "Where are you now?" week fix, accent colour (11 swatches + custom),
  reminders, timer-override reset, JSON export/import, full reset.

## Development

```bash
python3 -m http.server 8080   # open http://localhost:8080
node tests/fidelity.mjs       # verify both programs against their source tables
node scripts/gen-icons.mjs    # regenerate icons (generated, not committed)
```

Deployment is automatic: every push runs the fidelity tests and publishes to the
`gh-pages` branch via `.github/workflows/pages.yml`.

- [CHANGELOG.md](CHANGELOG.md) — every version, from the first build to now
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — data model, program registry,
  how to add a program, and the performance rules

## Future ideas

- Warm-up weight calculator and plate calculator
- Weekly body-weight log and trend
- Daily nutrition checklist (2,500 kcal / 180–200 g protein / creatine)
- Jump and ground-contact volume analytics
- Cross-device sync (needs a backend)
