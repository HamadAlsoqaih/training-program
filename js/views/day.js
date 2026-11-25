// ============================================================================
// day.js — the workout screen.
//
// Performance notes (this is the screen used mid-set, so it must stay snappy):
//  * ticking a set, typing a weight, tapping a stepper or the contact counter
//    re-renders ONLY the affected card, never the whole day;
//  * every card reads last-session data from the memoised history index in
//    completion.js rather than scanning the program itself;
//  * cards use CSS content-visibility, so a 25-exercise day only paints what
//    is actually on screen.
// ============================================================================
import { h, toast } from '../util.js';
import {
  EX, getDay, getWeek, schemeLabel, fmtSecs, ytUrl, hasVideo, displayName, totalDays,
  getProgram, PROGRAM_LIST,
} from '../program.js';
import * as store from '../state.js';
import {
  plannedDay, requiredEntries, exerciseDone, exerciseSetsDone, exerciseSetsSkipped, dayProgress,
  firstOpenIndex, lastSessionFor, overloadHint, historyFor, bestWeight, dayTime,
  toggleSet, setLog, markDay, setNote, completeSection, setExerciseField,
  toggleSkipExercise, toggleSkipSet, deleteSet, addSet, moveExercise, moveSection,
  hasCustomPlan, resetDayPlan, setExerciseOrder,
  insertDeload, removeDeload, deloadPlanFor, isEasyDay, removeExercise, restoreExercise, saveDayFields,
} from '../completion.js';
import {
  fieldsFor, hasInputs, dayFields, saveFieldsEverywhere, toLatin, parseNum, BOX_STEP, bestBox, boxBetter, boxDir,
} from '../fields.js';
import {
  idToIndex, indexToId, clampIndex, todayId, todayIndex, dateForId, fmtDate,
  weekdayName, isSwapped, programStatus, realToday, toISO,
  todaySlot, isDeloadId, deloadIdParts, deloadBlock, deloadLength, deloadDayId,
  calIndexOfDayId, dayIdAtCal, lastCalIndex, currentWeek, WEEKDAY_NAMES, prepWeeks, dayLabel,
} from '../schedule.js';
import {
  startSession, pauseSession, resumeSession, finishSession, discardSession, sessionElapsedMs,
  setSessionElapsed, fmtMs, startCountdown, unlockAudio, chime,
} from '../timers.js';
import {
  historySheet, noteSheet, skipSheet, summarySheet, durationSheet, textSheet,
  whereAmISheet, editExerciseSheet, deloadSheet, weekOverviewSheet,
  programReportSheet, maybeCelebrateProgram, openSheet, closeSheet,
} from './sheets.js';
import { deloadAdvice } from '../analytics.js';
import { openVideo } from '../video.js';
import { makeSortable } from '../dragsort.js';

let timerInterval = null;
// Which sections are folded away. A section you finish folds itself — that is
// what stops a 25-exercise day turning into endless scrolling — and any header
// you tap remembers your choice for as long as you stay on the day.
const folded = new Map();   // `${pid}:${dayId}:${si}` → boolean
const foldKey = (pid, dayId, si) => `${pid}:${dayId}:${si}`;
const isFolded = (pid, dayId, si, secDone) => {
  const k = foldKey(pid, dayId, si);
  return folded.has(k) ? folded.get(k) : secDone;
};
let organize = false;   // "organize day" mode — reveals reorder / delete / skip
let organizeFor = null; // ...and it only applies to the day it was opened on

const holdKey = (exId, secs) => `${exId}@${secs}`;
const effHoldSecs = (exId, secs) => store.get().settings.durOv?.[holdKey(exId, secs)] ?? secs;
const effRestSecs = (exId, rest) => store.get().settings.restOv?.[holdKey(exId, rest)] ?? rest;

export function renderDay(pid, dayId, rerender) {
  const day = getDay(pid, dayId);
  if (!day) { location.hash = '#/today'; return h('div'); }

  const planned = plannedDay(pid, dayId);
  const s = store.get();
  const rec = store.day(dayId, pid) || {};
  const prog = dayProgress(pid, dayId);
  const isActive = pid === store.activePid();
  const status = programStatus(pid);
  // A clamped index is NOT today — only an active program can have a today.
  const isToday = isActive && status.state === 'active' && dayId === todayId();
  // An inserted deload day borrows the week it is deloading for phase colour
  // and navigation; it has no program index of its own.
  const dl = deloadIdParts(dayId);
  const block = dl ? deloadBlock(dl.block, pid) : null;
  const prep = day.prep || 0;                 // a prep week before Week 1
  const srcWeek = day.week ?? block?.week ?? 1;
  const index = dl ? (block?.at ?? 0) : idToIndex(dayId, pid);
  const week = getWeek(pid, srcWeek);
  const sessionActive = s.session?.dayId === dayId && s.session?.pid === pid;
  const date = isActive ? dateForId(dayId, pid) : null;
  const dayCtx = { pid, dayId, deload: !!day.light };

  clearInterval(timerInterval);
  // organize mode never leaks from one day to another
  const dayKey = `${pid}:${dayId}`;
  if (organizeFor !== dayKey) { organize = false; organizeFor = dayKey; }
  const container = h('div');
  const cardEls = new Map();   // entry.key → card element (for targeted updates)

  // ---- header -------------------------------------------------------------
  container.append(h('div', { class: 'dayhead' },
    h('div', { class: 'nav' },
      h('button', {
        class: 'navbtn', disabled: calIndexOfDayId(pid, dayId) <= -prepWeeks(pid) * 7,
        onclick: () => { location.hash = `#/day/${pid}/${stepDay(pid, dayId, -1)}`; },
      }, '‹'),
      h('div', { class: 'center grow' },
        h('a', { class: 'h1', style: 'display:block', href: `#/week/${pid}/${srcWeek}` },
          prep ? `Prep ${prep} of ${prepWeeks(pid)} · ${dateForId(dayId, pid) ? WEEKDAY_NAMES[dateForId(dayId, pid).getDay()] : weekdayName(day.d, 1, pid)}`
          : dl ? `Deload · ${dateForId(dayId, pid) ? WEEKDAY_NAMES[dateForId(dayId, pid).getDay()] : weekdayName(day.d, null, pid)}`
             : `Week ${day.week} · ${weekdayName(day.d, day.week, pid)}`),
        h('div', { class: 'row', style: 'justify-content:center;gap:6px;margin-top:4px;flex-wrap:wrap' },
          h('span', { class: 'chip', style: `color:${week.phase.color};border-color:${week.phase.color}44` },
            week.phase.name),
          dl ? h('span', { class: 'chip deload-chip' }, day.light ? 'DELOAD' : `before the deload · Week ${block.week}`) : null,
          date ? h('span', { class: 'chip' }, fmtDate(date)) : null,
          isToday ? h('span', { class: 'chip accent' }, 'TODAY') : null,
          prog.status === 'done' ? h('span', { class: 'chip good' }, rec.auto ? '✓ done (assumed)' : '✓ done') : null,
          prog.status === 'skipped' ? h('span', { class: 'chip bad' }, 'skipped') : null,
          !dl && !prep && isSwapped(day.week, day.d, pid) ? h('span', { class: 'chip info' }, '⇄ swapped') : null,
          hasCustomPlan(pid, dayId) ? h('span', { class: 'chip info' }, '✎ edited') : null,
          isEasyDay(pid, dayId) && !prep ? h('span', { class: 'chip good' }, '🌱 easy week') : null,
        ),
        isToday ? h('div', { class: 'row', style: 'justify-content:center;gap:10px;margin-top:6px' },
          h('button', {
            class: 'chip', onclick: () => weekOverviewSheet(pid, rerender),
          }, '📅 This week'),
          h('button', {
            class: 'tiny faint', style: 'text-decoration:underline',
            onclick: () => whereAmISheet(pid, rerender),
          }, 'wrong week? fix it'),
        ) : null,
      ),
      h('button', {
        class: 'navbtn', disabled: !dl && index === totalDays(pid) - 1,
        onclick: () => { location.hash = `#/day/${pid}/${stepDay(pid, dayId, 1)}`; },
      }, '›'),
    ),
    h('div', { class: 'center dim small', style: 'font-weight:600' }, day.title),
    isActive ? h('div', { class: 'center tiny faint', style: 'margin-top:3px' },
      `Today is ${fmtDate(realToday(pid))}`) : null,
    !isActive ? h('div', { class: 'center', style: 'margin-top:6px' },
      h('span', { class: 'chip' }, `${week.program.name} — not your active program`)) : null,
    !isToday && isActive ? h('div', { class: 'center', style: 'margin-top:6px' },
      h('a', { class: 'chip info', href: '#/today' }, '↩ jump to today')) : null,
  ));

  if (dl && day.light) {
    container.append(h('div', { class: 'banner deload' },
      h('div', { style: 'font-weight:700;margin-bottom:4px' }, '🌙 Deload week'),
      `Same sessions, one set each, and weights around 60% of your last. `
      + `${deloadLength(block)} day${deloadLength(block) > 1 ? 's' : ''} of it, then Week ${block.week} `
      + 'starts again from Day 1 at full volume. Cardio carries on as normal.'));
  } else if (prep) {
    container.append(h('div', { class: 'banner' },
      h('div', { style: 'font-weight:700;margin-bottom:4px' }, `🌱 Prep week ${prep} of ${prepWeeks(pid)}`),
      'Your Week 1 sessions, lighter: 2 sets wherever the program says 3 or more. Learn the movements and pick weights you could lift for a few more reps. Week 1 starts after the prep weeks.'));
  } else if (week.badge && !dl) {
    container.append(h('div', { class: `banner ${week.badge.includes('DELOAD') ? 'deload' : ''}` }, week.badge));
  }
  if (isToday && status.state === 'active') {
    const advice = deloadAdviceBanner(pid, rerender);
    if (advice) container.append(advice);
  }
  if (isToday && status.state === 'active' && !dl && !prep) {
    const behind = todayIndex() - firstOpenIndex(pid);
    if (behind > 0) {
      container.append(h('div', { class: 'banner behind' },
        `You're ${behind} day${behind > 1 ? 's' : ''} behind schedule — first open day: `,
        h('a', { href: `#/day/${pid}/${indexToId(firstOpenIndex(pid), pid)}`, style: 'text-decoration:underline;font-weight:800' },
          labelFor(pid, indexToId(firstOpenIndex(pid), pid))),
      ));
    }
  }

  // ---- rest-only days -----------------------------------------------------
  if (day.kind === 'off') {
    container.append(restDayCard(pid, dayId, prog, rerender));
    container.append(footerButtons(pid, dayId, rec, prog, rerender));
    return container;
  }

  // ---- session bar + at-a-glance -----------------------------------------
  container.append(sessionBar(pid, dayId, sessionActive, prog, rerender));

  if (!sessionActive && prog.status !== 'done' && prog.status !== 'skipped' && prog.pct === 0) {
    container.append(h('div', { class: 'card row' },
      h('div', { class: 'grow' },
        h('div', { class: 'small', style: 'font-weight:700' },
          `${requiredEntries(planned).length} exercises · ~${estimateMinutes(planned)} min incl. cardio`),
        h('div', { class: 'tiny faint' }, 'Start the workout to track your time and get rest timers.'),
      ),
    ));
  }

  // ---- organize toggle ----------------------------------------------------
  container.append(h('div', { class: 'row', style: 'margin:14px 2px 0;gap:8px' },
    h('button', {
      class: `btn sm grow${organize ? ' primary' : ''}`,
      onclick: () => { organize = !organize; rerender({ keepScroll: true }); },
    }, organize ? '✓ Done organizing' : '↕ Organize day'),
    hasCustomPlan(pid, dayId) ? h('button', {
      class: 'btn sm',
      onclick: () => {
        if (!confirm('Reset this day back to the program\'s original layout and prescription?')) return;
        resetDayPlan(pid, dayId); toast('Day reset'); rerender({ keepScroll: true });
      },
    }, '↺ Reset') : null,
    h('button', {
      class: 'btn sm',
      onclick: () => {
        // fold everything unless it is all folded already, in which case open up
        const keys = planned.sections.map((b) => foldKey(pid, dayId, b.si));
        const allShut = planned.sections.every((b, i) =>
          folded.has(keys[i]) ? folded.get(keys[i])
            : b.entries.every((e) => e.item.opt || e.skipped || exerciseDone(pid, dayId, e)));
        for (const k of keys) folded.set(k, !allShut);
        rerender({ keepScroll: true });
      },
    }, '⌃⌄'),
  ));
  if (organize) {
    container.append(h('div', { class: 'banner', style: 'margin-top:8px' },
      'Hold any exercise card and drag it to reorder, hold a single set to skip just that set, and tap a section heading to fold it away — all of that works any time, not just here. Organize mode adds: move whole sections, edit reps and timers, and add or delete sets.'));
  }

  // ---- sections -----------------------------------------------------------
  const ctx = { pid, dayId, planned, dayCtx, rerender, cardEls, container, isToday, inputs: new Map() };
  // which card is open: the one holding your next set (+ its superset partner);
  // cards you opened or closed yourself keep that until the next set moves on
  ctx.activeKey = nextSet(pid, dayId)?.entry.key ?? null;
  ctx.activeKeys = activeKeysFor(pid, dayId, planned);
  ctx.currentKey = ctx.activeKey;
  const dk = `${pid}:${dayId}`;
  if (lastActive.get(dk) !== ctx.activeKey) {
    for (const k of [...manualOpen.keys()]) if (k.startsWith(`${dk}:`)) manualOpen.delete(k);
    lastActive.set(dk, ctx.activeKey);
  }

  planned.sections.forEach((block, pos) => {
    const { si, sec, entries } = block;
    const secDone = entries.every((e) => e.item.opt || e.skipped || exerciseDone(pid, dayId, e));
    const fold = isFolded(pid, dayId, si, secDone);
    const toggle = h('button', { class: 'sectoggle' },
      h('span', { class: 'chev' }, fold ? '▸' : '▾'),
      sec.title,
      h('span', { class: 'count' }, secDone ? ' ✓' : ` ${entries.length}`),
    );
    const head = h('div', { class: `section-title${fold ? ' folded' : ''}`, 'data-si': si },
      toggle,
      organize ? h('span', { class: 'row', style: 'gap:4px;order:9' },
        h('button', { class: 'iconbtn', disabled: pos === 0, 'aria-label': 'Move section up',
          onclick: () => { moveSection(pid, dayId, si, -1); rerender({ keepScroll: true }); } }, '↑'),
        h('button', { class: 'iconbtn', disabled: pos === planned.sections.length - 1, 'aria-label': 'Move section down',
          onclick: () => { moveSection(pid, dayId, si, +1); rerender({ keepScroll: true }); } }, '↓'),
      ) : (!secDone && prog.status !== 'skipped' ? h('button', {
        class: 'secall',
        onclick: () => {
          unlockAudio();
          const just = completeSection(pid, dayId, entries);
          if (just) onDayCompleted(pid, dayId, rerender);
          else { toast(`${sec.title} ✓`); rerender({ keepScroll: true }); }
        },
      }, '✓ all') : null),
    );
    container.append(head);

    // Cards live in a sortable list. A superset is ONE draggable unit so a pair
    // never gets split. Each unit remembers which program items it holds, so a
    // visual reorder maps straight back to the saved order.
    const list = h('div', { class: 'sec-list' });
    const removed = entries.filter((e) => e.removed);
    let i = 0;
    while (i < entries.length) {
      const e = entries[i];
      if (e.removed) { i++; continue; }          // taken off this day — listed below the cards
      if (e.item.ss && entries[i + 1]?.item.ss === e.item.ss) {
        const group = h('div', { class: 'ss-group', 'data-sortable': '' },
          h('span', { class: 'ss-label' }, 'Superset'));
        const iis = [];
        let j = i;
        while (j < entries.length && entries[j].item.ss === e.item.ss) {
          if (!entries[j].removed) group.append(buildCard(ctx, entries[j], j, entries.length));
          iis.push(entries[j].ii);
          j++;
        }
        group.dataset.iis = iis.join(',');
        if (group.querySelector('.ex')) list.append(group);   // both removed: no empty box
        i = j;
      } else {
        const card = buildCard(ctx, e, i, entries.length);
        card.setAttribute('data-sortable', '');
        card.dataset.iis = String(e.ii);
        list.append(card);
        i++;
      }
    }
    list.hidden = fold;
    toggle.onclick = () => {
      const next = !list.hidden;
      list.hidden = next;
      folded.set(foldKey(pid, dayId, si), next);
      head.classList.toggle('folded', next);
      toggle.querySelector('.chev').textContent = next ? '▸' : '▾';
    };
    container.append(list);
    if (removed.length && !fold) {
      container.append(h('div', { class: 'removedrow' },
        h('span', { class: 'tiny faint' }, 'Removed today:'),
        ...removed.map((e) => h('button', {
          class: 'chip', onclick: () => { restoreExercise(pid, dayId, e.key); toast(`${EX[e.item.ex].name} is back`); rerender({ keepScroll: true }); },
        }, `↺ ${EX[e.item.ex].name}`))));
    }

    makeSortable(list, {
      onCommit: (from, to) => {
        const units = [...list.children].map((el) => el.dataset.iis.split(',').map(Number));
        const [moved] = units.splice(from, 1);
        units.splice(to, 0, moved);
        setExerciseOrder(pid, dayId, si, units.flat());
        toast('Order saved');
        rerender({ keepScroll: true });
      },
    });
  });

  container.append(footerButtons(pid, dayId, rec, prog, rerender));
  if (rec.note) {
    container.append(h('div', { class: 'card', onclick: () => noteSheet(pid, dayId, rerender) },
      h('div', { class: 'tiny faint', style: 'font-weight:700;text-transform:uppercase;letter-spacing:.06em' }, 'Note'),
      h('div', { class: 'small dim', style: 'margin-top:3px;white-space:pre-wrap' }, rec.note)));
  }
  return container;
}

// "15-Week Program" → "15-Week"; "12-Week Vert Code" → "12-Week Vert Code"
const shortProgramName = (pid) => getProgram(pid).name.replace(/ Program$/, '');

// Shown on #/today when the active program has not started yet, or has ended.
export function renderProgramGate(pid, status, rerender) {
  const program = getProgram(pid);
  const other = PROGRAM_LIST.filter((p) => p.id !== pid && store.prog(p.id).started);
  const before = status.state === 'before';
  const wrap = h('div');

  wrap.append(h('div', { class: 'dayhead' },
    h('div', { class: 'center' },
      h('div', { class: 'h1' }, program.name),
      h('div', { class: 'tiny faint', style: 'margin-top:4px' }, `Today is ${fmtDate(realToday(pid))}`)),
  ));

  wrap.append(h('div', { class: 'card restday' },
    h('div', { class: 'emoji' }, before ? '📅' : '🏁'),
    h('div', { class: 'h2', style: 'margin-top:8px' },
      before ? `Starts ${fmtDate(status.startDate)}` : 'Program complete'),
    h('div', { class: 'bignum', style: 'margin-top:8px;color:var(--accent)' },
      before ? `in ${status.daysUntil} day${status.daysUntil === 1 ? '' : 's'}`
             : `${program.weeks} weeks done`),
    h('div', { class: 'small dim', style: 'margin:10px auto 0;max-width:330px' },
      before
        ? 'Nothing to train yet — this program begins on that date and today\u2019s workout will appear here automatically.'
        : `The last day was ${fmtDate(status.endDate)}. Review it on the Progress tab, or start something new.`),
  ));

  if (!before) {
    wrap.append(h('button', {
      class: 'btn primary block', style: 'min-height:52px',
      onclick: () => programReportSheet(pid, { celebrate: true }),
    }, '🏆 See how it went & export'));
  }

  if (before) {
    wrap.append(h('button', {
      class: 'btn primary block', style: 'min-height:52px',
      onclick: () => {
        if (!confirm(`Start ${program.name} today instead of ${fmtDate(status.startDate)}?`)) return;
        store.update((s) => {
          const setup = s.programs[pid].setup;
          setup.anchorDate = toISO(realToday(pid));
          setup.anchorDay = 'w1d1';
        });
        toast('Started today');
        rerender();
      },
    }, '▶ Start today instead'));
    wrap.append(h('a', { class: 'btn block', style: 'margin-top:8px', href: `#/day/${pid}/w1d1` },
      'Preview Day 1'));
  } else {
    wrap.append(h('a', { class: 'btn primary block', style: 'min-height:52px', href: '#/progress' },
      'See your progress'));
    wrap.append(h('a', { class: 'btn block', style: 'margin-top:8px', href: `#/start/${pid}/restart` },
      '↺ Run it again from Week 1'));
  }

  wrap.append(h('a', { class: 'btn block', style: 'margin-top:8px', href: `#/program/${pid}` },
    'Browse the whole program'));
  for (const p of other) {
    wrap.append(h('button', {
      class: 'btn block', style: 'margin-top:8px',
      onclick: () => { store.setActiveProgram(p.id); toast(`${p.name} is now active`); rerender(); },
    }, `⇄ Switch to ${p.name}`));
  }
  return wrap;
}

const labelFor = (pid, dayId) => dayLabel(pid, dayId);

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------
function buildCard(ctx, entry, pos, count) {
  const el = exerciseCard(ctx, entry, pos, count);
  ctx.cardEls.set(entry.key, el);
  return el;
}

// Replace one card in place — the hot path when ticking sets.
function refreshCard(ctx, key) {
  const planned = plannedDay(ctx.pid, ctx.dayId);
  ctx.planned = planned;
  const entry = planned.byKey.get(key);
  const old = ctx.cardEls.get(key);
  if (!entry || !old || !old.parentNode) return;
  const block = planned.sections.find((b) => b.entries.some((e) => e.key === key));
  const pos = block.entries.findIndex((e) => e.key === key);
  const next = exerciseCard(ctx, entry, pos, block.entries.length);
  old.replaceWith(next);
  ctx.cardEls.set(key, next);
  refreshSectionHeads(ctx);
  fillNextLine(ctx.container, ctx.pid, ctx.dayId);
}

// Update just the "n / ✓" counters in section headers.
function refreshSectionHeads(ctx) {
  for (const block of ctx.planned.sections) {
    const head = ctx.container.querySelector(`.section-title[data-si="${block.si}"] .count`);
    if (!head) continue;
    const done = block.entries.every((e) => e.item.opt || e.skipped || exerciseDone(ctx.pid, ctx.dayId, e));
    head.textContent = done ? ' ✓' : ` ${block.entries.length}`;
  }
}

const ARM_CHOICE = new Set(['triceps', 'biceps']);

// --- shosho-style flow ---------------------------------------------------------
// One card is open: the one holding your next set (both cards of a superset).
// The rest are one-line rows. Tapping a row opens it; that choice lasts until
// you move on to the next exercise, then the flow takes over again.
const manualOpen = new Map();   // `${pid}:${dayId}:${key}` → true / false
const lastActive = new Map();   // `${pid}:${dayId}` → the open card's key
const editingSets = new Set();  // `${pid}:${dayId}:${key}` showing 🗑 instead of ticks
const cardKey = (ctx, key) => `${ctx.pid}:${ctx.dayId}:${key}`;
const isOpen = (ctx, entry) => {
  if (organize) return true;
  const m = manualOpen.get(cardKey(ctx, entry.key));
  return m ?? ctx.activeKeys.has(entry.key);
};
// the keys that open by themselves: the next set's exercise and its superset partner
function activeKeysFor(pid, dayId, planned) {
  const nx = nextSet(pid, dayId);
  const out = new Set();
  if (!nx) return out;
  out.add(nx.entry.key);
  const ss = nx.entry.item.ss;
  if (ss) {
    const block = planned.sections.find((b) => b.entries.some((e) => e.key === nx.entry.key));
    for (const e of block?.entries || []) if (e.item.ss === ss && !e.removed) out.add(e.key);
  }
  return out;
}
// Rest after a set. In a superset you rest once per ROUND (one set of each):
// if a partner still owes a set to this round, go straight to it, no rest;
// otherwise the round is over — also when the partner has run out of sets
// (3 sets against 2: the third is a round on its own) — and you rest for the
// superset's rest, the longest any of its exercises asks for.
function restAfterSet(pid, dayId, entry) {
  const own = effRestSecs(entry.item.ex, entry.rest);
  const ss = entry.item.ss;
  if (!ss) return own;
  const planned = plannedDay(pid, dayId);
  const block = planned?.sections.find((b) => b.entries.some((e) => e.key === entry.key));
  const group = (block?.entries || []).filter((e) => e.item.ss === ss && !e.removed && !e.skipped);
  const settled = (e) => exerciseSetsDone(pid, dayId, e) + exerciseSetsSkipped(pid, dayId, e);
  const mine = settled(entry);
  const partnerOwes = group.some((e) => e.key !== entry.key && settled(e) < e.sets && settled(e) < mine);
  if (partnerOwes) return 0;
  return Math.max(own, ...group.map((e) => effRestSecs(e.item.ex, e.rest)));
}

// a superset opens and closes as one
function setOpen(ctx, entry, open) {
  const block = ctx.planned.sections.find((b) => b.entries.some((e) => e.key === entry.key));
  const keys = entry.item.ss
    ? (block?.entries || []).filter((e) => e.item.ss === entry.item.ss).map((e) => e.key)
    : [entry.key];
  for (const k of keys) { manualOpen.set(cardKey(ctx, k), open); refreshCard(ctx, k); }
}
// After any change: if the next set moved to another exercise, redraw and
// bring that card into view; otherwise just refresh this card.
function afterChange(ctx, key) {
  const nowActive = nextSet(ctx.pid, ctx.dayId)?.entry.key ?? null;
  if (nowActive !== ctx.activeKey) { ctx.rerender({ keepScroll: true, scrollNext: true }); return; }
  refreshCard(ctx, key);
}

// The kg / box value shown on a closed row: what's logged on the first set,
// else what you did last time.
function summaryLine(ctx, entry, f, last) {
  const { sch } = entry;
  const parts = [`${schemeLabel(sch)}${sch.t === 'sr' ? ' reps' : ''}`];
  const sets = store.day(ctx.dayId, ctx.pid)?.ex?.[entry.key]?.sets || [];
  const pick = (k) => {
    const logged = sets.find((x) => x && x[k] != null && x[k] !== '');
    if (logged) return logged[k];
    const prev = last?.sets?.find((x) => x[k] != null);
    return prev ? prev[k] : null;
  };
  if (f.weight) { const w = pick('weight'); parts.push(w != null ? `${w} kg` : 'kg not set'); }
  if (f.box) { const b = pick('box'); if (b != null) parts.push(`box ${b} cm`); }
  return parts.join(' · ');
}

function exerciseCard(ctx, entry, pos, count) {
  const { pid, dayId, dayCtx, rerender } = ctx;
  const { item, key, sch } = entry;
  const ex = EX[item.ex];
  const done = exerciseDone(pid, dayId, entry);
  const isCurrent = key === ctx.currentKey && !entry.skipped;
  const f = fieldsFor(pid, dayId, entry);
  const inputs = hasInputs(f);
  const rec = store.day(dayId, pid);
  const exRec = rec?.ex?.[key];
  const alt = exRec?.alt || '';
  const isArmChoice = ARM_CHOICE.has(item.ex);
  const mode = entry.mode;
  const effRest = effRestSecs(item.ex, entry.rest);
  // a timed exercise keeps its own seconds; a timer added to another one starts at 30 s
  const baseSecs = sch.t === 'time' ? sch.secs : 0;
  const effSecs = f.timer ? (store.get().settings.durOv?.[holdKey(item.ex, baseSecs)] ?? (baseSecs || f.secs || 30)) : null;
  const name = ex.band ? displayName(item.ex, mode) : ex.name;
  const open = isOpen(ctx, entry);
  const last = inputs ? lastSessionFor(item.ex, dayCtx, ex.band ? mode : undefined) : null;
  const doneN = exerciseSetsDone(pid, dayId, entry);
  const setRec = exRec?.sets || [];

  const card = h('div', {
    class: `ex${done ? ' done' : ''}${isCurrent ? ' current' : ''}${item.opt ? ' optional' : ''}${entry.skipped ? ' skipped' : ''}${open ? '' : ' closed'}`,
    'data-exkey': key,
    // Set here (not in the section loop) so a card rebuilt by refreshCard()
    // after a tick keeps its drag handle — otherwise reordering silently died
    // on exactly the day you were training.
    'data-sortable': '',
    'data-iis': String(entry.ii),
  });

  // --- closed: one line, tap to open ---------------------------------------
  if (!open) {
    card.append(h('button', {
      class: 'ex-line',
      onclick: () => setOpen(ctx, entry, true),
    },
      h('span', { class: `ex-idx${done ? ' ok' : ''}` }, done ? '✓' : String(pos + 1)),
      h('span', { class: 'grow', style: 'min-width:0' },
        h('span', { class: 'ex-name' }, name,
          entry.skipped ? h('span', { class: 'chip bad', style: 'margin-left:7px' }, 'skipped') : null),
        h('span', { class: 'ex-sum' }, summaryLine(ctx, entry, f, last))),
      h('span', { class: 'sdots' }, ...Array.from({ length: entry.sets }, (_, i) =>
        h('i', { class: setRec[i]?.done ? 'on' : setRec[i]?.skipped ? 'sk' : '' }))),
      h('span', { class: 'chevd', 'aria-hidden': 'true' }, '▾')));
    return card;
  }

  // --- head ---
  card.append(h('div', { class: 'ex-head' },
    h('div', { class: 'grow' },
      h('button', { class: 'ex-name', style: 'text-align:left', onclick: () => historySheet(item.ex, mode) },
        name,
        item.opt ? h('span', { class: 'chip', style: 'margin-left:7px' }, 'optional') : null,
        entry.skipped ? h('span', { class: 'chip bad', style: 'margin-left:7px' }, 'skipped') : null,
        entry.edited ? h('span', { class: 'chip info', style: 'margin-left:7px' }, '✎') : null,
      ),
      alt && !isArmChoice ? h('div', { class: 'chip info', style: 'margin-top:4px' }, `↔ ${alt}`) : null,
      h('div', { class: 'ex-meta' },
        h('span', {}, h('b', {},
          sch.t === 'time' && effSecs !== sch.secs ? `${sch.sets}×${fmtSecs(effSecs)}` : schemeLabel(sch)),
          sch.t === 'sr' ? ' reps' : '',
          item.side ? h('span', { class: 'faint' }, ' each side') : null,
        ),
        entry.rest ? h('button', { style: 'color:inherit',
          onclick: () => durationSheet(`Rest — ${ex.name}`, effRest, (secs) => {
            store.update((st) => { st.settings.restOv[holdKey(item.ex, entry.rest)] = secs; });
            toast(`Rest saved: ${fmtSecs(secs)} (remembered)`);
            refreshCard(ctx, key);
          }, { hint: `Program says ${fmtSecs(entry.rest)}. Remembered for future sessions until the program changes it.` }),
        }, '⏱ ', h('b', {}, fmtSecs(effRest)), ' ✎') : null,
      ),
      (ex.note || item.note) ? h('div', { class: 'ex-note' }, [ex.note, item.note].filter(Boolean).join(' · ')) : null,
    ),
    h('div', { class: 'ex-icons' },
      h('button', {
        class: `ytlink${entry.skipped ? ' on' : ''}`,
        'aria-label': entry.skipped ? 'Unskip this exercise' : 'Skip this exercise',
        onclick: () => {
          toggleSkipExercise(pid, dayId, key, !entry.skipped, 'day');
          toast(entry.skipped ? `${ex.name} back in` : `${ex.name} skipped`);
          rerender({ keepScroll: true });
        },
      }, entry.skipped ? '↺' : '⤼'),
      hasVideo(item.ex) ? h('button', {
        class: 'ytlink vid-open', 'aria-label': 'Play exercise video',
        onclick: () => openVideo(item.ex),
      }, '▶') : h('a', {
        class: 'ytlink', href: ytUrl(item.ex), target: '_blank', rel: 'noopener', 'aria-label': 'Search how-to video',
      }, '🔎'),
      !isArmChoice ? h('button', {
        class: 'ytlink', 'aria-label': 'Log a substitution',
        onclick: () => textSheet(`Substitution — ${ex.name}`, alt, (v) => {
          setExerciseField(pid, dayId, key, { alt: v.trim() });
          refreshCard(ctx, key);
        }, { placeholder: 'e.g. cable instead of band', hint: 'What did you actually do? Shown on this card and in history.' }),
      }, '↔') : null,
      organize ? null : h('button', {
        class: 'ytlink', 'aria-label': `Close ${ex.name}`,
        onclick: () => setOpen(ctx, entry, false),
      }, '⌃'),
    ),
  ));

  // --- band ↔ cable toggle (this day only) ---
  if (ex.band) {
    card.append(h('div', { class: 'seg' },
      ...['band', 'cable'].map((m) => h('button', {
        class: `seg-btn${mode === m ? ' on' : ''}`,
        onclick: () => {
          if (mode === m) return;
          setExerciseField(pid, dayId, key, { mode: m });
          refreshCard(ctx, key);
        },
      }, m === 'band' ? 'Band' : 'Cable + weight')),
    ));
  }

  // --- arm "exercise of choice" name ---
  if (isArmChoice) {
    const lastAlt = lastSessionFor(item.ex, dayCtx)?.alt;
    const nameIn = h('input', {
      class: 'txt', style: 'height:42px;margin-top:8px',
      placeholder: lastAlt ? `last time: ${lastAlt}` : 'Which exercise? e.g. Rope Pushdown',
      value: alt,
      onchange: () => setExerciseField(pid, dayId, key, { alt: nameIn.value.trim() }),
    });
    card.append(nameIn);
  }

  // --- overload: every working set clean last time → today starts heavier ---
  // The new weight is already in the boxes; you can still type over it.
  const bump = f.weight && !entry.skipped && !dayCtx.deload && !isEasyDay(pid, dayId)
    ? overloadHint(item.ex, dayCtx, ex.band ? mode : undefined) : null;
  if (bump) bump.next = Math.round((bump.lastWeight + BUMP_KG) * 10) / 10;
  if (bump && !done && doneN === 0) {
    card.append(h('div', { class: 'hint' },
      `Ready to add weight: every set clean at ${bump.lastWeight} kg last time → today starts at ${bump.next} kg`));
  }

  // --- sets ---
  const editing = editingSets.has(cardKey(ctx, key));
  const setsWrap = h('div', { class: `sets${inputs ? '' : ' ticks'}` });
  for (let i = 0; i < entry.sets; i++) {
    setsWrap.append(setRow(ctx, entry, i, last, f, bump, editing));
  }
  card.append(setsWrap);

  // --- timer (timed exercises, or a timer you added) ---
  if (f.timer) {
    card.append(h('div', { class: 'ex-actions' },
      h('button', {
        class: 'timerbtn',
        onclick: () => {
          unlockAudio();
          startCountdown({
            label: ex.name, secs: effSecs, kind: 'hold',
            // a timed exercise logs its next set when the hold ends; a timer you
            // added to a rep exercise just counts down
            onDone: sch.t !== 'time' ? null : () => {
              const cur = store.day(dayId, pid)?.ex?.[key]?.sets || [];
              for (let i = 0; i < entry.sets; i++) {
                if (!cur[i]?.done && !cur[i]?.skipped) {
                  const { dayJustCompleted } = toggleSet(pid, dayId, entry, i);
                  const r = restAfterSet(pid, dayId, entry);
                  if (r > 0 && store.get().settings.autoRest && !dayJustCompleted) {
                    startCountdown({ label: restLabel(pid, dayId), secs: r, kind: 'rest' });
                  }
                  if (dayJustCompleted) { onDayCompleted(pid, dayId, rerender); return; }
                  break;
                }
              }
              afterChange(ctx, key);
            },
          });
        },
      }, `▶ ${fmtSecs(effSecs)} timer`),
      h('button', {
        class: 'timerbtn', style: 'flex:0 0 auto', 'aria-label': 'Edit timer duration',
        onclick: () => durationSheet(`Timer — ${ex.name}`, effSecs, (secs) => {
          store.update((st) => { st.settings.durOv[holdKey(item.ex, baseSecs)] = secs; });
          toast(`Timer saved: ${fmtSecs(secs)} (remembered)`);
          refreshCard(ctx, key);
        }, { hint: sch.t === 'time'
          ? `Program says ${fmtSecs(sch.secs)}. Remembered for future sessions; when the program itself changes the duration, the new value takes over.`
          : 'Remembered for this exercise.' }),
      }, '✎'),
    ));
  }

  // --- ground-contact counter ---
  if (item.counter) card.append(contactCounter(ctx, entry));

  // --- add / delete sets, and the card's fields ---
  card.append(h('div', { class: 'cardfoot' },
    h('button', { class: 'btn sm', onclick: () => { addSet(pid, dayId, entry); afterChange(ctx, key); } }, '+ set'),
    entry.sets > 0 ? h('button', {
      class: `btn sm${editing ? ' primary' : ''}`, 'aria-pressed': editing ? 'true' : 'false',
      onclick: () => {
        const k = cardKey(ctx, key);
        if (editing) editingSets.delete(k); else editingSets.add(k);
        refreshCard(ctx, key);
      },
    }, editing ? '✓ Done' : 'Edit sets') : null,
    h('button', { class: 'btn sm', onclick: () => fieldsSheet(ctx, entry) }, '⚙ Fields'),
  ));

  // --- organize controls ---
  if (organize) {
    card.append(h('div', { class: 'orgbar' },
      h('button', { class: 'iconbtn', disabled: pos === 0, 'aria-label': 'Move up',
        onclick: () => { moveExercise(pid, dayId, entry.si, entry.ii, -1); rerender({ keepScroll: true }); } }, '↑'),
      h('button', { class: 'iconbtn', disabled: pos === count - 1, 'aria-label': 'Move down',
        onclick: () => { moveExercise(pid, dayId, entry.si, entry.ii, +1); rerender({ keepScroll: true }); } }, '↓'),
      h('button', { class: 'btn sm', onclick: () => editExerciseSheet(pid, dayId, entry, rerender) }, '✎ Edit'),
    ));
  }

  return card;
}

// Delete a set, asking first. The last set takes the exercise off the day.
function askDeleteSet(ctx, entry, i) {
  const { pid, dayId } = ctx;
  const ex = EX[entry.item.ex];
  const st = store.day(dayId, pid)?.ex?.[entry.key]?.sets?.[i];
  const lastOne = entry.sets <= 1;
  const logged = [st?.weight != null ? `${st.weight} kg` : null, st?.reps != null ? `× ${st.reps}` : null,
    st?.box != null ? `box ${st.box} cm` : null].filter(Boolean).join(' ');
  openSheet(
    h('div', { class: 'h2', style: 'margin-bottom:6px' }, lastOne ? `Remove ${ex.name}?` : `Delete set ${i + 1}?`),
    h('div', { class: 'small dim', style: 'margin-bottom:14px' }, lastOne
      ? 'That was its last set, so the exercise comes off this day. You can put it back from the bottom of the section.'
      : `${ex.name}${logged ? ` · ${logged}` : ''}${st?.done ? ' · already logged' : ''}`),
    h('div', { class: 'row', style: 'gap:8px' },
      h('button', { class: 'btn grow', onclick: closeSheet }, 'Keep it'),
      h('button', {
        class: 'btn danger grow',
        onclick: () => {
          closeSheet();
          if (lastOne) {
            editingSets.delete(cardKey(ctx, entry.key));
            removeExercise(pid, dayId, entry.key);
            toast(`${ex.name} removed from this day`);
            ctx.rerender({ keepScroll: true });
            return;
          }
          deleteSet(pid, dayId, entry, i);
          afterChange(ctx, entry.key);
        },
      }, lastOne ? 'Remove' : 'Delete')),
  );
}

// The card's fields: weight, reps, box (higher or lower is better) and a timer.
// Saved for this exercise everywhere, or with the tick, for this day only.
function fieldsSheet(ctx, entry) {
  const { pid, dayId } = ctx;
  const ex = EX[entry.item.ex];
  const cur = fieldsFor(pid, dayId, entry);
  const hasDay = Object.keys(dayFields(pid, dayId, entry.key)).length > 0;
  const tgl = (label, sub, on) => {
    const input = h('input', { type: 'checkbox', checked: on || null });
    const row = h('div', { class: 'setrow2' },
      h('div', { class: 'grow' }, h('div', { class: 'small', style: 'font-weight:700' }, label),
        sub ? h('div', { class: 'tiny faint' }, sub) : null),
      h('label', { class: 'switch' }, input, h('span', { class: 'knob' })));
    return { row, input };
  };
  const w = tgl('Weight (kg)', null, cur.weight);
  const r = tgl('Reps', null, cur.reps);
  const b = tgl('Box height (cm)', 'For box jumps, box push-ups and the like', !!cur.box);
  const t = tgl('Timer', 'A countdown on the card — for holds', cur.timer);
  let dir = cur.box || 'up';
  const dirSeg = h('div', { class: 'seg', style: 'margin:0 0 6px' });
  const drawDir = () => dirSeg.replaceChildren(
    ...[['up', 'Higher is better'], ['down', 'Lower is better']].map(([v, l]) => h('button', {
      class: `seg-btn${dir === v ? ' on' : ''}`, onclick: () => { dir = v; drawDir(); },
    }, l)));
  drawDir();
  const showDir = () => { dirSeg.style.display = b.input.checked ? '' : 'none'; };
  b.input.addEventListener('change', showDir); showDir();
  const only = h('input', { type: 'checkbox', checked: hasDay || null });
  const build = () => ({ weight: w.input.checked, reps: r.input.checked, timer: t.input.checked,
    box: b.input.checked ? dir : false });
  openSheet(
    h('div', { class: 'h2', style: 'margin-bottom:2px' }, `Fields — ${ex.name}`),
    h('div', { class: 'tiny faint', style: 'margin-bottom:8px' }, 'Which boxes this card shows. Your logged history is kept either way.'),
    w.row, r.row, b.row, dirSeg, t.row,
    h('label', { class: 'row', style: 'gap:10px;margin:12px 0 4px' },
      h('span', { class: 'switch' }, only, h('span', { class: 'knob' })),
      h('span', { class: 'small' }, 'Only for this day',
        h('span', { class: 'tiny faint', style: 'display:block' }, 'Off: changes this exercise everywhere'))),
    h('div', { class: 'row', style: 'gap:8px;margin-top:12px' },
      h('button', {
        class: 'btn grow',
        onclick: () => {
          saveFieldsEverywhere(entry.item.ex, null);
          saveDayFields(pid, dayId, entry.key, null);
          closeSheet(); toast('Back to the program’s fields'); ctx.rerender({ keepScroll: true });
        },
      }, 'Reset'),
      h('button', {
        class: 'btn primary grow',
        onclick: () => {
          if (only.checked) saveDayFields(pid, dayId, entry.key, build());
          else { saveFieldsEverywhere(entry.item.ex, build()); saveDayFields(pid, dayId, entry.key, null); }
          closeSheet(); toast(only.checked ? 'Saved for this day' : `Saved for ${ex.name} everywhere`);
          ctx.rerender({ keepScroll: true });
        },
      }, 'Save')),
  );
}

// A number box that takes 0-9, Arabic/Persian digits and a comma decimal;
// anything else is refused (the box keeps its last good value).
function numBox({ value, placeholder, decimal, onSave }) {
  const el = h('input', {
    type: 'text', inputmode: decimal ? 'decimal' : 'numeric', autocomplete: 'off', enterkeyhint: 'next',
    placeholder, value: value ?? '', class: 'numbox',
  });
  let good = el.value;
  el.addEventListener('input', () => {
    const lat = toLatin(el.value);
    const ok = decimal ? /^\d*\.?\d*$/.test(lat) : /^\d*$/.test(lat);
    if (!ok) { el.value = good; el.classList.remove('nudge'); void el.offsetWidth; el.classList.add('nudge'); return; }
    if (lat !== el.value) el.value = lat;
    good = el.value;
  });
  el.addEventListener('change', () => { const v = parseNum(el.value); el.value = v == null || Number.isNaN(v) ? '' : String(v); good = el.value; onSave(); });
  return el;
}
const valOf = (el) => { if (!el) return undefined; const v = parseNum(el.value); return v == null || Number.isNaN(v) ? null : v; };

// One set row: [tick] then the card's fields (kg, reps, box) + last-session line
function setRow(ctx, entry, i, last, f, bump, editing) {
  const { pid, dayId, rerender } = ctx;
  const { key, sch, item } = entry;
  const ex = EX[item.ex];
  const inputs = hasInputs(f);
  const isWU = sch.t === 'wuws' && i < entry.wu;
  const st = store.day(dayId, pid)?.ex?.[key]?.sets?.[i];
  const ticked = !!st?.done;
  const setSkipped = !!st?.skipped;
  const label = sch.t === 'wuws'
    ? (isWU ? `WU${sch.wu > 1 ? i + 1 : ''}` : `WS${sch.ws > 1 ? i - entry.wu + 1 : ''}`)
    : `${i + 1}`;

  const prevSet = last?.sets?.find((s2) => s2.i === i) ?? last?.sets?.[last?.sets?.length - 1];
  let wIn = null, rIn = null, bIn = null;

  // only the fields on the card are written, so a hidden field keeps its old value
  const readInputs = () => ({ weight: valOf(wIn), reps: valOf(rIn), box: valOf(bIn) });
  const saveLog = () => setLog(pid, dayId, entry, i, readInputs());

  // Hold a set to skip just that set — the whole-exercise skip stays on the
  // card. A skipped set is settled: the exercise can still finish without it.
  let holdTimer = null, held = false;
  const skipThisSet = () => {
    const now = toggleSkipSet(pid, dayId, entry, i);
    toast(now ? `Set ${i + 1} skipped` : `Set ${i + 1} back in`);
    afterChange(ctx, key);
  };
  const doTick = () => {
    const { dayJustCompleted } = toggleSet(pid, dayId, entry, i, inputs ? readInputs() : {});
    const nowTicked = !ticked;
    // The first set you tick today starts the workout clock if you forgot to.
    const autoStarted = nowTicked && ctx.isToday && !store.get().session;
    if (autoStarted) startSession(pid, dayId);
    const effRest = restAfterSet(pid, dayId, entry);
    if (nowTicked && effRest > 0 && store.get().settings.autoRest && !dayJustCompleted) {
      startCountdown({ label: restLabel(pid, dayId), secs: effRest, kind: 'rest' });
    }
    if (dayJustCompleted) { onDayCompleted(pid, dayId, rerender); return; }
    if (autoStarted) {      // the timer bar appears, so the whole day redraws
      toast('Workout timer started');
      rerender({ keepScroll: true, scrollNext: nextSet(pid, dayId)?.entry.key !== ctx.activeKey });
      return;
    }
    afterChange(ctx, key);
  };
  const tick = editing
    ? h('button', { class: 'set trash', 'aria-label': `Delete set ${i + 1}`, onclick: () => askDeleteSet(ctx, entry, i) }, '🗑')
    : h('button', {
      class: `set${isWU ? ' wu' : ''}${ticked ? ' on' : ''}${setSkipped ? ' skipped' : ''}`,
      'aria-label': `${ex.name} set ${i + 1}${setSkipped ? ' (skipped)' : ''} — hold to skip`,
      onpointerdown: () => {
        held = false;
        holdTimer = setTimeout(() => { held = true; skipThisSet(); }, 450);
      },
      onpointerup: () => clearTimeout(holdTimer),
      onpointercancel: () => clearTimeout(holdTimer),
      onpointerleave: () => clearTimeout(holdTimer),
      onclick: () => {
        clearTimeout(holdTimer);
        if (held) { held = false; return; }      // the hold already skipped it
        unlockAudio();
        // An empty weight box on an exercise you have loaded before is probably a
        // slip, so ask. Never asked for exercises you've only done without weight.
        if (!ticked && wIn && wIn.value === '' && usedWeightBefore(item.ex, ex.band ? entry.mode : undefined)) {
          confirmNoWeight(ex.name, doTick, () => wIn.focus());
          return;
        }
        doTick();
      },
    }, h('span', { class: 'lbl' }, setSkipped ? '⤼' : ticked ? '✓' : label));

  if (!inputs) {
    return organize && !editing
      ? h('div', { class: 'setrow' }, tick,
          h('button', { class: `iconbtn${setSkipped ? ' on' : ''}`, 'aria-label': 'Skip this set', onclick: skipThisSet }, '⤼'))
      : tick;
  }

  // A value you type carries down to the sets below it that aren't ticked yet
  // (warm-ups and working sets each keep to their own group).
  const boxesOf = (field) => {
    const all = ctx.inputs.get(key) || (ctx.inputs.set(key, { weight: [], box: [] }), ctx.inputs.get(key));
    return all[field];
  };
  const carryDown = (field, el) => {
    const v = valOf(el);
    const sets = store.day(dayId, pid)?.ex?.[key]?.sets || [];
    const boxes = boxesOf(field);
    for (let j = i + 1; j < entry.sets; j++) {
      if ((sch.t === 'wuws' && j < entry.wu) !== isWU || sets[j]?.done || sets[j]?.skipped) continue;
      setLog(pid, dayId, entry, j, { [field]: v });
      if (boxes[j] && boxes[j] !== document.activeElement) boxes[j].value = v ?? '';
    }
  };
  const many = [f.weight, f.reps, f.box].filter(Boolean).length > 2;   // no room for − / + on all three
  const stepper = (el, d, field) => h('button', {
    class: 'step', 'aria-label': d > 0 ? `more ${field}` : `less ${field}`,
    onclick: () => {
      const cur = valOf(el) ?? 0;
      el.value = String(Math.max(0, Math.round((cur + d) * 10) / 10));
      saveLog(); carryDown(field, el);
    },
  }, d > 0 ? '+' : '−');

  const parts = [];
  if (f.weight) {
    // On a deload day the prescription is "about 60% of last time" — prefill that
    // rather than last week's working weight, so going light is the default.
    const suggested = ctx.dayCtx.deload ? deloadWeight(prevSet?.weight ?? null)
      : (bump && !isWU ? bump.next : (prevSet?.weight ?? null));
    wIn = numBox({ value: st?.weight ?? suggested, placeholder: ctx.dayCtx.deload ? 'kg (light)' : 'kg', decimal: true,
      onSave: () => { saveLog(); carryDown('weight', wIn); } });
    boxesOf('weight')[i] = wIn;
    if (many) parts.push(wIn); else parts.push(stepper(wIn, -2.5, 'weight'), wIn, stepper(wIn, 2.5, 'weight'));
  }
  if (f.reps) {
    rIn = numBox({ value: st?.reps, placeholder: sch.reps != null ? String(sch.reps) : 'reps', decimal: false, onSave: saveLog });
    parts.push(rIn, h('span', { class: 'unit' }, 'REPS'));
  }
  if (f.box) {
    bIn = numBox({ value: st?.box ?? prevSet?.box, placeholder: 'cm', decimal: true,
      onSave: () => { saveLog(); carryDown('box', bIn); } });
    boxesOf('box')[i] = bIn;
    if (!f.weight && !many) parts.push(stepper(bIn, -BOX_STEP, 'box'), bIn, stepper(bIn, BOX_STEP, 'box'));
    else parts.push(bIn);
    parts.push(h('span', { class: 'unit' }, f.box === 'down' ? 'CM ↓' : 'CM ↑'));
  }

  const row = h('div', { class: 'setrow' }, tick,
    h('div', { class: 'loginputs' }, ...parts),
    organize && !editing ? h('button', {
      class: `iconbtn${setSkipped ? ' on' : ''}`, 'aria-label': 'Skip this set',
      onclick: skipThisSet,
    }, '⤼') : null,
  );

  // last-session line: what you actually did on this set last time —
  // from ANY program, labelled when it came from a different one.
  if (prevSet && (prevSet.weight != null || prevSet.reps != null || prevSet.box != null)) {
    const reps = prevSet.reps ?? (prevSet.done ? last.defReps : null);
    const bits = [];
    if (prevSet.weight != null) bits.push(`${prevSet.weight} kg`);
    if (reps != null) bits.push(`× ${reps}`);
    if (prevSet.box != null) bits.push(`box ${prevSet.box} cm`);
    const from = last.pid !== pid ? ` · ${shortProgramName(last.pid)}` : '';
    return h('div', { class: 'setwrap' }, row,
      h('div', { class: 'lastline' }, `↺ last: ${bits.join(' ')}${from}`));
  }
  return row;
}

// ---------------------------------------------------------------------------
const BUMP_KG = 2.5;

// The set up next: the first exercise with an open set. In a superset the two
// alternate — once A has more sets done than B, B is next (A1 → B1 → A2 → B2).
export function nextSet(pid, dayId) {
  const planned = plannedDay(pid, dayId);
  if (!planned) return null;
  const req = requiredEntries(planned);
  const rec = store.day(dayId, pid);
  const openIdx = (e) => {
    const sets = rec?.ex?.[e.key]?.sets || [];
    for (let i = 0; i < e.sets; i++) if (!sets[i]?.done && !sets[i]?.skipped) return i;
    return -1;
  };
  const at = req.findIndex((e) => openIdx(e) >= 0);
  if (at < 0) return null;
  let e = req[at];
  const n = req[at + 1];
  if (e.item.ss && n && n.item.ss === e.item.ss && openIdx(n) >= 0
    && exerciseSetsDone(pid, dayId, e) > exerciseSetsDone(pid, dayId, n)) e = n;
  return { entry: e, i: openIdx(e) };
}
const entryName = (e) => (EX[e.item.ex].band ? displayName(e.item.ex, e.mode) : EX[e.item.ex].name);

function restLabel(pid, dayId) {
  const nx = nextSet(pid, dayId);
  return nx ? `Next: ${entryName(nx.entry)} · set ${nx.i + 1}` : 'Rest — last set done';
}

function fillNextLine(root, pid, dayId) {
  const el = root.querySelector('[data-nextset]');
  if (!el) return;
  const nx = nextSet(pid, dayId);
  el.dataset.key = nx ? nx.entry.key : '';
  if (!nx) { el.textContent = 'All sets done ✓'; return; }
  const w = store.day(dayId, pid)?.ex?.[nx.entry.key]?.sets?.[nx.i]?.weight;
  el.replaceChildren(h('span', { class: 'tiny faint' }, 'NEXT '),
    h('b', {}, entryName(nx.entry)),
    ` · set ${nx.i + 1} of ${nx.entry.sets}${w != null ? ` · ${w} kg` : ''}`);
}

const dayHasTicks = (pid, dayId) =>
  Object.values(store.day(dayId, pid)?.ex || {}).some((x) => (x.sets || []).some((v) => v?.done));

// Have you ever logged a weight on this exercise (in this mode)?
const usedWeightBefore = (exId, mode) => historyFor(exId).some((r) =>
  (!mode || r.mode === mode) && r.sets.some((x) => x.weight != null && x.weight !== ''));

function confirmNoWeight(name, onYes, onAdd) {
  openSheet(
    h('div', { class: 'h2', style: 'margin-bottom:6px' }, 'No weight on this set'),
    h('div', { class: 'small dim', style: 'margin-bottom:14px' },
      `You’ve used weight on ${name} before. Are you sure you won’t add weight?`),
    h('div', { class: 'row', style: 'gap:8px' },
      h('button', { class: 'btn grow', onclick: () => { closeSheet(); onYes(); } }, 'Tick without weight'),
      h('button', { class: 'btn primary grow', onclick: () => { closeSheet(); onAdd(); } }, 'Add weight')),
  );
}

function restDayCard(pid, dayId, prog, rerender) {
  const done = prog.status === 'done';
  return h('div', { class: 'card restday' },
    h('div', { class: 'emoji' }, '😴'),
    h('div', { class: 'h2', style: 'margin-top:8px' }, 'Full Rest'),
    h('div', { class: 'small dim', style: 'margin:8px auto 16px;max-width:320px' },
      'No training, no cardio today. Recovery is where the adaptation happens — eat your protein (180–200 g) and sleep.'),
    h('button', {
      class: `btn ${done ? '' : 'primary'}`,
      onclick: () => { markDay(pid, dayId, done ? null : 'done'); rerender(); },
    }, done ? '✓ Rest day complete — undo' : 'Mark rest day complete'),
  );
}

function sessionBar(pid, dayId, active, prog, rerender) {
  const s = store.get();
  if (!active) {
    const other = s.session && (s.session.dayId !== dayId || s.session.pid !== pid);
    const logged = store.day(dayId, pid)?.elapsedMs || 0;
    return h('div', { class: 'sessionbar' },
      h('div', { class: 'grow' },
        h('button', {
          class: 'time', style: 'text-align:left',
          onclick: () => durationSheet('Edit logged workout time', Math.round(logged / 1000), (secs) => {
            store.update((st) => {
              const d = st.programs[pid].days[dayId] || (st.programs[pid].days[dayId] = { status: null, ex: {} });
              d.elapsedMs = secs * 1000;
            });
            rerender({ keepScroll: true });
          }),
        }, logged ? fmtMs(logged) : '0:00', h('span', { class: 'tiny faint', style: 'margin-left:6px' }, '✎')),
        h('div', { class: 'tiny faint' }, logged ? 'time logged on this day' : 'workout timer'),
      ),
      other
        ? h('a', { class: 'btn sm', href: `#/day/${s.session.pid}/${s.session.dayId}` }, 'Session running →')
        : h('button', {
            class: 'btn primary',
            onclick: () => { unlockAudio(); startSession(pid, dayId); rerender(); },
          }, prog.pct > 0 ? '▶ Resume workout' : '▶ Start workout'),
    );
  }
  const paused = !!s.session.pausedAt;
  const nextBtn = h('button', { class: 'nextset', 'data-nextset': '',
    onclick: () => {
      const k = nextBtn.dataset.key;
      const card = k && document.querySelector(`[data-exkey="${k}"]`);
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } });
  setTimeout(() => fillNextLine(document, pid, dayId), 0);
  const timeEl = h('span', {}, fmtMs(sessionElapsedMs()));
  timerInterval = setInterval(() => { timeEl.textContent = fmtMs(sessionElapsedMs()); }, 1000);
  return h('div', { class: 'sessionbar running' },
    h('div', { class: 'grow' },
      h('button', {
        class: 'time', style: 'text-align:left',
        onclick: () => durationSheet('Edit workout time', Math.round(sessionElapsedMs() / 1000), (secs) => {
          setSessionElapsed(secs); rerender({ keepScroll: true });
        }),
      }, timeEl, h('span', { class: 'tiny faint', style: 'margin-left:6px' }, '✎')),
      h('div', { class: 'tiny', style: 'color:var(--accent);font-weight:700' }, paused ? 'PAUSED' : '● RECORDING')),
    h('button', { class: 'btn sm', onclick: () => { paused ? resumeSession() : pauseSession(); rerender({ keepScroll: true }); } },
      paused ? '▶' : '⏸'),
    h('button', {
      class: 'btn sm',
      onclick: () => {
        // Finishing with nothing ticked would save an empty workout: cancel it.
        if (!dayHasTicks(pid, dayId)) {
          discardSession(); toast('Nothing logged — workout cancelled'); rerender({ keepScroll: true }); return;
        }
        const { elapsed } = finishSession(); toast(`Workout time saved: ${fmtMs(elapsed)}`); rerender({ keepScroll: true });
      },
    }, '■ Finish'),
    nextBtn,
  );
}

function contactCounter(ctx, entry) {
  const { pid, dayId, key } = { ...ctx, key: entry.key };
  const rec = store.day(dayId, pid);
  const sets = rec?.ex?.[entry.key]?.sets || [];
  let block = 0;
  for (let i = 0; i < entry.sets; i++) { if (!sets[i]?.done) { block = i; break; } block = entry.sets - 1; }
  const contacts = rec?.contacts?.[`${entry.key}:${block}`] || 0;
  const { warn, cap } = entry.item.counter;
  const cls = contacts >= cap ? 'cap' : contacts >= warn ? 'warn' : '';
  const num = h('div', { class: 'cnum' }, String(contacts));
  const msg = h('div', { class: 'tiny dim' },
    contacts >= cap ? '⛔ Cap reached — stop this block'
      : contacts >= warn ? `⚠️ Approaching cap (${cap})`
      : `cap ${warn}–${cap} per block`);
  const box = h('div', { class: `counterbox ${cls}` },
    h('div', { class: 'tiny faint', style: 'font-weight:800;letter-spacing:.06em;text-transform:uppercase' },
      `Ground contacts — block ${block + 1}/${entry.sets}`),
    num, msg,
    h('div', { class: 'cbtns' },
      h('button', { class: 'tapbtn', style: 'flex:0 0 64px', onclick: () => bump(-1) }, '−'),
      h('button', { class: 'tapbtn', onclick: () => bump(+1) }, '+1 contact'),
    ),
  );
  function bump(d) {
    let v = 0;
    store.update((s) => {
      const dRec = s.programs[pid].days[dayId] || (s.programs[pid].days[dayId] = { status: null, ex: {} });
      dRec.contacts = dRec.contacts || {};
      const k = `${entry.key}:${block}`;
      v = dRec.contacts[k] = Math.max(0, (dRec.contacts[k] || 0) + d);
    });
    if (d > 0 && v === warn) chime('warn');
    if (d > 0 && v === cap) chime('done');
    // update in place — no re-render
    num.textContent = String(v);
    box.className = `counterbox ${v >= cap ? 'cap' : v >= warn ? 'warn' : ''}`;
    msg.textContent = v >= cap ? '⛔ Cap reached — stop this block'
      : v >= warn ? `⚠️ Approaching cap (${cap})` : `cap ${warn}–${cap} per block`;
  }
  return box;
}

// ---------------------------------------------------------------------------
function onDayCompleted(pid, dayId, rerender) {
  const s = store.get();
  let elapsed = 0;
  if (s.session?.dayId === dayId && s.session?.pid === pid) elapsed = finishSession().elapsed;
  else elapsed = store.day(dayId, pid)?.elapsedMs || 0;

  const planned = plannedDay(pid, dayId);
  const dayCtx = { pid, dayId };
  const rec = store.day(dayId, pid);
  const prs = [];
  const seen = new Set();
  let setsDone = 0;
  for (const e of planned.entries) {
    const exRec = rec?.ex?.[e.key];
    if (!exRec) continue;
    setsDone += (exRec.sets || []).filter((x) => x?.done).length;
    if (seen.has(e.item.ex)) continue;
    seen.add(e.item.ex);
    // box height: higher or lower is better, per exercise
    const dir = boxDir(e.item.ex, pid, dayId, e.key);
    const boxesToday = (exRec.sets || []).filter((x) => x?.done && x.box != null).map((x) => +x.box);
    if (dir && boxesToday.length && !getDay(pid, dayId)?.light) {   // a deload is never a record
      const todayB = dir === 'down' ? Math.min(...boxesToday) : Math.max(...boxesToday);
      const prevB = bestBox(historyFor(e.item.ex).filter((hh) => !(!hh.run && hh.pid === pid && hh.dayId === dayId)), dir);
      if (prevB === null || boxBetter(todayB, prevB, dir)) prs.push({ name: `${EX[e.item.ex].name} (box)`, weight: todayB, prev: prevB, unit: 'cm' });
    }
    const todayW = Math.max(...(exRec.sets || []).map((x) => (x?.weight != null ? +x.weight : -Infinity)));
    if (!isFinite(todayW)) continue;
    const prevBest = bestWeight(historyFor(e.item.ex)
      .filter((hh) => !(!hh.run && hh.pid === pid && hh.dayId === dayId)));
    if (prevBest === null || todayW > prevBest) prs.push({ name: EX[e.item.ex].name, weight: todayW, prev: prevBest });
  }
  chime('done');
  // If that was the last day of the program, the finish screen follows the
  // day summary rather than fighting it for the same sheet.
  summarySheet({ pid, dayId, elapsed, setsDone, prs }, () => {
    if (!maybeCelebrateProgram(pid, rerender)) rerender?.();
  });
  maybeBackupNudge(pid, getDay(pid, dayId).week);
}

function maybeBackupNudge(pid, week) {
  if (!week) return;            // prep and deload days belong to no program week
  const s = store.get();
  import('../completion.js').then(({ weekProgress }) => {
    if (weekProgress(pid, week).closed && s.settings.backupPromptWeek < week) {
      store.update((st) => { st.settings.backupPromptWeek = week; });
      setTimeout(() => toast('💾 Week closed — consider exporting a backup (Settings)', 4200), 1200);
    }
  });
}

// "Time to back off" — shown on Today only, dismissible for the week.
function deloadAdviceBanner(pid, rerender) {
  const s = store.get();
  const advice = deloadAdvice(pid);
  const week = currentWeek(pid);
  if (!advice.show) return null;
  if ((s.settings.deloadDismissed || {})[pid] >= week) return null;
  if (!deloadPlanFor(pid)) return null;

  return h('div', { class: 'banner deload' },
    h('div', { style: 'font-weight:700;margin-bottom:4px' }, '🌙 Time for a deload?'),
    `${advice.weeks} weeks of training since your last one, and ${advice.reason}. `
    + 'A light week now keeps the next block productive.',
    h('div', { class: 'row', style: 'gap:8px;margin-top:10px' },
      h('button', { class: 'btn sm', onclick: () => deloadSheet(pid, rerender) }, 'Insert deload week'),
      h('button', {
        class: 'btn sm',
        onclick: () => {
          store.update((st) => {
            st.settings.deloadDismissed = { ...(st.settings.deloadDismissed || {}), [pid]: week };
          });
          rerender();
        },
      }, 'Not now'),
    ));
}

// Prev/next walks the CALENDAR, so an inserted deload week sits between the
// program days either side of it exactly as it does in real life.
function stepDay(pid, dayId, dir) {
  const c = calIndexOfDayId(pid, dayId) + dir;
  return dayIdAtCal(pid, Math.max(-prepWeeks(pid) * 7, Math.min(lastCalIndex(pid), c)));
}

// Deload sets are light on purpose. Prefill about 60% of what you last lifted,
// rounded to the nearest 2.5 kg — a concrete number you can still overwrite.
export const deloadWeight = (w) => (w == null ? null : Math.max(2.5, Math.round((w * 0.6) / 2.5) * 2.5));

function footerButtons(pid, dayId, rec, prog, rerender) {
  const wrap = h('div', { style: 'display:flex;gap:8px;margin-top:16px;flex-wrap:wrap' });
  wrap.append(h('button', { class: 'btn sm grow', onclick: () => noteSheet(pid, dayId, rerender) },
    rec.note ? '✍️ Edit note' : '✍️ Add note'));
  if (prog.status === 'done') {
    wrap.append(h('button', { class: 'btn sm grow', onclick: () => { markDay(pid, dayId, null); rerender(); } }, '↺ Reopen day'));
  } else if (prog.status === 'skipped') {
    wrap.append(h('button', { class: 'btn sm grow', onclick: () => { markDay(pid, dayId, null); rerender(); } }, '↺ Unskip day'));
  } else {
    wrap.append(h('button', {
      class: 'btn sm grow',
      onclick: () => { markDay(pid, dayId, 'done'); onDayCompleted(pid, dayId, rerender); },
    }, '✓ Mark day done'));
    wrap.append(h('button', { class: 'btn sm grow', onclick: () => skipSheet(pid, dayId, rerender) }, '⤼ Skip day'));
  }
  const dl = deloadIdParts(dayId);
  if (dl) {
    wrap.append(h('button', {
      class: 'btn sm grow',
      onclick: () => {
        if (!confirm('Remove this deload week? The days you trained before it go back where they were.')) return;
        removeDeload(pid, dl.block);
        toast('Deload removed');
        location.hash = '#/today';
        rerender();
      },
    }, '✕ Remove deload'));
  } else if (pid === store.activePid() && programStatus(pid).state === 'active' && deloadPlanFor(pid)) {
    wrap.append(h('button', {
      class: 'btn sm grow', onclick: () => deloadSheet(pid, rerender),
    }, '🌙 Insert deload week'));
  }
  return wrap;
}

function estimateMinutes(planned) {
  let secs = 0;
  for (const e of planned.entries) {
    if (e.skipped) continue;
    const per = e.sch.t === 'time' ? e.sch.secs : 35;
    secs += e.sets * (per + (e.rest || 25));
  }
  return Math.round(secs / 60 / 5) * 5;
}
