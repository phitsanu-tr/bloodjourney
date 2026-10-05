import { test, expect } from "@playwright/test";
import { startFresh, seed, rec, assertNoErrors } from "./helpers.js";

test("faq: headings, question buttons named without +/-, answers point at real settings rows", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", "2026-06-01")] });
  await page.goto("/?tab=faq");
  await expect(page.getByRole("heading", { level: 2, name: "คำถามที่พบบ่อย" })).toBeVisible();
  const q = page.getByRole("button", { name: "ถ้าเปลี่ยนเครื่อง ลง LINE ใหม่ หรือล้างแคช ข้อมูลจะหายไหม", exact: true });
  await expect(q).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("heading", { level: 3, name: "ถ้าเปลี่ยนเครื่อง ลง LINE ใหม่ หรือล้างแคช ข้อมูลจะหายไหม" })).toBeVisible();
  await q.click();
  await expect(q).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText(/ตั้งค่า → สำรอง\/กู้คืนข้อมูล/)).toBeVisible();
  // the rows the answers name exist in Settings
  await page.getByRole("button", { name: "ตั้งค่า", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "ตั้งค่า" });
  for (const row of ["สำรอง/กู้คืนข้อมูล", "ความเป็นส่วนตัว", "ลบข้อมูลทั้งหมด"]) await expect(settings.getByRole("button", { name: new RegExp("^" + row) })).toHaveCount(1);
  assertNoErrors(page);
});
