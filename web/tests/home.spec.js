import { test, expect } from "@playwright/test";
import { startFresh, seed, rec, assertNoErrors, noOverflow } from "./helpers.js";

const daysAgo = (n) => {
  const d = new Date(); d.setDate(d.getDate() - n);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const PROFILE = { bloodType: "O", bloodRh: "+", birthYear: "1993", weight: "65", gender: "male" };

test("home: hidden personal info shows one chip; tap peeks then re-hides", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(30))], profile: PROFILE });
  const chip = page.getByRole("button", { name: /ข้อมูลส่วนตัวถูกซ่อนอยู่/ });
  await expect(chip).toBeVisible();
  await expect(page.getByText("O Rh+", { exact: true })).toHaveCount(0);
  await chip.tap();
  await expect(page.getByText("O Rh+", { exact: true })).toBeVisible();
  await expect(chip).toHaveCount(0);
  await expect(chip).toBeVisible({ timeout: 8000 }); // re-hidden after ~5s
  await expect(page.getByText("O Rh+", { exact: true })).toHaveCount(0);
  assertNoErrors(page);
});

test("home: countdown bar says how far along the wait is", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(30))] });
  await expect(page.getByText(/ผ่านมาแล้ว \d+ จาก \d+ วัน/)).toBeVisible();
  assertNoErrors(page);
});

test("history: cards hide empty location/note rows but show them when filled", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(200)), rec("b", daysAgo(30), "whole", { location: "สภากาชาดไทย", note: "ปกติดี" })] });
  await expect(page.getByText("สภากาชาดไทย")).toBeVisible();
  await expect(page.getByText("ปกติดี")).toBeVisible();
  const cards = page.locator(".hist-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.filter({ hasText: "—" })).toHaveCount(0);
  assertNoErrors(page);
});

test("layout: home with the new chip/caption has no overflow at 390 and 320", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(200)), rec("b", daysAgo(30))], profile: PROFILE });
  for (const w of [390, 320]) {
    await page.setViewportSize({ width: w, height: 780 });
    await page.waitForTimeout(400);
    expect(await noOverflow(page), `overflow at ${w}`).toBe(true);
  }
  assertNoErrors(page);
});
