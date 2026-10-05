import { test, expect } from "@playwright/test";
import { startFresh, seed, rec, assertNoErrors } from "./helpers.js";

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); const p = (x) => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

// "ขนาดตัวอักษร: ใหญ่" zooms the whole app 1.15x. On a 360px Android phone that leaves ~313px to lay out in,
// narrower than the 320px the rest of the suite checks -- so check the main screens and dialogs there.
test("text size: ใหญ่ persists, zooms the app, and still fits a 360px phone", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(10), "whole", { location: "ศูนย์บริการโลหิตแห่งชาติ", note: "ปกติดี", time: "09:30" }), rec("b", daysAgo(200)), rec("c", daysAgo(400), "plasma")], profile: { nickname: "แพรว", bloodType: "O", weight: 60, startingCountWhole: 3 } });
  await page.getByLabel("ตั้งค่า").click();
  const group = page.getByRole("radiogroup", { name: "ขนาดตัวอักษร" });
  await expect(group.getByRole("radio", { name: "ปกติ" })).toHaveAttribute("aria-checked", "true");
  await group.getByRole("radio", { name: "ใหญ่" }).click();
  await expect(group.getByRole("radio", { name: "ใหญ่" })).toHaveAttribute("aria-checked", "true");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).zoom)).toBe("1.15");
  // survives a reload
  await page.reload();
  await expect(page.getByTestId("hero-card")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.classList.contains("text-large"))).toBe(true);
  const fits = () => page.evaluate(() => {
    const out = { overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    const d = [...document.querySelectorAll('[role="dialog"]')].pop();
    if (d) { const panel = d.firstElementChild || d; const r = panel.getBoundingClientRect(); out.dialogBottom = Math.round(r.bottom); out.dialogTop = Math.round(r.top); out.vh = Math.round(document.documentElement.clientHeight); }
    return out;
  });
  const home = await fits();
  expect(home.overflowX, "home overflows sideways").toBeLessThanOrEqual(0);
  for (const open of [
    async () => page.getByRole("button", { name: "บันทึกบริจาคโลหิต" }).click(),
    async () => page.getByLabel("ตั้งค่า").click(),
    async () => page.getByLabel("โปรไฟล์ของฉัน").click(),
  ]) {
    await open(); await page.waitForTimeout(500);
    const f = await fits();
    expect(f.overflowX, "dialog page overflows sideways").toBeLessThanOrEqual(0);
    expect(f.dialogTop, "dialog top off screen " + JSON.stringify(f)).toBeGreaterThanOrEqual(0);
    expect(f.dialogBottom, "dialog bottom off screen " + JSON.stringify(f)).toBeLessThanOrEqual(f.vh + 1);
    await page.keyboard.press("Escape"); await page.waitForTimeout(400);
  }
  // the brand-new user's hero still fits its content at this size (the narrow-screen min-height must not apply)
  await seed(page, { donations: [], profile: {} });
  const newH = await page.getByTestId("hero-status").evaluate((el) => parseFloat(getComputedStyle(el).minHeight) || 0);
  expect(newH, "new-user hero-status min-height").toBe(0);
  // back to ปกติ
  await page.getByLabel("ตั้งค่า").click();
  await page.getByRole("radiogroup", { name: "ขนาดตัวอักษร" }).getByRole("radio", { name: "ปกติ" }).click();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).zoom)).toBe("1");
  assertNoErrors(page);
});
