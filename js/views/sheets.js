// ============================================================================
// sheets.js — bottom sheets: exercise history, day note, skip, session
// summary, program notes & nutrition.
// ============================================================================
import { h, toast, escapeHtml } from '../util.js';
import { EX, ytUrl, NUTRITION, PROGRAM_NOTES, getDay, fmtSecs } from '../program.js';
import * as store from '../state.js';
import { historyFor, bestWeight, setNote, markDay, seedBefore } from '../completion.js';
import {
  dateForId, fmtDate, weekdayName, progOfWeekday, toISO, idToIndex, todayIndex,
  WEEKDAY_NAMES, weekSwaps,
} from '../schedule.js';
import { fmtMs } from '../timers.js';
import { lineChart } from '../charts.js';

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

// --- exercise history -------------------------------------------------------
export function historySheet(exId) {
  const ex = EX[exId];
  const hist = historyFor(exId);
  const best = bestWeight(hist);

  const rows = hist.slice(-14).reverse().map((entry) => {
    const day = getDay(entry.dayId);
    const date = dateForId(entry.dayId);
    const setsTxt = entry.sets.map((s) => {
      const wuTag = entry.wu > 0 && s.i < entry.wu ? 'WU ' : '';
      const reps = s.reps ?? (s.done ? entry.defReps : null); // blank reps → prescribed
      if (s.weight != null && reps != null) return `${wuTag}${s.weight}kg × ${reps}`;
      if (s.weight != null) return `${wuTag}${s.weight}kg`;
      if (reps != null) return `${wuTag}× ${reps}`;
      return s.done ? `${wuTag}✓` : '·';
    }).join('  ·  ');
    const partial = entry.doneCount < entry.total;
    const partialChip = partial
      ? h('span', {
          class: 'chip', style: 'color:var(--warn);border-color:rgba(251,146,60,.35);margin-left:6px',
        }, entry.wu > 0 ? `WS ${entry.wsDone}/${entry.wsTotal}` : `${entry.doneCount}/${entry.total} sets`)
      : null;
    return h('div', { class: 'card', style: 'padding:10px 12px' },
      h('div', { class: 'row' },
        h('div', { class: 'grow' },
          h('div', { class: 'small', style: 'font-weight:700' }, `Week ${day.week} · ${weekdayName(day.d, day.week)}`,
            entry.alt ? h('span', { class: 'chip info', style: 'margin-left:6px' }, `↔ ${entry.alt}`) : null,
            partialChip),
          h('div', { class: 'tiny faint' }, fmtDate(date)),
        ),
      ),
      h('div', { class: 'small dim', style: 'margin-top:4px;font-variant-numeric:tabular-nums' }, setsTxt),
    );
  });

  const weights = hist
    .map((e) => {
      const w = e.sets.filter((s) => s.weight != null).map((s) => +s.weight);
      return w.length ? { x: e.index, y: Math.max(...w) } : null;
    })
    .filter(Boolean);

  openSheet(
    h('div', { class: 'row', style: 'margin-bottom:10px' },
      h('div', { class: 'grow' },
        h('div', { class: 'h2' }, ex.name),
        best != null ? h('div', { class: 'small dim' }, `Best working weight: `, h('b', {}, `${best} kg`)) : null,
      ),
      h('a', { class: 'btn sm', href: ytUrl(exId), target: '_blank', rel: 'noopener' }, '▶ How-to'),
    ),
    ex.note ? h('div', { class: 'banner', style: 'font-weight:500' }, ex.note) : null,
    weights.length >= 2
      ? h('div', { class: 'card chartwrap', html: lineChart(weights, { unit: 'kg' }) })
      : null,
    rows.length
      ? h('div', {}, h('div', { class: 'section-title' }, 'Log'), ...rows)
      : h('div', { class: 'chart-empty' }, 'No logged sessions yet — tick sets and enter weights to build history.'),
  );
}

// --- duration editor --------------------------------------------------------
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

// --- "where are you now?" quick re-anchor -----------------------------------
export function whereAmISheet(onDone) {
  const s = store.get();
  const roll = s.setup.rolloverHour ?? 4;
  const eff = new Date(Date.now() - roll * 3600 * 1000);
  const effNoon = new Date(eff.getFullYear(), eff.getMonth(), eff.getDate(), 12);
  const progDay = progOfWeekday(effNoon.getDay());
  const curWeek = Math.min(15, Math.max(1, Math.floor(todayIndex() / 7) + 1));

  const weekSel = h('select', { class: 'sel' },
    ...Array.from({ length: 15 }, (_, i) => h('option', { value: i + 1, selected: i + 1 === curWeek }, `Week ${i + 1}`)));
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
            st.setup.anchorDate = toISO(effNoon);
            st.setup.anchorDay = anchorDay;
          });
          if (seedTgl.checked) seedBefore(idToIndex(anchorDay));
          closeSheet();
          toast(`You're on Week ${weekSel.value} · ${WEEKDAY_NAMES[effNoon.getDay()]}`);
          onDone?.();
        },
      }, 'Save'),
    ),
  );
}

// --- one-off day swap for a single week --------------------------------------
export function daySwapSheet(week, onDone) {
  const daySel = (def) => h('select', { class: 'sel' },
    ...Array.from({ length: 7 }, (_, i) =>
      h('option', { value: i + 1, selected: i + 1 === def }, `Day ${i + 1} — ${weekdayName(i + 1, week)}`)));
  const aSel = daySel(3), bSel = daySel(4);

  const existing = weekSwaps(week);
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
              st.setup.weekSwaps[week] = (st.setup.weekSwaps[week] || []).filter((_, i) => i !== idx);
              if (!st.setup.weekSwaps[week].length) delete st.setup.weekSwaps[week];
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
            st.setup.weekSwaps = st.setup.weekSwaps || {};
            (st.setup.weekSwaps[week] = st.setup.weekSwaps[week] || []).push([a, b]);
          });
          closeSheet();
          toast(`Week ${week}: Day ${a} ⇄ Day ${b}`);
          onDone?.();
        },
      }, 'Swap'),
    ),
  );
}

// --- one-line text editor (substitutions, names) ----------------------------
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

// --- day note ---------------------------------------------------------------
export function noteSheet(dayId, onSaved) {
  const rec = store.day(dayId);
  const ta = h('textarea', { class: 'note', placeholder: 'How did it go? Pain, PRs, energy…' });
  ta.value = rec?.note || '';
  openSheet(
    h('div', { class: 'h2', style: 'margin-bottom:10px' }, 'Day note'),
    ta,
    h('div', { class: 'row', style: 'margin-top:12px' },
      h('button', { class: 'btn grow', onclick: closeSheet }, 'Cancel'),
      h('button', {
        class: 'btn primary grow',
        onclick: () => { setNote(dayId, ta.value.trim()); closeSheet(); toast('Note saved'); onSaved?.(); },
      }, 'Save'),
    ),
  );
  setTimeout(() => ta.focus(), 250);
}

// --- skip day ---------------------------------------------------------------
export function skipSheet(dayId, onDone) {
  const reasons = ['Sick', 'Travel', 'Too fatigued', 'No time', 'Pain / injury', 'Other'];
  let chosen = null;
  const btns = reasons.map((r) =>
    h('button', {
      class: 'btn sm',
      onclick: (e) => {
        chosen = r;
        btns.forEach((b) => b.classList.remove('primary'));
        e.currentTarget.classList.add('primary');
      },
    }, r));
  openSheet(
    h('div', { class: 'h2', style: 'margin-bottom:4px' }, 'Skip this day?'),
    h('div', { class: 'small dim', style: 'margin-bottom:12px' },
      'A skipped day closes out (the week can still close) but counts against adherence.'),
    h('div', { style: 'display:flex;flex-wrap:wrap;gap:8px' }, btns),
    h('div', { class: 'row', style: 'margin-top:16px' },
      h('button', { class: 'btn grow', onclick: closeSheet }, 'Cancel'),
      h('button', {
        class: 'btn danger grow',
        onclick: () => { markDay(dayId, 'skipped', { reason: chosen || '' }); closeSheet(); onDone?.(); },
      }, 'Skip day'),
    ),
  );
}

// --- session summary --------------------------------------------------------
export function summarySheet({ dayId, elapsed, setsDone, prs }, onClose) {
  const day = getDay(dayId);
  openSheet(
    h('div', { class: 'center', style: 'padding:8px 0 4px' },
      h('div', { class: 'confetti-pop', style: 'font-size:52px' }, '🏐'),
      h('div', { class: 'h1', style: 'margin-top:6px' }, 'Session complete'),
      h('div', { class: 'dim small' }, `Week ${day.week} · ${weekdayName(day.d)} — ${day.title}`),
    ),
    h('div', { class: 'statgrid', style: 'margin-top:14px' },
      h('div', { class: 'stat' }, h('div', { class: 'v' }, fmtMs(elapsed)), h('div', { class: 'k' }, 'Duration')),
      h('div', { class: 'stat' }, h('div', { class: 'v' }, String(setsDone)), h('div', { class: 'k' }, 'Sets done')),
      h('div', { class: 'stat' }, h('div', { class: 'v' }, String(prs.length)), h('div', { class: 'k' }, 'PRs')),
    ),
    prs.length ? h('div', { class: 'card', style: 'border-color:rgba(251,191,36,.4)' },
      h('div', { class: 'small', style: 'font-weight:800;color:var(--accent);margin-bottom:4px' }, '🎉 New bests'),
      ...prs.map((p) => h('div', { class: 'small dim' }, `${p.name}: `, h('b', {}, `${p.weight} kg`), p.prev != null ? ` (was ${p.prev} kg)` : ' (first log)')),
    ) : null,
    h('button', { class: 'btn block', style: 'margin-top:6px', onclick: () => { closeSheet(); noteSheet(dayId, onClose); } }, '✍️ Add a note'),
    h('button', { class: 'btn primary block', style: 'margin-top:8px', onclick: () => { closeSheet(); onClose?.(); } }, 'Done'),
  );
}

// --- program notes & nutrition ---------------------------------------------
export function programNotesSheet() {
  openSheet(
    h('div', { class: 'h2', style: 'margin-bottom:10px' }, 'Nutrition — daily targets'),
    h('div', { class: 'card' },
      ...NUTRITION.map(([k, v]) => h('div', { class: 'row', style: 'padding:5px 0' },
        h('div', { class: 'grow small', style: 'font-weight:700' }, k),
        h('div', { class: 'small dim' }, v)))),
    h('div', { class: 'h2', style: 'margin:14px 0 10px' }, 'Program notes'),
    ...PROGRAM_NOTES.map((n) => h('div', { class: 'card small dim', style: 'padding:10px 12px' }, n)),
  );
}
