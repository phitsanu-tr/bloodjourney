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

test("home: type tabs stay put (no 30s rotation) and eligible types carry a check", async ({ page }) => {
  await page.clock.install();
  await startFresh(page);
  // whole: 120 days ago (eligible) · plasma: 3 days ago (waiting 11 more days)
  await seed(page, { donations: [rec("a", daysAgo(120)), rec("b", daysAgo(3), "plasma")] });
  const whole = page.getByRole("tab", { name: /โลหิตรวม/ });
  const plasma = page.getByRole("tab", { name: /พลาสมา/ });
  await expect(whole).toHaveAttribute("aria-label", /บริจาคได้แล้ว$/);
  await expect(plasma).not.toHaveAttribute("aria-label", /บริจาคได้แล้ว/);
  await plasma.tap();
  await expect(plasma).toHaveAttribute("aria-selected", "true");
  await page.clock.fastForward(95_000); // three of the old 30s rotation steps
  await expect(plasma).toHaveAttribute("aria-selected", "true");
  assertNoErrors(page);
});

test("history: each card has its own spoken label; ⋮ menu rows are 44px and Escape closes it", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(200)), rec("b", daysAgo(30), "whole", { location: "สภากาชาดไทย" })] });
  await expect(page.getByRole("button", { name: /^ครั้งที่ 2, .*โลหิตรวม, สภากาชาดไทย ดูรายละเอียด$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^ครั้งที่ 1, .*โลหิตรวม ดูรายละเอียด$/ })).toBeVisible();
  const more = page.getByRole("button", { name: "ตัวเลือกเพิ่มเติม สำหรับครั้งที่ 2" });
  await more.click();
  const edit = page.getByRole("menuitem", { name: "แก้ไข" });
  await expect(edit).toBeVisible();
  expect((await edit.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press("Escape");
  await expect(edit).toHaveCount(0);
  await expect(more).toBeFocused();
  assertNoErrors(page);
});

test("home: post-donation tips start folded to one and expand on tap", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(1)), rec("b", daysAgo(200))], profile: { gender: "female" } });
  const care = page.getByRole("region", { name: "ดูแลตัวเองหลังบริจาค" });
  await expect(care.getByText(/ดื่มน้ำมากกว่าปกติ/)).toBeVisible();
  await expect(care.getByText(/^กินยาธาตุเหล็กที่ได้รับ/)).toHaveCount(0);
  const toggle = care.getByRole("button", { name: "ดูคำแนะนำอีก 2 ข้อ" });
  await toggle.tap();
  await expect(care.getByText(/^กินยาธาตุเหล็กที่ได้รับ/)).toBeVisible();
  await expect(care.getByText(/^ผู้หญิงเสียธาตุเหล็ก/)).toBeVisible();
  await expect(care.getByRole("button", { name: "ย่อคำแนะนำ" })).toHaveAttribute("aria-expanded", "true");
  assertNoErrors(page);
});

test("home: record button turns solid red only when the shown type can be donated", async ({ page }) => {
  await startFresh(page);
  const cta = page.getByRole("button", { name: "บันทึกบริจาคโลหิต" });
  await seed(page, { donations: [rec("a", daysAgo(120))] });
  await expect.poll(() => cta.evaluate((b) => getComputedStyle(b).backgroundImage)).toContain("gradient");
  await seed(page, { donations: [rec("a", daysAgo(30))] });
  await expect.poll(() => cta.evaluate((b) => getComputedStyle(b).backgroundImage)).toBe("none");
  assertNoErrors(page);
});

test("home: profile row opens the profile; the info chip still only peeks; multi-type hero says all types", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(200)), rec("b", daysAgo(30), "plasma")], profile: PROFILE });
  await expect(page.getByTestId("hero-card").getByText("บริจาคโลหิตสะสม · รวมทุกประเภท")).toBeVisible();
  await page.getByRole("button", { name: /ข้อมูลส่วนตัวถูกซ่อนอยู่/ }).tap();
  await expect(page.getByRole("dialog", { name: "โปรไฟล์ของฉัน" })).toHaveCount(0);
  await page.getByRole("button", { name: "เปิดโปรไฟล์" }).tap();
  await expect(page.getByRole("dialog", { name: "โปรไฟล์ของฉัน" })).toBeVisible();
  assertNoErrors(page);
});

test("history: a ⋮ menu near the bottom tab bar opens upward instead of under it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(200)), rec("b", daysAgo(30))], profile: { startingCountWhole: 4 } });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(400);
  const navTop = await page.getByRole("button", { name: "หน้าหลัก" }).evaluate((b) => b.getBoundingClientRect().top);
  for (const name of ["ตัวเลือกเพิ่มเติม สำหรับยอดบริจาคที่ผ่านมา", /^ตัวเลือกเพิ่มเติม สำหรับครั้งที่ 5$/]) {
    await page.getByRole("button", { name }).click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    const box = await menu.boundingBox();
    expect(box.y + box.height, `menu for ${name} ends above the tab bar`).toBeLessThanOrEqual(navTop);
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
  }
  assertNoErrors(page);
});

test("home: the reminder carousel never moves on its own", async ({ page }) => {
  await page.clock.install();
  await startFresh(page);
  // backup (4 unexported) + weight warning + calendar prompt -> three slides
  await seed(page, { donations: [rec("a", daysAgo(30)), rec("b", daysAgo(200)), rec("c", daysAgo(300)), rec("d", daysAgo(400))], profile: { weight: 45 } });
  const scroller = page.getByRole("region", { name: /^การแจ้งเตือน \d+ เรื่อง/ });
  await expect(scroller).toBeVisible();
  await page.clock.fastForward(20_000);
  await page.waitForTimeout(300);
  expect(await scroller.evaluate((el) => el.scrollLeft)).toBe(0);
  assertNoErrors(page);
});
