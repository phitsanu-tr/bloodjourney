// GET /api/cron/send-reminders — triggered once a day by Vercel Cron (see
// vercel.json). Scans every stored reminder record and pushes a LINE message
// for whichever ones are exactly 7 days, 1 day, or 0 days (due today) away
// from their stored next-eligible date, per donation type (whole/component
// each have their own independent due date and cycle). Each stage only ever
// fires once per due date, tracked via the record's sentWhole/sentComponent
// flags (reset by subscribe.js whenever the due date itself changes).
//
// Also deletes any record that's gone stale (see isStale/STALE_AFTER_DAYS
// below) instead of only ever adding records — this is the feature's
// retention limit, not just its opt-out mechanism.
//
// Protected by CRON_SECRET (see setup doc) so this can't be triggered by
// anyone who finds the URL — Vercel Cron is configured to call it with that
// same secret as a bearer token.
import { kv } from "@vercel/kv";
import { pushLineMessage } from "../_lib/line.js";

const CRON_SECRET = process.env.CRON_SECRET;

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function formatThaiDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d} ${THAI_MONTHS[m - 1]} ${y + 543}`;
}

// "Today" in Thailand's own calendar date (UTC+7, no DST) — the 7/1/0-day
// thresholds below need to match the donor's local date, not whichever UTC
// date the serverless function happens to be executing under.
function bangkokTodayStr() {
  const bkk = new Date(Date.now() + 7 * 3600000);
  return bkk.toISOString().slice(0, 10);
}

function daysBetweenDateStrs(fromStr, toStr) {
  const from = new Date(`${fromStr}T00:00:00Z`).getTime();
  const to = new Date(`${toStr}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86400000);
}

const REMINDER_STAGES = [
  { key: "7", daysBefore: 7, text: (d) => `🩸 เตือนความจำจาก Blood Journey: อีก 7 วัน (${d}) คุณจะครบกำหนดบริจาคโลหิตอีกครั้งแล้วนะ` },
  { key: "1", daysBefore: 1, text: (d) => `🩸 พรุ่งนี้ (${d}) คุณครบกำหนดบริจาคโลหิตแล้ว — เตรียมพักผ่อนและดื่มน้ำให้เพียงพอก่อนไปบริจาคได้เลย` },
  { key: "0", daysBefore: 0, text: (d) => `🩸 วันนี้ (${d}) คุณครบกำหนดบริจาคโลหิตแล้ว พร้อมไปบริจาคได้เลยนะ` },
];

// [donation type, field holding its due date, field holding its sent-flags]
const DUE_DATE_FIELDS = [
  ["whole", "nextWhole", "sentWhole", ""],
  ["component", "nextComponent", "sentComponent", " (พลาสมา/เกล็ดเลือด)"],
];

// A record only gets touched (subscribe.js re-upserts it) when the user logs,
// edits, or deletes a donation while the toggle stays on — which normally
// happens well within one donation cycle. If a record has gone untouched for
// this long, the most likely explanation is the user stopped using the app
// (or uninstalled it) without remembering to flip the toggle off first, so
// there's no one left to remind. Deleting it keeps data off the server
// beyond what the feature actually needs (see PRIVACY_POLICY_SECTIONS item 7
// in the main app file) instead of letting it sit there indefinitely.
const STALE_AFTER_DAYS = 120;

function isStale(record, todayStr) {
  if (!record || !record.updatedAt) return false;
  const updatedMs = new Date(record.updatedAt).getTime();
  if (Number.isNaN(updatedMs)) return false;
  const todayMs = new Date(`${todayStr}T00:00:00Z`).getTime();
  return (todayMs - updatedMs) / 86400000 > STALE_AFTER_DAYS;
}

export default async function handler(req, res) {
  if (CRON_SECRET) {
    const auth = req.headers["authorization"] || "";
    if (auth !== `Bearer ${CRON_SECRET}`) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
  }

  const today = bangkokTodayStr();
  let cursor = 0;
  let scanned = 0;
  let sent = 0;
  let cleaned = 0;
  const errors = [];

  try {
    do {
      const [nextCursor, keys] = await kv.scan(cursor, { match: "reminder:*", count: 100 });
      cursor = Number(nextCursor);
      for (const key of keys) {
        scanned++;
        const record = await kv.get(key);
        if (!record) continue;
        const userId = key.slice("reminder:".length);

        if (isStale(record, today)) {
          await kv.del(key);
          cleaned++;
          continue;
        }

        let changed = false;

        for (const [, dateField, sentField, label] of DUE_DATE_FIELDS) {
          const dueDate = record[dateField];
          if (!dueDate) continue;
          const daysLeft = daysBetweenDateStrs(today, dueDate);
          const stage = REMINDER_STAGES.find((s) => s.daysBefore === daysLeft);
          if (!stage) continue;
          const sentMap = record[sentField] || {};
          if (sentMap[stage.key]) continue;
          try {
            await pushLineMessage(userId, stage.text(formatThaiDate(dueDate)) + label);
            sentMap[stage.key] = true;
            record[sentField] = sentMap;
            changed = true;
            sent++;
          } catch (e) {
            errors.push(String(e));
          }
        }

        if (changed) await kv.set(key, record);
      }
    } while (cursor !== 0);

    res.status(200).json({ ok: true, scanned, sent, cleaned, errors });
  } catch (e) {
    res.status(500).json({ error: "cron failed", detail: String(e) });
  }
}
