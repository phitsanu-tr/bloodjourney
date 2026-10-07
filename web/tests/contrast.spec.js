import { test, expect } from "@playwright/test";
import { startFresh, seed, rec, assertNoErrors } from "./helpers.js";

// WCAG contrast of an element's text colour against the first opaque background behind it.
const ratio = (loc) => loc.evaluate((e) => {
  const parse = (c) => c.match(/[\d.]+/g).map(Number);
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  let bg = [255, 255, 255];
  for (let n = e; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c.length < 4 || c[3] > 0.9) { bg = c.slice(0, 3); break; } }
  const [a, b] = [lum(parse(getComputedStyle(e).color)), lum(bg)].sort((x, y) => x - y);
  return (b + 0.05) / (a + 0.05);
});

test("text colours that used to be too faint now reach 4.5:1", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", "2026-06-01", "whole", { time: "09:30" })], profile: { nickname: "แพรว", gender: "female", weight: 52, height: 158, birthYear: 2536 } });
  // time in a history card
  expect(await ratio(page.getByText("เวลา 09:30 น.").first())).toBeGreaterThanOrEqual(4.5);
  // "ส่งออกแบบไม่เข้ารหัส" link in the backup dialog
  await page.getByRole("button", { name: "ตั้งค่า", exact: true }).click();
  await page.getByRole("button", { name: /^สำรอง\/กู้คืนข้อมูล/ }).click();
  await page.waitForTimeout(600);
  expect(await ratio(page.getByRole("button", { name: "ส่งออกแบบไม่เข้ารหัส", exact: true }))).toBeGreaterThanOrEqual(4.5);
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  // green "อยู่ในเกณฑ์" badge in the profile weight sheet
  await page.goto("/"); await expect(page.getByTestId("hero-card")).toBeVisible();
  await page.getByRole("button", { name: "โปรไฟล์ของฉัน", exact: true }).click();
  await page.getByText("น้ำหนัก (กก.)", { exact: true }).click(); await page.waitForTimeout(600);
  expect(await ratio(page.getByText("อยู่ในเกณฑ์", { exact: true }).first())).toBeGreaterThanOrEqual(4.5);
  assertNoErrors(page);
});
