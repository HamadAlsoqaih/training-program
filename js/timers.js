// ============================================================================
// timers.js — session stopwatch, rest countdown, hold/interval timers.
// All timestamp-based (correct after phone lock / reload). iOS Safari has no
// navigator.vibrate → completion cue = WebAudio chime + full-screen flash.
// ============================================================================
import * as store from './state.js';

// --- audio -----------------------------------------------------------------
let audioCtx = null;
export function unlockAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

export function chime(kind = 'done') {
  if (!store.get().settings.sound) return;
  unlockAudio();
  if (!audioCtx || audioCtx.state !== 'running') return;
  const notes = kind === 'done' ? [880, 1174.7] : kind === 'warn' ? [660] : [523.3];
  const t0 = audioCtx.currentTime;
  notes.forEach((f, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine'; osc.frequency.value = f;
    gain.gain.setValueAtTime(0.0001, t0 + i * 0.18);
    gain.gain.exponentialRampToValueAtTime(0.4, t0 + i * 0.18 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.18 + 0.5);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0 + i * 0.18); osc.stop(t0 + i * 0.18 + 0.55);
  });
}

export function flash() {
  const el = document.getElementById('flash');
  if (!el) return;
  el.classList.remove('on');
  void el.offsetWidth;
  el.classList.add('on');
}

// --- wake lock -------------------------------------------------------------
let wakeLock = null;
export async function acquireWakeLock() {
  if (!store.get().settings.wakeLock || !('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch { /* denied / low battery — fine */ }
}
export function releaseWakeLock() {
  wakeLock?.release?.().catch(() => {});
  wakeLock = null;
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && store.get().session && !wakeLock) acquireWakeLock();
});

// --- session stopwatch -----------------------------------------------------
export function startSession(dayId) {
  store.update((s) => {
    s.session = { dayId, startedAt: Date.now(), pausedAt: null, pausedMs: 0 };
    const d = s.days[dayId] || (s.days[dayId] = { status: null, ex: {} });
    d.startedAt = d.startedAt || Date.now();
  });
  acquireWakeLock();
}
export function pauseSession() {
  store.update((s) => { if (s.session && !s.session.pausedAt) s.session.pausedAt = Date.now(); });
}
export function resumeSession() {
  store.update((s) => {
    if (s.session?.pausedAt) {
      s.session.pausedMs += Date.now() - s.session.pausedAt;
      s.session.pausedAt = null;
    }
  });
  acquireWakeLock();
}
export function sessionElapsedMs(sess = store.get().session) {
  if (!sess) return 0;
  const end = sess.pausedAt || Date.now();
  return end - sess.startedAt - sess.pausedMs;
}
export function finishSession() {
  let elapsed = 0, dayId = null;
  store.update((s) => {
    if (!s.session) return;
    elapsed = sessionElapsedMs(s.session);
    dayId = s.session.dayId;
    const d = s.days[dayId] || (s.days[dayId] = { status: null, ex: {} });
    d.elapsedMs = (d.elapsedMs || 0) + elapsed;
    s.session = null;
  });
  releaseWakeLock();
  return { elapsed, dayId };
}
export function discardSession() {
  store.update((s) => { s.session = null; });
  releaseWakeLock();
}

export function fmtMs(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

// --- countdown engine (rest + holds) ---------------------------------------
// One active countdown at a time; UI subscribes to ticks.
let countdown = null; // { label, endsAt, totalMs, kind, onDone }
let rafId = null;
const cdListeners = new Set();

export function onCountdown(fn) { cdListeners.add(fn); return () => cdListeners.delete(fn); }
const notify = () => cdListeners.forEach((f) => f(countdown && { ...countdown, remainMs: countdown.endsAt - Date.now() }));

function tickLoop() {
  if (!countdown) return;
  const remain = countdown.endsAt - Date.now();
  if (remain <= 0) {
    const done = countdown;
    countdown = null;
    notify();
    chime('done'); flash();
    done.onDone?.();
    return;
  }
  notify();
  rafId = requestAnimationFrame(tickLoop);
}

let cdSeq = 0;
export function startCountdown({ label, secs, kind = 'rest', onDone }) {
  cancelAnimationFrame(rafId);
  countdown = { id: ++cdSeq, label, endsAt: Date.now() + secs * 1000, totalMs: secs * 1000, kind, onDone };
  notify();
  tickLoop();
}
export function extendCountdown(secs) {
  if (!countdown) return;
  countdown.endsAt += secs * 1000;
  countdown.totalMs += secs * 1000;
  notify();
}
export function skipCountdown() {
  cancelAnimationFrame(rafId);
  countdown = null;
  notify();
}
export const activeCountdown = () =>
  countdown && { ...countdown, remainMs: countdown.endsAt - Date.now() };

// Recover from tab being backgrounded (rAF stops → recheck on visibility)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && countdown) { cancelAnimationFrame(rafId); tickLoop(); }
});
