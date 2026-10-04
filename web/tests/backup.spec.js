import { test, expect } from "@playwright/test";
import { startFresh, seed, stored, rec, noOverflow, assertNoErrors, PREFIX } from "./helpers.js";

const two = [rec("a", "2026-06-01"), rec("b", "2026-03-01", "component")];

async function openHub(page) {
  await page.getByLabel("ตั้งค่า").tap();
  await page.getByRole("button", { name: "สำรอง/กู้คืนข้อมูล" }).tap();
  await expect(page.getByRole("button", { name: "กู้คืนข้อมูล" })).toBeVisible();
  return page.locator("[role=dialog]").last();
}

const pasteBox = (page) => page.getByLabel("วางข้อความ JSON สำรองที่คัดลอกไว้");

// Export (encrypted, generated password). Returns { text, pw }.
async function exportEncrypted(page) {
  const pw = (await page.locator(".selectable").first().innerText()).trim();
  await page.getByRole("button", { name: "ต่อไป: ยืนยันรหัส" }).tap();
  await page.locator("#export-confirm-pw").fill(pw);
  const box = page.getByLabel("ข้อมูลสำรองที่เข้ารหัสแล้ว สำหรับคัดลอก");
  await expect(box).not.toHaveValue("");
  return { text: await box.inputValue(), pw };
}

// Export as plain JSON through the "unencrypted" warning dialog.
async function exportPlain(page) {
  await page.getByRole("button", { name: "ส่งออกแบบไม่เข้ารหัส" }).tap();
  await page.locator("[role=alertdialog] input[type=checkbox]").check();
  await page.locator("[role=alertdialog]").getByRole("button", { name: "ส่งออกแบบไม่เข้ารหัส" }).tap();
  const box = page.getByLabel(/^ข้อมูลสำรองแบ/);
  await expect(box).not.toHaveValue("");
  return box.inputValue();
}

async function pasteAndImport(page, text) {
  await page.getByRole("button", { name: "กู้คืนข้อมูล" }).tap();
  await pasteBox(page).fill(text);
  await page.getByRole("button", { name: "นำเข้าจากข้อความ" }).tap();
}

test("backup: plain export then import into an empty app restores every donation", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: two });
  await openHub(page);
  const text = await exportPlain(page);
  expect(JSON.parse(text).donations).toHaveLength(2);

  await seed(page, { donations: [] });
  await openHub(page);
  await pasteAndImport(page, text);
  await page.locator("[role=dialog]").last().getByRole("button", { name: "นำเข้า", exact: true }).tap();
  await expect.poll(async () => (await stored(page, "donations"))?.length).toBe(2);
  assertNoErrors(page);
});

test("backup: importing the same file twice adds nothing (duplicates skipped)", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: two });
  await openHub(page);
  const text = await exportPlain(page);
  await pasteAndImport(page, text);
  const dlg = page.locator("[role=dialog]").last();
  await expect(dlg.getByText("ในไฟล์ 2 · มีอยู่แล้ว 2")).toBeVisible();
  await expect(dlg.getByText("ไม่มีอะไรใหม่ให้นำเข้า — ข้อมูลนี้มีอยู่ในเครื่องแล้วทั้งหมด")).toBeVisible();
  await expect(dlg.getByRole("button", { name: "นำเข้า", exact: true })).toBeDisabled();
  assertNoErrors(page);
});

// Simulates a new phone: no uiMeta, no carried-over count, default settings.
async function wipeToNewPhone(page) {
  await page.evaluate((pre) => localStorage.removeItem(pre + "uiMeta"), PREFIX);
  await seed(page, { donations: [] });
}

test("backup: carried-over counts, reminder cycles and home settings move to a new phone", async ({ page }) => {
  await startFresh(page);
  await page.evaluate((pre) => localStorage.setItem(pre + "uiMeta", JSON.stringify({ cycleByType: { whole: 120, plasma: 14, platelet: 30, rbc: 120 }, blurInfoPills: false })), PREFIX);
  await seed(page, { donations: two, profile: { startingCountWhole: 20, startingCountPlasma: 5 } });
  await openHub(page);
  const text = await exportPlain(page);
  const j = JSON.parse(text);
  expect(j.blurInfoPills).toBe(false);
  expect(Array.isArray(j.seenAchievements)).toBe(true);

  await wipeToNewPhone(page);
  await openHub(page);
  await pasteAndImport(page, text);
  const dlg = page.locator("[role=dialog]").last();
  await expect(dlg.getByText("โลหิตรวม 20 · พลาสมา 5")).toBeVisible();
  await expect(dlg.getByText("+25")).toBeVisible();
  await expect(dlg.getByText("โลหิตรวม 120 วัน")).toBeVisible();
  await dlg.getByRole("button", { name: "นำเข้า", exact: true }).tap();
  await expect.poll(async () => (await stored(page, "profile"))?.startingCountWhole).toBe(20);
  expect((await stored(page, "profile")).startingCountPlasma).toBe(5);
  await expect.poll(async () => (await stored(page, "uiMeta"))?.cycleByType?.whole).toBe(120);
  expect((await stored(page, "uiMeta")).blurInfoPills).toBe(false);
  await expect(page.getByTestId("hero-card").getByText(/^27/).first()).toBeVisible(); // 2 records + 25 carried over
  assertNoErrors(page);
});

test("backup: a file with only a carried-over count can be imported", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [], profile: { startingCountWhole: 12 } });
  await openHub(page);
  const text = await exportPlain(page);
  await wipeToNewPhone(page);
  await openHub(page);
  await pasteAndImport(page, text);
  const btn = page.locator("[role=dialog]").last().getByRole("button", { name: "นำเข้า", exact: true });
  await expect(btn).toBeEnabled();
  await btn.tap();
  await expect.poll(async () => (await stored(page, "profile"))?.startingCountWhole).toBe(12);
  assertNoErrors(page);
});

test("backup: a device that already has a carried-over count keeps it", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: two, profile: { startingCountWhole: 25 } });
  await openHub(page);
  const text = await exportPlain(page);
  await seed(page, { donations: [], profile: { startingCountWhole: 10 } });
  await openHub(page);
  await pasteAndImport(page, text);
  const dlg = page.locator("[role=dialog]").last();
  await expect(dlg.getByText("เครื่องนี้ 10 · ในไฟล์ 25")).toBeVisible();
  await expect(dlg.getByText("คงเดิม", { exact: true })).toBeVisible();
  await dlg.getByRole("button", { name: "นำเข้า", exact: true }).tap();
  await expect.poll(async () => (await stored(page, "donations"))?.length).toBe(2);
  expect((await stored(page, "profile")).startingCountWhole).toBe(10);
  assertNoErrors(page);
});

test("backup: encrypted export needs the right password to import", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: two });
  await openHub(page);
  const { text, pw } = await exportEncrypted(page);
  expect(text).not.toContain("2026-06-01"); // really encrypted, not readable

  await seed(page, { donations: [] });
  await openHub(page);
  await pasteAndImport(page, text);
  const pwInput = page.locator("[role=dialog]").last().locator("input[type=password], input[type=text]").last();
  await pwInput.fill("wrong-password-1");
  await page.getByRole("button", { name: /ปลดล็อก/ }).tap();
  await expect(page.getByText("รหัสผ่านไม่ถูกต้อง หรือไฟล์ถูกแก้ไข")).toBeVisible();
  expect(await stored(page, "donations")).toHaveLength(0);

  await pwInput.fill(pw);
  await page.getByRole("button", { name: /ปลดล็อก/ }).tap();
  await page.locator("[role=dialog]").last().getByRole("button", { name: "นำเข้า", exact: true }).tap();
  await expect.poll(async () => (await stored(page, "donations"))?.length).toBe(2);
  assertNoErrors(page);
});

test("import errors: garbage text and garbage file show inline messages, data untouched", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: two });
  await openHub(page);
  await page.getByRole("button", { name: "กู้คืนข้อมูล" }).tap();

  await pasteBox(page).fill("this is not a backup");
  await page.getByRole("button", { name: "นำเข้าจากข้อความ" }).tap();
  await expect(page.getByText("ข้อความที่วางไม่ถูกต้อง ลองคัดลอกใหม่จากแอปนี้")).toBeVisible();

  await page.locator("input[type=file][accept*=json]").setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from("not json at all") });
  await expect(page.getByText("อ่านไฟล์ไม่ได้ ใช้ไฟล์สำรองจากแอปนี้")).toBeVisible();

  expect(await stored(page, "donations")).toHaveLength(2);
  assertNoErrors(page);
});

test("layout: backup hub has no horizontal overflow at 390 and 320 (both tabs)", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: two });
  for (const w of [390, 320]) {
    await page.setViewportSize({ width: w, height: 780 });
    await openHub(page);
    expect(await noOverflow(page), `export @${w}`).toBe(true);
    await page.getByRole("button", { name: "กู้คืนข้อมูล" }).tap();
    expect(await noOverflow(page), `import @${w}`).toBe(true);
    await page.reload();
  }
  assertNoErrors(page);
});
