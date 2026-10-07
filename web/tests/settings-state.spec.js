import { test, expect } from "@playwright/test";
import { startFresh, seed, rec, assertNoErrors, PREFIX } from "./helpers.js";

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); const p = (x) => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

test("a closed after-care card stays closed after another setting is saved in a later session", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(1)), rec("b", daysAgo(200))], profile: { gender: "female" } });
  const care = page.getByRole("region", { name: "ดูแลตัวเองหลังบริจาค" });
  await expect(care).toBeVisible();
  await page.getByRole("button", { name: "ปิดคำแนะนำหลังบริจาค" }).click();
  await expect(care).toHaveCount(0);
  await page.reload(); await expect(page.getByTestId("hero-card")).toBeVisible();
  // a different setting changes in the new session ...
  await page.getByRole("button", { name: "ตั้งค่า", exact: true }).click();
  await page.getByRole("dialog", { name: "ตั้งค่า" }).getByText("ใหญ่", { exact: true }).click();
  await expect.poll(() => page.evaluate((pre) => JSON.parse(localStorage.getItem(pre + "uiMeta")).textLarge, PREFIX)).toBe(true);
  expect(await page.evaluate((pre) => JSON.parse(localStorage.getItem(pre + "uiMeta")).dismissedCareFor, PREFIX)).toBeTruthy();
  // ... and the dismissal is still remembered
  await page.reload(); await expect(page.getByTestId("hero-card")).toBeVisible();
  await expect(care).toHaveCount(0);
  assertNoErrors(page);
});

test("deleting all data also resets the text size and does not bring old settings back", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(30))] });
  await page.getByRole("button", { name: "ตั้งค่า", exact: true }).click();
  await page.getByRole("dialog", { name: "ตั้งค่า" }).getByText("ใหญ่", { exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains("text-large"))).toBe(true);
  await page.getByRole("button", { name: "ลบข้อมูลทั้งหมด" }).click();
  const dlg = page.locator("[role=dialog], [role=alertdialog]").last();
  await dlg.getByRole("button", { name: /^ลบ/ }).last().click();
  await page.locator("input[type=checkbox]").waitFor({ timeout: 15000 });
  expect(await page.evaluate(() => document.documentElement.classList.contains("text-large"))).toBe(false);
  // start again: nothing from the old session is written back by the first new setting
  await page.locator("input[type=checkbox]").tap();
  await page.getByText("ยินยอมและเริ่มใช้งาน").tap();
  await expect(page.getByTestId("hero-card")).toBeVisible();
  await page.getByRole("button", { name: "ตั้งค่า", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "ตั้งค่า" });
  await settings.getByText("ใหญ่", { exact: true }).click();
  await settings.getByText("ปกติ", { exact: true }).click();
  await page.waitForTimeout(500);
  const meta = await page.evaluate((pre) => JSON.parse(localStorage.getItem(pre + "uiMeta") || "{}"), PREFIX);
  expect(meta.textLarge).toBe(false);
  assertNoErrors(page);
});

test("the free-text fields and the backup-reminder number have accessible names; pinch-zoom is allowed", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(30))] });
  await page.getByRole("button", { name: "บันทึกบริจาคโลหิต" }).first().click();
  await expect(page.getByRole("textbox", { name: "สถานที่ (ไม่บังคับ)" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "บันทึกช่วยจำ (ไม่บังคับ)" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "ตั้งค่า", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "เตือนสำรองข้อมูลทุกกี่รายการ" })).toBeAttached();
  expect(await page.locator("meta[name=viewport]").getAttribute("content")).not.toMatch(/maximum-scale|user-scalable\s*=\s*no/);
  assertNoErrors(page);
});
