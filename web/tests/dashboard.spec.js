import { test, expect } from "@playwright/test";
import { startFresh, seed, rec, assertNoErrors } from "./helpers.js";

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); const p = (x) => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const openDashboard = async (page) => { await page.getByRole("button", { name: "แดชบอร์ด" }).click(); await expect(page.getByRole("heading", { name: "แดชบอร์ดสรุปข้อมูล" })).toBeVisible(); };

test("dashboard: brand-new user sees one empty card instead of 0 / — cards", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [], profile: {} });
  await openDashboard(page);
  await expect(page.getByRole("heading", { name: "ยังไม่มีสถิติ" })).toBeVisible();
  await expect(page.getByText("0 ลิตร", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "ระยะห่างเฉลี่ยต่อครั้ง" })).toHaveCount(0);
  assertNoErrors(page);
});

test("dashboard: yearly chart opens on the latest years and its numbers are readable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startFresh(page);
  await seed(page, { donations: Array.from({ length: 40 }, (_, i) => rec("m" + i, daysAgo(5 + i * 100))) });
  await openDashboard(page);
  const chart = page.getByRole("img", { name: /^จำนวนครั้งที่บริจาครายปี: / });
  await expect(chart).toBeVisible();
  await expect.poll(() => chart.evaluate((el) => el.scrollWidth - el.clientWidth - el.scrollLeft), { timeout: 5000 }).toBeLessThanOrEqual(1);
  // coming back to the tab still lands on the latest years
  await page.getByRole("button", { name: "หน้าหลัก" }).click();
  await openDashboard(page);
  await expect.poll(() => chart.evaluate((el) => el.scrollWidth - el.clientWidth - el.scrollLeft), { timeout: 5000 }).toBeLessThanOrEqual(1);
  // the current year's point is labelled with its count
  const thisYear = String(new Date().getFullYear() + 543);
  expect(await chart.getAttribute("aria-label")).toContain(`ปี ${thisYear} `);
  // every card title is a heading
  for (const h of ["บริจาคโลหิตสะสม", "ปริมาณที่ให้สะสม", "ระยะห่างเฉลี่ยต่อครั้ง", "สถิติการบริจาคโลหิตรายปี", "เดือนที่บริจาคโลหิตบ่อยที่สุด"]) {
    await expect(page.getByRole("heading", { name: h })).toBeVisible();
  }
  assertNoErrors(page);
});

test("dashboard: tied busiest months are all named/highlighted; equal counts show equal %", async ({ page }) => {
  await startFresh(page);
  const y = new Date().getFullYear() - 1;
  // March and May twice each, June once (whole) + 1 plasma + 1 platelet + 40 carried-over whole
  await seed(page, {
    donations: [rec("a", `${y}-03-01`), rec("b", `${y - 1}-03-10`), rec("c", `${y}-05-20`), rec("d", `${y - 1}-05-02`), rec("e", `${y}-06-15`, "plasma"), rec("f", `${y - 2}-08-15`, "platelet")],
    profile: { startingCountWhole: 40 },
  });
  await openDashboard(page);
  await expect(page.getByText("มี.ค. และ พ.ค. (2 ครั้ง)", { exact: true })).toBeVisible();
  await expect(page.getByText("1 ครั้ง (2%)", { exact: true })).toHaveCount(2);
  assertNoErrors(page);
});

test("dashboard: average gap explains itself until there are 2 records; type pills have 44px tap areas", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(120)), rec("b", daysAgo(5), "plasma")] });
  await openDashboard(page);
  await expect(page.getByText("ต้องมีบันทึกอย่างน้อย 2 ครั้ง", { exact: true })).toHaveCount(2);
  const pill = page.getByRole("button", { name: "พลาสมา", exact: true }).first();
  const h = await pill.evaluate((b) => { const r = b.getBoundingClientRect(); const s = b.querySelector("span[aria-hidden=true]").getBoundingClientRect(); return Math.max(r.bottom, s.bottom) - Math.min(r.top, s.top); });
  expect(h).toBeGreaterThanOrEqual(44);
  assertNoErrors(page);
});

test("dashboard: carried-over count only -> same wording as home with a link; single type -> no share ring", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [], profile: { startingCountWhole: 5 } });
  await openDashboard(page);
  await expect(page.getByText("ระบุวันที่ แล้วแอปจะนับวันครบกำหนดให้")).toBeVisible();
  await expect(page.getByRole("button", { name: "ระบุวันที่บริจาคล่าสุด" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "สัดส่วนการบริจาคโลหิตแต่ละประเภท" })).toHaveCount(0);
  await page.getByRole("button", { name: "ระบุวันที่บริจาคล่าสุด" }).click();
  await expect(page.locator("[role=dialog]").last()).toBeVisible();
  assertNoErrors(page);
});
