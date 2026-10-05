import { test, expect } from "@playwright/test";
import { startFresh, seed, rec, assertNoErrors } from "./helpers.js";

const settings = (page) => page.getByRole("dialog", { name: "ตั้งค่า" });
const profile = (page) => page.getByRole("dialog", { name: "โปรไฟล์ของฉัน" });

test("settings and profile open as full-screen pages with a ← back button", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await startFresh(page);
  await seed(page, { donations: [rec("a", "2026-06-01")] });
  for (const [open, dlg, title] of [["ตั้งค่า", settings, "ตั้งค่า"], ["โปรไฟล์ของฉัน", profile, "โปรไฟล์ของฉัน"]]) {
    await page.getByRole("button", { name: open, exact: true }).click();
    const d = dlg(page);
    await expect(d.getByRole("heading", { level: 2, name: title })).toBeVisible();
    const box = await d.locator("> div").boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(779);
    const back = d.getByRole("button", { name: "ย้อนกลับ" });
    expect(Math.round((await back.boundingBox()).height)).toBeGreaterThanOrEqual(44);
    await back.click();
    await expect(dlg(page)).toHaveCount(0);
  }
  assertNoErrors(page);
});

test("the phone's back button closes settings / profile without leaving the app", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", "2026-06-01")] });
  const url = page.url();
  await page.getByRole("button", { name: "ตั้งค่า", exact: true }).click();
  await expect(settings(page)).toBeVisible();
  await page.goBack();
  await expect(settings(page)).toHaveCount(0);
  expect(page.url()).toBe(url);
  await expect(page.getByTestId("hero-card")).toBeVisible();
  // ← then back again: ← already removed the history entry, so the page stays put
  await page.getByRole("button", { name: "โปรไฟล์ของฉัน", exact: true }).click();
  await profile(page).getByRole("button", { name: "ย้อนกลับ" }).click();
  await expect(profile(page)).toHaveCount(0);
  await page.getByRole("button", { name: "ตั้งค่า", exact: true }).click();
  await expect(settings(page)).toBeVisible();
  await page.goBack();
  await expect(settings(page)).toHaveCount(0);
  await expect(page.getByTestId("hero-card")).toBeVisible();
  assertNoErrors(page);
});

test("settings -> privacy keeps one history entry; back closes everything", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", "2026-06-01")] });
  await page.getByRole("button", { name: "ตั้งค่า", exact: true }).click();
  await settings(page).getByRole("button", { name: "ความเป็นส่วนตัว" }).click();
  await expect(page.getByRole("dialog", { name: "นโยบายความเป็นส่วนตัว" })).toBeVisible();
  await expect(settings(page)).toHaveCount(0);
  await page.goBack();
  await expect(page.locator("[role=dialog]")).toHaveCount(0);
  await expect(page.getByTestId("hero-card")).toBeVisible();
  assertNoErrors(page);
});
