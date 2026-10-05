import { test, expect } from "@playwright/test";
import { startFresh, seed, rec, assertNoErrors } from "./helpers.js";

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); const p = (x) => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const openMissions = async (page) => { await page.locator("nav button[aria-label^='ภารกิจ']").click(); await expect(page.getByRole("heading", { name: "ภารกิจนักบริจาค" })).toBeVisible(); };

test("missions: page and sections are headings; unlocked cards say so to screen readers; locked medals read like locked pins", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(10))], profile: { startingCountWhole: 6 } });
  await openMissions(page);
  await expect(page.getByRole("heading", { level: 2, name: "ภารกิจนักบริจาค" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "เข็มที่ระลึก" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "เหรียญกาชาดสมนาคุณ" })).toBeVisible();
  // 7 donations: "หยดแรก" and "ครั้งที่ 7" unlocked
  await expect(page.getByText("ปลดล็อกแล้ว · บริจาคโลหิตครบ 7 ครั้ง", { exact: true })).toBeAttached();
  await expect(page.getByText("ปลดล็อกแล้ว · ", { exact: true })).toHaveCount(2);
  await expect(page.getByText("อีก 43 ครั้งจะปลดล็อก", { exact: true })).toBeVisible();
  assertNoErrors(page);
});

test("missions: a pace estimate over a year is shown in years and months", async ({ page }) => {
  await startFresh(page);
  // 60 donations (40 dated, ~100 days apart) -> 12 more to the 72nd pin = ~40 months
  await seed(page, { donations: Array.from({ length: 40 }, (_, i) => rec("m" + i, daysAgo(5 + i * 100))), profile: { startingCountWhole: 20 } });
  await openMissions(page);
  await expect(page.getByText("ประมาณ 3 ปี 4 เดือน", { exact: true })).toBeVisible();
  assertNoErrors(page);
});

test("missions: locked cards are not faded; numbers stay with their label; share button is 44px tall", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(10)), rec("b", daysAgo(100)), rec("c", daysAgo(200))], profile: { startingCountWhole: 20 } });
  await openMissions(page);
  const locked = page.getByText("อีก 37 ครั้งจะปลดล็อก", { exact: true });
  // no card on the page is see-through any more
  expect(await locked.evaluate((el) => { let o = 1; for (let n = el; n; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o; })).toBe(1);
  // "ครั้งที่ 60" never splits across lines
  const tail = page.getByText("ครั้งที่ 60", { exact: true });
  expect(await tail.evaluate((el) => new Set([...el.getClientRects()].map((r) => Math.round(r.top))).size)).toBe(1);
  const share = page.getByRole("button", { name: "แชร์การให้ที่ยิ่งใหญ่ของคุณ" });
  expect((await share.boundingBox()).height).toBeGreaterThanOrEqual(44);
  assertNoErrors(page);
});

test("missions: everything unlocked shows a congratulations card instead of an empty space", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(10))], profile: { startingCountWhole: 120 } });
  await openMissions(page);
  await expect(page.getByText("ปลดล็อกภารกิจครบทุกอันแล้ว", { exact: true })).toBeVisible();
  await expect(page.getByText("ภารกิจถัดไป", { exact: true })).toHaveCount(0);
  assertNoErrors(page);
});

test("missions: 320px + large text keeps the unlocked count on one line", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await startFresh(page);
  await page.evaluate(() => localStorage.setItem("bloodjourney:uiMeta", JSON.stringify({ textLarge: true })));
  await seed(page, { donations: [rec("a", daysAgo(10)), rec("b", daysAgo(100))], profile: { startingCountWhole: 21 } });
  await openMissions(page);
  for (const t of ["ปลดล็อกแล้ว 0/3", "ปลดล็อกแล้ว 3/11"]) {
    const el = page.getByText(t, { exact: true });
    expect(await el.evaluate((e) => { const r = document.createRange(); r.selectNodeContents(e); return new Set([...r.getClientRects()].filter((x) => x.width > 1).map((x) => Math.round(x.top))).size; })).toBe(1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  assertNoErrors(page);
});
