# 15-Week Training Program — Phone App

A phone-first, offline-capable web app for the 15-week volleyball strength & plyometric
program. All 105 days encoded exactly (phases, volume ramps, deloads, per-week tables),
with progress tracking, timers, weight logging and a progress dashboard.
No backend, no login — everything lives on your phone.

## Get it on your iPhone

1. Open the site on your iPhone:
   **https://hamadalsoqaih.github.io/personal-15week-program/**
2. In Safari: **Share → Add to Home Screen**. You now have a full-screen app that works
   offline at the gym.

Deployment: every push to the main development branch runs the fidelity tests and
publishes the site to the `gh-pages` branch (`.github/workflows/pages.yml`), which
GitHub Pages serves. No manual steps.

## Features

- **Today view** — opens on today's workout (calendar-mapped, with a 4 AM "late-night
  grace": at 1 AM Tuesday you still see Monday's session). Free navigation to any day.
- **Every exercise, all info** — sets/reps/durations/rest per week, warm-up vs working
  sets, technique notes, superset grouping, how-to video links (YouTube search).
- **Cascading completion** — tick sets → exercise done → all exercises → day done
  automatically → all days → week done. Optional items (volleyball, static stretch)
  never block completion.
- **Timers** — session stopwatch (survives phone lock/reload), auto-starting rest
  countdowns with chime + screen flash, hold/breathing timers, a ground-contact tap
  counter for Freestyle Jumping with the 40–50 cap warning.
- **Logging** — weight/reps per working set, prefilled from last session, PR detection,
  per-exercise history with trend chart, progressive-overload hints ("all sets clean
  last time → add weight").
- **Progress page** — overall %, streak, adherence, cardio %, gym time, phase timeline,
  105-day heatmap, session-duration and lift-progression charts, weekly volume, notes
  timeline, weekly fatigue check-in (surfaces the program's own reduce-cardio rule),
  VO2-swap reminder after week 6.
- **Skips & notes** — skip a day with a reason, add notes to any day, reopen/edit
  past days.
- **Onboarding** — "I'm on Week 3, Monday" seeding: marks everything before your
  current day as done (assumed), calendar-anchored from that date.
- **Data safety** — export/import JSON backups (Settings). Backup nudge each closed week.

## Development

Zero-build vanilla ES modules. Serve locally:

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

Run the program-data fidelity checks (resolved sets/reps/rest vs the source tables):

```bash
node tests/fidelity.mjs
```

Regenerate icons (they are generated, not committed): `node scripts/gen-icons.mjs`

## Structure

```
index.html            app shell
css/app.css           design system (dark, mobile-first)
js/program.js         ★ the entire 15-week program as data + week resolver
js/state.js           localStorage store + export/import
js/schedule.js        calendar ↔ program-day mapping, rollover hour
js/completion.js      set → exercise → day → week cascade, history, PRs
js/timers.js          stopwatch, countdowns, chime, wake lock
js/charts.js          hand-rolled SVG charts
js/views/*.js         day / program / progress / settings / sheets
sw.js                 offline cache
tests/fidelity.mjs    data fidelity spot-checks
```

## Future ideas (backlog)

- Warm-up weight calculator (% of working set) & plate calculator
- Weekly body-weight log + trend chart
- Daily nutrition checklist (2,500 kcal / 180–200 g protein / creatine 5 g)
- Jump & ground-contact weekly volume analytics
- Exercise substitution tracking ("did X instead")
- Cross-device sync (needs a backend)
- Embedded exercise demo GIFs
