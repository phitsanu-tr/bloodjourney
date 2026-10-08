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

test("settings -> privacy / FAQ stack over settings; the phone's back button closes one layer at a time", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", "2026-06-01")] });
  const privacy = page.getByRole("dialog", { name: "นโยบายความเป็นส่วนตัว" });
  const faq = page.getByRole("dialog", { name: "คำถามที่พบบ่อย" });
  await page.getByRole("button", { name: "ตั้งค่า", exact: true }).click();
  await settings(page).getByRole("button", { name: "ความเป็นส่วนตัว" }).click();
  await expect(privacy).toBeVisible();
  // settings stays underneath (mounted, but inert: not reachable by Tab or a screen reader)
  await expect(settings(page)).toHaveCount(1);
  expect(await settings(page).evaluate((el) => el.hasAttribute("inert"))).toBe(true);
  await page.goBack();
  await expect(privacy).toHaveCount(0);
  await expect(settings(page)).toBeVisible();
  expect(await settings(page).evaluate((el) => el.hasAttribute("inert"))).toBe(false);
  // FAQ is a page too, opened from the same list
  await settings(page).getByRole("button", { name: "คำถามที่พบบ่อย" }).click();
  await expect(faq).toBeVisible();
  await faq.getByRole("button", { name: "ย้อนกลับ", exact: true }).click();
  await expect(faq).toHaveCount(0);
  await expect(settings(page)).toBeVisible();
  // second back press closes settings, third stays in the app (no leftover history entries)
  await page.goBack();
  await expect(page.locator("[role=dialog]")).toHaveCount(0);
  await expect(page.getByTestId("hero-card")).toBeVisible();
  // Escape closes only the top page
  await page.getByRole("button", { name: "ตั้งค่า", exact: true }).click();
  await settings(page).getByRole("button", { name: "ความเป็นส่วนตัว" }).click();
  await page.keyboard.press("Escape");
  await expect(privacy).toHaveCount(0);
  await expect(settings(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[role=dialog]")).toHaveCount(0);
  assertNoErrors(page);
});

test("privacy policy is a full-screen page; ← returns to where it was opened from", async ({ page }) => {
  await page.goto("/");
  await page.locator("input[type=checkbox]").waitFor();
  await page.getByText("อ่านนโยบายความเป็นส่วนตัวฉบับเต็ม").tap();
  const pv = page.getByRole("dialog", { name: "นโยบายความเป็นส่วนตัว" });
  await expect(pv).toBeVisible();
  const box = await pv.evaluate((el) => { const r = el.getBoundingClientRect(); return [r.width, r.height, getComputedStyle(el).backgroundColor, el.hasAttribute("data-page-motion")]; });
  expect(box).toEqual([390, 780, "rgba(0, 0, 0, 0)", true]);
  await expect(pv.getByRole("heading", { name: "นโยบายความเป็นส่วนตัว" })).toBeVisible();
  await pv.getByRole("button", { name: "ย้อนกลับ" }).click();
  await expect(pv).toHaveCount(0);
  await expect(page.locator("input[type=checkbox]")).toBeVisible();

  await page.locator("input[type=checkbox]").tap(); await page.getByText("ยินยอมและเริ่มใช้งาน").tap();
  await expect(page.getByTestId("hero-card")).toBeVisible();
  await page.getByRole("button", { name: "โปรไฟล์ของฉัน", exact: true }).click();
  await profile(page).getByRole("button", { name: "อ่านนโยบายความเป็นส่วนตัว" }).click();
  await expect(pv).toBeVisible();
  await expect(profile(page)).toHaveCount(1); // profile stays underneath
  await pv.getByRole("button", { name: "ย้อนกลับ" }).click();
  await expect(profile(page)).toBeVisible();
  await page.goBack();
  await expect(page.locator("[role=dialog]")).toHaveCount(0);
});

test("share card says the Rh next to the blood group, only when it is known", async ({ page }) => {
  await page.addInitScript(() => {
    window.__cardText = [];
    const f = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t, ...r) { window.__cardText.push(String(t)); return f.call(this, t, ...r); };
  });
  await startFresh(page);
  for (const [rh, want] of [["+", "หมู่โลหิต O Rh+"], ["-", "หมู่โลหิต O Rh−"], ["", "หมู่โลหิต O"], ["unknown", "หมู่โลหิต O"]]) {
    await seed(page, { donations: [rec("a", "2026-03-01"), rec("b", "2026-06-01")], profile: { nickname: "แพรว", bloodType: "O", bloodRh: rh } });
    await page.evaluate(() => { window.__cardText = []; });
    await page.locator("nav button[aria-label^='ภารกิจ']").click();
    await page.getByRole("button", { name: "แชร์การให้ที่ยิ่งใหญ่ของคุณ" }).click();
    await expect.poll(() => page.evaluate(() => window.__cardText.some((t) => t.startsWith("🩸")))).toBe(true);
    const lines = await page.evaluate(() => window.__cardText.filter((t) => t.includes("หมู่โลหิต")));
    expect(lines.some((t) => t.includes(want) && (want.includes("Rh") || !t.includes("Rh")))).toBe(true);
    await page.evaluate(() => { window.__cardText = []; });
  }
  assertNoErrors(page);
});

test("pages slide in from the right with no dimmed/blurred backdrop, and slide out on close", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", "2026-06-01")] });
  await page.getByRole("button", { name: "ตั้งค่า", exact: true }).click();
  const d = settings(page);
  await expect(d).toBeVisible();
  const look = await d.evaluate((el) => { const cs = getComputedStyle(el), p = getComputedStyle(el.firstElementChild); return { bg: cs.backgroundColor, blur: cs.backdropFilter, anim: p.animationName }; });
  expect(look).toEqual({ bg: "rgba(0, 0, 0, 0)", blur: "none", anim: "pageIn" });
  await d.getByRole("button", { name: "ย้อนกลับ" }).click();
  await expect(page.locator(".page-exit-clone")).toHaveCount(1);
  await expect(page.locator(".page-exit-clone")).toHaveCount(0);
  assertNoErrors(page);
});

test("backup/restore opens over Settings (Settings stays underneath) and the back button closes only the backup dialog", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", "2026-06-01")] });
  const backup = page.getByRole("dialog", { name: "สำรอง/กู้คืนข้อมูล" });
  await page.getByRole("button", { name: "ตั้งค่า", exact: true }).click();
  await settings(page).getByRole("button", { name: /^สำรอง\/กู้คืนข้อมูล/ }).click();
  await expect(backup).toBeVisible();
  await expect(settings(page)).toHaveCount(1);
  expect(await settings(page).evaluate((el) => el.hasAttribute("inert"))).toBe(true);
  await page.goBack();
  await expect(backup).toHaveCount(0);
  await expect(settings(page)).toBeVisible();
  expect(await settings(page).evaluate((el) => el.hasAttribute("inert"))).toBe(false);
  // the ✕ path: settings is still the page underneath, and one more back press closes it
  await settings(page).getByRole("button", { name: /^สำรอง\/กู้คืนข้อมูล/ }).click();
  await backup.getByRole("button", { name: "ปิด" }).click();
  await expect(backup).toHaveCount(0);
  await expect(settings(page)).toBeVisible();
  await page.goBack();
  await expect(page.locator("[role=dialog]")).toHaveCount(0);
  await expect(page.getByTestId("hero-card")).toBeVisible();
  assertNoErrors(page);
});
