import { expect } from "@playwright/test";

export const PREFIX = "bloodjourney:";

// Collects uncaught page errors; call assertNoErrors(page) at the end of a test.
export function trackErrors(page) {
  page.__errs = [];
  page.on("pageerror", (e) => page.__errs.push(String(e)));
}
export function assertNoErrors(page) {
  expect(page.__errs, "uncaught page errors").toEqual([]);
}

export const rec = (id, date, type = "whole", extra = {}) => ({
  id, date, time: "", location: "", note: "", type,
  loggedAt: `${date}T03:00:00.000Z`, createdAt: `${date}T03:00:00.000Z`, ...extra,
});

// Fresh install: opens the app and gives consent.
export async function startFresh(page) {
  trackErrors(page);
  await page.goto("/");
  await page.locator("input[type=checkbox]").tap();
  await page.getByText("ยินยอมและเริ่มใช้งาน").tap();
  await expect(page.getByText("บันทึกบริจาคโลหิต", { exact: true }).last()).toBeVisible();
}

// Writes data straight into localStorage and reloads, so tests can start from
// a known state without clicking through onboarding.
export async function seed(page, { donations = [], profile = {} } = {}) {
  await page.evaluate(([d, p, pre]) => {
    localStorage.setItem(pre + "donations", JSON.stringify(d));
    localStorage.setItem(pre + "profile", JSON.stringify({ nickname: "ทดสอบ", donorType: "general", donorTypePicked: true, ...p }));
  }, [donations, profile, PREFIX]);
  await page.reload();
  await expect(page.getByText("บันทึกบริจาคโลหิต", { exact: true }).last()).toBeVisible();
}

export const stored = (page, key) =>
  page.evaluate(([k, pre]) => { const v = localStorage.getItem(pre + k); return v ? JSON.parse(v) : null; }, [key, PREFIX]);

export const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

// Picks a date in the in-app calendar. "วันนี้" selects today, then ยืนยัน.
export async function pickToday(dialog) {
  await dialog.getByText("ระบุวันที่", { exact: true }).first().tap();
  await dialog.getByRole("button", { name: "วันนี้" }).tap();
  await dialog.getByText("ยืนยัน", { exact: true }).tap();
}

export const todayStr = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Opens the add-donation form from the home screen.
export async function openForm(page) {
  await page.getByRole("button", { name: "บันทึกบริจาคโลหิต" }).tap();
  await expect(page.locator("[role=dialog]").last()).toBeVisible();
  return page.locator("[role=dialog]").last();
}
