import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { app, APP_SOURCE } from "./_load.mjs";

test("estimateVolumeMl adds each type's volume per donation", () => {
  assert.equal(app.estimateVolumeMl({ whole: 2 }), 700);
  assert.equal(app.estimateVolumeMl({ whole: 1, plasma: 1, platelet: 1, rbc: 1 }), 350 + 500 + 250 + 400);
  assert.equal(app.estimateVolumeMl({}), 0);
  assert.equal(app.estimateVolumeMl(undefined), 0);
  assert.equal(app.estimateVolumeMl({ whole: "3" }), 1050); // counts may arrive as strings from stored data
});

test("formatLiters rounds to one decimal, half up, with no trailing .0", () => {
  const cases = { 0: "0", 150: "0.2", 350: "0.4", 700: "0.7", 950: "1", 1000: "1", 2050: "2.1", 12350: "12.4" };
  for (const [ml, want] of Object.entries(cases)) assert.equal(app.formatLiters(Number(ml)), want, `${ml} ml`);
  assert.equal(app.formatLiters(undefined), "0");
});

// The share card once had its own formula ((ml / 1000).toFixed(1)) that disagreed with the dashboard for 86 volumes (350 ml:
// card 0.3, dashboard 0.4). There must be one formula: guard against a second one being typed in again.
test("the share card gets its litres from formatLiters, not a second formula", () => {
  const src = fs.readFileSync(APP_SOURCE, "utf8");
  assert.match(src, /const liters = formatLiters\(estVolumeMl\)/);
  assert.doesNotMatch(src, /estVolumeMl\s*\/\s*1000/);
  assert.doesNotMatch(src, /\(ml\s*\/\s*1000\)\.toFixed/);
});
