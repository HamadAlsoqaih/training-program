// ============================================================================
// programview.js — the browsing hierarchy:
//   Programs  →  Program (start / continue + phases)  →  Phase  →  Week  →  Day
// ============================================================================
import { h, svgRing, toast } from '../util.js';
import { PROGRAM_LIST, getProgram, getWeek, totalWeeks } from '../program.js';
import { weekProgress, dayProgress } from '../completion.js';
import * as store from '../state.js';
import { todayId, dateForId, fmtDate, weekdayName, isSwapped, currentWeek } from '../schedule.js';
import { programNotesSheet, daySwapSheet } from './sheets.js';

const progressOf = (pid) => {
  let done = 0;
  const weeks = totalWeeks(pid);
  for (let w = 1; w <= weeks; w++) done += weekProgress(pid, w).doneDays;
  return { done, total: weeks * 7, pct: done / (weeks * 7) };
};

// --- 1. all programs ---------------------------------------------------------
export function renderPrograms() {
  const activePid = store.activePid();
  const container = h('div', h('div', { class: 'h1', style: 'margin-bottom:4px' }, 'Programs'),
    h('div', { class: 'small dim', style: 'margin-bottom:14px' },
      'Each program keeps its own schedule and progress. Your logged weights carry across both.'));

  for (const program of PROGRAM_LIST) {
    const pid = program.id;
    const p = progressOf(pid);
    const bucket = store.prog(pid);
    const isActive = pid === activePid;
    container.append(h('a', { class: `weekrow${isActive ? ' current' : ''}`, href: `#/program/${pid}` },
      h('div', { class: 'ring-mini', style: 'width:46px;height:46px' },
        h('span', { html: svgRing(p.pct, 46, 4, isActive ? 'var(--accent)' : 'var(--dim)') }),
        h('span', { class: 'v' }, `${Math.round(p.pct * 100)}%`),
      ),
      h('div', { class: 'grow' },
        h('div', { class: 'wnum' }, program.name,
          isActive ? h('span', { class: 'chip accent', style: 'margin-left:8px' }, 'active') : null,
          !bucket.started ? h('span', { class: 'chip', style: 'margin-left:8px' }, 'not started') : null),
        h('div', { class: 'wsub' }, program.subtitle),
        h('div', { class: 'tiny faint', style: 'margin-top:2px' },
          `${program.weeks} weeks · ${program.phases.length} phases · ${p.done}/${p.total} days done`),
      ),
      h('div', { class: 'faint' }, '›'),
    ));
  }
  return container;
}

// --- 2. one program: start/continue + phases --------------------------------
export function renderProgram(pid, rerender) {
  const program = getProgram(pid);
  const bucket = store.prog(pid);
  const isActive = pid === store.activePid();
  const p = progressOf(pid);
  const container = h('div',
    h('div', { class: 'nav row', style: 'margin-bottom:10px' },
      h('a', { class: 'navbtn', href: '#/programs' }, '‹'),
      h('div', { class: 'center grow' },
        h('div', { class: 'h1' }, program.name),
        h('div', { class: 'small dim' }, program.subtitle)),
      h('button', { class: 'navbtn', 'aria-label': 'Notes & nutrition', onclick: () => programNotesSheet(pid) }, '📋'),
    ),
    h('div', { class: 'hero' },
      h('div', { class: 'ring-mini', style: 'width:64px;height:64px' },
        h('span', { html: svgRing(p.pct, 64, 6, 'var(--good)') }),
        h('span', { class: 'v' }, `${Math.round(p.pct * 100)}%`)),
      h('div', { class: 'grow' },
        h('div', { class: 'bignum' }, `${program.weeks} weeks`),
        h('div', { class: 'small dim' }, `${p.done} of ${p.total} days complete`),
        isActive ? h('div', { class: 'chip accent', style: 'margin-top:6px' }, 'your active program') : null,
      ),
    ),
  );

  // start / continue / switch
  if (!bucket.started) {
    container.append(h('button', {
      class: 'btn primary block', style: 'min-height:54px',
      onclick: () => { location.hash = `#/start/${pid}`; },
    }, '▶ Start this program'));
    container.append(h('div', { class: 'tiny faint center', style: 'margin-top:8px' },
      'You pick your training weekdays and where you are starting from. Your other program keeps all of its progress.'));
  } else if (isActive) {
    container.append(h('a', { class: 'btn primary block', style: 'min-height:54px', href: '#/today' }, '▶ Continue — go to today'));
  } else {
    container.append(h('button', {
      class: 'btn block', style: 'min-height:54px',
      onclick: () => {
        if (!confirm(`Make "${program.name}" your active program? The Today tab will follow this program. Nothing is deleted.`)) return;
        store.setActiveProgram(pid);
        toast(`${program.name} is now active`);
        location.hash = '#/today';
      },
    }, '⇄ Make this my active program'));
    container.append(h('a', { class: 'btn sm block', style: 'margin-top:8px', href: `#/start/${pid}` }, '⚙ Change its schedule / starting point'));
  }

  // phases
  container.append(h('div', { class: 'section-title' }, 'Phases'));
  for (const phase of program.phases) {
    let done = 0, total = 0;
    for (let w = phase.weeks[0]; w <= phase.weeks[1]; w++) {
      const wp = weekProgress(pid, w);
      done += wp.doneDays + wp.skipped; total += 7;
    }
    const cur = isActive && currentWeek(pid) >= phase.weeks[0] && currentWeek(pid) <= phase.weeks[1];
    container.append(h('a', { class: `weekrow${cur ? ' current' : ''}`, href: `#/phase/${pid}/${phase.n}` },
      h('div', { class: 'ring-mini' },
        h('span', { html: svgRing(done / total, 40, 4, phase.color) }),
        h('span', { class: 'v' }, `${Math.round((done / total) * 100)}%`)),
      h('div', { class: 'grow' },
        h('div', { class: 'wnum' }, phase.name,
          cur ? h('span', { class: 'chip accent', style: 'margin-left:8px' }, 'current') : null),
        h('div', { class: 'wsub' },
          `Weeks ${phase.weeks[0]}–${phase.weeks[1]} · ${done}/${total} days`),
      ),
      h('div', { class: 'faint' }, '›'),
    ));
  }
  return container;
}

// --- 3. a phase: its weeks ---------------------------------------------------
export function renderPhase(pid, phaseNum) {
  const program = getProgram(pid);
  const phase = program.phases.find((x) => x.n === phaseNum);
  if (!phase) { location.hash = `#/program/${pid}`; return h('div'); }
  const cur = currentWeek(pid);
  const isActive = pid === store.activePid();

  const container = h('div',
    h('div', { class: 'nav row', style: 'margin-bottom:10px' },
      h('a', { class: 'navbtn', href: `#/program/${pid}` }, '‹'),
      h('div', { class: 'center grow' },
        h('div', { class: 'h1' }, phase.name),
        h('div', { class: 'small dim' }, `${program.name} · weeks ${phase.weeks[0]}–${phase.weeks[1]}`)),
      h('span', { class: 'navbtn', style: 'visibility:hidden' }),
    ),
  );

  for (let w = phase.weeks[0]; w <= phase.weeks[1]; w++) {
    const wp = weekProgress(pid, w);
    const badge = program.badges[w];
    container.append(h('a', {
      class: `weekrow${isActive && w === cur ? ' current' : ''}`, href: `#/week/${pid}/${w}`,
    },
      h('div', { class: 'ring-mini' },
        h('span', { html: svgRing(wp.pct, 40, 4, wp.complete ? 'var(--good)' : phase.color) }),
        h('span', { class: 'v' }, wp.closed ? '✓' : `${wp.doneDays + wp.skipped}/7`)),
      h('div', { class: 'grow' },
        h('div', { class: 'wnum' }, `Week ${w}`,
          isActive && w === cur ? h('span', { class: 'chip accent', style: 'margin-left:8px' }, 'current') : null,
          wp.complete ? h('span', { class: 'chip good', style: 'margin-left:8px' }, 'done') : null),
        badge ? h('div', { class: 'wsub' }, badge) : null),
      h('div', { class: 'faint' }, '›'),
    ));
  }
  return container;
}

// --- 4. a week: its days -----------------------------------------------------
export function renderWeek(pid, weekNum, rerender) {
  const week = getWeek(pid, weekNum);
  if (!week) { location.hash = `#/program/${pid}`; return h('div'); }
  const program = getProgram(pid);
  const isActive = pid === store.activePid();
  const tId = isActive ? todayId() : null;
  const wp = weekProgress(pid, weekNum);
  const phase = week.phase;

  const container = h('div',
    h('div', { class: 'nav row', style: 'margin-bottom:10px' },
      h('a', { class: 'navbtn', href: `#/phase/${pid}/${phase.n}` }, '‹'),
      h('div', { class: 'center grow' },
        h('div', { class: 'h1' }, `Week ${weekNum}`),
        h('div', { class: 'row', style: 'justify-content:center;gap:6px;margin-top:4px;flex-wrap:wrap' },
          h('span', { class: 'chip', style: `color:${phase.color};border-color:${phase.color}44` }, phase.name),
          h('span', { class: 'chip' }, program.name),
          wp.complete ? h('span', { class: 'chip good' }, '✓ week done') : null)),
      h('button', { class: 'navbtn', 'aria-label': 'Swap days this week', style: 'font-size:15px',
        onclick: () => daySwapSheet(pid, weekNum, rerender) }, '⇄'),
    ),
  );
  if (week.badge) {
    container.append(h('div', { class: `banner ${week.badge.includes('DELOAD') ? 'deload' : ''}` }, week.badge));
  }

  for (const day of week.days) {
    const p = dayProgress(pid, day.id);
    const isToday = day.id === tId;
    const date = isActive ? dateForId(day.id, pid) : null;
    let statEl;
    if (p.status === 'done') statEl = h('div', { class: 'dstat done' }, '✓');
    else if (p.status === 'skipped') statEl = h('div', { class: 'dstat skip' }, '✗');
    else if (p.pct > 0) statEl = h('div', { class: 'dstat part' }, `${Math.round(p.pct * 100)}`);
    else statEl = h('div', { class: 'dstat' }, String(day.d));

    container.append(h('a', {
      class: `daycard${isToday ? ' today' : ''}${p.status === 'done' ? ' done' : ''}`,
      href: `#/day/${pid}/${day.id}`,
    },
      statEl,
      h('div', { class: 'grow' },
        h('div', { style: 'font-weight:700;font-size:15px' },
          `Day ${day.d} — ${weekdayName(day.d, weekNum, pid)}`,
          isToday ? h('span', { class: 'chip accent', style: 'margin-left:7px' }, 'today') : null,
          isSwapped(weekNum, day.d, pid) ? h('span', { class: 'chip info', style: 'margin-left:7px' }, '⇄') : null),
        h('div', { class: 'small dim' }, day.title),
        date ? h('div', { class: 'tiny faint' },
          fmtDate(date), store.day(day.id, pid)?.auto ? ' · assumed done' : '') : null),
      h('div', { class: 'faint' }, '›'),
    ));
  }
  return container;
}
