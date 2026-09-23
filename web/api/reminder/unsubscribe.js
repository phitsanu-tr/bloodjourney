// POST /api/reminder/unsubscribe — called when the user turns the
// "แจ้งเตือนผ่าน LINE" toggle off. Deletes the server-side record for that
// user's verified LINE user ID immediately — this IS the "right to delete"
// for this feature's data (see PRIVACY_POLICY_SECTIONS item 7).
import { kv } from "@vercel/kv";
import { verifyLineIdToken } from "../_lib/line.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { idToken } = body;
    if (!idToken) {
      res.status(400).json({ error: "missing idToken" });
      return;
    }
    const userId = await verifyLineIdToken(idToken);
    if (!userId) {
      res.status(401).json({ error: "invalid or expired token" });
      return;
    }
    await kv.del(`reminder:${userId}`);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "server error" });
  }
}
