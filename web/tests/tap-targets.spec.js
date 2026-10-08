import { test, expect } from "@playwright/test";
import { trackErrors, seed, rec, assertNoErrors } from "./helpers.js";

// Every button/link/switch in these screens must have a tap area of at least 44px in both directions
// (the button plus its invisible padding), without the visible size having to change.
const small = (page) => page.evaluate(() => {
  const root = [...document.querySelectorAll("[role=dialog]")].filter((d) => d.getBoundingClientRect().width > 0).pop() || document.body;
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; };
  const hit = (e) => { const lab = e.tagName === "INPUT" ? e.closest("label") : null; const r = (lab || e).getBoundingClientRect(); let [l, t, rr, b] = [r.left, r.top, r.right, r.bottom]; for (const c of e.querySelectorAll("span[aria-hidden=true]")) { if (getComputedStyle(c).position !== "absolute") continue; const q = c.getBoundingClientRect(); l = Math.min(l, q.left); t = Math.min(t, q.top); rr = Math.max(rr, q.right); b = Math.max(b, q.bottom); } return [Math.round(rr - l), Math.round(b - t)]; };
  return [...root.querySelectorAll("button, a[href], input[type=checkbox], [role=radio], [role=switch], [role=tab]")].filter(vis)
    .map((e) => ({ n: (e.getAttribute("aria-label") || e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 30), s: hit(e) }))
    .filter((x) => x.s[0] < 43.5 || x.s[1] < 43.5);
});

test("tap areas: form, settings, backup, share, profile and consent controls are at least 44px", async ({ page }) => {
  test.setTimeout(180_000);
  trackErrors(page);
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto("/");
  await page.locator("input[type=checkbox]").waitFor();
  expect(await small(page), "consent").toEqual([]);
  // the consent checkbox itself is 18px; what counts is the whole <label> row around it (checkbox + text), which is tappable
  expect(await page.evaluate(() => { const l = document.querySelector("input[type=checkbox]").closest("label").getBoundingClientRect(); return [Math.round(l.width), Math.round(l.height)]; }).then(([w, h]) => w >= 44 && h >= 44), "consent row").toBe(true);
  await page.setViewportSize({ width: 320, height: 640 });
  expect(await small(page), "consent 320").toEqual([]);
  await page.setViewportSize({ width: 390, height: 780 });
  await page.locator("input[type=checkbox]").tap(); await page.getByText("ยินยอมและเริ่มใช้งาน").tap();
  await expect(page.getByTestId("hero-card")).toBeVisible();
  await seed(page, { donations: [rec("a", "2026-06-01")], profile: { nickname: "แพรว", gender: "female", weight: 52, height: 158, birthYear: 2536, bloodType: "O", bloodRh: "+" } });

  await page.getByRole("button", { name: "บันทึกบริจาคโลหิต" }).first().click();
  await page.locator("[role=dialog]").last().waitFor(); await page.waitForTimeout(400);
  expect(await small(page), "form").toEqual([]);
  // the date picker's month arrows and month/year header (the day cells themselves are a grid, left as they are)
  await page.locator("[role=dialog]").last().getByText("ระบุวันที่", { exact: true }).first().click(); await page.waitForTimeout(400);
  expect((await small(page)).filter((x) => /^เดือน|\d{4}$/.test(x.n)), "date picker").toEqual([]);
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);

  await page.getByRole("button", { name: "ตั้งค่า", exact: true }).click(); await page.waitForTimeout(500);
  expect(await small(page), "settings").toEqual([]);
  await page.getByRole("button", { name: /^สำรอง\/กู้คืนข้อมูล/ }).click(); await page.waitForTimeout(500);
  expect(await small(page), "backup").toEqual([]);
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);

  await page.goto("/"); await expect(page.getByTestId("hero-card")).toBeVisible();
  await page.getByRole("button", { name: "โปรไฟล์ของฉัน", exact: true }).click(); await page.waitForTimeout(500);
  expect(await small(page), "profile").toEqual([]);

  await page.goto("/"); await expect(page.getByTestId("hero-card")).toBeVisible();
  await page.locator("nav button[aria-label^='ภารกิจ']").click();
  await page.getByRole("button", { name: "แชร์การให้ที่ยิ่งใหญ่ของคุณ" }).click(); await page.waitForTimeout(1500);
  expect(await small(page), "share").toEqual([]);
  assertNoErrors(page);
});
