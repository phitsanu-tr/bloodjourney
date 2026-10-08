import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { app, APP_SOURCE, SOURCE_FILES } from "./_load.mjs";

// Donation dates are stored as "YYYY-MM-DD" calendar days. Read with `new Date("2026-06-01")` they are UTC midnight, which
// in America/New_York is still May 31 -- the countdown to the next donation then came out a day short. Every date that
// reaches the screen or a countdown must mean the same calendar day in every timezone.
const ZONES = ["Asia/Bangkok", "America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Kolkata", "Pacific/Auckland"];
const inZone = async (tz, fn) => { const prev = process.env.TZ; process.env.TZ = tz; try { return await fn(); } finally { if (prev === undefined) delete process.env.TZ; else process.env.TZ = prev; } };

test("a stored date reads back as the same calendar day in every timezone", async () => {
  for (const tz of ZONES) await inZone(tz, () => {
    assert.equal(app.dateToLocalStr(app.parseLocalDate("2026-06-01")), "2026-06-01", tz);
    assert.equal(app.dateToLocalStr("2026-06-01"), "2026-06-01", tz);
    assert.equal(app.toBuddhistDate("2026-06-01"), "1 มิ.ย. 2569", tz);
    assert.equal(app.daysBetween("2026-06-01", "2026-08-30"), 90, tz);
    assert.equal(app.daysBetween("2026-12-31", "2027-01-01"), 1, tz);
  });
});

test("nextEligibleFrom: last date + cycle in calendar days, same result everywhere and across daylight-saving changes", async () => {
  for (const tz of ZONES) await inZone(tz, () => {
    assert.equal(app.dateToLocalStr(app.nextEligibleFrom("2026-06-01", 90)), "2026-08-30", tz);
    const noonOnDonationDay = new Date(2026, 5, 1, 12, 0);
    assert.equal(app.daysBetween(noonOnDonationDay, app.nextEligibleFrom("2026-06-01", 90)), 90, `${tz}: days left on the donation day`);
    assert.equal(app.dateToLocalStr(app.nextEligibleFrom("2026-03-01", 30)), "2026-03-31", `${tz} (spring forward)`);
    assert.equal(app.dateToLocalStr(app.nextEligibleFrom("2026-10-01", 60)), "2026-11-30", `${tz} (fall back)`);
    assert.equal(app.dateToLocalStr(app.nextEligibleFrom("2026-02-20", 14)), "2026-03-06", tz);
  });
});

test("a donation-record share link shows the same calendar day to a sender and a viewer in different timezones", async () => {
  const record = { kind: "r", sizeIdx: 0, order: 1, date: "2026-06-01", timeStr: "", type: "whole", location: "", bloodType: "O", bloodRh: "+", nickname: "" };
  for (const sender of ZONES) for (const viewer of ZONES) {
    const token = await inZone(sender, () => app.encodeShareToken(record));
    const decoded = await inZone(viewer, () => app.decodeShareToken(token));
    const shown = await inZone(viewer, () => app.dateToLocalStr(decoded.dateObj));
    assert.equal(shown, "2026-06-01", `sent from ${sender}, opened in ${viewer}`);
  }
});

test("no source line reads a stored date with new Date(x.date) (use parseLocalDate)", () => {
  const offenders = [];
  for (const f of SOURCE_FILES) fs.readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    if (/new Date\([A-Za-z_][\w\[\]\-\. ]*\.date\)/.test(line) || /new Date\(\w*(Str|DateStr)\)/.test(line)) offenders.push(`${f.split("web/")[1] || f}:${i + 1}`);
  });
  assert.deepEqual(offenders, []);
});

test("package.json version matches APP_VERSION (bump both together)", () => {
  const appVersion = fs.readFileSync(APP_SOURCE, "utf8").match(/const APP_VERSION = "([^"]+)"/)[1];
  const pkg = JSON.parse(fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.version, appVersion);
});
