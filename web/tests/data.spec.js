import { test, expect } from "@playwright/test";
import { startFresh, seed, stored, rec, openForm, pickToday, todayStr, assertNoErrors, PREFIX } from "./helpers.js";

test("history: edit a record keeps it in place and saves the change", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", "2026-06-01", "whole", { location: "รพ.เดิม" })] });
  await page.getByLabel("ตัวเลือกเพิ่มเติม").first().tap();
  await page.getByRole("menuitem", { name: "แก้ไข", exact: true }).tap();
  const d = page.locator("[role=dialog]").last();
  await expect(d.getByRole("button", { name: "บันทึกการแก้ไข" })).toBeDisabled(); // nothing changed yet
  await d.getByPlaceholder(/เช่น ศูนย์/).fill("รพ.ใหม่");
  await d.getByRole("button", { name: "บันทึกการแก้ไข" }).tap();
  await expect(page.locator("[role=dialog]")).toHaveCount(0);
  const list = await stored(page, "donations");
  expect(list).toHaveLength(1);
  expect(list[0]).toMatchObject({ id: "a", date: "2026-06-01", location: "รพ.ใหม่" });
  assertNoErrors(page);
});

test("history: delete asks for confirmation and removes only that record", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", "2026-06-01"), rec("b", "2026-03-01")] });
  await page.getByLabel("ตัวเลือกเพิ่มเติม").first().tap();
  await page.getByRole("menuitem", { name: "ลบ", exact: true }).tap();
  const d = page.locator("[role=dialog]").last();
  await d.getByRole("button", { name: "ยกเลิก" }).tap(); // cancel keeps both
  expect(await stored(page, "donations")).toHaveLength(2);
  await page.getByLabel("ตัวเลือกเพิ่มเติม").first().tap();
  await page.getByRole("menuitem", { name: "ลบ", exact: true }).tap();
  await page.locator("[role=dialog]").last().getByRole("button", { name: "ลบรายการ" }).tap();
  await expect.poll(async () => (await stored(page, "donations")).length).toBe(1);
  expect((await stored(page, "donations"))[0].id).toBe("b"); // "a" is the newest, so it was the one removed
  assertNoErrors(page);
});

test("persistence: donations and profile survive a reload", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", "2026-06-01"), rec("b", "2026-03-01")], profile: { nickname: "สมชาย" } });
  await page.reload();
  await expect(page.getByText("สมชาย").first()).toBeVisible();
  expect(await stored(page, "donations")).toHaveLength(2);
  assertNoErrors(page);
});

test("first-time quick entry: prior count and last date are saved together", async ({ page }) => {
  await startFresh(page);
  await page.getByRole("button", { name: "บันทึกบริจาคโลหิต" }).tap();
  await page.getByText("เคยบริจาคแล้ว", { exact: true }).tap();
  const d = page.locator("[role=dialog]").last();
  await d.locator("[role=switch]").first().tap();
  await d.locator("input[inputmode=numeric]").nth(0).fill("5");
  await pickToday(d);
  await d.locator("button.btn-primary").last().tap();
  await expect(page.locator("[role=dialog]")).toHaveCount(0);
  const donations = await stored(page, "donations");
  expect(donations).toHaveLength(1);
  expect(donations[0].date).toBe(todayStr());
  expect((await stored(page, "profile")).startingCountWhole).toBe(4); // 5 total = 4 before + the one just recorded
  assertNoErrors(page);
});

test("first-time quick entry: out-of-range count and missing date show inline errors", async ({ page }) => {
  await startFresh(page);
  await page.getByRole("button", { name: "บันทึกบริจาคโลหิต" }).tap();
  await page.getByText("เคยบริจาคแล้ว", { exact: true }).tap();
  const d = page.locator("[role=dialog]").last();
  await d.locator("[role=switch]").first().tap();
  await d.locator("button.btn-primary").last().tap();
  await expect(d.getByText(/^ระบุ 1-\d+ ครั้ง/)).toBeVisible();
  await d.locator("input[inputmode=numeric]").nth(0).fill("5");
  await d.locator("button.btn-primary").last().tap();
  await expect(d.getByText("ระบุวันที่บริจาค (ครั้งล่าสุด)")).toBeVisible();
  expect(await stored(page, "donations")).toBeNull();
  assertNoErrors(page);
});

test("profile photo: HEIC and unreadable images show an inline error and change nothing", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", "2026-06-01")] });
  await page.getByLabel("โปรไฟล์ของฉัน").tap();
  const input = page.locator("input[type=file][accept='image/*']").last();
  await input.setInputFiles({ name: "a.heic", mimeType: "image/heic", buffer: Buffer.from("xx") });
  await expect(page.getByText("เบราว์เซอร์นี้เปิดไฟล์ HEIC ไม่ได้ ลองเลือก JPG หรือ PNG")).toBeVisible();
  await input.setInputFiles({ name: "a.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not an image") });
  await expect(page.getByText("อัปโหลดรูปไม่สำเร็จ ลองเลือกไฟล์ JPG หรือ PNG")).toBeVisible();
  expect((await stored(page, "profile")).photo || "").toBe("");
  assertNoErrors(page);
});

test("clear profile: removes profile fields but keeps the donation history", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", "2026-06-01")], profile: { nickname: "สมชาย" } });
  await page.getByLabel("โปรไฟล์ของฉัน").tap();
  const clear = page.getByText("ลบข้อมูลโปรไฟล์").last();
  await clear.scrollIntoViewIfNeeded();
  await clear.tap();
  await page.locator("[role=dialog]").last().getByRole("button", { name: "ลบข้อมูล" }).tap();
  await expect.poll(async () => (await stored(page, "profile")).nickname).toBe("");
  expect(await stored(page, "donations")).toHaveLength(1);
  assertNoErrors(page);
});

test("settings: delete everything wipes all stored data after confirmation", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", "2026-06-01")] });
  await page.getByLabel("ตั้งค่า").tap();
  await page.getByRole("button", { name: "ลบข้อมูลทั้งหมด" }).tap();
  const d = page.locator("[role=dialog]").last();
  await expect(d).toHaveAttribute("aria-label", "ยืนยันการลบข้อมูลทั้งหมด");
  await d.getByRole("button", { name: "ลบข้อมูล", exact: true }).tap();
  await expect.poll(async () => await stored(page, "donations")).toBeNull();
  expect(await stored(page, "profile")).toBeNull();
  assertNoErrors(page);
});

test("unreadable history: a copy is kept, the user is told, and a new save doesn't destroy it", async ({ page }) => {
  await startFresh(page);
  await page.evaluate((pre) => localStorage.setItem(pre + "donations", "{broken"), PREFIX);
  await page.reload();
  const warn = page.getByRole("dialog", { name: "อ่านประวัติการบริจาคไม่ได้" });
  await expect(warn).toBeVisible();
  const copies = () => page.evaluate((pre) => JSON.parse(localStorage.getItem(pre + "donationsUnreadable") || "[]").map((c) => c.raw), PREFIX);
  expect(await copies()).toEqual(["{broken"]);
  // a second open doesn't duplicate the same copy
  await page.reload();
  await expect(warn).toBeVisible();
  expect(await copies()).toEqual(["{broken"]);
  // "เริ่มบันทึกใหม่": record a donation; the copy is still there
  await warn.getByRole("button", { name: /^เริ่มบันทึกใหม่/ }).tap();
  await expect(warn).toHaveCount(0);
  await seed(page, { donations: [rec("a", "2026-06-01")] });
  expect(await copies()).toEqual(["{broken"]);
  await expect(page.getByRole("dialog", { name: "อ่านประวัติการบริจาคไม่ได้" })).toHaveCount(0);
  // "ลบข้อมูลทั้งหมด" also removes the copy
  await page.getByLabel("ตั้งค่า").tap();
  await page.getByRole("button", { name: "ลบข้อมูลทั้งหมด" }).tap();
  await page.locator("[role=dialog]").last().getByRole("button", { name: "ลบข้อมูล", exact: true }).tap();
  await expect.poll(() => page.evaluate((pre) => localStorage.getItem(pre + "donationsUnreadable"), PREFIX)).toBeNull();
  assertNoErrors(page);
});

test("unreadable history: กู้คืนจากไฟล์สำรอง opens the restore tab", async ({ page }) => {
  await startFresh(page);
  await page.evaluate((pre) => localStorage.setItem(pre + "donations", '{"not":"a list"}'), PREFIX);
  await page.reload();
  const warn = page.getByRole("dialog", { name: "อ่านประวัติการบริจาคไม่ได้" });
  await warn.getByRole("button", { name: "กู้คืนจากไฟล์สำรอง" }).tap();
  await expect(warn).toHaveCount(0);
  await expect(page.getByLabel("วางข้อความ JSON สำรองที่คัดลอกไว้")).toBeVisible();
  assertNoErrors(page);
});

