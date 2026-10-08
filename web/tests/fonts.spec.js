import { test, expect } from "@playwright/test";
import { startFresh, seed, rec, assertNoErrors } from "./helpers.js";

// Mitr is served from /fonts (our own origin): no request goes to Google, and the text really is drawn in Mitr.
test("font: Mitr loads from our own /fonts and nothing is requested from Google Fonts", async ({ page }) => {
  const external = [], local = [];
  page.on("request", (r) => { const u = r.url(); if (/fonts\.(googleapis|gstatic)\.com/.test(u)) external.push(u); if (u.includes("/fonts/mitr-")) local.push(u); });
  await startFresh(page);
  await seed(page, { donations: [rec("a", "2026-06-01")] });
  await page.evaluate(() => document.fonts.ready);
  expect(external).toEqual([]);
  expect(local.some((u) => u.includes("mitr-400-thai"))).toBe(true);
  const ok = await page.evaluate(() => ["400", "500", "600", "700"].every((w) => document.fonts.check(`${w} 16px Mitr`, "บริจาคโลหิต")));
  expect(ok).toBe(true);
  const status = await page.evaluate(() => [...document.fonts].filter((f) => f.family.includes("Mitr")).map((f) => f.status));
  expect(status).not.toContain("error");
  assertNoErrors(page);
});
