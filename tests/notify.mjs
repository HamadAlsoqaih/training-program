// Notification server: loads, refuses bad or unconfigured requests, and builds
// the reminder schedule. Run: node tests/notify.mjs  (needs `npm install`)
const lib = await import('../api/_lib.mjs');
const timer = await import('../api/timer.mjs');
const reminder = await import('../api/reminder.mjs');
const key = await import('../api/key.mjs');
const send = await import('../api/send.mjs');

let fails = 0;
const eq = (label, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) { fails++; console.error(`FAIL ${label}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); } };
const post = (url, body, origin = 'https://app.example') => new Request(url, {
  method: 'POST', headers: { 'Content-Type': 'application/json', origin }, body: JSON.stringify(body) });

// --- the reminder schedule
eq('cron: weekdays', lib.reminderCron('17:30', [5, 1, 3, 3], 'Asia/Riyadh'), 'CRON_TZ=Asia/Riyadh 30 17 * * 1,3,5');
eq('cron: every day', lib.reminderCron('6:05', [0, 1, 2, 3, 4, 5, 6], 'UTC'), 'CRON_TZ=UTC 5 6 * * *');
eq('cron: bad time', lib.reminderCron('25:00', [1], 'UTC'), null);
eq('cron: no days', lib.reminderCron('17:00', [], 'UTC'), null);
eq('cron: junk days ignored', lib.reminderCron('17:00', [9, -1, 'x', 2], 'UTC'), 'CRON_TZ=UTC 0 17 * * 2');

// --- subscriptions are checked
eq('sub: ok', !!lib.cleanSub({ endpoint: 'https://push.example/x', keys: { p256dh: 'a', auth: 'b' } }), true);
eq('sub: http refused', lib.cleanSub({ endpoint: 'http://push.example/x', keys: { p256dh: 'a', auth: 'b' } }), null);
eq('sub: missing keys', lib.cleanSub({ endpoint: 'https://push.example/x' }), null);

// --- unconfigured server: no key handed out, requests refused
for (const k of ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'QSTASH_TOKEN']) delete process.env[k];
eq('key: empty when not set up', await (await key.GET()).json(), { key: '' });
eq('timer: 503 when not set up', (await timer.POST(post('https://app.example/api/timer', {}))).status, 503);
eq('reminder: 503 when not set up', (await reminder.POST(post('https://app.example/api/reminder', {}))).status, 503);

// --- configured: other sites refused, bad bodies refused (before any network call)
process.env.VAPID_PUBLIC_KEY = 'pub'; process.env.VAPID_PRIVATE_KEY = 'priv'; process.env.QSTASH_TOKEN = 'tok';
eq('key: handed out', await (await key.GET()).json(), { key: 'pub' });
eq('timer: no Origin refused', (await timer.POST(new Request('https://app.example/api/timer', { method: 'POST', body: '{}' }))).status, 403);
eq('timer: other site refused', (await timer.POST(post('https://app.example/api/timer', {}, 'https://evil.example'))).status, 403);
eq('timer: no sub refused', (await timer.POST(post('https://app.example/api/timer', { at: Date.now() + 60e3 }))).status, 400);
const sub = { endpoint: 'https://push.example/x', keys: { p256dh: 'a', auth: 'b' } };
eq('timer: 4h away refused', (await timer.POST(post('https://app.example/api/timer', { sub, at: Date.now() + 4 * 3600e3 }))).status, 400);
eq('reminder: bad zone refused', (await reminder.POST(post('https://app.example/api/reminder', { sub, on: true, time: '17:00', days: [1], tz: 'Mars/Base' }))).status, 400);
eq('reminder: no days refused', (await reminder.POST(post('https://app.example/api/reminder', { sub, on: true, time: '17:00', days: [], tz: 'UTC' }))).status, 400);
// --- send only accepts calls signed by Upstash
process.env.QSTASH_CURRENT_SIGNING_KEY = 'k1'; process.env.QSTASH_NEXT_SIGNING_KEY = 'k2';
eq('send: unsigned refused', (await send.POST(post('https://app.example/api/send', { sub, title: 'x' }))).status, 403);

if (fails) { console.error(`\n${fails} check(s) failed`); process.exit(1); }
console.log('✓ All notification checks passed');
