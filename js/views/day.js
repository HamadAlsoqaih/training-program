// ============================================================================
// day.js — the main screen: one program day with every exercise, ticks,
// logging, timers, counters, flow mode, notes, skip, and auto-completion.
// ============================================================================
import { h, toast, svgRing } from '../util.js';
import {
  EX, getDay, getWeek, schemeSets, schemeLabel, fmtSecs, dayExercises,
  WEEK_BADGES, phaseOf, ytUrl,
} from '../program.js';
import * as store from '../state.js';
import {
  toggleSet, setLog, markDay, dayProgress, requiredEntries, exerciseDone,
  exerciseSetsDone, firstOpenIndex, lastSessionFor, overloadHint, historyFor, bestWeight,
} from '../completion.js';
import {
  idToIndex, indexToId, clampIndex, todayId, todayIndex, dateForId, fmtDate,
} from '../schedule.js';
import {
  startSession, pauseSession, resumeSession, finishSession, sessionElapsedMs,
  fmtMs, startCountdown, unlockAudio, chime,
} from '../timers.js';
import { historySheet, noteSheet, skipSheet, summarySheet } from './sheets.js';

let timerInterval = null;

export function renderDay(dayId, rerender) {
  const day = getDay(dayId);
  if (!day) { location.hash = '#/today'; return h('div'); }
  const s = store.get();
  const rec = store.day(dayId) || {};
  const prog = dayProgress(dayId);
  const index = idToIndex(dayId);
  const isToday = dayId === todayId();
  const week = getWeek(day.week);
  const sessionActive = s.session?.dayId === dayId;
  const date = dateForId(dayId);

  clearInterval(timerInterval);

  const container = h('div');

  // ---- header -------------------------------------------------------------
  const nav = h('div', { class: 'nav' },
    h('button', {
      class: 'navbtn', disabled: index === 0,
      onclick: () => { location.hash = `#/day/${indexToId(clampIndex(index - 1))}`; },
    }, '‹'),
    h('div', { class: 'center grow' },
      h('div', { class: 'h1' }, `Week ${day.week} · ${day.name}`),
      h('div', { class: 'row', style: 'justify-content:center;gap:6px;margin-top:4px;flex-wrap:wrap' },
        h('span', { class: 'chip', style: `color:${week.phase.color};border-color:${week.phase.color}44` }, week.phase.name),
        date ? h('span', { class: 'chip' }, fmtDate(date)) : null,
        isToday ? h('span', { class: 'chip accent' }, 'TODAY') : null,
        prog.status === 'done' ? h('span', { class: 'chip good' }, rec.auto ? '✓ done (assumed)' : '✓ done') : null,
        prog.status === 'skipped' ? h('span', { class: 'chip bad' }, 'skipped') : null,
      ),
    ),
    h('button', {
      class: 'navbtn', disabled: index === 104,
      onclick: () => { location.hash = `#/day/${indexToId(clampIndex(index + 1))}`; },
    }, '›'),
  );
  const head = h('div', { class: 'dayhead' }, nav,
    h('div', { class: 'center dim small', style: 'font-weight:600' }, day.title),
    !isToday ? h('div', { class: 'center', style: 'margin-top:6px' },
      h('a', { class: 'chip info', href: '#/today' }, '↩ jump to today')) : null,
  );
  container.append(head);

  // badges / banners
  if (week.badge) container.append(h('div', { class: `banner ${day.week === 7 || day.week === 12 ? 'deload' : ''}` }, week.badge));
  if (isToday) {
    const behind = todayIndex() - firstOpenIndex();
    if (behind > 0) {
      container.append(h('div', { class: 'banner behind' },
        `You're ${behind} day${behind > 1 ? 's' : ''} behind schedule — first open day: `,
        h('a', { href: `#/day/${indexToId(firstOpenIndex())}`, style: 'text-decoration:underline;font-weight:800' },
          labelFor(indexToId(firstOpenIndex()))),
      ));
    }
  }

  // ---- rest-only / off days ----------------------------------------------
  if (day.kind === 'off') {
    container.append(restDayCard(dayId, prog, rerender,
      '😴', 'Full Rest', 'No training, no cardio today. Recovery is where the adaptation happens — eat your protein (180–200 g) and sleep.'));
    container.append(footerButtons(dayId, rec, prog, rerender));
    return container;
  }

  // ---- session timer bar --------------------------------------------------
  container.append(sessionBar(dayId, sessionActive, prog, rerender));

  // ---- at-a-glance (not started, not done) --------------------------------
  if (!sessionActive && prog.status !== 'done' && prog.status !== 'skipped' && prog.pct === 0) {
    const req = requiredEntries(day);
    const est = estimateMinutes(day);
    container.append(h('div', { class: 'card row' },
      h('div', { class: 'grow' },
        h('div', { class: 'small', style: 'font-weight:700' }, `${req.length} exercises · ~${est} min incl. cardio`),
        h('div', { class: 'tiny faint' }, 'Start the workout to track your time and get rest timers.'),
      ),
    ));
  }

  // ---- sections -----------------------------------------------------------
  const entries = dayExercises(day);
  const entryByKey = new Map(entries.map((e) => [e.key, e]));
  const currentKey = sessionActive ? findCurrentKey(dayId, entries) : null;

  day.sections.forEach((sec, si) => {
    const secDone = sec.items.every((_, ii) => {
      const e = entryByKey.get(`s${si}i${ii}`);
      return e.item.opt || exerciseDone(dayId, e);
    });
    container.append(h('div', { class: 'section-title' },
      `${sec.title}`,
      h('span', { class: 'count' }, secDone ? ' ✓' : ` ${sec.items.length}`),
    ));

    // group consecutive superset items
    let i = 0;
    while (i < sec.items.length) {
      const item = sec.items[i];
      if (item.ss && sec.items[i + 1]?.ss === item.ss) {
        const group = h('div', { class: 'ss-group' }, h('span', { class: 'ss-label' }, 'Superset'));
        let j = i;
        while (j < sec.items.length && sec.items[j].ss === item.ss) {
          group.append(exerciseCard(dayId, entryByKey.get(`s${si}i${j}`), currentKey, rerender));
          j++;
        }
        container.append(group);
        i = j;
      } else {
        container.append(exerciseCard(dayId, entryByKey.get(`s${si}i${i}`), currentKey, rerender));
        i++;
      }
    }
  });

  // ---- footer -------------------------------------------------------------
  container.append(footerButtons(dayId, rec, prog, rerender));
  if (rec.note) {
    container.append(h('div', { class: 'card', onclick: () => noteSheet(dayId, rerender) },
      h('div', { class: 'tiny faint', style: 'font-weight:700;text-transform:uppercase;letter-spacing:.06em' }, 'Note'),
      h('div', { class: 'small dim', style: 'margin-top:3px;white-space:pre-wrap' }, rec.note)));
  }
  return container;
}

const labelFor = (dayId) => {
  const d = getDay(dayId);
  return `Week ${d.week} · ${d.name}`;
};

function restDayCard(dayId, prog, rerender, emoji, title, text) {
  const done = prog.status === 'done';
  return h('div', { class: 'card restday' },
    h('div', { class: 'emoji' }, emoji),
    h('div', { class: 'h2', style: 'margin-top:8px' }, title),
    h('div', { class: 'small dim', style: 'margin:8px auto 16px;max-width:320px' }, text),
    h('button', {
      class: `btn ${done ? '' : 'primary'}`,
      onclick: () => { markDay(dayId, done ? null : 'done'); rerender(); },
    }, done ? '✓ Rest day complete — undo' : 'Mark rest day complete'),
  );
}

// ---- session bar -----------------------------------------------------------
function sessionBar(dayId, active, prog, rerender) {
  const s = store.get();
  if (!active) {
    const otherSession = s.session && s.session.dayId !== dayId;
    return h('div', { class: 'sessionbar' },
      h('div', { class: 'grow' },
        h('div', { class: 'time' }, store.day(dayId)?.elapsedMs ? fmtMs(store.day(dayId).elapsedMs) : '0:00'),
        h('div', { class: 'tiny faint' }, store.day(dayId)?.elapsedMs ? 'time logged on this day' : 'workout timer'),
      ),
      otherSession
        ? h('a', { class: 'btn sm', href: `#/day/${s.session.dayId}` }, `Session running on ${labelFor(s.session.dayId)} →`)
        : h('button', {
            class: 'btn primary',
            onclick: () => { unlockAudio(); startSession(dayId); rerender(); },
          }, prog.pct > 0 ? '▶ Resume workout' : '▶ Start workout'),
    );
  }
  const paused = !!s.session.pausedAt;
  const timeEl = h('div', { class: 'time' }, fmtMs(sessionElapsedMs()));
  timerInterval = setInterval(() => { timeEl.textContent = fmtMs(sessionElapsedMs()); }, 500);
  return h('div', { class: 'sessionbar running' },
    h('div', { class: 'grow' }, timeEl,
      h('div', { class: 'tiny', style: 'color:var(--accent);font-weight:700' }, paused ? 'PAUSED' : '● RECORDING')),
    h('button', {
      class: 'btn sm', onclick: () => { paused ? resumeSession() : pauseSession(); rerender(); },
    }, paused ? '▶' : '⏸'),
    h('button', {
      class: 'btn sm',
      onclick: () => {
        const { elapsed } = finishSession();
        toast(`Workout time saved: ${fmtMs(elapsed)}`);
        rerender();
      },
    }, '■ Finish'),
  );
}

// first not-fully-ticked required exercise (flow mode highlight)
function findCurrentKey(dayId, entries) {
  for (const e of entries) {
    if (e.item.opt) continue;
    if (!exerciseDone(dayId, e)) return e.key;
  }
  return null;
}

// ---- exercise card ---------------------------------------------------------
function exerciseCard(dayId, entry, currentKey, rerender) {
  const { item, key } = entry;
  const ex = EX[item.ex];
  const done = exerciseDone(dayId, entry);
  const isCurrent = key === currentKey;
  const sch = item.sch;
  const loggable = !!ex.log;
  const rec = store.day(dayId);
  const index = idToIndex(dayId);

  const card = h('div', {
    class: `ex${done ? ' done' : ''}${isCurrent ? ' current' : ''}${item.opt ? ' optional' : ''}`,
    'data-exkey': key,
  });

  // head
  card.append(h('div', { class: 'ex-head' },
    h('div', { class: 'grow' },
      h('button', {
        class: 'ex-name', style: 'text-align:left',
        onclick: () => historySheet(item.ex),
      }, ex.name, item.opt ? h('span', { class: 'chip', style: 'margin-left:7px' }, 'optional') : null),
      h('div', { class: 'ex-meta' },
        h('span', {}, h('b', {}, schemeLabel(sch)), sch.t === 'sr' ? ' reps' : ''),
        item.rest ? h('span', {}, '⏱ rest ', h('b', {}, fmtSecs(item.rest))) : null,
      ),
      (ex.note || item.note) ? h('div', { class: 'ex-note' }, [ex.note, item.note].filter(Boolean).join(' · ')) : null,
    ),
    h('a', { class: 'ytlink', href: ytUrl(item.ex), target: '_blank', rel: 'noopener', 'aria-label': 'How-to video' },
      h('span', { html: '<svg viewBox="0 0 24 24"><path fill-rule="evenodd" d="M10 8.5v7l6-3.5-6-3.5ZM21.6 7.2a2.6 2.6 0 0 0-1.8-1.9C18.2 5 12 5 12 5s-6.2 0-7.8.3a2.6 2.6 0 0 0-1.8 1.9A27 27 0 0 0 2 12c0 1.6.1 3.2.4 4.8a2.6 2.6 0 0 0 1.8 1.9c1.6.3 7.8.3 7.8.3s6.2 0 7.8-.3a2.6 2.6 0 0 0 1.8-1.9c.3-1.6.4-3.2.4-4.8s-.1-3.2-.4-4.8Z"/></svg>' })),
  ));

  // overload hint (loggable, untouched yet)
  if (loggable && !done && exerciseSetsDone(dayId, entry) === 0) {
    const hint = overloadHint(item.ex, index);
    if (hint) {
      card.append(h('div', { class: 'hint' },
        `Last time: all sets clean at ${hint.lastWeight} kg → add weight today`));
    }
  }

  // sets
  const last = loggable ? lastSessionFor(item.ex, index) : null;
  const setsWrap = h('div', { class: 'sets' });
  const n = schemeSets(sch);
  for (let i = 0; i < n; i++) {
    const isWU = sch.t === 'wuws' && i < sch.wu;
    const st = rec?.ex?.[key]?.sets?.[i];
    const ticked = !!st?.done;
    const label = sch.t === 'wuws' ? (isWU ? `WU${sch.wu > 1 ? i + 1 : ''}` : `WS${sch.ws > 1 ? i - sch.wu + 1 : ''}`) : `${i + 1}`;
    const tick = h('button', {
      class: `set${isWU ? ' wu' : ''}${ticked ? ' on' : ''}`,
      'aria-label': `${ex.name} set ${i + 1}`,
      onclick: () => {
        unlockAudio();
        const wasLast = i === n - 1 || allOthersTicked(rec, key, n, i);
        const { dayJustCompleted } = toggleSet(dayId, entry, i);
        const nowTicked = !ticked;
        if (nowTicked && item.rest && store.get().settings.autoRest && !dayJustCompleted) {
          startCountdown({ label: `Rest — ${ex.name}`, secs: item.rest, kind: 'rest' });
        }
        if (dayJustCompleted) onDayCompleted(dayId, rerender);
        rerender(nowTicked && wasLast ? { scrollNext: true } : undefined);
      },
    }, h('span', { class: 'lbl' }, ticked ? '✓' : label));

    if (loggable && !isWU) {
      const prevSet = last?.sets?.[i] ?? last?.sets?.[last.sets.length - 1];
      const wIn = h('input', {
        type: 'number', inputmode: 'decimal', placeholder: prevSet?.weight != null ? String(prevSet.weight) : 'kg',
        value: st?.weight ?? '',
        onchange: (e) => setLog(dayId, entry, i, { weight: e.target.value === '' ? null : +e.target.value, reps: st?.reps ?? null }),
      });
      const rIn = h('input', {
        type: 'number', inputmode: 'numeric', placeholder: prevSet?.reps != null ? String(prevSet.reps) : (sch.reps != null ? String(sch.reps) : 'reps'),
        value: st?.reps ?? '',
        onchange: (e) => setLog(dayId, entry, i, { weight: st?.weight ?? null, reps: e.target.value === '' ? null : +e.target.value }),
      });
      setsWrap.append(h('div', { class: 'setrow' }, tick,
        h('div', { class: 'loginputs' },
          wIn, h('span', { class: 'unit' }, 'KG'), rIn, h('span', { class: 'unit' }, 'REPS'))));
    } else {
      setsWrap.append(tick);
    }
  }
  card.append(setsWrap);

  // actions: hold timer / counter
  const actions = h('div', { class: 'ex-actions' });
  if (sch.t === 'time') {
    actions.append(h('button', {
      class: 'timerbtn',
      onclick: () => {
        unlockAudio();
        startCountdown({
          label: ex.name, secs: sch.secs, kind: 'hold',
          onDone: () => {
            // auto-tick the first unticked set once the hold finishes
            const cur = store.day(dayId)?.ex?.[key]?.sets || [];
            for (let i = 0; i < n; i++) {
              if (!cur[i]?.done) {
                const { dayJustCompleted } = toggleSet(dayId, entry, i);
                if (item.rest && store.get().settings.autoRest && !dayJustCompleted) {
                  startCountdown({ label: `Rest — ${ex.name}`, secs: item.rest, kind: 'rest' });
                }
                if (dayJustCompleted) onDayCompleted(dayId, rerender);
                break;
              }
            }
            rerender();
          },
        });
      },
    }, `▶ ${fmtSecs(sch.secs)} timer`));
  }
  card.append(actions);

  // freestyle contact counter
  if (item.counter) card.append(contactCounter(dayId, entry, rerender));

  return card;
}

function allOthersTicked(rec, key, n, except) {
  const sets = rec?.ex?.[key]?.sets || [];
  for (let i = 0; i < n; i++) if (i !== except && !sets[i]?.done) return false;
  return true;
}

function contactCounter(dayId, entry, rerender) {
  const { item, key } = entry;
  const n = schemeSets(item.sch);
  const rec = store.day(dayId);
  // active block: first unticked set, else last
  let block = 0;
  const sets = rec?.ex?.[key]?.sets || [];
  for (let i = 0; i < n; i++) { if (!sets[i]?.done) { block = i; break; } block = n - 1; }
  const contacts = rec?.contacts?.[`${key}:${block}`] || 0;
  const { warn, cap } = item.counter;
  const cls = contacts >= cap ? 'cap' : contacts >= warn ? 'warn' : '';
  const box = h('div', { class: `counterbox ${cls}` },
    h('div', { class: 'tiny faint', style: 'font-weight:800;letter-spacing:.06em;text-transform:uppercase' },
      `Ground contacts — block ${block + 1}/${n}`),
    h('div', { class: 'cnum' }, String(contacts)),
    h('div', { class: 'tiny dim' },
      contacts >= cap ? '⛔ Cap reached — stop this block'
        : contacts >= warn ? `⚠️ Approaching cap (${cap})`
        : `cap ${warn}–${cap} per block`),
    h('div', { class: 'cbtns' },
      h('button', {
        class: 'tapbtn', style: 'flex:0 0 64px',
        onclick: () => { bump(-1); },
      }, '−'),
      h('button', { class: 'tapbtn', onclick: () => { bump(+1); } }, '+1 contact'),
    ),
  );
  function bump(d) {
    store.update((s) => {
      const dRec = s.days[dayId] || (s.days[dayId] = { status: null, ex: {} });
      dRec.contacts = dRec.contacts || {};
      const k = `${key}:${block}`;
      dRec.contacts[k] = Math.max(0, (dRec.contacts[k] || 0) + d);
      if (d > 0 && dRec.contacts[k] === warn) chime('warn');
      if (d > 0 && dRec.contacts[k] === cap) chime('done');
    });
    rerender({ keepScroll: true });
  }
  return box;
}

// ---- day completion --------------------------------------------------------
function onDayCompleted(dayId, rerender) {
  const s = store.get();
  let elapsed = 0;
  if (s.session?.dayId === dayId) {
    elapsed = finishSession().elapsed;
  } else {
    elapsed = store.day(dayId)?.elapsedMs || 0;
  }
  // PR detection: this day's best logged weight per exercise vs previous best
  const day = getDay(dayId);
  const index = idToIndex(dayId);
  const rec = store.day(dayId);
  const prs = [];
  const seen = new Set();
  let setsDone = 0;
  for (const e of dayExercises(day)) {
    const exRec = rec?.ex?.[e.key];
    if (!exRec) continue;
    setsDone += (exRec.sets || []).filter((x) => x?.done).length;
    if (!EX[e.item.ex].log || seen.has(e.item.ex)) continue;
    seen.add(e.item.ex);
    const todayW = Math.max(...(exRec.sets || []).map((x) => x?.weight != null ? +x.weight : -Infinity));
    if (!isFinite(todayW)) continue;
    const prevBest = bestWeight(historyFor(e.item.ex).filter((hh) => hh.index < index));
    if (prevBest === null || todayW > prevBest) {
      prs.push({ name: EX[e.item.ex].name, weight: todayW, prev: prevBest });
    }
  }
  chime('done');
  summarySheet({ dayId, elapsed, setsDone, prs }, rerender);
  maybeBackupNudge(day.week);
}

function maybeBackupNudge(week) {
  const s = store.get();
  // nudge once per newly-closed week
  import('../completion.js').then(({ weekProgress }) => {
    if (weekProgress(week).closed && s.settings.backupPromptWeek < week) {
      store.update((st) => { st.settings.backupPromptWeek = week; });
      setTimeout(() => toast('💾 Week closed — consider exporting a backup (Settings)', 4200), 1200);
    }
  });
}

// ---- footer ---------------------------------------------------------------
function footerButtons(dayId, rec, prog, rerender) {
  const wrap = h('div', { style: 'display:flex;gap:8px;margin-top:16px;flex-wrap:wrap' });
  wrap.append(h('button', { class: 'btn sm grow', onclick: () => noteSheet(dayId, rerender) },
    rec.note ? '✍️ Edit note' : '✍️ Add note'));
  if (prog.status === 'done') {
    wrap.append(h('button', {
      class: 'btn sm grow',
      onclick: () => { markDay(dayId, null); rerender(); },
    }, '↺ Reopen day'));
  } else if (prog.status === 'skipped') {
    wrap.append(h('button', {
      class: 'btn sm grow',
      onclick: () => { markDay(dayId, null); rerender(); },
    }, '↺ Unskip day'));
  } else {
    wrap.append(h('button', {
      class: 'btn sm grow',
      onclick: () => {
        markDay(dayId, 'done');
        onDayCompleted(dayId, rerender);
      },
    }, '✓ Mark day done'));
    wrap.append(h('button', { class: 'btn sm grow', onclick: () => skipSheet(dayId, rerender) }, '⤼ Skip'));
  }
  return wrap;
}

function estimateMinutes(day) {
  let secs = 0;
  for (const e of dayExercises(day)) {
    const sch = e.item.sch;
    const per = sch.t === 'time' ? sch.secs : 35;
    secs += schemeSets(sch) * (per + (e.item.rest || 25));
  }
  return Math.round(secs / 60 / 5) * 5;
}
