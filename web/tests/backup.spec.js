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
  await page.locator("[role=dialog]").last().getByRole("button", { name: "ถัดไป", exact: true }).tap();
  await page.locator("#export-confirm-pw").fill(pw);
  const box = page.getByLabel("ข้อมูลสำรองที่เข้ารหัสแล้ว สำหรับคัดลอก");
  await expect(box).not.toHaveValue("");
  return { text: await box.inputValue(), pw };
}

// There is no plain export any more: tests that only need "a backup file to import" use the encrypted one and type its password.
const exportPlain = exportEncrypted;

// Restore tab, text source: paste the text (an encrypted backup shows the password field under the box).
async function pasteText(page, text) {
  await page.getByRole("button", { name: "กู้คืนข้อมูล" }).tap();
  await page.getByRole("radio", { name: "ข้อความ" }).tap();
  await pasteBox(page).fill(text);
}
const nextBtn = (page) => page.locator("[role=dialog]").last().getByRole("button", { name: "ถัดไป", exact: true });

async function pasteAndImport(page, backup) {
  const { text, pw } = typeof backup === "string" ? { text: backup, pw: "" } : backup;
  await pasteText(page, text);
  if (pw) await page.locator("#import-pw-text").fill(pw);
  await nextBtn(page).tap();
}

test("backup: export then import into an empty app restores every donation", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: two });
  await openHub(page);
  const backup = await exportPlain(page);
  expect(backup.text).not.toContain("2026-06-01"); // the only export is encrypted

  await seed(page, { donations: [] });
  await openHub(page);
  await pasteAndImport(page, backup);
  await page.locator("[role=dialog]").last().getByRole("button", { name: "นำเข้า", exact: true }).tap();
  await expect.poll(async () => (await stored(page, "donations"))?.length).toBe(2);
  assertNoErrors(page);
});

test("backup: importing the same file twice adds nothing (duplicates skipped)", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: two });
  await openHub(page);
  const backup = await exportPlain(page);
  await pasteAndImport(page, backup);
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
  const backup = await exportPlain(page);

  await wipeToNewPhone(page);
  await openHub(page);
  await pasteAndImport(page, backup);
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
  const backup = await exportPlain(page);
  await wipeToNewPhone(page);
  await openHub(page);
  await pasteAndImport(page, backup);
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
  const backup = await exportPlain(page);
  await seed(page, { donations: [], profile: { startingCountWhole: 10 } });
  await openHub(page);
  await pasteAndImport(page, backup);
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
  await pasteText(page, text);
  const pwInput = page.locator("#import-pw-text");
  await expect(nextBtn(page)).toBeDisabled(); // an encrypted backup needs its password first
  await pwInput.fill("wrong-password-1");
  await nextBtn(page).tap();
  await expect(page.getByText("รหัสผ่านไม่ถูกต้อง หรือไฟล์ถูกแก้ไข")).toBeVisible();
  expect(await stored(page, "donations")).toHaveLength(0);

  await pwInput.fill(pw);
  await nextBtn(page).tap();
  await page.locator("[role=dialog]").last().getByRole("button", { name: "นำเข้า", exact: true }).tap();
  await expect.poll(async () => (await stored(page, "donations"))?.length).toBe(2);
  assertNoErrors(page);
});

test("import errors: garbage text and garbage file show inline messages, data untouched", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: two });
  await openHub(page);
  await page.getByRole("button", { name: "กู้คืนข้อมูล" }).tap();

  await page.getByRole("radio", { name: "ข้อความ" }).tap();
  await pasteBox(page).fill("this is not a backup");
  await page.locator("[role=dialog]").last().getByRole("button", { name: "ถัดไป", exact: true }).tap();
  await expect(page.getByText("ข้อความที่วางไม่ถูกต้อง ลองคัดลอกใหม่จากแอปนี้")).toBeVisible();
  await page.getByRole("radio", { name: "ไฟล์" }).tap();

  await page.locator("input[type=file][accept*=json]").setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from("not json at all") });
  await expect(page.getByText("x.json")).toBeVisible(); // staged, not imported yet
  await page.locator("[role=dialog]").last().getByRole("button", { name: "ถัดไป", exact: true }).tap();
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

test("backup export: both modes end with ถัดไป; own password needs a matching 8+ char password; no plain export is offered", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: two });
  const dlg = await openHub(page);
  await expect(dlg.getByRole("radio", { name: "แอปสุ่มให้" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("ส่งออกแบบไม่เข้ารหัส")).toHaveCount(0);
  await expect(page.getByText("ตัวเลือกอื่น")).toHaveCount(0);
  const pw = (await page.locator(".selectable").first().innerText()).trim();
  expect(pw).toMatch(/^[^\s]{16}$/);
  // switch to own password: button is disabled until both fields match
  await dlg.getByRole("radio", { name: "ตั้งเอง" }).tap();
  const next = dlg.getByRole("button", { name: "ถัดไป", exact: true });
  await expect(next).toBeDisabled();
  await dlg.locator("#export-pw").fill("MyPass#2026");
  await dlg.locator("#export-pw2").fill("MyPass#2027");
  await expect(next).toBeDisabled();
  await dlg.locator("#export-pw2").fill("MyPass#2026");
  await expect(next).toBeEnabled();
  await next.tap();
  // own mode: no typed re-check, the file is ready on this step
  const box = page.getByLabel("ข้อมูลสำรองที่เข้ารหัสแล้ว สำหรับคัดลอก");
  await expect(box).not.toHaveValue("");
  await expect(dlg.getByRole("button", { name: "ดาวน์โหลดไฟล์" })).toBeEnabled();
  // back keeps what was typed; switching to the app's password and back keeps it too
  await dlg.getByRole("button", { name: "ย้อนกลับไปแก้รหัสผ่าน" }).tap();
  await expect(dlg.locator("#export-pw")).toHaveValue("MyPass#2026");
  await dlg.getByRole("radio", { name: "แอปสุ่มให้" }).tap();
  await expect(dlg.getByRole("button", { name: "ถัดไป" })).toBeEnabled();
  assertNoErrors(page);
});

test("backup hub: the other tab's content never shows through (restore card on the backup tab, backup fields on the restore tab)", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: two });
  const dlg = await openHub(page);
  await expect(dlg.getByText("เลือกไฟล์สำรอง")).toBeHidden();
  await dlg.getByRole("radio", { name: "ตั้งเอง" }).tap();
  await expect(dlg.getByText("เลือกไฟล์สำรอง")).toBeHidden();
  await dlg.getByRole("button", { name: "กู้คืนข้อมูล" }).tap();
  await expect(dlg.getByText("เลือกไฟล์สำรอง")).toBeVisible();
  await expect(dlg.getByText("รหัสผ่านของคุณ")).toBeHidden();
  await expect(dlg.locator("#export-pw")).toBeHidden();
  await dlg.getByRole("button", { name: "สำรองข้อมูล", exact: true }).tap();
  await expect(dlg.getByText("เลือกไฟล์สำรอง")).toBeHidden();
  assertNoErrors(page);
});

test("restore by file: an encrypted file asks for its password on the same page, then goes to the confirm dialog", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: two });
  await openHub(page);
  const backup = await exportEncrypted(page);
  await seed(page, { donations: [] });
  const dlg = await openHub(page);
  await dlg.getByRole("button", { name: "กู้คืนข้อมูล" }).tap();
  await page.locator("input[type=file][accept*=json]").setInputFiles({ name: "enc.json", mimeType: "application/json", buffer: Buffer.from(backup.text) });
  await expect(dlg.getByText("ไฟล์นี้เข้ารหัสอยู่")).toBeVisible();
  await expect(nextBtn(page)).toBeDisabled();
  await dlg.locator("#import-pw-file").fill("wrong-password-1");
  await nextBtn(page).tap();
  await expect(dlg.getByText("รหัสผ่านไม่ถูกต้อง หรือไฟล์ถูกแก้ไข")).toBeVisible();
  await dlg.locator("#import-pw-file").fill(backup.pw);
  await nextBtn(page).tap();
  await page.locator("[role=dialog]").last().getByRole("button", { name: "นำเข้า", exact: true }).tap();
  await expect.poll(async () => (await stored(page, "donations"))?.length).toBe(2);
  assertNoErrors(page);
});

test("backup hub and the import confirm dialog keep exactly the same window size on every page", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: two });
  const dlg = await openHub(page);
  const size = () => page.locator("[role=dialog]").last().evaluate((el) => { const b = el.firstElementChild.getBoundingClientRect(); return `${Math.round(b.width)}x${Math.round(b.height)}`; });
  const first = await size();
  const seen = { "backup, app password": await size() };
  await dlg.getByRole("radio", { name: "ตั้งเอง" }).tap();
  seen["backup, own password"] = await size();
  await dlg.getByRole("radio", { name: "แอปสุ่มให้" }).tap();
  const pw = (await page.locator(".selectable").first().innerText()).trim();
  await dlg.getByRole("button", { name: "ถัดไป", exact: true }).tap();
  await dlg.locator("#export-confirm-pw").fill(pw);
  const text = await page.getByLabel("ข้อมูลสำรองที่เข้ารหัสแล้ว สำหรับคัดลอก").inputValue();
  seen["backup, save step"] = await size();
  await dlg.getByRole("button", { name: "กู้คืนข้อมูล" }).tap();
  seen["restore, file"] = await size();
  await dlg.getByRole("radio", { name: "ข้อความ" }).tap();
  seen["restore, text"] = await size();
  await pasteBox(page).fill(text);
  seen["restore, encrypted text"] = await size();
  await dlg.locator("#import-pw-text").fill(pw);
  await nextBtn(page).tap();
  await expect(page.getByRole("dialog", { name: "ยืนยันการนำเข้าข้อมูล" })).toBeVisible();
  seen["import confirm"] = await size();
  for (const [name, value] of Object.entries(seen)) expect(value, name).toBe(first);
  assertNoErrors(page);
});
