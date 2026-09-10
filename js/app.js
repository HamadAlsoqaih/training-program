// ============================================================================
// app.js — boot, hash router, theme accent, rest-countdown bar, service worker.
//
// Routes
//   #/today                     active program's day for today
//   #/day/<pid>/<dayId>         any day of any program
//   #/programs                  all programs
//   #/program/<pid>             one program: start / continue + phases
//   #/phase/<pid>/<n>           weeks in a phase
//   #/week/<pid>/<n>            days in a week
//   #/start/<pid>               start / re-configure a program (also first run)
//   #/progress  #/settings
// ============================================================================
import { h, svgRing } from './util.js';
import * as store from './state.js';
import { todayId, programStatus } from './schedule.js';
import { DEFAULT_PROGRAM, PROGRAMS } from './program.js';
import { onCountdown, extendCountdown, skipCountdown, fmtMs, acquireWakeLock } from './timers.js';
import { renderDay, renderProgramGate } from './views/day.js';
import { renderPrograms, renderProgram, renderPhase, renderWeek } from './views/programview.js';
import { renderProgress } from './views/progress.js';
import { renderSettings, renderStart } from './views/settings.js';

const view = () => document.getElementById('view');
let currentRoute = null;

// --- theme accent -----------------------------------------------------------
function applyAccent(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const value = m ? `#${m[1]}` : '#fbbf24';
  const r = parseInt(value.slice(1, 3), 16);
  const g = parseInt(value.slice(3, 5), 16);
  const b = parseInt(value.slice(5, 7), 16);
  // relative luminance decides whether text on the accent is dark or light
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const root = document.documentElement.style;
  root.setProperty('--accent', value);
  root.setProperty('--accent-ink', lum > 0.55 ? '#15130a' : '#ffffff');
  root.setProperty('--accent-soft', `rgba(${r},${g},${b},.14)`);
  root.setProperty('--accent-line', `rgba(${r},${g},${b},.42)`);
}

// --- router -----------------------------------------------------------------
function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { name: parts[0] || 'today', args: parts.slice(1) };
}

function render(opts = {}) {
  const s = store.get();
  applyAccent(s.settings.accent);

  const tabbar = document.getElementById('tabbar');
  if (!s.onboarded) {
    tabbar.style.display = 'none';
    view().replaceChildren(renderStart(DEFAULT_PROGRAM, () => { location.hash = '#/today'; render(); }));
    return;
  }
  tabbar.style.display = '';

  const { name, args } = parseRoute();
  currentRoute = { name, args };
  const prevScroll = window.scrollY;
  const rerender = (o) => render({ keepScroll: true, ...(o || {}) });
  const validPid = (p) => (PROGRAMS[p] ? p : store.activePid());

  let el, tab = 'today';
  switch (name) {
    case 'day':
      el = renderDay(validPid(args[0]), args[1], rerender); tab = 'today'; break;
    case 'programs':
      el = renderPrograms(); tab = 'program'; break;
    case 'program':
      el = renderProgram(validPid(args[0]), rerender); tab = 'program'; break;
    case 'phase':
      el = renderPhase(validPid(args[0]), +args[1]); tab = 'program'; break;
    case 'week':
      el = renderWeek(validPid(args[0]), +args[1], rerender); tab = 'program'; break;
    case 'start':
      tabbar.style.display = 'none';
      view().replaceChildren(renderStart(validPid(args[0]), () => { location.hash = '#/today'; render(); }));
      return;
    case 'progress':
      el = renderProgress(rerender); tab = 'progress'; break;
    case 'settings':
      el = renderSettings(rerender); tab = 'settings'; break;
    case 'today':
    default: {
      // If the active program hasn't started yet (or has finished), show that
      // instead of pretending the nearest day is today.
      const pid = store.activePid();
      const status = programStatus(pid);
      el = status.state === 'active'
        ? renderDay(pid, todayId(), rerender)
        : renderProgramGate(pid, status, rerender);
      tab = 'today'; break;
    }
  }

  view().replaceChildren(el);
  document.querySelectorAll('#tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));

  if (opts.scrollNext) {
    const cur = view().querySelector('.ex.current');
    if (cur) { cur.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  }
  if (opts.keepScroll) window.scrollTo(0, prevScroll);
  else window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => render());
if (store.get().session) acquireWakeLock();

// --- rest / hold countdown bar ----------------------------------------------
const restbar = document.getElementById('restbar');
let restUi = null;
onCountdown((cd) => {
  if (!cd) { restbar.classList.remove('show'); restUi = null; return; }
  const pct = 1 - cd.remainMs / cd.totalMs;
  const secsLeft = Math.ceil(cd.remainMs / 1000);
  const color = cd.kind === 'hold' ? 'var(--accent)' : 'var(--info)';
  if (!restUi || restUi.id !== cd.id) {
    const ringSpan = h('span', { html: svgRing(pct, 52, 4, color) });
    const rt = h('span', { class: 'rt' }, String(secsLeft));
    const rtime = h('div', { class: 'rtime' }, fmtMs(cd.remainMs + 999));
    restbar.replaceChildren(h('div', { class: `restcard${cd.kind === 'hold' ? ' hold' : ''}` },
      h('div', { class: 'ring' }, ringSpan, rt),
      h('div', { class: 'grow' },
        h('div', { class: 'rlabel' }, cd.kind === 'hold' ? `⏱ ${cd.label}` : cd.label),
        rtime),
      h('button', { class: 'btn sm', onclick: () => extendCountdown(-30) }, '−30'),
      h('button', { class: 'btn sm', onclick: () => extendCountdown(30) }, '+30'),
      h('button', { class: 'btn sm', onclick: () => skipCountdown() }, 'Skip'),
    ));
    restUi = { id: cd.id, ringSpan, rt, rtime };
    restbar.classList.add('show');
  } else {
    restUi.ringSpan.innerHTML = svgRing(pct, 52, 4, color);
    restUi.rt.textContent = String(secsLeft);
    restUi.rtime.textContent = fmtMs(cd.remainMs + 999);
  }
});

// re-check "today" when the app comes back to the foreground
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && currentRoute?.name === 'today') render({ keepScroll: true });
});

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}

render();
