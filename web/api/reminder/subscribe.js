// POST /api/reminder/subscribe — called by the app whenever the user turns
// on the "แจ้งเตือนผ่าน LINE" toggle, and again (silently, in the background)
// whenever their next-due-date changes while the toggle stays on (see
// syncLineReminder/toggleLineReminder in the main app file). Upserts one
// record keyed by the user's verified LINE user ID — never trusts a
// client-supplied user ID directly, see verifyLineIdToken.
import { kv } from "@vercel/kv";
import { verifyLineIdToken, cleanDateStr, checkRateLimit } from "../_lib/line.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { idToken, nextWhole, nextComponent } = body;
    if (!idToken) {
      res.status(400).json({ error: "missing idToken" });
      return;
    }
    const userId = await verifyLineIdToken(idToken);
    if (!userId) {
      res.status(401).json({ error: "invalid or expired token" });
      return;
    }

    // Generous limit — this fires once on toggle-on and again, silently, on
    // every donation logged/edited/deleted while the toggle stays on — but
    // still bounded, so a stuck retry loop or a reused token can't hammer
    // this route (and LINE's own verify endpoint, called just above)
    // indefinitely.
    const allowed = await checkRateLimit("subscribe", userId, 30, 600);
    if (!allowed) {
      res.status(429).json({ error: "too many requests" });
      return;
    }

    const cleanWhole = cleanDateStr(nextWhole);
    const cleanComponent = cleanDateStr(nextComponent);

    const key = `reminder:${userId}`;
    const prev = await kv.get(key);
    const record = {
      nextWhole: cleanWhole,
      nextComponent: cleanComponent,
      // "Sent" flags only carry over when the due date they were recorded
      // against hasn't changed — a new due date (e.g. after logging a fresh
      // donation) is a new cycle, and should be reminded about again from
      // scratch rather than being silently skipped as "already sent".
      sentWhole: prev && prev.nextWhole === cleanWhole && prev.sentWhole ? prev.sentWhole : {},
      sentComponent: prev && prev.nextComponent === cleanComponent && prev.sentComponent ? prev.sentComponent : {},
      updatedAt: new Date().toISOString(),
    };
    await kv.set(key, record);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "server error" });
  }
}
