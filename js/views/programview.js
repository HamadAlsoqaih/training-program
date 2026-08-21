// ============================================================================
// programview.js — 15-week overview grouped by phase, and week detail.
// ============================================================================
import { h, svgRing } from '../util.js';
import { PHASES, getWeek, WEEK_BADGES } from '../program.js';
import { weekProgress, dayProgress } from '../completion.js';
import { todayId, dateForId, fmtDate, weekdayName, isSwapped } from '../schedule.js';
import { programNotesSheet, daySwapSheet } from './sheets.js';

export function renderProgram() {
  const tId = todayId();
  const curWeek = +/w(\d+)/.exec(tId)[1];
  const container = h('div',
    h('div', { class: 'row', style: 'margin-bottom:6px' },
      h('div', { class: 'h1 grow' }, 'Program'),
      h('button', { class: 'btn sm', onclick: programNotesSheet }, '📋 Notes & nutrition'),
    ),
  );

  for (const phase of PHASES) {
    container.append(h('div', { class: 'phasehead' },
      h('span', { class: 'dot', style: `background:${phase.color}` }),
      h('span', { class: 'name' }, phase.name),
    ));
    for (let w = phase.weeks[0]; w <= phase.weeks[1]; w++) {
      const wp = weekProgress(w);
      const isCur = w === curWeek;
      const badge = WEEK_BADGES[w];
      container.append(h('a', { class: `weekrow${isCur ? ' current' : ''}`, href: `#/week/${w}` },
        h('div', { class: 'ring-mini' },
          h('span', { html: svgRing(wp.pct, 40, 4, wp.complete ? 'var(--good)' : phase.color) }),
          h('span', { class: 'v' }, wp.closed ? '✓' : `${wp.doneDays + wp.skipped}/7`),
        ),
        h('div', { class: 'grow' },
          h('div', { class: 'wnum' }, `Week ${w}`,
            isCur ? h('span', { class: 'chip accent', style: 'margin-left:8px' }, 'current') : null,
            wp.complete ? h('span', { class: 'chip good', style: 'margin-left:8px' }, 'done') : null,
            wp.skipped > 0 && wp.closed ? h('span', { class: 'chip bad', style: 'margin-left:8px' }, `${wp.skipped} skipped`) : null,
          ),
          badge ? h('div', { class: 'wsub' }, badge) : null,
        ),
        h('div', { class: 'faint' }, '›'),
      ));
    }
  }
  return container;
}

export function renderWeek(weekNum, rerender) {
  const week = getWeek(weekNum);
  if (!week) { location.hash = '#/program'; return h('div'); }
  const tId = todayId();
  const wp = weekProgress(weekNum);

  const container = h('div',
    h('div', { class: 'nav row', style: 'margin-bottom:10px' },
      h('a', { class: 'navbtn', href: '#/program' }, '‹'),
      h('div', { class: 'center grow' },
        h('div', { class: 'h1' }, `Week ${weekNum}`),
        h('div', { class: 'row', style: 'justify-content:center;gap:6px;margin-top:4px' },
          h('span', { class: 'chip', style: `color:${week.phase.color};border-color:${week.phase.color}44` }, week.phase.name),
          wp.complete ? h('span', { class: 'chip good' }, '✓ week done') : null,
        ),
      ),
      h('button', {
        class: 'navbtn', 'aria-label': 'Swap days this week', style: 'font-size:15px',
        onclick: () => daySwapSheet(weekNum, rerender),
      }, '⇄'),
    ),
  );
  if (week.badge) container.append(h('div', { class: `banner ${weekNum === 7 || weekNum === 12 ? 'deload' : ''}` }, week.badge));

  for (const day of week.days) {
    const p = dayProgress(day.id);
    const isToday = day.id === tId;
    const date = dateForId(day.id);
    let statEl;
    if (p.status === 'done') statEl = h('div', { class: 'dstat done' }, '✓');
    else if (p.status === 'skipped') statEl = h('div', { class: 'dstat skip' }, '✗');
    else if (p.pct > 0) statEl = h('div', { class: 'dstat part' }, `${Math.round(p.pct * 100)}`);
    else statEl = h('div', { class: 'dstat' }, String(day.d));
    container.append(h('a', {
      class: `daycard${isToday ? ' today' : ''}${p.status === 'done' ? ' done' : ''}`,
      href: `#/day/${day.id}`,
    },
      statEl,
      h('div', { class: 'grow' },
        h('div', { style: 'font-weight:700;font-size:15px' },
          `Day ${day.d} — ${weekdayName(day.d, weekNum)}`,
          isToday ? h('span', { class: 'chip accent', style: 'margin-left:7px' }, 'today') : null,
          isSwapped(weekNum, day.d) ? h('span', { class: 'chip info', style: 'margin-left:7px' }, '⇄') : null,
        ),
        h('div', { class: 'small dim' }, day.title),
        date ? h('div', { class: 'tiny faint' }, fmtDate(date), p.status === 'done' && dayProgressAuto(day.id) ? ' · assumed done' : '') : null,
      ),
      h('div', { class: 'faint' }, '›'),
    ));
  }
  return container;
}

import * as store from '../state.js';
const dayProgressAuto = (id) => !!store.day(id)?.auto;
