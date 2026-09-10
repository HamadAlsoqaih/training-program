// ============================================================================
// sheets.js — every bottom sheet in the app.
//   historySheet      per-exercise log + trend
//   editExerciseSheet change sets/reps/duration/rest, with a day-or-phase scope
//   durationSheet     min:sec editor (timers, rest, session time)
//   textSheet         one-line text (substitutions, chosen arm exercise)
//   noteSheet / skipSheet / summarySheet / whereAmISheet / daySwapSheet
//   programNotesSheet nutrition + program notes
// ============================================================================
import { h, toast } from '../util.js';
import {
  EX, ytUrl, hasVideo, displayName, getDay, fmtSecs, schemeLabel,
  nutritionFor, notesFor, getProgram, phaseOf,
} from '../program.js';
import * as store from '../state.js';
import {
  historyFor, bestWeight, setNote, markDay, seedBefore, patchPlan, dayIdsForScope,
  isLiveDay,
} from '../completion.js';
import {
  dateForId, fmtDate, weekdayName, progOfWeekday, toISO, idToIndex, todayIndex,
  WEEKDAY_NAMES, weekSwaps, currentWeek,
} from '../schedule.js';
import { fmtMs } from '../timers.js';
import { lineChart } from '../charts.js';
import { jumpContactsForDay } from '../analytics.js';
import { openVideo } from '../video.js';

const root = () => document.getElementById('sheet-root');

export function openSheet(...children) {
  closeSheet();
  const sheet = h('div', { class: 'sheet' }, h('div', { class: 'grab' }), ...children);
  const backdrop = h('div', {
    class: 'sheet-backdrop',
    onclick: (e) => { if (e.target === backdrop) closeSheet(); },
  }, sheet);
  root().append(backdrop);
  return sheet;
}
export function closeSheet() { root().replaceChildren(); }

// --- exercise history --------------------------------------------------------
export function historySheet(exId, mode) {
  const ex = EX[exId];
  const all = historyFor(exId);
  const list = mode && ex.band ? all.filter((r) => r.mode === mode) : all;
  const best = bestWeight(list);

  const rows = list.slice(-14).reverse().map((entry) => {
    const day = getDay(entry.pid, entry.dayId);
    const date = dateForId(entry.dayId, entry.pid);
    const setsTxt = entry.sets.map((s) => {
      const wuTag = entry.wu > 0 && s.i < entry.wu ? 'WU ' : '';
      const reps = s.reps ?? (s.done ? entry.defReps : null);
      if (s.weight != null && reps != null) return `${wuTag}${s.weight}kg × ${reps}`;
      if (s.weight != null) return `${wuTag}${s.weight}kg`;
      if (reps != null) return `${wuTag}× ${reps}`;
      return s.done ? `${wuTag}✓` : '·';
    }).join('  ·  ');
    const partial = entry.doneCount < entry.total;
    return h('div', { class: 'card', style: 'padding:10px 12px' },
      h('div', { class: 'row' },
        h('div', { class: 'grow' },
          h('div', { class: 'small', style: 'font-weight:700' },
            `Week ${day.week} · ${weekdayName(day.d, day.week, entry.pid)}`,
            entry.alt ? h('span', { class: 'chip info', style: 'margin-left:6px' }, `↔ ${entry.alt}`) : null,
            entry.mode === 'cable' ? h('span', { class: 'chip info', style: 'margin-left:6px' }, 'cable') : null,
            partial ? h('span', {
              class: 'chip', style: 'color:var(--warn);border-color:rgba(251,146,60,.35);margin-left:6px',
            }, entry.wu > 0 ? `WS ${entry.wsDone}/${entry.wsTotal}` : `${entry.doneCount}/${entry.total} sets`) : null),
          h('div', { class: 'tiny faint' },
            `${getProgram(entry.pid).name} · ${fmtDate(date)}`),
        ),
      ),
      h('div', { class: 'small dim', style: 'margin-top:4px;font-variant-numeric:tabular-nums' }, setsTxt),
    );
  });

  const weights = list.map((e) => {
    const w = e.sets.filter((s) => s.weight != null).map((s) => +s.weight);
    return w.length ? { x: e.t, y: Math.max(...w) } : null;
  }).filter(Boolean);

  openSheet(
    h('div', { class: 'row', style: 'margin-bottom:10px' },
      h('div', { class: 'grow' },
        h('div', { class: 'h2' }, ex.band ? displayName(exId, mode) : ex.name),
        best != null ? h('div', { class: 'small dim' }, 'Best working weight: ', h('b', {}, `${best} kg`)) : null,
      ),
      hasVideo(exId)
        ? h('button', { class: 'btn sm', onclick: () => { closeSheet(); openVideo(exId); } }, '▶ Video')
        : h('a', { class: 'btn sm', href: ytUrl(exId), target: '_blank', rel: 'noopener' }, '🔎 How-to'),
    ),
    ex.note ? h('div', { class: 'banner', style: 'font-weight:500' }, ex.note) : null,
    weights.length >= 2 ? h('div', { class: 'card chartwrap', html: lineChart(weights, { unit: 'kg' }) }) : null,
    rows.length
      ? h('div', {}, h('div', { class: 'section-title' }, 'Log'), ...rows)
      : h('div', { class: 'chart-empty' }, 'No logged sessions yet — tick sets and enter weights to build history.'),
  );
}

// --- edit an exercise's prescription (with day / phase scope) ----------------
export function editExerciseSheet(pid, dayId, entry, rerender) {
  const ex = EX[entry.item.ex];
  const sch = entry.sch;
  const day = getDay(pid, dayId);
  const phase = phaseOf(pid, day.week);
  const phaseIds = dayIdsForScope(pid, dayId, 'phase');

  const num = (label, value, min = 0) => {
    const input = h('input', { class: 'txt', type: 'number', inputmode: 'numeric', min, value: String(value), style: 'text-align:center' });
    return { el: h('div', { class: 'grow' }, h('div', { class: 'tiny faint center' }, label), input), input };
  };

  const fields = [];
  let setsF, repsF, wuF, wsF, secsF;
  if (sch.t === 'sr') {
    setsF = num('SETS', sch.sets, 1); repsF = num('REPS', sch.reps, 1);
    fields.push(setsF.el, repsF.el);
  } else if (sch.t === 'time') {
    setsF = num('SETS', sch.sets, 1); secsF = num('SECONDS', sch.secs, 1);
    fields.push(setsF.el, secsF.el);
  } else {
    wuF = num('WARM-UP SETS', sch.wu, 0); wsF = num('WORKING SETS', sch.ws, 0);
    fields.push(wuF.el, wsF.el);
  }
  const restF = num('REST (SEC)', entry.rest, 0);

  const build = () => {
    const patch = {};
    if (sch.t === 'sr') { patch.sets = +setsF.input.value || 1; patch.reps = +repsF.input.value || 1; }
    else if (sch.t === 'time') { patch.sets = +setsF.input.value || 1; patch.secs = +secsF.input.value || 1; }
    else { patch.wu = Math.max(0, +wuF.input.value || 0); patch.ws = Math.max(0, +wsF.input.value || 0); }
    patch.rest = Math.max(0, +restF.input.value || 0);
    return patch;
  };
  const save = (scope) => {
    const n = patchPlan(pid, dayId, entry.key, build(), scope);
    closeSheet();
    toast(scope === 'phase' ? `Applied to ${n} day${n > 1 ? 's' : ''} in ${phase?.name || 'this phase'}` : 'Saved for this day');
    rerender({ keepScroll: true });
  };

  // Mid-workout (today, or a day with a running session): save straight away,
  // this day only — no scope question, nothing else touched.
  const live = isLiveDay(pid, dayId);

  openSheet(
    h('div', { class: 'h2', style: 'margin-bottom:2px' }, `Edit — ${ex.name}`),
    h('div', { class: 'tiny faint', style: 'margin-bottom:10px' },
      `Program prescribes ${schemeLabel(sch)}${entry.rest ? ` · rest ${fmtSecs(entry.rest)}` : ''}`),
    h('div', { class: 'row', style: 'gap:8px' }, ...fields),
    h('div', { class: 'row', style: 'gap:8px;margin-top:10px' }, restF.el),
    live
      ? h('div', {},
          h('div', { class: 'tiny faint', style: 'margin:14px 0 10px' },
            'Today\u2019s session — this change applies to today only.'),
          h('div', { class: 'row' },
            h('button', { class: 'btn grow', onclick: closeSheet }, 'Cancel'),
            h('button', { class: 'btn primary grow', onclick: () => save('day') }, 'Save'),
          ))
      : h('div', {},
          h('div', { class: 'section-title', style: 'margin-top:18px' }, 'Apply to'),
          h('button', { class: 'btn primary block', onclick: () => save('day') }, 'Just this day'),
          h('button', { class: 'btn block', style: 'margin-top:8px', onclick: () => save('phase') },
            `All of ${phase ? phase.name : 'this phase'} \u2014 ${phaseIds.length} day${phaseIds.length > 1 ? 's' : ''}`),
          h('div', { class: 'tiny faint', style: 'margin-top:8px' },
            'Phase scope changes the same day-slot in every week of this phase. Days you already completed are left untouched.'),
          h('button', { class: 'btn block', style: 'margin-top:12px', onclick: closeSheet }, 'Cancel'),
        ),
  );
}

// --- duration editor ---------------------------------------------------------
export function durationSheet(title, currentSecs, onSave, { hint } = {}) {
  const mIn = h('input', { class: 'txt', type: 'number', inputmode: 'numeric', min: 0, style: 'text-align:center' });
  const sIn = h('input', { class: 'txt', type: 'number', inputmode: 'numeric', min: 0, max: 59, style: 'text-align:center' });
  const setVal = (secs) => { mIn.value = Math.floor(secs / 60); sIn.value = secs % 60; };
  setVal(Math.max(0, Math.round(currentSecs)));
  const read = () => Math.max(0, (+mIn.value || 0) * 60 + (+sIn.value || 0));
  const presets = [10, 20, 30, 45, 60, 90, 120, 180];
  openSheet(
    h('div', { class: 'h2', style: 'margin-bottom:4px' }, title),
    hint ? h('div', { class: 'tiny faint', style: 'margin-bottom:8px' }, hint) : null,
    h('div', { class: 'row', style: 'margin:10px 0' },
      h('div', { class: 'grow' }, h('div', { class: 'tiny faint center' }, 'MIN'), mIn),
      h('div', { style: 'font-weight:800' }, ':'),
      h('div', { class: 'grow' }, h('div', { class: 'tiny faint center' }, 'SEC'), sIn),
    ),
    h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px' },
      ...presets.map((p) => h('button', { class: 'btn sm', onclick: () => setVal(p) }, fmtSecs(p)))),
    h('div', { class: 'row', style: 'margin-top:14px' },
      h('button', { class: 'btn grow', onclick: closeSheet }, 'Cancel'),
      h('button', { class: 'btn primary grow', onclick: () => { const v = read(); closeSheet(); onSave(v); } }, 'Save'),
    ),
  );
}

// --- one-line text -----------------------------------------------------------
export function textSheet(title, current, onSave, { placeholder, hint } = {}) {
  const input = h('input', { class: 'txt', placeholder: placeholder || '', value: current || '' });
  openSheet(
    h('div', { class: 'h2', style: 'margin-bottom:4px' }, title),
    hint ? h('div', { class: 'tiny faint', style: 'margin-bottom:8px' }, hint) : null,
    input,
    h('div', { class: 'row', style: 'margin-top:14px' },
      h('button', { class: 'btn grow', onclick: closeSheet }, 'Cancel'),
      current ? h('button', { class: 'btn grow', onclick: () => { closeSheet(); onSave(''); } }, 'Clear') : null,
      h('button', { class: 'btn primary grow', onclick: () => { const v = input.value; closeSheet(); onSave(v); } }, 'Save'),
    ),
  );
  setTimeout(() => input.focus(), 250);
}

// --- where am I --------------------------------------------------------------
export function whereAmISheet(pid, onDone) {
  const roll = store.setupOf(pid).rolloverHour ?? 4;
  const eff = new Date(Date.now() - roll * 3600 * 1000);
  const effNoon = new Date(eff.getFullYear(), eff.getMonth(), eff.getDate(), 12);
  const progDay = progOfWeekday(effNoon.getDay(), pid);
  const program = getProgram(pid);
  const cur = currentWeek(pid);

  const weekSel = h('select', { class: 'sel' },
    ...Array.from({ length: program.weeks }, (_, i) =>
      h('option', { value: i + 1, selected: i + 1 === cur }, `Week ${i + 1}`)));
  const seedTgl = h('input', { type: 'checkbox' });

  openSheet(
    h('div', { class: 'h2', style: 'margin-bottom:4px' }, '📍 Where are you now?'),
    h('div', { class: 'small dim', style: 'margin-bottom:12px' },
      `Today is ${WEEKDAY_NAMES[effNoon.getDay()]} → Day ${progDay} of whichever week you pick (from your weekday mapping). Only the week can be wrong — fix it here.`),
    weekSel,
    h('label', { class: 'row', style: 'margin-top:12px;gap:10px' },
      h('span', { class: 'switch' }, seedTgl, h('span', { class: 'knob' })),
      h('span', { class: 'small' }, 'Mark everything before today as done'),
    ),
    h('div', { class: 'row', style: 'margin-top:14px' },
      h('button', { class: 'btn grow', onclick: closeSheet }, 'Cancel'),
      h('button', {
        class: 'btn primary grow',
        onclick: () => {
          const anchorDay = `w${weekSel.value}d${progDay}`;
          store.update((st) => {
            const setup = st.programs[pid].setup;
            setup.anchorDate = toISO(effNoon);
            setup.anchorDay = anchorDay;
          });
          if (seedTgl.checked) seedBefore(pid, idToIndex(anchorDay));
          closeSheet();
          toast(`You're on Week ${weekSel.value} · ${WEEKDAY_NAMES[effNoon.getDay()]}`);
          onDone?.();
        },
      }, 'Save'),
    ),
  );
}

// --- one-off day swap --------------------------------------------------------
export function daySwapSheet(pid, week, onDone) {
  const daySel = (def) => h('select', { class: 'sel' },
    ...Array.from({ length: 7 }, (_, i) =>
      h('option', { value: i + 1, selected: i + 1 === def }, `Day ${i + 1} — ${weekdayName(i + 1, week, pid)}`)));
  const aSel = daySel(3), bSel = daySel(4);
  const existing = weekSwaps(week, pid);

  openSheet(
    h('div', { class: 'h2', style: 'margin-bottom:4px' }, `⇄ Swap days — Week ${week} only`),
    h('div', { class: 'small dim', style: 'margin-bottom:12px' },
      'Trade two days for this week (e.g. Friday ↔ Saturday). Your standing weekly schedule is untouched.'),
    existing.length ? h('div', { style: 'margin-bottom:10px' },
      ...existing.map((pair, idx) => h('div', { class: 'row', style: 'padding:4px 0' },
        h('div', { class: 'small grow' }, `Day ${pair[0]} ⇄ Day ${pair[1]}`),
        h('button', {
          class: 'btn sm danger',
          onclick: () => {
            store.update((st) => {
              const ws = st.programs[pid].setup.weekSwaps;
              ws[week] = (ws[week] || []).filter((_, i) => i !== idx);
              if (!ws[week].length) delete ws[week];
            });
            closeSheet(); onDone?.();
          },
        }, '✕ remove'),
      ))) : null,
    h('div', { class: 'row' }, aSel, h('div', { style: 'font-weight:800' }, '⇄'), bSel),
    h('div', { class: 'row', style: 'margin-top:14px' },
      h('button', { class: 'btn grow', onclick: closeSheet }, 'Cancel'),
      h('button', {
        class: 'btn primary grow',
        onclick: () => {
          const a = +aSel.value, b = +bSel.value;
          if (a === b) { toast('Pick two different days'); return; }
          store.update((st) => {
            const setup = st.programs[pid].setup;
            setup.weekSwaps = setup.weekSwaps || {};
            (setup.weekSwaps[week] = setup.weekSwaps[week] || []).push([a, b]);
          });
          closeSheet(); toast(`Week ${week}: Day ${a} ⇄ Day ${b}`); onDone?.();
        },
      }, 'Swap'),
    ),
  );
}

// --- day note ----------------------------------------------------------------
export function noteSheet(pid, dayId, onSaved) {
  const rec = store.day(dayId, pid);
  const ta = h('textarea', { class: 'note', placeholder: 'How did it go? Pain, PRs, energy…' });
  ta.value = rec?.note || '';
  openSheet(
    h('div', { class: 'h2', style: 'margin-bottom:10px' }, 'Day note'),
    ta,
    h('div', { class: 'row', style: 'margin-top:12px' },
      h('button', { class: 'btn grow', onclick: closeSheet }, 'Cancel'),
      h('button', {
        class: 'btn primary grow',
        onclick: () => { setNote(pid, dayId, ta.value.trim()); closeSheet(); toast('Note saved'); onSaved?.(); },
      }, 'Save'),
    ),
  );
  setTimeout(() => ta.focus(), 250);
}

// --- skip a whole day --------------------------------------------------------
export function skipSheet(pid, dayId, onDone) {
  const reasons = ['Sick', 'Travel', 'Too fatigued', 'No time', 'Pain / injury', 'Other'];
  let chosen = null;
  const btns = reasons.map((r) => h('button', {
    class: 'btn sm',
    onclick: (e) => { chosen = r; btns.forEach((b) => b.classList.remove('primary')); e.currentTarget.classList.add('primary'); },
  }, r));
  openSheet(
    h('div', { class: 'h2', style: 'margin-bottom:4px' }, 'Skip this day?'),
    h('div', { class: 'small dim', style: 'margin-bottom:12px' },
      'A skipped day closes out (the week can still close) but counts against adherence. To skip a single exercise instead, use “Organize day”.'),
    h('div', { style: 'display:flex;flex-wrap:wrap;gap:8px' }, btns),
    h('div', { class: 'row', style: 'margin-top:16px' },
      h('button', { class: 'btn grow', onclick: closeSheet }, 'Cancel'),
      h('button', {
        class: 'btn danger grow',
        onclick: () => { markDay(pid, dayId, 'skipped', { reason: chosen || '' }); closeSheet(); onDone?.(); },
      }, 'Skip day'),
    ),
  );
}

// --- session summary ---------------------------------------------------------
export function summarySheet({ pid, dayId, elapsed, setsDone, prs }, onClose) {
  const day = getDay(pid, dayId);
  const contacts = Math.round(jumpContactsForDay(pid, dayId));
  openSheet(
    h('div', { class: 'center', style: 'padding:8px 0 4px' },
      h('div', { class: 'confetti-pop', style: 'font-size:52px' }, '🏐'),
      h('div', { class: 'h1', style: 'margin-top:6px' }, 'Session complete'),
      h('div', { class: 'dim small' }, `Week ${day.week} · ${weekdayName(day.d, day.week, pid)} — ${day.title}`),
    ),
    h('div', { class: 'statgrid', style: 'margin-top:14px' },
      h('div', { class: 'stat' }, h('div', { class: 'v' }, fmtMs(elapsed)), h('div', { class: 'k' }, 'Duration')),
      h('div', { class: 'stat' }, h('div', { class: 'v' }, String(setsDone)), h('div', { class: 'k' }, 'Sets done')),
      h('div', { class: 'stat' }, h('div', { class: 'v' }, String(prs.length)), h('div', { class: 'k' }, 'PRs')),
      contacts ? h('div', { class: 'stat' },
        h('div', { class: 'v' }, String(contacts)), h('div', { class: 'k' }, 'Jump contacts')) : null,
    ),
    prs.length ? h('div', { class: 'card', style: 'border-color:var(--accent-soft)' },
      h('div', { class: 'small', style: 'font-weight:800;color:var(--accent);margin-bottom:4px' }, '🎉 New bests'),
      ...prs.map((p) => h('div', { class: 'small dim' },
        `${p.name}: `, h('b', {}, `${p.weight} kg`), p.prev != null ? ` (was ${p.prev} kg)` : ' (first log)')),
    ) : null,
    h('button', { class: 'btn block', style: 'margin-top:6px', onclick: () => { closeSheet(); noteSheet(pid, dayId, onClose); } }, '✍️ Add a note'),
    h('button', { class: 'btn primary block', style: 'margin-top:8px', onclick: () => { closeSheet(); onClose?.(); } }, 'Done'),
  );
}

// --- program notes & nutrition -----------------------------------------------
export function programNotesSheet(pid) {
  openSheet(
    h('div', { class: 'h2', style: 'margin-bottom:10px' }, 'Nutrition — daily targets'),
    h('div', { class: 'card' },
      ...nutritionFor(pid).map(([k, v]) => h('div', { class: 'row', style: 'padding:5px 0' },
        h('div', { class: 'grow small', style: 'font-weight:700' }, k),
        h('div', { class: 'small dim' }, v)))),
    h('div', { class: 'h2', style: 'margin:14px 0 10px' }, 'Program notes'),
    ...notesFor(pid).map((n) => h('div', { class: 'card small dim', style: 'padding:10px 12px' }, n)),
  );
}
