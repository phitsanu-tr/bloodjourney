import { test, expect } from "@playwright/test";
import { startFresh, seed, rec, assertNoErrors } from "./helpers.js";

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); const p = (x) => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const thaiYear = (age) => new Date().getFullYear() + 543 - age;
const openEligibility = async (page) => {
  await page.goto("/?tab=eligibility");
  await expect(page.getByRole("heading", { level: 2, name: "เช็คคุณสมบัติก่อนบริจาคโลหิต" })).toBeVisible();
};

test("eligibility: checks follow the picked type -- platelets men only, 50 kg; whole blood 45 kg", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(60), "platelet")], profile: { gender: "female", weight: 48, height: 160, birthYear: thaiYear(33) } });
  await openEligibility(page);
  await expect(page.getByRole("button", { name: "เกล็ดเลือด", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("รับบริจาคเกล็ดเลือดจากเพศชายเท่านั้น", { exact: true })).toBeVisible();
  await expect(page.getByText("น้ำหนัก 48 กก. ต่ำกว่าเกณฑ์ขั้นต่ำ (50 กก.)")).toBeVisible();
  await expect(page.getByText(/อยู่ในเกณฑ์ \(17-60 ปี\)/)).toBeVisible();
  await page.getByRole("button", { name: "โลหิตรวม", exact: true }).click();
  await expect(page.getByText("เพศ", { exact: true })).toHaveCount(0);
  await expect(page.getByText("น้ำหนัก 48 กก. อยู่ในเกณฑ์ (ขั้นต่ำ 45 กก.)")).toBeVisible();
  await expect(page.getByText(/อยู่ในเกณฑ์ \(17-70 ปี\)/)).toBeVisible();
  await expect(page.getByText("ยังไม่มีประวัติบริจาคโลหิตรวมในแอป ถือว่าเว้นระยะครบแล้ว")).toBeVisible();
  assertNoErrors(page);
});

test("eligibility: red cells need sex for weight/height; missing data gets a 44px profile button", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(200), "rbc")], profile: { weight: 70 } });
  await openEligibility(page);
  await expect(page.getByText(/^เกณฑ์น้ำหนักต่างกันตามเพศ/)).toBeVisible();
  await expect(page.getByText("ยังไม่ได้กรอกส่วนสูงที่หน้าโปรไฟล์")).toBeVisible();
  const btn = page.getByRole("button", { name: "ไปกรอกข้อมูลโปรไฟล์" });
  expect((await btn.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await expect(page.getByRole("heading", { level: 3, name: "เช็คอัตโนมัติจากข้อมูลของคุณ" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "เกณฑ์อื่น ๆ ที่ต้องประเมินเอง" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  assertNoErrors(page);
});

test("eligibility: complete profile hides the profile button; reached from the knowledge tab on the same type", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(200))], profile: { gender: "male", weight: 62, height: 170, birthYear: thaiYear(40) } });
  await page.locator("nav button[aria-label='ให้ความรู้']").click();
  await page.getByRole("button", { name: "พลาสมา", exact: true }).click();
  await page.getByRole("button", { name: "เช็คคุณสมบัติของฉัน (พลาสมา)" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "เช็คคุณสมบัติก่อนบริจาคโลหิต" })).toBeVisible();
  await expect(page.getByRole("button", { name: "พลาสมา", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("น้ำหนัก 62 กก. อยู่ในเกณฑ์ (ขั้นต่ำ 50 กก.)")).toBeVisible();
  await expect(page.getByRole("button", { name: "ไปกรอกข้อมูลโปรไฟล์" })).toHaveCount(0);
  await page.getByRole("button", { name: "เม็ดเลือดแดง", exact: true }).click();
  await expect(page.getByText("ส่วนสูง 170 ซม. อยู่ในเกณฑ์ (มากกว่า 155 ซม.)")).toBeVisible();
  assertNoErrors(page);
});
