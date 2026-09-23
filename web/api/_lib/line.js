// Shared helpers for the LINE reminder feature's backend routes
// (../reminder/subscribe.js, ../reminder/unsubscribe.js, ../cron/send-reminders.js).
//
// This whole backend exists for exactly one purpose: the optional, off-by-
// default "แจ้งเตือนผ่าน LINE" toggle in Settings (see PRIVACY_POLICY_SECTIONS
// item 7 in the main app file). It stores nothing except a LINE user ID and
// a next-due-date per donation type — never donation history, profile
// fields, or anything else — and only for users who explicitly opted in.

const LINE_LOGIN_CHANNEL_ID = process.env.LINE_LOGIN_CHANNEL_ID;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

// Verifies a LIFF ID token was actually issued by this app's own LINE Login
// channel (BloodJourney) and hasn't expired, returning the LINE user ID (the
// token's `sub` claim) on success or null on any failure. This MUST run
// server-side before trusting a client-supplied user ID for anything: these
// routes end up sending a LINE push message to whatever user ID gets stored,
// so accepting an unverified ID would let anyone spam another LINE user's
// chat just by knowing (or guessing) their user ID.
export async function verifyLineIdToken(idToken) {
  if (!idToken || typeof idToken !== "string") return null;
  if (!LINE_LOGIN_CHANNEL_ID) throw new Error("LINE_LOGIN_CHANNEL_ID env var not set");
  try {
    const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: LINE_LOGIN_CHANNEL_ID }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.sub || data.aud !== LINE_LOGIN_CHANNEL_ID) return null;
    return data.sub;
  } catch (e) {
    return null;
  }
}

// Sends one text-message LINE push to a single user via the Messaging API
// (the OA's own channel — a different LINE channel from the LINE Login one
// used above, but registered under the same Provider; see the setup doc for
// where to get this token). Push, not reply, because this fires from a cron
// job with no incoming webhook event to reply to.
export async function pushLineMessage(userId, text) {
  if (!LINE_CHANNEL_ACCESS_TOKEN) throw new Error("LINE_CHANNEL_ACCESS_TOKEN env var not set");
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ to: userId, messages: [{ type: "text", text }] }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LINE push failed (${res.status}): ${body}`);
  }
}

export const REMINDER_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function cleanDateStr(value) {
  return typeof value === "string" && REMINDER_DATE_RE.test(value) ? value : null;
}
