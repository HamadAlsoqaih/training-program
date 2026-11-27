// ============================================================================
// video.js — in-app exercise video player (Mux HLS).
//
// iOS Safari plays HLS (.m3u8) natively in a <video> element, so on iPhone the
// video plays inline with zero libraries. Other browsers get hls.js, loaded
// lazily from a CDN the first time it's actually needed — it is never fetched
// on iPhone and never on app start.
//
// The player opens as a half-screen sheet, can be expanded to full screen or
// collapsed back, and uses the browser's native controls (play/pause, seek,
// volume, speed, AirPlay/PiP, fullscreen).
// ============================================================================
import { h } from './util.js';
import { EX, muxHls, muxPoster } from './exercises.js';

const HLS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.17/hls.min.js';

let hlsLoader = null;
function loadHlsLib() {
  if (window.Hls) return Promise.resolve(window.Hls);
  if (hlsLoader) return hlsLoader;
  hlsLoader = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = HLS_CDN;
    s.async = true;
    s.onload = () => resolve(window.Hls);
    s.onerror = () => reject(new Error('player failed to load'));
    document.head.append(s);
  });
  return hlsLoader;
}

let current = null; // { root, video, hls }

export function closeVideo() {
  if (!current) return;
  const { root, video, hls } = current;
  try {
    video.pause();
    hls?.destroy?.();
    video.removeAttribute('src');
    video.load();
  } catch { /* teardown is best-effort */ }
  root.remove();
  current = null;
  document.body.classList.remove('video-open');
}

export function openVideo(exId) {
  closeVideo();
  const ex = EX[exId];
  if (!ex?.mux) return;

  const video = h('video', {
    class: 'vid',
    controls: true,
    playsinline: true,
    preload: 'none',
    poster: muxPoster(exId, 800),
    'webkit-playsinline': 'true',
    'x-webkit-airplay': 'allow',
  });

  const status = h('div', { class: 'vid-status', hidden: true });
  const setStatus = (msg, showLink) => {
    status.hidden = false;
    status.replaceChildren(
      h('div', {}, msg),
      showLink ? h('a', { class: 'btn sm', style: 'margin-top:10px',
        href: muxHls(exId), target: '_blank', rel: 'noopener' }, 'Open externally') : null,
    );
  };

  const sheet = h('div', { class: 'vid-sheet' },
    h('div', { class: 'vid-bar' },
      h('div', { class: 'vid-title grow' }, ex.name),
      h('button', { class: 'vid-btn', 'aria-label': 'Expand', onclick: toggleSize }, '⤢'),
      h('button', { class: 'vid-btn', 'aria-label': 'Close', onclick: closeVideo }, '✕'),
    ),
    h('div', { class: 'vid-stage' }, video, status),
  );
  const root = h('div', { class: 'vid-root', onclick: (e) => { if (e.target === root) closeVideo(); } }, sheet);

  function toggleSize(e) {
    const big = sheet.classList.toggle('full');
    e.currentTarget.textContent = big ? '⤡' : '⤢';
  }

  document.body.append(root);
  document.body.classList.add('video-open');
  current = { root, video, hls: null };

  const src = muxHls(exId);
  const nativeHls = video.canPlayType('application/vnd.apple.mpegurl');

  if (nativeHls) {
    // iOS / macOS Safari — hand the manifest straight to the element
    video.src = src;
    video.addEventListener('error', () => setStatus('This video could not be loaded. Check your connection.', true), { once: true });
    video.play().catch(() => { /* autoplay may be blocked; the poster + play button remain */ });
  } else {
    loadHlsLib().then((Hls) => {
      if (!current || current.video !== video) return;
      if (Hls?.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: 20 });
        current.hls = hls;
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (data?.fatal) setStatus('This video could not be loaded. Check your connection.', true);
        });
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      } else {
        setStatus('Your browser cannot play this video format.', true);
      }
    }).catch(() => setStatus('The video player failed to load. Check your connection.', true));
  }
}

// Esc closes the player on desktop
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) closeVideo(); });
