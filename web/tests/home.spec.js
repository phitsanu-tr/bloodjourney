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

test("home: waiting countdown has no clock icon; text still shows days left", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(30))] });
  await expect(page.getByText(/อีก \d+ วัน/)).toBeVisible();
  await expect(page.locator("svg.lucide-clock")).toHaveCount(0);
  await seed(page, { donations: [rec("a", daysAgo(200))] });
  await expect(page.getByText("บริจาคได้แล้ววันนี้")).toBeVisible();
  await expect(page.locator("svg.lucide-clock")).toHaveCount(0);
  assertNoErrors(page);
});

test("nav: all four bottom-tab labels sit on the same line", async ({ page }) => {
  await startFresh(page);
  const tops = await page.evaluate(() =>
    ["หน้าหลัก", "แดชบอร์ด", "ภารกิจ", "ให้ความรู้"].map((n) => {
      const b = [...document.querySelectorAll("button[aria-label]")].find((x) => x.getAttribute("aria-label").startsWith(n));
      return Math.round(b.querySelector("span:last-child").getBoundingClientRect().top * 10) / 10;
    }));
  expect(new Set(tops).size, `label tops ${tops}`).toBe(1);
  assertNoErrors(page);
});

test("home reminders: backup card shows the count; several reminders peek the next slide", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(90)), rec("b", daysAgo(60)), rec("c", daysAgo(10))] });
  await expect(page.getByText("3 รายการยังไม่ได้สำรอง")).toBeVisible();
  await expect(page.getByRole("button", { name: "สำรองข้อมูล" })).toBeVisible();
  const slides = page.locator('[role="group"][aria-label^="เรื่องที่"]');
  const n = await slides.count();
  expect(n).toBeGreaterThan(1);
  const [a, b] = [await slides.nth(0).boundingBox(), await slides.nth(1).boundingBox()];
  expect(b.x, "second slide edge should be visible").toBeLessThan(page.viewportSize().width);
  expect(a.width).toBeLessThan(page.viewportSize().width - 32);
  for (const w of [390, 320]) {
    await page.setViewportSize({ width: w, height: 780 });
    await page.waitForTimeout(300);
    expect(await noOverflow(page), `overflow at ${w}`).toBe(true);
  }
  assertNoErrors(page);
});

test("hero card: eligible shows last donation date, no info button, plain link", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(200))] });
  await expect(page.getByText("บริจาคได้แล้ววันนี้")).toBeVisible();
  await expect(page.getByText(/ครั้งล่าสุด\s+\d/)).toBeVisible();
  await expect(page.getByRole("button", { name: /รายละเอียดการคำนวณ/ })).toHaveCount(0);
  const link = page.getByRole("button", { name: /ดูวิธีเตรียมตัวก่อนบริจาค/ });
  expect(await link.evaluate((e) => getComputedStyle(e).textDecorationLine)).toBe("none");
  assertNoErrors(page);
});

test("hero card: waiting still has the info button", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(30))] });
  await expect(page.getByRole("button", { name: /รายละเอียดการคำนวณ/ })).toBeVisible();
  assertNoErrors(page);
});

test("hero card: prior count only asks for the last date and the link opens the form", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [], profile: { startingCountWhole: 5 } });
  await expect(page.getByText("ยังไม่มีวันที่บริจาคล่าสุด")).toBeVisible();
  await page.getByRole("button", { name: "ระบุวันที่บริจาคล่าสุด" }).tap();
  await expect(page.locator("[role=dialog]").last()).toBeVisible();
  assertNoErrors(page);
});

test("hero card: paused reminders still show the next donation date", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(30))], profile: { remindPauseUntil: "indefinite" } });
  await expect(page.getByText("พักการเตือนไว้")).toBeVisible();
  await expect(page.getByText(/บริจาคได้อีกครั้ง .* \(อีก \d+ วัน\)/)).toBeVisible();
  assertNoErrors(page);
});

test("hero card: brand-new user chip is plain text (no pill background)", async ({ page }) => {
  await startFresh(page);
  const chip = page.getByText("บริจาค 1 ครั้ง ช่วยได้สูงสุด 3 ชีวิต");
  await expect(chip).toBeVisible();
  const bg = await chip.evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(bg === "rgba(0, 0, 0, 0)" || bg === "transparent").toBe(true);
  assertNoErrors(page);
});
