# Architecture

Zero-build static PWA: vanilla ES modules, no framework, no npm, no backend.
GitHub Actions publishes the folder to the `gh-pages` branch, which GitHub Pages
serves. Everything the app knows lives in the browser's `localStorage`.

```
index.html              app shell (tab bar, sheet root, toast root)
css/app.css             design system — dark, phone-first, accent-driven
sw.js                   offline cache (bump CACHE on every release)
manifest.webmanifest    PWA metadata
js/
  app.js                boot, hash router, theme accent, rest-countdown bar
  exercises.js          shared exercise catalog (names, notes, Mux video ids)
  schemes.js            prescription builders: sr / time / wuws + formatting
  program.js            program registry + facade (getWeek, getDay, caching)
  programs/p15.js       15-Week Program definition
  programs/p12.js       12-Week Vert Code definition
  state.js              localStorage store, schema v2 + migration, export/import
  schedule.js           calendar ↔ program-day mapping, weekday map, swaps
  completion.js         planned days, history index, completion cascade, edits
  timers.js             stopwatch, countdowns, chime, wake lock
  video.js              in-app HLS player (native on iOS, hls.js elsewhere)
  charts.js             hand-rolled SVG charts
  util.js               h() DOM helper, toast, progress rings
  views/                day · programview · progress · settings · sheets
tests/fidelity.mjs      encoded programs vs the source tables
```

## Data model

### A program
A program module default-exports:

```js
{
  id, name, subtitle, weeks, phases, badges, daySlots, nutrition, notes,
  buildWeek(week) -> [ { d, title, kind, sections } x7 ]
}
```

A **section** is `{ title, tag, items }`; an **item** is
`{ ex, sch, rest, note?, opt?, ss?, side?, counter? }` where `sch` is
`sr(sets,reps)`, `time(sets,secs)` or `wuws(warmupSets,workingSets)`.

`program.js` wraps `buildWeek` with a cache and stamps identity onto each day:
`{ pid, week, d, id: "w3d6" }`. To add a program: write the module, add it to
`PROGRAM_LIST`, done — state, schedule, progress and the browser adapt.

### Saved state (schema v2)

```js
{
  version: 2,
  activeProgram: 'p15',          // the Today tab follows this
  programs: {
    p15: {
      started, startedAt,
      setup:   { anchorDate, anchorDay, rolloverHour, dayMap, weekSwaps },
      days:    { "w3d6": DayRecord },
      fatigue: [ { week, rating, at } ],
    },
    p12: { ... },
  },
  session:  { pid, dayId, startedAt, pausedAt, pausedMs } | null,
  settings: { accent, sound, autoRest, wakeLock, durOv, restOv, ... },
  onboarded: true,
}
```

`DayRecord` holds both what you *did* and how you *changed* the day:

```js
{
  status: 'done'|'skipped'|null, auto: true,   // auto = back-filled "assumed done"
  ex: { "s0i2": { sets: [{done, weight, reps}], alt, mode } },
  plan: {                                       // per-day customisation
    secOrder: [1,0,2],                          // section order
    exOrder:  { "0": [2,0,1] },                 // item order within a section
    ex: { "s0i2": { sets, reps, secs, wu, ws, rest, skipped } },
  },
  note, skipReason, cardioDone, startedAt, elapsedMs, contacts
}
```

A v1 save (single program) migrates automatically into `programs.p15` on load.

## Key rules

**The displayed day is pinned to the real weekday.** `setup.dayMap` maps program
day 1–7 → weekday 0–6. Today's slot is looked up from today's actual weekday; the
anchor only decides which *week*. A rollover hour (default 4 AM) keeps 1 AM
sessions on the previous day. `weekSwaps[week]` exchanges two slots for one week
without touching the standing schedule.

**Planned vs prescribed.** `plannedDay(pid, dayId)` layers the day's `plan` over
the program's prescription and returns ordered sections and entries. Everything
downstream (rendering, completion, stats) reads the *planned* day, so an edited
day behaves consistently everywhere.

**Edit scope.** `isLiveDay(pid, dayId)` is true for the active program's today or
any day with a running session. Live days save immediately at day scope with no
prompt. Other days offer day-or-phase; phase scope writes the same override to
that day-slot across the phase's weeks, skipping days already completed.

**Completion cascade.** A set is done when ticked; an exercise when all its sets
are; a day when every required (non-optional, non-skipped) exercise is; a week
when all seven days are closed. Partial work stays partial — one ticked set counts
as exactly one set in every statistic.

**Progressive overload.** The "add weight" hint fires only when the last session
had *all working sets* done and weight-logged. Warm-ups are excluded.

**Sticky timer overrides** live in `settings.durOv` / `settings.restOv`, keyed
`exId@prescribedValue`. When the program itself progresses a duration the key
changes, so the new prescription automatically wins.

## Performance rules

This app is used mid-set on a phone. Three rules protect that:

1. **Index, don't scan.** `historyIndex()` walks every logged day of every
   program once per state change and indexes by exercise. Cards read the index —
   never the program — for prefill, last-session lines and hints.
2. **Update the smallest thing.** Ticking a set, typing a weight, using a stepper
   or the contact counter calls `refreshCard()` (or mutates one text node), not a
   full re-render. Full re-renders are reserved for navigation and structural
   changes such as reordering.
3. **Cache and defer.** Week building, `plannedDay()` and `dayExercises()` are
   cached (`Map` / `WeakMap`, invalidated by `store.rev()`); cards use
   `content-visibility: auto`; video uses `preload="none"` and hls.js is loaded
   lazily and never on iOS.

`tests/e2e` asserts a heavy day renders in well under 1200 ms and a set tick in
under 250 ms; regressions fail the build. Current CI numbers: ~16 ms and ~11 ms.

## Video

Videos are Mux HLS (`.m3u8`). iOS Safari plays HLS natively in
`<video playsinline>`; other browsers get hls.js from a CDN, loaded only when
needed. Posters come from `image.mux.com/<id>/thumbnail.jpg`. Video is the only
part of the app that needs a network connection — everything else works offline.

## Testing

```bash
node tests/fidelity.mjs      # encoded programs vs the source tables
python3 -m http.server 8080  # then drive with Playwright at 390×844
```

The fidelity suite is the guard against silently corrupting a program's
prescription while refactoring; add a spot-check whenever you touch program data.
