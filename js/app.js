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
//   #/start/<pid>/restart       start over from Week 1 (old run kept in history)
//   #/progress  #/settings
// ============================================================================
import { h, svgRing, toast } from './util.js';
import * as store from './state.js';
import { todayId, programStatus } from './schedule.js';
import { DEFAULT_PROGRAM, PROGRAMS } from './program.js';
import { onCountdown, extendCountdown, skipCountdown, fmtMs, acquireWakeLock, releaseWakeLock } from './timers.js';
import { closeStaleSession, migrateEasyStart } from './completion.js';
import { initPush } from './push.js';
import { renderDay, renderProgramGate } from './views/day.js';
import { renderPrograms, renderProgram, renderPhase, renderWeek } from './views/programview.js';
import { renderProgress } from './views/progress.js';
import { renderSettings, renderStart } from './views/settings.js';

const view = () => document.getElementById('view');
let currentRoute = null;

// --- theme accent -----------------------------------------------------------
function applyAccent(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const value = m ? `#${m[1]}` : '#3b82f6';
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
    // first run: the start screen follows whichever program you pick on it
    const r = parseRoute();
    const pid = r.name === 'start' && PROGRAMS[r.args[0]] ? r.args[0] : DEFAULT_PROGRAM;
    view().replaceChildren(renderStart(pid, () => { location.hash = '#/today'; render(); }));
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
      view().replaceChildren(renderStart(validPid(args[0]), () => { location.hash = '#/today'; render(); },
        { restart: args[1] === 'restart' && store.prog(validPid(args[0])).started }));
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

  if (opts.keepScroll || opts.scrollNext) window.scrollTo(0, prevScroll);
  else window.scrollTo(0, 0);
  // the next exercise just opened: glide to it (from where you were, not the top)
  if (opts.scrollNext) {
    const cur = view().querySelector('.ex.current');
    const r0 = cur?.getBoundingClientRect();
    if (cur && r0.height > 0) {                       // not inside a section you folded
      const r = r0;
      const top = window.scrollY + r.top - Math.max(90, (window.innerHeight - Math.min(r.height, window.innerHeight * 0.7)) / 2);
      window.scrollTo({ top: Math.max(0, top), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  }
}

window.addEventListener('hashchange', () => render());

// A workout you forgot to finish closes by itself (see closeStaleSession).
function closeForgotten() {
  const closed = closeStaleSession();
  if (!closed) return false;
  releaseWakeLock();
  toast(closed.elapsed
    ? `Closed a workout you didn’t finish — ${Math.max(1, Math.round(closed.elapsed / 60000))} min saved`
    : closed.kept ? 'Closed a workout you didn’t finish' : 'Closed a workout with nothing logged', 4200);
  return true;
}
// phones that started with the first easy-start version move to prep weeks
if (migrateEasyStart().length) toast('Easy start is now 2 prep weeks before Week 1 — your program starts after them', 5000);
closeForgotten();
setInterval(() => { if (closeForgotten()) render({ keepScroll: true }); }, 60e3);
if (store.get().session) acquireWakeLock();

store.onSaveError(() => toast('⚠️ Couldn’t save on this phone — storage may be full. Export a backup in Settings.', 6000));
// Ask the browser not to clear this app's data when the phone is low on space.
try { navigator.storage?.persist?.(); } catch { /* not supported */ }

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

// --- number boxes: tap selects what's there, so typing replaces it -----------
// (iPhone drops a selection made on focus when the tap ends, so select again
// right after.) Enter moves from one box to the next in the same set row.
const isNumBox = (t) => t?.classList?.contains('numbox');
const selectAll = (t) => { try { t.setSelectionRange(0, t.value.length); } catch { try { t.select(); } catch { /* ignore */ } } };
document.addEventListener('focusin', (e) => {
  if (!isNumBox(e.target)) return;
  e.target.dataset.fresh = '1';
  selectAll(e.target);
  setTimeout(() => { if (e.target.dataset.fresh) selectAll(e.target); }, 0);
});
for (const type of ['mouseup', 'touchend']) {
  document.addEventListener(type, (e) => {
    const t = e.target;
    if (!isNumBox(t) || !t.dataset.fresh) return;
    if (type === 'mouseup') e.preventDefault();
    setTimeout(() => { if (t.dataset.fresh) selectAll(t); }, 0);
  }, true);
}
document.addEventListener('input', (e) => { if (isNumBox(e.target)) delete e.target.dataset.fresh; });
document.addEventListener('focusout', (e) => { if (isNumBox(e.target)) delete e.target.dataset.fresh; });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !isNumBox(e.target)) return;
  e.preventDefault();
  const row = e.target.closest('.loginputs');
  const boxes = row ? [...row.querySelectorAll('.numbox')] : [];
  const next = boxes[boxes.indexOf(e.target) + 1];
  if (next) next.focus(); else e.target.blur();
});

// --- keyboard vs the tab bar (iPhone) ------------------------------------------
// iOS 26 Home Screen apps have a bug: after the keyboard closes, the app can
// keep the SHORT height it had while the keyboard was up, so anything pinned
// to the bottom (tab bar, rest timer) floats up by the keyboard's height.
//   1. While typing, the tab bar steps aside (the keyboard covers it anyway).
//   2. The app remembers its full height while no keyboard is up.
//   3. After the keyboard leaves, if the height is still short, it asks iPhone
//      to measure again; if that doesn't take, it moves the bars DOWN by the
//      missing amount (--vv-drift) so they sit on the real bottom edge.
const typing = (t) => t && (t.tagName === 'TEXTAREA'
  || (t.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'range', 'color', 'file'].includes(t.type)));
const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const landscape = () => window.innerWidth > window.innerHeight;
const fullH = { portrait: 0, landscape: 0 };       // the tallest height seen with no keyboard
const root = document.documentElement;
const setDrift = (px) => root.style.setProperty('--vv-drift', `${Math.max(0, Math.round(px))}px`);
const keyboardUp = () => document.body.classList.contains('kb-open') || typing(document.activeElement);

function measure() {
  const h = window.innerHeight, o = landscape() ? 'landscape' : 'portrait';
  if (keyboardUp()) { setDrift(0); return; }
  if (h > fullH[o]) fullH[o] = h;
  const missing = fullH[o] - h;
  // a few px is the normal toolbar wobble; only a real shortfall is the bug
  setDrift(standalone && missing > 24 ? missing : 0);
}
// make iPhone recompute the viewport: hide and show a full-height element
function remeasure() {
  if (keyboardUp()) return;
  const app = document.getElementById('app');
  const y = window.scrollY;
  app.style.display = 'none';
  void app.offsetHeight;                             // force the layout now
  app.style.display = '';
  window.scrollTo(0, y);
  requestAnimationFrame(measure);
}
function afterKeyboard() {
  document.body.classList.remove('kb-open');
  measure();
  if (standalone && parseFloat(getComputedStyle(root).getPropertyValue('--vv-drift')) > 0) remeasure();
  // iPhone settles over a few hundred ms: look again
  setTimeout(measure, 350); setTimeout(measure, 900);
}
document.addEventListener('focusin', (e) => { if (typing(e.target)) { document.body.classList.add('kb-open'); setDrift(0); } });
document.addEventListener('focusout', (e) => {
  if (!typing(e.target)) return;
  setTimeout(() => { if (!typing(document.activeElement)) afterKeyboard(); }, 150);   // not just moving to the next box
});
window.addEventListener('resize', measure);
window.addEventListener('orientationchange', () => setTimeout(measure, 300));
window.visualViewport?.addEventListener('resize', measure);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(measure, 200); });
measure();

// re-check "today" when the app comes back to the foreground
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const closed = closeForgotten();
  if (closed || currentRoute?.name === 'today') render({ keepScroll: true });
});

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', async () => {
    // The site moved path once (personal-15week-program → training). A browser
    // that loaded the old address still holds a worker registered under the old
    // scope, and it would happily keep serving that old app shell. Drop any
    // registration that is not this page's, then register ours.
    try {
      const here = new URL('./', location.href).href;
      for (const reg of await navigator.serviceWorker.getRegistrations()) {
        if (reg.scope !== here) await reg.unregister();
      }
    } catch { /* not fatal — carry on and register */ }
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
initPush();

render();
