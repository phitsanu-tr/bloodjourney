import test from "node:test";
import assert from "node:assert/strict";
import { app } from "./_load.mjs";

test("daysBetween counts whole calendar days, whatever the time of day", () => {
  assert.equal(app.daysBetween(new Date(2026, 9, 1, 23, 59), new Date(2026, 9, 2, 0, 1)), 1);
  assert.equal(app.daysBetween(new Date(2026, 9, 1, 0, 0), new Date(2026, 9, 1, 23, 59)), 0);
  assert.equal(app.daysBetween(new Date(2026, 9, 8), new Date(2026, 0, 1)), -280);
  assert.equal(app.daysBetween(new Date(2026, 0, 31), new Date(2026, 2, 1)), 29); // across February
  assert.equal(app.daysBetween(new Date(2024, 1, 28), new Date(2024, 2, 1)), 2); // leap year
});

test("daysBetween leaves the dates it was given untouched", () => {
  const a = new Date(2026, 9, 1, 13, 45, 12, 500), b = new Date(2026, 9, 9, 8, 30);
  const a0 = a.getTime(), b0 = b.getTime();
  app.daysBetween(a, b);
  assert.equal(a.getTime(), a0);
  assert.equal(b.getTime(), b0);
});

test("dateToLocalStr is the local calendar day (not UTC)", () => {
  assert.equal(app.dateToLocalStr(new Date(2026, 9, 8, 0, 5)), "2026-10-08");
  assert.equal(app.dateToLocalStr(new Date(2026, 0, 2, 23, 59)), "2026-01-02");
});

test("toBuddhistDate writes the short Thai month and the Buddhist year", () => {
  assert.equal(app.toBuddhistDate(new Date(2026, 9, 7)), "7 ต.ค. 2569");
});
