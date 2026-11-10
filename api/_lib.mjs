// Shared by the api/ functions (a file starting with _ is not an endpoint).
// Needs these in Vercel → Settings → Environment Variables (see README):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY            — your notification keys
//   QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY,
//   QSTASH_NEXT_SIGNING_KEY (+ QSTASH_URL)         — added by the Upstash integration
import webpush from 'web-push';
import { Client, Receiver } from '@upstash/qstash';
import { createHash } from 'node:crypto';

const env = (k) => process.env[k] || '';
export const ready = () => !!(env('VAPID_PUBLIC_KEY') && env('VAPID_PRIVATE_KEY') && env('QSTASH_TOKEN'));
export const publicKey = () => env('VAPID_PUBLIC_KEY');

export const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const qstash = () => new Client({ token: env('QSTASH_TOKEN'), baseUrl: env('QSTASH_URL') || undefined });

// Where Upstash calls back: always the live site, never a preview link.
export const sendUrl = (request) => (env('VERCEL_PROJECT_PRODUCTION_URL')
  ? `https://${env('VERCEL_PROJECT_PRODUCTION_URL')}` : new URL(request.url).origin) + '/api/send';

// Only the app itself may ask for notifications.
export function fromApp(request) {
  const o = request.headers.get('origin');
  return !o || new URL(o).host === new URL(request.url).host;
}

// The phone's push address, exactly as the browser gave it.
export function cleanSub(s) {
  if (!s || typeof s.endpoint !== 'string' || !/^https:\/\//.test(s.endpoint) || !s.keys
    || typeof s.keys.p256dh !== 'string' || typeof s.keys.auth !== 'string') return null;
  return { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } };
}
export const subId = (sub) => createHash('sha256').update(sub.endpoint).digest('hex').slice(0, 24);
export const text = (v, n = 200) => String(v == null ? '' : v).slice(0, n);
export async function readJson(request) { try { return JSON.parse(await request.text()); } catch { return null; } }

// Upstash signs every call it makes; anything unsigned is refused.
export async function signed(request, body) {
  const r = new Receiver({
    currentSigningKey: env('QSTASH_CURRENT_SIGNING_KEY'), nextSigningKey: env('QSTASH_NEXT_SIGNING_KEY'),
  });
  try { return await r.verify({ signature: request.headers.get('upstash-signature') || '', body }); } catch { return false; }
}

export function push(sub, payload, ttl) {
  // Apple wants a real contact: your site's address unless VAPID_SUBJECT says otherwise.
  const subject = env('VAPID_SUBJECT')
    || (env('VERCEL_PROJECT_PRODUCTION_URL') ? `https://${env('VERCEL_PROJECT_PRODUCTION_URL')}` : 'https://vercel.com');
  webpush.setVapidDetails(subject, env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));
  return webpush.sendNotification(sub, JSON.stringify(payload), { TTL: ttl, urgency: 'high' });
}

// "17:30" + weekdays [1,3,5] → a cron line in the phone's time zone.
export function reminderCron(time, days, tz) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time || '');
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  const d = [...new Set((Array.isArray(days) ? days : []).filter((x) => Number.isInteger(x) && x >= 0 && x <= 6))].sort();
  if (!d.length) return null;
  return `CRON_TZ=${tz} ${+m[2]} ${+m[1]} * * ${d.length === 7 ? '*' : d.join(',')}`;
}
