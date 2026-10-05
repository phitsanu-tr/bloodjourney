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
