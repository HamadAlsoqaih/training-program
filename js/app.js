// ============================================================================
// app.js — boot, hash router, rest-countdown bar, service worker.
// ============================================================================
import { h, svgRing } from './util.js';
import * as store from './state.js';
import { todayId } from './schedule.js';
import { onCountdown, extendCountdown, skipCountdown, fmtMs, acquireWakeLock } from './timers.js';
import { renderDay } from './views/day.js';
import { renderProgram, renderWeek } from './views/programview.js';
import { renderProgress } from './views/progress.js';
import { renderSettings, renderOnboarding } from './views/settings.js';

const view = () => document.getElementById('view');

let currentRoute = null;

function parseRoute() {
  const hashRoute = location.hash.replace(/^#\/?/, '') || 'today';
  const [name, arg] = hashRoute.split('/');
  return { name, arg };
}

function render(opts = {}) {
  const s = store.get();
  if (!s.setup.done) {
    document.getElementById('tabbar').style.display = 'none';
    view().replaceChildren(renderOnboarding(() => { location.hash = '#/today'; render(); }));
    return;
  }
  document.getElementById('tabbar').style.display = '';

  const { name, arg } = parseRoute();
  currentRoute = { name, arg };
  const prevScroll = window.scrollY;
  const rerender = (o) => render({ keepScroll: true, ...(o || {}) });

  let el, tab;
  switch (name) {
    case 'day':
      el = renderDay(arg, rerender); tab = 'today'; break;
    case 'program':
      el = renderProgram(); tab = 'program'; break;
    case 'week':
      el = renderWeek(+arg); tab = 'program'; break;
    case 'progress':
      el = renderProgress(rerender); tab = 'progress'; break;
    case 'settings':
      el = renderSettings(rerender); tab = 'settings'; break;
    case 'today':
    default:
      el = renderDay(todayId(), rerender); tab = 'today'; break;
  }

  view().replaceChildren(el);
  document.querySelectorAll('#tabbar a').forEach((a) =>
    a.classList.toggle('active', a.dataset.tab === tab));

  if (opts.scrollNext) {
    const cur = view().querySelector('.ex.current');
    if (cur) { cur.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  }
  if (opts.keepScroll) window.scrollTo(0, prevScroll);
  else window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => render());

// If a session is running, keep the wake lock across reloads
if (store.get().session) acquireWakeLock();

// ---------------------------------------------------------------------------
// Rest / hold countdown bar
// ---------------------------------------------------------------------------
const restbar = document.getElementById('restbar');
let restUi = null; // { id, ringSpan, rt, rtime } — built once per countdown
onCountdown((cd) => {
  if (!cd) {
    restbar.classList.remove('show');
    restUi = null;
    return;
  }
  const pct = 1 - cd.remainMs / cd.totalMs;
  const secsLeft = Math.ceil(cd.remainMs / 1000);
  if (!restUi || restUi.id !== cd.id) {
    const ringSpan = h('span', { html: svgRing(pct, 52, 4, cd.kind === 'hold' ? 'var(--accent)' : 'var(--info)') });
    const rt = h('span', { class: 'rt' }, String(secsLeft));
    const rtime = h('div', { class: 'rtime' }, fmtMs(cd.remainMs + 999));
    restbar.replaceChildren(h('div', { class: `restcard${cd.kind === 'hold' ? ' hold' : ''}` },
      h('div', { class: 'ring' }, ringSpan, rt),
      h('div', { class: 'grow' },
        h('div', { class: 'rlabel' }, cd.kind === 'hold' ? '⏱ ' + cd.label : cd.label),
        rtime,
      ),
      h('button', { class: 'btn sm', onclick: () => extendCountdown(-30) }, '−30'),
      h('button', { class: 'btn sm', onclick: () => extendCountdown(30) }, '+30'),
      h('button', { class: 'btn sm', onclick: () => skipCountdown() }, 'Skip'),
    ));
    restUi = { id: cd.id, ringSpan, rt, rtime };
    restbar.classList.add('show');
  } else {
    restUi.ringSpan.innerHTML = svgRing(pct, 52, 4, cd.kind === 'hold' ? 'var(--accent)' : 'var(--info)');
    restUi.rt.textContent = String(secsLeft);
    restUi.rtime.textContent = fmtMs(cd.remainMs + 999);
  }
});

// ---------------------------------------------------------------------------
// Day rollover: re-render "today" when the app returns to foreground
// ---------------------------------------------------------------------------
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && currentRoute?.name === 'today') render({ keepScroll: true });
});

// ---------------------------------------------------------------------------
// Service worker
// ---------------------------------------------------------------------------
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

render();
