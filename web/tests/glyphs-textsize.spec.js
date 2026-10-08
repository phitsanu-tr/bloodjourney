import { test, expect } from "@playwright/test";
import { startFresh, seed, rec, assertNoErrors, PREFIX } from "./helpers.js";

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); const p = (x) => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const data = [rec("a", daysAgo(5), "whole"), rec("b", daysAgo(120), "plasma"), rec("c", daysAgo(400), "whole")];
const PROFILE = { nickname: "แพรว", gender: "female", weight: 52, height: 158, birthYear: 2536, bloodType: "O", bloodRh: "+" };
const NOT_IN_MITR = /[≈▼▲✓✕→≥]/;

test("glyphs: no screen draws a character the Mitr font lacks (they fell back to the system font)", async ({ page }) => {
  test.setTimeout(120_000);
  await startFresh(page);
  await seed(page, { donations: data, profile: PROFILE });
  const text = () => page.evaluate(() => document.body.innerText);
  const bad = async (label) => { const t = await text(); const m = t.match(NOT_IN_MITR); expect(m, `${label}: "${m && m[0]}"`).toBeNull(); };
  await bad("home");
  await page.goto("/?tab=dashboard"); await page.locator("nav[aria-label='เมนูหลัก']").waitFor(); await bad("dashboard");
  await page.goto("/?tab=missions"); await page.locator("nav[aria-label='เมนูหลัก']").waitFor(); await bad("missions");
  await page.goto("/?tab=faq");
  const faq = page.getByRole("dialog", { name: "คำถามที่พบบ่อย" });
  await expect(faq).toBeVisible();
  const n = await faq.getByRole("heading", { level: 3 }).count();
  for (let i = 0; i < n; i++) { await faq.getByRole("heading", { level: 3 }).nth(i).getByRole("button").click(); await bad(`faq item ${i}`); }
  await page.goto("/"); await page.getByRole("button", { name: "โปรไฟล์ของฉัน", exact: true }).click(); await page.waitForTimeout(500); await bad("profile");
  assertNoErrors(page);
});

test("home liters pill and the year comparison use words/icons, not ≈ ▼", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: data, profile: PROFILE });
  await expect(page.getByTestId("hero-card").getByText(/ประมาณ [\d.]+ ลิตร/)).toBeVisible();
  await page.goto("/?tab=dashboard"); await page.locator("nav[aria-label='เมนูหลัก']").waitFor();
  await expect(page.getByText(/โลหิตรวม 1 ครั้ง ประมาณ \d+ คน/)).toBeVisible();
  const chip = page.getByText(/จากปี \d{4}/).first();
  await expect(chip).toContainText(/[+−]\d/);
  expect(await chip.locator("svg").count()).toBe(1);
});

test("text size: ปกติ / ใหญ่ / ใหญ่มาก, saved, only one at a time", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: data, profile: PROFILE });
  const html = () => page.evaluate(() => ({ large: document.documentElement.classList.contains("text-large"), xl: document.documentElement.classList.contains("text-xl"), zoom: document.documentElement.style.getPropertyValue("--ui-zoom") }));
  const meta = () => page.evaluate((pre) => JSON.parse(localStorage.getItem(pre + "uiMeta")), PREFIX);
  await page.getByRole("button", { name: "ตั้งค่า", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "ตั้งค่า" });
  await expect(settings.getByRole("radio")).toHaveCount(3);
  await settings.getByRole("radio", { name: "ใหญ่มาก" }).click();
  await expect.poll(html).toEqual({ large: false, xl: true, zoom: "1.3" });
  await expect.poll(async () => { const m = await meta(); return [m.textLarge, m.textXL]; }).toEqual([false, true]);
  await settings.getByRole("radio", { name: "ใหญ่", exact: true }).click();
  await expect.poll(html).toEqual({ large: true, xl: false, zoom: "1.15" });
  await settings.getByRole("radio", { name: "ใหญ่มาก" }).click();
  await page.reload(); await expect(page.getByTestId("hero-card")).toBeVisible();
  expect((await html()).xl).toBe(true); // survives a reload
  await page.getByRole("button", { name: "ตั้งค่า", exact: true }).click();
  await page.getByRole("dialog", { name: "ตั้งค่า" }).getByRole("radio", { name: "ปกติ" }).click();
  await expect.poll(html).toEqual({ large: false, xl: false, zoom: "1" });
  assertNoErrors(page);
});

test("a very narrow page (browser zoom 200% on a phone, ~195px) keeps both header icons in view", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: data, profile: PROFILE });
  await page.setViewportSize({ width: 195, height: 390 });
  await page.reload(); await expect(page.getByTestId("hero-card")).toBeVisible();
  for (const name of ["โปรไฟล์ของฉัน", "ตั้งค่า"]) {
    const box = await page.getByRole("button", { name, exact: true }).boundingBox();
    expect(box.x, name).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, name).toBeLessThanOrEqual(195 + 1);
  }
  await expect(page.locator(".hdr-sub")).toBeHidden();
});

test("pull-to-refresh hint is not exposed to screen readers while idle; the live status is empty", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: data, profile: PROFILE });
  const info = await page.evaluate(() => ({
    statusTexts: [...document.querySelectorAll("[role=status]")].map((e) => e.textContent.trim()),
    hintHidden: [...document.querySelectorAll("div[aria-hidden=true]")].some((e) => e.textContent.includes("ดึงลงเพื่อรีเฟรช")),
  }));
  expect(info.statusTexts.every((t) => !t.includes("ดึงลง") && !t.includes("รีเฟรช"))).toBe(true);
  expect(info.hintHidden).toBe(true);
});
