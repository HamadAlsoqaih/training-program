// ============================================================================
// push.js — notifications through the small server in api/ (Vercel + QStash).
//
// A web app can't ring once the phone is locked or you're in another app, so:
//   * leaving the app with a rest/hold timer running sends its end time to the
//     server, which notifies you then. Coming back first cancels it — the open
//     app rings by itself.
//   * the daily reminder is a repeating schedule on the server, on your
//     training weekdays only, at your chosen time, in your phone's time zone.
// On iPhone this needs iOS 16.4+ and the app opened from the Home Screen icon.
// Where api/ doesn't exist (e.g. GitHub Pages) the Settings card says so.
// ============================================================================
import * as store from './state.js';
import { activeCountdown } from './timers.js';
import { getWeek } from './program.js';
import { usualMapForWeek, currentWeek, programStatus } from './schedule.js';

export const PUSH_OK = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  && window.isSecureContext;

// sub: undefined while checking, null when off
const N = { reg: null, key: '', sub: undefined, away: null, ready: false };
const listeners = new Set();
export const onPushChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
// a copy: a listener may re-register itself while we walk the list
const changed = () => [...listeners].forEach((f) => { try { f(); } catch { /* ignore */ } });
export const pushState = () => ({ ...N });

const b64u = (s) => Uint8Array.from(atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function api(path, body, keepalive) {
  const r = await fetch(`api/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: !!keepalive,
  });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json();
}

export function initPush() {
  if (!PUSH_OK) { N.sub = null; return; }
  fetch('api/key').then((r) => (r.ok ? r.json() : {})).then((j) => { N.key = j.key || ''; })
    .catch(() => {}).finally(() => { N.ready = true; changed(); });
  navigator.serviceWorker.ready
    .then((reg) => { N.reg = reg; return reg.pushManager.getSubscription(); })
    .then((sub) => { N.sub = sub || null; if (sub) reminderSync(); changed(); })
    .catch(() => { N.sub = null; changed(); });
}

// Must run straight from a tap: iPhone only asks for permission from a tap.
export async function pushOn() {
  if (!N.reg) throw new Error('Open the app from the Home Screen icon first');
  if (!N.key) throw new Error('Notifications are not set up on the server yet');
  try {
    N.sub = await N.reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(N.key) });
  } catch {
    throw new Error(Notification.permission === 'denied'
      ? 'Notifications are blocked — allow them in iPhone Settings › Notifications' : 'Could not turn on notifications');
  }
  store.update((s) => { s.settings.reminderSig = ''; });
  changed();
  await reminderSync(true);
}

export async function pushOff() {
  const sub = N.sub; if (!sub) return;
  await api('reminder', { sub: sub.toJSON(), on: false }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
  N.sub = null;
  store.update((s) => { s.settings.reminderSig = ''; });
  changed();
}

export function sendTest() {
  if (!N.sub) return Promise.reject(new Error('Notifications are off'));
  return api('timer', { sub: N.sub.toJSON(), at: Date.now() + 5000, title: 'Notifications work 🔔', body: 'Lock the phone — this is what you’ll see.' });
}

// Weekdays with a session on them in your usual week (full rest days skipped).
export function trainingWeekdays(pid = store.activePid()) {
  if (programStatus(pid).state === 'over') return [];
  const week = Math.max(1, currentWeek(pid));
  const days = getWeek(pid, week)?.days || [];
  const map = usualMapForWeek(week, pid);
  return [...new Set(days.filter((d) => d.kind !== 'off').map((d) => map[d.d]))].sort();
}

// Send the reminder schedule again only when something changed: on/off, the
// time, your training weekdays or the time zone.
export async function reminderSync(loud) {
  if (!N.sub) return;
  const st = store.get().settings;
  const body = {
    on: !!st.remindersOn, time: st.reminderTime || '17:00', days: trainingWeekdays(),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    title: 'Training today 💪', body: 'Open the app to see today’s workout.',
  };
  const sig = JSON.stringify([N.sub.endpoint, body]);
  if (sig === st.reminderSig) return;
  try {
    await api('reminder', { sub: N.sub.toJSON(), ...body });
    store.update((s) => { s.settings.reminderSig = sig; });
  } catch (e) {
    if (loud || body.on) throw new Error('Could not reach the server — the reminder isn’t saved yet');
  }
}

// --- timers while you're away -------------------------------------------------
function timerAway() {
  const cd = activeCountdown();
  if (!N.sub || store.get().settings.notifyTimer === false || N.away || !cd || cd.remainMs < 3000) return;
  const hold = cd.kind === 'hold';
  N.away = api('timer', {
    sub: N.sub.toJSON(), at: cd.endsAt,
    title: hold ? 'Hold done ⏱️' : 'Rest is over — next set 💪', body: cd.label || '',
  }, true).then((r) => r.id).catch(() => null);
}
function timerBack() {
  const p = N.away; if (!p) return;
  N.away = null;
  p.then((id) => { if (id) api('timer', { cancel: id }).catch(() => {}); });
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { timerBack(); reminderSync().catch(() => {}); } else timerAway();
});
