import { test, expect } from "@playwright/test";
import { openForm, startFresh, seed, stored, rec, pickToday, todayStr, noOverflow, assertNoErrors } from "./helpers.js";

test("consent: first run asks for consent and remembers it after reload", async ({ page }) => {
  await startFresh(page);
  expect(await stored(page, "consent")).toBeTruthy();
  await page.reload();
  await expect(page.getByText("ยินยอมและเริ่มใช้งาน")).toHaveCount(0);
  await expect(page.getByText("บันทึกบริจาคโลหิต", { exact: true }).last()).toBeVisible();
  assertNoErrors(page);
});

test("add donation: saves to storage and closes the form", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("old", "2026-06-01")] });
  const d = await openForm(page);
  await pickToday(d);
  await d.getByText("โลหิตรวม").first().tap();
  await d.locator("button.btn-primary").last().tap();
  await expect(page.locator("[role=dialog]")).toHaveCount(0);
  const list = await stored(page, "donations");
  expect(list).toHaveLength(2);
  expect(list.map((x) => x.date)).toContain(todayStr());
  assertNoErrors(page);
});

test("add donation: same date as an existing record shows the inline error", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("today", todayStr())] });
  const d = await openForm(page);
  await pickToday(d);
  await expect(d.getByText("วันที่นี้มีรายการบันทึกแล้ว เลือกวันอื่น")).toBeVisible();
  await expect(d.locator("button.btn-primary").last()).toBeDisabled();
  assertNoErrors(page);
});

test("add donation: submitting without a date shows the date error", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("old", "2026-06-01")] });
  const d = await openForm(page);
  await d.locator("button.btn-primary").last().tap();
  await expect(d.getByText("ระบุวันที่บริจาค")).toBeVisible();
  assertNoErrors(page);
});

test("layout: home and the form have no horizontal overflow at 390 and 320", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", "2026-06-01"), rec("b", "2026-03-01", "component")] });
  for (const w of [390, 320]) {
    await page.setViewportSize({ width: w, height: 780 });
    expect(await noOverflow(page), `home @${w}`).toBe(true);
    await openForm(page);
    expect(await noOverflow(page), `form @${w}`).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.locator("[role=dialog]")).toHaveCount(0);
  }
  assertNoErrors(page);
});
