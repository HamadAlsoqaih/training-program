// A rest/hold timer is running and you left the app: notify when it ends.
//   { sub, at, title, body }  → { id }    (at: end time in ms)
//   { cancel: id }            → you came back before it ended
import { json, ready, qstash, sendUrl, fromApp, cleanSub, text, readJson } from './_lib.mjs';

export async function POST(request) {
  if (!ready()) return json({ error: 'not set up' }, 503);
  if (!fromApp(request)) return json({ error: 'forbidden' }, 403);
  const b = await readJson(request);
  if (!b) return json({ error: 'bad request' }, 400);
  const q = qstash();
  if (b.cancel) {
    try { await q.messages.delete(text(b.cancel, 100)); } catch { /* already sent */ }
    return json({ ok: true });
  }
  const sub = cleanSub(b.sub), at = Number(b.at), now = Date.now();
  if (!sub || !isFinite(at) || at < now - 5000 || at > now + 3 * 3600e3) return json({ error: 'bad request' }, 400);
  const r = await q.publishJSON({
    url: sendUrl(request), body: { sub, title: text(b.title), body: text(b.body), tag: 'timer' },
    notBefore: Math.round(at / 1000), retries: 1,
  });
  return json({ id: r.messageId });
}
