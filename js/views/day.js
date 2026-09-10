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
  plannedDay, requiredEntries, exerciseDone, exerciseSetsDone, dayProgress,
  firstOpenIndex, lastSessionFor, overloadHint, historyFor, bestWeight, dayTime,
  toggleSet, setLog, markDay, setNote, completeSection, setExerciseField,
  toggleSkipExercise, deleteSet, addSet, moveExercise, moveSection,
  hasCustomPlan, resetDayPlan, setExerciseOrder,
} from '../completion.js';
import {
  idToIndex, indexToId, clampIndex, todayId, todayIndex, dateForId, fmtDate,
  weekdayName, isSwapped, programStatus, realToday, toISO,
} from '../schedule.js';
import {
  startSession, pauseSession, resumeSession, finishSession, sessionElapsedMs,
  setSessionElapsed, fmtMs, startCountdown, unlockAudio, chime,
} from '../timers.js';
import {
  historySheet, noteSheet, skipSheet, summarySheet, durationSheet, textSheet,
  whereAmISheet, editExerciseSheet,
} from './sheets.js';
import { openVideo } from '../video.js';
import { makeSortable } from '../dragsort.js';

let timerInterval = null;
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
  const index = idToIndex(dayId);
  const isActive = pid === store.activePid();
  const status = programStatus(pid);
  // A clamped index is NOT today — only an active program can have a today.
  const isToday = isActive && status.state === 'active' && dayId === todayId();
  const week = getWeek(pid, day.week);
  const sessionActive = s.session?.dayId === dayId && s.session?.pid === pid;
  const date = isActive ? dateForId(dayId, pid) : null;
  const dayCtx = { pid, dayId };

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
        class: 'navbtn', disabled: index === 0,
        onclick: () => { location.hash = `#/day/${pid}/${indexToId(clampIndex(index - 1, pid))}`; },
      }, '‹'),
      h('div', { class: 'center grow' },
        h('a', { class: 'h1', style: 'display:block', href: `#/week/${pid}/${day.week}` },
          `Week ${day.week} · ${weekdayName(day.d, day.week, pid)}`),
        h('div', { class: 'row', style: 'justify-content:center;gap:6px;margin-top:4px;flex-wrap:wrap' },
          h('span', { class: 'chip', style: `color:${week.phase.color};border-color:${week.phase.color}44` },
            week.phase.name),
          date ? h('span', { class: 'chip' }, fmtDate(date)) : null,
          isToday ? h('span', { class: 'chip accent' }, 'TODAY') : null,
          prog.status === 'done' ? h('span', { class: 'chip good' }, rec.auto ? '✓ done (assumed)' : '✓ done') : null,
          prog.status === 'skipped' ? h('span', { class: 'chip bad' }, 'skipped') : null,
          isSwapped(day.week, day.d, pid) ? h('span', { class: 'chip info' }, '⇄ swapped') : null,
          hasCustomPlan(pid, dayId) ? h('span', { class: 'chip info' }, '✎ edited') : null,
        ),
        isToday ? h('button', {
          class: 'tiny faint', style: 'margin-top:4px;text-decoration:underline',
          onclick: () => whereAmISheet(pid, rerender),
        }, 'wrong week? fix it') : null,
      ),
      h('button', {
        class: 'navbtn', disabled: index === totalDays(pid) - 1,
        onclick: () => { location.hash = `#/day/${pid}/${indexToId(clampIndex(index + 1, pid))}`; },
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

  if (week.badge) {
    container.append(h('div', { class: `banner ${week.badge.startsWith('DELOAD') || week.badge.includes('DELOAD') ? 'deload' : ''}` }, week.badge));
  }
  if (isToday && status.state === 'active') {
    const behind = todayIndex() - firstOpenIndex(pid);
    if (behind > 0) {
      container.append(h('div', { class: 'banner behind' },
        `You're ${behind} day${behind > 1 ? 's' : ''} behind schedule — first open day: `,
        h('a', { href: `#/day/${pid}/${indexToId(firstOpenIndex(pid))}`, style: 'text-decoration:underline;font-weight:800' },
          labelFor(pid, indexToId(firstOpenIndex(pid)))),
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
  ));
  if (organize) {
    container.append(h('div', { class: 'banner', style: 'margin-top:8px' },
      'Hold any exercise card and drag it to reorder — that works any time, not just here. Organize mode adds: move whole sections, edit reps and timers, and add or delete sets.'));
  }

  // ---- sections -----------------------------------------------------------
  const ctx = { pid, dayId, planned, dayCtx, rerender, cardEls, container };
  const currentKey = sessionActive ? findCurrentKey(pid, dayId, planned) : null;
  ctx.currentKey = currentKey;

  planned.sections.forEach((block, pos) => {
    const { si, sec, entries } = block;
    const secDone = entries.every((e) => e.item.opt || e.skipped || exerciseDone(pid, dayId, e));
    const head = h('div', { class: 'section-title', 'data-si': si },
      sec.title,
      h('span', { class: 'count' }, secDone ? ' ✓' : ` ${entries.length}`),
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
    let i = 0;
    while (i < entries.length) {
      const e = entries[i];
      if (e.item.ss && entries[i + 1]?.item.ss === e.item.ss) {
        const group = h('div', { class: 'ss-group', 'data-sortable': '' },
          h('span', { class: 'ss-label' }, 'Superset'));
        const iis = [];
        let j = i;
        while (j < entries.length && entries[j].item.ss === e.item.ss) {
          group.append(buildCard(ctx, entries[j], j, entries.length));
          iis.push(entries[j].ii);
          j++;
        }
        group.dataset.iis = iis.join(',');
        list.append(group);
        i = j;
      } else {
        const card = buildCard(ctx, e, i, entries.length);
        card.setAttribute('data-sortable', '');
        card.dataset.iis = String(e.ii);
        list.append(card);
        i++;
      }
    }
    container.append(list);

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

const labelFor = (pid, dayId) => {
  const d = getDay(pid, dayId);
  return `Week ${d.week} · ${weekdayName(d.d, d.week, pid)}`;
};

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

function exerciseCard(ctx, entry, pos, count) {
  const { pid, dayId, dayCtx, rerender } = ctx;
  const { item, key, sch } = entry;
  const ex = EX[item.ex];
  const done = exerciseDone(pid, dayId, entry);
  const isCurrent = key === ctx.currentKey && !entry.skipped;
  const repsBased = sch.t !== 'time' && !ex.noload;
  const rec = store.day(dayId, pid);
  const exRec = rec?.ex?.[key];
  const alt = exRec?.alt || '';
  const isArmChoice = ARM_CHOICE.has(item.ex);
  const mode = entry.mode;
  const effRest = effRestSecs(item.ex, entry.rest);
  const effSecs = sch.t === 'time' ? effHoldSecs(item.ex, sch.secs) : null;
  const name = ex.band ? displayName(item.ex, mode) : ex.name;

  const card = h('div', {
    class: `ex${done ? ' done' : ''}${isCurrent ? ' current' : ''}${item.opt ? ' optional' : ''}${entry.skipped ? ' skipped' : ''}`,
    'data-exkey': key,
    // Set here (not in the section loop) so a card rebuilt by refreshCard()
    // after a tick keeps its drag handle — otherwise reordering silently died
    // on exactly the day you were training.
    'data-sortable': '',
    'data-iis': String(entry.ii),
  });

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

  // --- overload hint ---
  if (repsBased && !done && !entry.skipped && exerciseSetsDone(pid, dayId, entry) === 0) {
    const hint = overloadHint(item.ex, dayCtx, ex.band ? mode : undefined);
    if (hint) card.append(h('div', { class: 'hint' }, `Last time: all sets clean at ${hint.lastWeight} kg → add weight today`));
  }

  // --- sets ---
  const last = repsBased ? lastSessionFor(item.ex, dayCtx, ex.band ? mode : undefined) : null;
  const setsWrap = h('div', { class: 'sets' });
  for (let i = 0; i < entry.sets; i++) {
    setsWrap.append(setRow(ctx, entry, i, last, repsBased));
  }
  card.append(setsWrap);

  // --- timed exercise controls ---
  if (sch.t === 'time') {
    card.append(h('div', { class: 'ex-actions' },
      h('button', {
        class: 'timerbtn',
        onclick: () => {
          unlockAudio();
          startCountdown({
            label: ex.name, secs: effHoldSecs(item.ex, sch.secs), kind: 'hold',
            onDone: () => {
              const cur = store.day(dayId, pid)?.ex?.[key]?.sets || [];
              for (let i = 0; i < entry.sets; i++) {
                if (!cur[i]?.done) {
                  const { dayJustCompleted } = toggleSet(pid, dayId, entry, i);
                  const r = effRestSecs(item.ex, entry.rest);
                  if (r > 0 && store.get().settings.autoRest && !dayJustCompleted) {
                    startCountdown({ label: `Rest — ${ex.name}`, secs: r, kind: 'rest' });
                  }
                  if (dayJustCompleted) { onDayCompleted(pid, dayId, rerender); return; }
                  break;
                }
              }
              refreshCard(ctx, key);
            },
          });
        },
      }, `▶ ${fmtSecs(effSecs)} timer`),
      h('button', {
        class: 'timerbtn', style: 'flex:0 0 auto', 'aria-label': 'Edit timer duration',
        onclick: () => durationSheet(`Timer — ${ex.name}`, effSecs, (secs) => {
          store.update((st) => { st.settings.durOv[holdKey(item.ex, sch.secs)] = secs; });
          toast(`Timer saved: ${fmtSecs(secs)} (remembered)`);
          refreshCard(ctx, key);
        }, { hint: `Program says ${fmtSecs(sch.secs)}. Remembered for future sessions; when the program itself changes the duration, the new value takes over.` }),
      }, '✎'),
    ));
  }

  // --- ground-contact counter ---
  if (item.counter) card.append(contactCounter(ctx, entry));

  // --- organize controls ---
  if (organize) {
    card.append(h('div', { class: 'orgbar' },
      h('button', { class: 'iconbtn', disabled: pos === 0, 'aria-label': 'Move up',
        onclick: () => { moveExercise(pid, dayId, entry.si, entry.ii, -1); rerender({ keepScroll: true }); } }, '↑'),
      h('button', { class: 'iconbtn', disabled: pos === count - 1, 'aria-label': 'Move down',
        onclick: () => { moveExercise(pid, dayId, entry.si, entry.ii, +1); rerender({ keepScroll: true }); } }, '↓'),
      h('button', { class: 'btn sm', onclick: () => editExerciseSheet(pid, dayId, entry, rerender) }, '✎ Edit'),
      h('button', { class: 'btn sm', onclick: () => { addSet(pid, dayId, entry); refreshCard(ctx, key); } }, '+ set'),
    ));
  }

  return card;
}

// One set row: [tick] [−][kg][+] [reps]  + last-session line
function setRow(ctx, entry, i, last, repsBased) {
  const { pid, dayId, rerender } = ctx;
  const { key, sch, item } = entry;
  const ex = EX[item.ex];
  const isWU = sch.t === 'wuws' && i < entry.wu;
  const st = store.day(dayId, pid)?.ex?.[key]?.sets?.[i];
  const ticked = !!st?.done;
  const label = sch.t === 'wuws'
    ? (isWU ? `WU${sch.wu > 1 ? i + 1 : ''}` : `WS${sch.ws > 1 ? i - entry.wu + 1 : ''}`)
    : `${i + 1}`;

  const prevSet = last?.sets?.find((s2) => s2.i === i) ?? last?.sets?.[last?.sets?.length - 1];
  let wIn = null, rIn = null;

  const readInputs = () => ({
    weight: wIn && wIn.value !== '' ? +wIn.value : null,
    reps: rIn && rIn.value !== '' ? +rIn.value : null,
  });
  const saveLog = () => setLog(pid, dayId, entry, i, readInputs());

  const tick = h('button', {
    class: `set${isWU ? ' wu' : ''}${ticked ? ' on' : ''}`,
    'aria-label': `${ex.name} set ${i + 1}`,
    onclick: () => {
      unlockAudio();
      const { dayJustCompleted } = toggleSet(pid, dayId, entry, i, repsBased ? readInputs() : {});
      const nowTicked = !ticked;
      const effRest = effRestSecs(item.ex, entry.rest);
      if (nowTicked && effRest > 0 && store.get().settings.autoRest && !dayJustCompleted) {
        startCountdown({ label: `Rest — ${ex.name}`, secs: effRest, kind: 'rest' });
      }
      if (dayJustCompleted) { onDayCompleted(pid, dayId, rerender); return; }
      refreshCard(ctx, key);
    },
  }, h('span', { class: 'lbl' }, ticked ? '✓' : label));

  if (!repsBased) {
    return organize
      ? h('div', { class: 'setrow' }, tick, h('button', {
          class: 'iconbtn danger', 'aria-label': 'Delete set',
          onclick: () => { deleteSet(pid, dayId, entry, i); refreshCard(ctx, key); },
        }, '🗑'))
      : tick;
  }

  wIn = h('input', {
    type: 'number', inputmode: 'decimal', step: 'any', placeholder: 'kg',
    value: st?.weight ?? prevSet?.weight ?? '',
    onchange: saveLog,
  });
  rIn = h('input', {
    type: 'number', inputmode: 'numeric', placeholder: sch.reps != null ? String(sch.reps) : 'reps',
    value: st?.reps ?? '',
    onchange: saveLog,
  });
  const step = (d) => h('button', {
    class: 'step', 'aria-label': d > 0 ? 'add 2.5 kg' : 'remove 2.5 kg',
    onclick: () => {
      const cur = wIn.value !== '' ? +wIn.value : 0;
      wIn.value = String(Math.max(0, Math.round((cur + d) * 10) / 10));
      saveLog();
    },
  }, d > 0 ? '+' : '−');

  const row = h('div', { class: 'setrow' }, tick,
    h('div', { class: 'loginputs' }, step(-2.5), wIn, step(2.5), rIn, h('span', { class: 'unit' }, 'REPS')),
    organize ? h('button', {
      class: 'iconbtn danger', 'aria-label': 'Delete set',
      onclick: () => { deleteSet(pid, dayId, entry, i); refreshCard(ctx, key); },
    }, '🗑') : null,
  );

  // last-session line: what you actually lifted for this set last time —
  // from ANY program, labelled when it came from a different one.
  if (prevSet && (prevSet.weight != null || prevSet.reps != null)) {
    const reps = prevSet.reps ?? (prevSet.done ? last.defReps : null);
    const parts = [];
    if (prevSet.weight != null) parts.push(`${prevSet.weight} kg`);
    if (reps != null) parts.push(`× ${reps}`);
    const from = last.pid !== pid ? ` · ${shortProgramName(last.pid)}` : '';
    return h('div', { class: 'setwrap' }, row,
      h('div', { class: 'lastline' }, `↺ last: ${parts.join(' ')}${from}`));
  }
  return row;
}

// ---------------------------------------------------------------------------
function findCurrentKey(pid, dayId, planned) {
  for (const e of planned.entries) {
    if (e.item.opt || e.skipped) continue;
    if (!exerciseDone(pid, dayId, e)) return e.key;
  }
  return null;
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
      onclick: () => { const { elapsed } = finishSession(); toast(`Workout time saved: ${fmtMs(elapsed)}`); rerender({ keepScroll: true }); },
    }, '■ Finish'),
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
    const todayW = Math.max(...(exRec.sets || []).map((x) => (x?.weight != null ? +x.weight : -Infinity)));
    if (!isFinite(todayW)) continue;
    const prevBest = bestWeight(historyFor(e.item.ex)
      .filter((hh) => !(hh.pid === pid && hh.dayId === dayId)));
    if (prevBest === null || todayW > prevBest) prs.push({ name: EX[e.item.ex].name, weight: todayW, prev: prevBest });
  }
  chime('done');
  summarySheet({ pid, dayId, elapsed, setsDone, prs }, rerender);
  maybeBackupNudge(pid, getDay(pid, dayId).week);
}

function maybeBackupNudge(pid, week) {
  const s = store.get();
  import('../completion.js').then(({ weekProgress }) => {
    if (weekProgress(pid, week).closed && s.settings.backupPromptWeek < week) {
      store.update((st) => { st.settings.backupPromptWeek = week; });
      setTimeout(() => toast('💾 Week closed — consider exporting a backup (Settings)', 4200), 1200);
    }
  });
}

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
