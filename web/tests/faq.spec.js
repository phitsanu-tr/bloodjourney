import { test, expect } from "@playwright/test";
import { startFresh, seed, rec, assertNoErrors } from "./helpers.js";

test("faq: headings, question buttons named without +/-, answers point at real settings rows", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", "2026-06-01")] });
  await page.goto("/?tab=faq");
  await expect(page.getByRole("heading", { level: 2, name: "คำถามที่พบบ่อย" })).toBeVisible();
  const q = page.getByRole("button", { name: "ถ้าเปลี่ยนเครื่อง ลง LINE ใหม่ หรือล้างแคช ข้อมูลจะหายไหม", exact: true });
  await expect(q).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("heading", { level: 3, name: "ถ้าเปลี่ยนเครื่อง ลง LINE ใหม่ หรือล้างแคช ข้อมูลจะหายไหม" })).toBeVisible();
  await q.click();
  await expect(q).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText(/ตั้งค่า → สำรอง\/กู้คืนข้อมูล/)).toBeVisible();
  // the rows the answers name exist in Settings (close the FAQ page the deep link opened first)
  await page.getByRole("dialog", { name: "คำถามที่พบบ่อย" }).getByRole("button", { name: "ย้อนกลับ", exact: true }).click();
  await page.getByRole("button", { name: "ตั้งค่า", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "ตั้งค่า" });
  for (const row of ["สำรอง/กู้คืนข้อมูล", "ความเป็นส่วนตัว", "ลบข้อมูลทั้งหมด"]) await expect(settings.getByRole("button", { name: new RegExp("^" + row) })).toHaveCount(1);
  assertNoErrors(page);
});

test("faq: Settings has a row that opens the FAQ; answers are 14px", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", "2026-06-01")] });
  await page.getByRole("button", { name: "ตั้งค่า", exact: true }).click();
  await page.getByRole("dialog", { name: "ตั้งค่า" }).getByRole("button", { name: "คำถามที่พบบ่อย" }).click();
  const faq = page.getByRole("dialog", { name: "คำถามที่พบบ่อย" });
  await expect(faq).toBeVisible();
  await expect(faq.getByRole("heading", { level: 2, name: "คำถามที่พบบ่อย" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "ตั้งค่า" })).toHaveCount(1); // settings stays underneath
  await page.getByRole("button", { name: "แอปนี้ฟรีไหม ใครเป็นผู้พัฒนา", exact: true }).click();
  expect(await page.getByText(/^ใช้งานได้ฟรี/).evaluate((e) => getComputedStyle(e).fontSize)).toBe("14px");
  assertNoErrors(page);
});

test("faq + settings: the report channel reads the same (LINE menu button, no 'coming soon'); medal answer says all types count", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", "2026-06-01")] });
  for (const [w, h] of [[390, 780], [320, 640]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.getByRole("button", { name: "ตั้งค่า", exact: true }).click();
    const settings = page.getByRole("dialog", { name: "ตั้งค่า" });
    await expect(settings.getByText("ส่งความคิดเห็น / แจ้งปัญหา")).toBeVisible();
    await expect(settings.getByText('ผ่านปุ่ม "แจ้งปัญหา" ในเมนู LINE')).toBeVisible();
    await expect(settings.getByText("เร็วๆ นี้")).toHaveCount(0);
    // it is plain text, not a control, and the hint stays on one line at 320
    const hint = settings.getByText('ผ่านปุ่ม "แจ้งปัญหา" ในเมนู LINE');
    expect(await hint.evaluate((el) => !el.closest("button, a, [role=button]") && el.getBoundingClientRect().height < 20)).toBe(true);
    await settings.getByRole("button", { name: "ย้อนกลับ", exact: true }).click();
  }
  await page.goto("/?tab=faq");
  const q = page.getByRole("button", { name: "เข็มที่ระลึกและเหรียญกาชาดสมนาคุณนับจากอะไร", exact: true });
  await q.click();
  await expect(page.getByText(/ทุกประเภทการบริจาครวมกัน/)).toBeVisible();
  // the ?tab=faq deep link (LINE menu) opens the same page over home; ← closes it back to home
  const faq = page.getByRole("dialog", { name: "คำถามที่พบบ่อย" });
  await faq.getByRole("button", { name: "ย้อนกลับ", exact: true }).click();
  await expect(page.locator("[role=dialog]")).toHaveCount(0);
  await expect(page.getByTestId("hero-card")).toBeVisible();
  assertNoErrors(page);
});
