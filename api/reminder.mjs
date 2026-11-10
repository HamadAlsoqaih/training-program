// Turn the daily workout reminder on, change it, or turn it off.
//   { sub, on, time: '17:00', days: [0..6], tz, title, body }
// One repeating schedule on Upstash per phone, only on your training weekdays.
import { json, ready, qstash, sendUrl, fromApp, cleanSub, subId, text, readJson, reminderCron } from './_lib.mjs';

export async function POST(request) {
  if (!ready()) return json({ error: 'not set up' }, 503);
  if (!fromApp(request)) return json({ error: 'forbidden' }, 403);
  const b = await readJson(request), sub = b && cleanSub(b.sub);
  if (!sub) return json({ error: 'bad request' }, 400);
  const q = qstash(), sid = `reminder-${subId(sub)}`;
  if (!b.on) {
    try { await q.schedules.delete(sid); } catch { /* was never on */ }
    return json({ ok: true });
  }
  const tz = text(b.tz, 64);
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); } catch { return json({ error: 'bad time zone' }, 400); }
  const cron = reminderCron(b.time, b.days, tz);
  if (!cron) return json({ error: 'bad request' }, 400);
  await q.schedules.create({
    scheduleId: sid,                      // the same id replaces the old schedule
    destination: sendUrl(request),
    cron,
    body: JSON.stringify({ sub, tag: 'reminder', title: text(b.title) || 'Training today 💪', body: text(b.body), sid }),
    headers: { 'Content-Type': 'application/json' },
    retries: 0,
  });
  return json({ ok: true });
}
