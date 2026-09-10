# Changelog

Every version of this app, from the first build to today. Newest first.

---

## v7 — Jump volume tracking, drag fix, new address

**Moving house**
- The app now lives at **https://hamadalsoqaih.github.io/training/** (it was
  `.../personal-15week-program/`, a name that stopped being true once there were
  two programs).
- **Your data comes with it.** Browser storage is scoped to the origin
  (`hamadalsoqaih.github.io`), not the path, so every logged set, weight and
  setting survives the move untouched. The only thing that breaks is the old
  address — re-add the app to your home screen from the new one and delete the
  old icon.
- On load the app now unregisters any service worker left over from the old
  path, so a browser that once cached the old app shell can't keep serving it.
  Cache bumped to `t15-v7`.

**Jump volume (ground contacts)**
- New card on **Progress**: total ground contacts per **calendar** week for the
  last 12 weeks, counting plyo from **both programs** in the same bar — the two
  programs number their weeks differently, but your legs only know the calendar.
- Every plyo drill is tagged in the exercise catalog with `jump` and, where one
  rep is not one contact, a multiplier — Consecutive Hurdle Jump counts 3 (the
  program's own "3 hurdles = 1 rep"). "Each side" drills count double.
- Counting follows the reps you actually logged, falling back to the prescribed
  reps — the same rule the rest of the app uses. Unticked sets count for nothing.
- **Freestyle Jumping uses your real tapped contacts**, not an estimate; only an
  untapped block falls back to the middle of the 40–50 cap. The card also
  reports how many tapped blocks landed inside that cap.
- **Spike warning**: an amber banner when the week is more than 30% up on the
  last one (and above a floor, so 8 → 12 contacts never nags). It names the
  numbers and points at the program's own fatigue rule.
- The post-session summary now shows the day's jump contacts beside duration,
  sets and PRs.
- New `js/analytics.js`, built off the existing memoised history index — no new
  storage and no extra scan, so Progress stays as fast as it was.

**Fixed: drag stopped working on the day you were training**
- `data-sortable` was applied when a day was first drawn, but ticking a set
  rebuilds that card — and the rebuilt card lost the attribute. So reordering
  worked while browsing and quietly died on exactly the day you were using. The
  attribute now lives on the card itself and survives every rebuild.
- Grabbing a card *inside* a superset used to do nothing; the drag now resolves
  to the whole superset, so the pair moves as one unit.
- The drop position is worked out from the neighbours' midpoints rather than a
  fixed row height, so cards of different heights land where you put them.

---

## v6 — Real dates, future starts, cross-program progression

**The date bug (and what caused it)**
- The start flow used to **silently rewrite the date you typed**: picking a
  program day snapped the date to the *nearest* matching weekday and was allowed
  to snap **backwards**. Entering 16 Sep and picking a Day 1 that falls on a
  Monday rewrote the anchor to Monday 7 Sep — a date you never chose. It now
  only ever moves forward, and never touches a date you typed yourself.
- The start screen spells out the result plainly: *"Starts Wed 16 Sep — in 6
  days. That date is Week 1 · Day 1"*, and warns if the date's weekday doesn't
  match the day you picked.
- **Out-of-range dates are no longer silently clamped.** `programStatus()` now
  reports `before` / `active` / `over`, and a day is only labelled TODAY when it
  genuinely is. (`isBeforeStart` / `isProgramOver` existed but were never called.)
- **Future start = countdown, then auto-start.** Today shows "Starts Wed 16 Sep —
  in 6 days" with a Day-1 preview, a one-tap **Start today instead**, and a way
  to switch to your other program. On the start date it just becomes Day 1.
  A finished program gets an equivalent "program complete" screen.
- The real current date is now always shown in the day header.

**Progression follows the exercise, not the program**
- Sets are stamped with a real `loggedAt` time, so history is ordered by when
  you actually trained rather than by a program's calendar maths.
- "Last session" now means *the most recent session of that exercise anywhere*,
  excluding the day you're looking at — so a mis-anchored program can never hide
  your history again. Prefill, the last-session line, the "add weight" hint and
  PR detection all use it.
- The last-session line names the source when it came from your other program:
  `↺ last: 95 kg × 6 · 15-Week`.
- **Fixed:** logging real work on a back-filled "assumed done" day left it
  flagged as assumed, so the history index ignored it entirely. Any set you log
  now makes that day real data.

**Reordering and skipping**
- **Hold a card and drag it**, like any phone app — the card lifts, the others
  slide apart, and releasing drops it there. Works any time, not just in
  organize mode. Supersets move as one unit so a pair never gets split. Holding
  a set tick, input or stepper never starts a drag, and a tap is still a tap.
- **Skip a single exercise straight from its card** (⤼ icon) — no need to enter
  organize mode. Tap again to bring it back.

---

## v5 — Multi-program, in-app video, editable days, theme colour

Renamed **15-Week Training Program → Hamad's Training**: the app is no longer one
program. (Home-screen label "Training"; the lightning-bolt icon is unchanged. The
repo name and site URL are deliberately left alone so installed apps and saved
progress keep working.)

**Second program**
- Added the **12-Week Vert Code** (PJF Vert Code — bodyweight, adapted to the same
  weekly template): 84 days, 4 phases, encoded exactly from the source tables —
  per-week rep/duration progressions, Type A (Freestyle) vs Type B (Max Approach)
  day assignment, the week-5 deload (Day 1 no plyo, Day 2 no core), Drach Jumps
  dropping out of Type A from week 7, its own lower-volume warm-up/rehab blocks,
  Chest Press and KB Bottoms-Up Walk, accessory placement before the cooldown, and
  no Seven Eleven Breathing in phase 4.
- **Programs browser**: Programs → Program (Start / Continue / Make active +
  phases) → Phase → Week → Day.
- Each program keeps its **own schedule anchor, weekday map, day records and
  fatigue log**. Switching programs never deletes anything. **Logged weights are
  shared across programs**, so leg-press numbers carry over.

**In-app video**
- Exercise videos (Mux HLS) now play **inside the app**: a ▶ button opens a
  half-screen player that expands to full screen, with native controls
  (play/seek/volume/speed/AirPlay/PiP). iOS plays HLS natively; other browsers
  lazily load hls.js. `preload="none"`, so nothing downloads until you tap.
  A blocked or missing video shows a clear message plus an external link.

**Editing a day**
- **Organize day** mode: reorder exercises and whole sections, add or delete
  individual sets, skip a single exercise (instead of only the whole day), and
  edit sets / reps / duration / rest per exercise.
- **Scope rule**: edits made in **Today (or any day with a running session) apply
  silently to that day only** — never interrupting a workout. Edits made while
  **browsing** a day ask: **just this day** or **the whole phase** (same day-slot
  across that phase's weeks, skipping days already completed).
- Per-day **Band ↔ Cable toggle** on band exercises: renames the exercise and
  keeps cable weight history separate from band history. Applies to that day only.
- "✎ edited" badge on customised days plus a one-tap **Reset** back to the
  program's original layout.

**Logging**
- Every set row now shows **what you actually lifted last time — weight AND reps**
  (`↺ last: 60 kg × 8`), not just a prefilled weight.

**Appearance**
- **Accent colour** is now a setting: 11 swatches plus a custom colour picker.
  It drives the tab bar, primary buttons, toggles, highlights and timers.
  Text on the accent flips between dark and light automatically by luminance.

**Performance** (explicit goal this round)
- **Memoised history index**: every logged day of every program is indexed by
  exercise once per state change. Previously each exercise card re-scanned all
  105 days for prefill/hints — the main lag risk, which would have doubled with a
  second program.
- **Targeted DOM updates**: ticking a set, typing a weight, using a stepper or the
  contact counter now updates only that card (or a single text node) instead of
  re-rendering the whole day.
- Week building, planned days and per-day exercise lists are cached;
  `content-visibility` keeps long days from painting off-screen cards.
- Measured in CI at iPhone viewport: **~16 ms** to render a 28-exercise day,
  **~11 ms** to tick a set. The E2E suite fails the build if these regress.

**Fixes**
- Organize mode no longer leaks from one day to another.
- `h()` no longer drops a child passed as the first argument.

---

## v4 — Partial sessions count as partial

- Volume, sets and completion already counted only ticked sets; this is now
  locked down by a test (one set at 2 kg × prescribed 10 reps = exactly 20 kg).
- History records became warm-up/working-set aware: each set keeps its original
  index, and records carry prescribed totals and done counts.
- The **"add weight" hint** now follows the program rule exactly — it fires only
  when **all working sets** were completed and weight-logged. Warm-up ticks are
  ignored, so they can neither fake nor block it.
- History flags partial sessions (`WS 1/2`, `n/total sets`) and labels warm-ups.
- Reopening an "assumed done" back-filled day clears the assumed flag so
  retro-logged work counts in stats.

## v3 — Quick re-anchor, weekly comparison, kg steppers, day swaps

- **"Where are you now?"**: pick the week you're actually in (the day comes from
  the real weekday), with optional back-fill — reachable from Settings and a
  "wrong week? fix it" link on today. Replaced the confusing anchor editor.
- **This week vs last** card: volume (kg × reps), sets, gym time and cardio
  sessions with deltas.
- **−/+ 2.5 kg steppers** beside every weight input.
- **One-off day swaps** per week (e.g. Friday ↔ Saturday) that leave the standing
  schedule untouched; swapped days are badged and dates follow the swap.
- Fixed `h()` dropping first-argument children, which had silently removed the
  Program/Progress/Week headings.

## v2 — Weekday bug, flexible schedule, logging everywhere

- **Fixed the wrong-day bug**: the displayed day is now locked to the real
  weekday; the anchor only decides which week it is.
- **Configurable training weekdays**: assign the 5 workout days + 2 rest days to
  any weekdays (default Wed–Tue).
- Weight/reps inputs on **every** rep-based exercise including warm-up sets;
  blank weight logs nothing, blank reps count as the prescribed number.
- **Sticky values**: weights pre-fill from your last session; edited hold and rest
  timers are remembered per exercise, keyed by the prescribed value so program
  progressions automatically take over.
- Editable workout stopwatch, hold timers and rest times; −30s on the rest bar.
- Band Overhead Iso Hold became a timed hold (3×0:30); KB Anti-Rotation Hold
  stayed reps.
- Core moved after the upper-body work on Days 2 and 4.
- Arm "exercise of choice" naming, substitution notes, per-section "✓ all" bulk
  tick, header link to the week view.

## v1 — Initial build

The 15-week volleyball strength & plyometrics program as a phone-first,
offline-capable PWA:

- All 105 days encoded from the source tables — 4 phases, volume ramps, the week 7
  and week 12 deloads, Type A/B plyo days, warm-up/rehab/strength blocks,
  supersets, rest times and technique notes.
- Calendar-anchored Today view with a 4 AM late-night rollover, plus onboarding
  that can back-fill earlier days as done.
- Cascading completion: set → exercise → day → week.
- Session stopwatch, auto rest countdowns, hold timers, and a Freestyle Jumping
  ground-contact counter with the 40–50 cap warning.
- Weight/reps logging with PR detection, per-exercise history and trend charts.
- Progress dashboard: streak, adherence, cardio %, 105-day heatmap, phase
  timeline, duration/lift/volume charts, weekly fatigue check-in, VO2 reminder.
- Offline PWA (service worker, manifest, generated icons), wake lock, JSON
  export/import backups.
- Fidelity tests validating the encoded program against the source tables, and a
  GitHub Actions workflow deploying to GitHub Pages.
