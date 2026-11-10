// Upstash calls this at the right moment (a timer's end, or the daily
// reminder) and it sends the notification to the phone.
import { json, signed, push, qstash } from './_lib.mjs';

export async function POST(request) {
  const raw = await request.text();
  if (!(await signed(request, raw))) return json({ error: 'forbidden' }, 403);
  let b; try { b = JSON.parse(raw); } catch { return json({ error: 'bad request' }, 400); }
  try {
    await push(b.sub, { title: b.title, body: b.body || '', tag: b.tag }, b.tag === 'reminder' ? 3600 : 600);
  } catch (e) {
    // 404 / 410: notifications were turned off or the app removed. Stop the reminder.
    if (e.statusCode === 404 || e.statusCode === 410) {
      if (b.sid) await qstash().schedules.delete(b.sid).catch(() => {});
      return json({ gone: true });
    }
    return json({ error: 'push failed' }, 502);
  }
  return json({ ok: true });
}
