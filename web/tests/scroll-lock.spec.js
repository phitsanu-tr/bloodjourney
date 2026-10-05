import { test, expect } from "@playwright/test";
import { startFresh, seed, rec, assertNoErrors } from "./helpers.js";

const daysAgo = (n) => {
  const d = new Date(); d.setDate(d.getDate() - n);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// A dialog locks page scroll with overflow:hidden on <html>+<body> (not position:fixed, which made
// LINE's in-app browser re-expand its top bar), and closing it restores the exact scroll position.
test("dialog: page scroll is locked with overflow hidden and restored on close", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(10)), rec("b", daysAgo(400), "plasma"), rec("c", daysAgo(800), "platelet"), rec("d", daysAgo(1200), "rbc")], profile: { startingCountWhole: 4, startingCountPlasma: 3 } });
  const card = page.getByRole("button", { name: /^ยอดบริจาคที่ผ่านมา/ });
  await card.scrollIntoViewIfNeeded();
  const y0 = await page.evaluate(() => Math.round(window.scrollY));
  expect(y0).toBeGreaterThan(0);
  await card.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const st = await page.evaluate(() => ({ h: getComputedStyle(document.documentElement).overflow, b: getComputedStyle(document.body).overflow, pos: getComputedStyle(document.body).position }));
  expect(st).toEqual({ h: "hidden", b: "hidden", pos: "static" });
  await page.mouse.click(5, 5); // backdrop closes it
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");
  expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(y0);
  assertNoErrors(page);
});

// Quick entry: switching a lower type ON scrolls the dialog so that type's switch sits at the top
// and its count field is in view (page itself stays locked).
test("quick entry: turning on a lower type scrolls its form into view", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await startFresh(page);
  await page.getByRole("button", { name: "บันทึกบริจาคโลหิต" }).tap();
  await page.getByText("เคยบริจาคแล้ว", { exact: true }).tap();
  const d = page.locator("[role=dialog]").last();
  await d.locator("[role=switch]").first().tap();
  const plasma = d.getByRole("switch", { name: /พลาสมา/ });
  await plasma.scrollIntoViewIfNeeded();
  const y0 = await page.evaluate(() => Math.round(window.scrollY));
  await plasma.tap();
  const input = d.locator("[data-quick-card=plasma] input[inputmode=numeric]");
  await expect(input).toBeVisible();
  await expect.poll(async () => {
    const r = await input.evaluate((el) => { const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, vh: window.innerHeight }; });
    return r.top >= 0 && r.bottom <= r.vh;
  }, { timeout: 3000 }).toBe(true);
  expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(y0); // our scroll moves the dialog, not the page
  assertNoErrors(page);
});

test("quick entry: turning a lower type back off keeps its switch in view", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await startFresh(page);
  await page.getByRole("button", { name: "บันทึกบริจาคโลหิต" }).tap();
  await page.getByText("เคยบริจาคแล้ว", { exact: true }).tap();
  const d = page.locator("[role=dialog]").last();
  await d.locator("[role=switch]").first().tap();
  const rbc = d.getByRole("switch", { name: /เม็ดเลือดแดง/ });
  await rbc.scrollIntoViewIfNeeded();
  await rbc.tap();
  await expect(d.locator("[data-quick-card=rbc] input[inputmode=numeric]")).toBeVisible();
  await page.waitForTimeout(600);
  await rbc.tap(); // off again: the form collapses
  await expect(d.locator("[data-quick-card=rbc] input[inputmode=numeric]")).toHaveCount(0);
  await expect.poll(async () => rbc.evaluate((el) => { const b = el.getBoundingClientRect(); return b.top >= 0 && b.bottom <= window.innerHeight; }), { timeout: 3000 }).toBe(true);
  assertNoErrors(page);
});
