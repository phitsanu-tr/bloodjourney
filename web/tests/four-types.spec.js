import { test, expect } from "@playwright/test";
import { startFresh, seed, rec, stored, openForm, pickToday, assertNoErrors, noOverflow } from "./helpers.js";

const daysAgo = (n) => {
  const d = new Date(); d.setDate(d.getDate() - n);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

test("record form: two-step type picker saves a platelet donation", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("old", "2026-06-01")] });
  const dialog = await openForm(page);
  await pickToday(dialog);
  // Step 1 only offers the two groups; the three component types appear after "เฉพาะส่วน".
  await expect(dialog.getByRole("radio", { name: "เกล็ดเลือด" })).toHaveCount(0);
  await dialog.getByRole("radio", { name: "เฉพาะส่วน" }).tap();
  for (const n of ["พลาสมา", "เกล็ดเลือด", "เม็ดเลือดแดง"]) await expect(dialog.getByRole("radio", { name: n })).toBeVisible();
  // Saving with a group but no type still asks for the type.
  await dialog.locator("button.btn-primary").last().tap();
  await expect(dialog.getByText("ระบุประเภทการบริจาค")).toBeVisible();
  await dialog.getByRole("radio", { name: "เกล็ดเลือด" }).tap();
  await dialog.locator("button.btn-primary").last().tap();
  await expect(page.locator("[role=dialog]")).toHaveCount(0);
  const donations = await stored(page, "donations");
  expect(donations).toHaveLength(2);
  expect(donations.find((d) => d.id !== "old").type).toBe("platelet");
  assertNoErrors(page);
});

test("home: tabs show only recorded types and each counts down on its own cycle", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(10), "whole"), rec("b", daysAgo(10), "platelet"), rec("c", daysAgo(40), "rbc")] });
  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(3); // plasma was never recorded, so it has no tab
  await expect(page.getByRole("tab", { name: /พลาสมา/ })).toHaveCount(0);
  const hero = page.getByTestId("hero-card");
  await page.getByRole("tab", { name: /เกล็ดเลือด/ }).tap();
  await expect(hero.getByText(/ผ่านมา 10\/30 วัน/)).toBeVisible();   // platelet: every 30 days
  await page.getByRole("tab", { name: /เม็ดเลือดแดง/ }).tap();
  await expect(hero.getByText(/ผ่านมา 40\/120 วัน/)).toBeVisible();  // red cells: every 120 days
  await page.getByRole("tab", { name: /โลหิตรวม/ }).tap();
  await expect(hero.getByText(/ผ่านมา 10\/90 วัน/)).toBeVisible();   // whole blood: every 90 days
  assertNoErrors(page);
});

test("legacy 'component' records are read as plasma", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(5), "component")] });
  await expect(page.getByRole("tab")).toHaveCount(0); // single type -> no tab row
  await expect(page.getByTestId("hero-card").getByText("พลาสมา").first()).toBeVisible();
  await expect(page.getByTestId("hero-card").getByText(/ผ่านมา 5\/14 วัน/)).toBeVisible();
  assertNoErrors(page);
});

test("carried-over counts are kept per type and add to the total", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(10), "whole")], profile: { startingCountWhole: 4, startingCountPlatelet: 6, startingCountRbc: 2 } });
  await expect(page.getByTestId("hero-card").getByText(/^13/).first()).toBeVisible(); // 1 + 4 + 6 + 2
  await expect(page.getByRole("tab")).toHaveCount(3);
  assertNoErrors(page);
});

test("liters: hero pill follows the selected type; dashboard shows count × ml per type and a total", async ({ page }) => {
  await startFresh(page);
  // whole 2 × 350 = 0.7 L · plasma 4 (carried over) × 500 = 2 L · platelet 1 × 250 = 0.25 L → total 2.95 ≈ 3 L
  await seed(page, { donations: [rec("a", daysAgo(120), "whole"), rec("b", daysAgo(200), "whole"), rec("c", daysAgo(5), "platelet")], profile: { startingCountPlasma: 4 } });
  const hero = page.getByTestId("hero-card");
  await page.getByRole("tab", { name: /โลหิตรวม/ }).tap();
  await expect(hero.getByLabel("โลหิตรวม ประมาณ 0.7 ลิตร")).toBeVisible();
  await page.getByRole("tab", { name: /พลาสมา/ }).tap();
  await expect(hero.getByLabel("พลาสมา ประมาณ 2 ลิตร")).toBeVisible();
  await page.getByRole("button", { name: "แดชบอร์ด" }).tap();
  await expect(page.getByText("ปริมาณที่ให้สะสม")).toBeVisible();
  await expect(page.getByRole("row", { name: /เกล็ดเลือด.*1 ครั้ง.*× 250 มล\..*0\.3 ล\./ })).toBeVisible();
  await expect(page.getByRole("row", { name: /รวม.*7 ครั้ง.*3 ล\./ })).toBeVisible();
  await expect(page.getByText("คำนวณที่ 350 มล./ครั้ง")).toHaveCount(0);
  assertNoErrors(page);
});

test("settings: each type has its own reminder cycle and it is saved", async ({ page }) => {
  await startFresh(page);
  await page.getByRole("button", { name: /ตั้งค่า/ }).first().tap();
  for (const [id, def] of [["whole", 90], ["plasma", 14], ["platelet", 30], ["rbc", 120]]) {
    await expect(page.locator(`#cycle-${id}`)).toHaveValue(String(def));
  }
  await page.locator("#cycle-platelet").fill("45");
  await page.locator("#cycle-platelet").blur();
  await expect.poll(async () => (await stored(page, "uiMeta"))?.cycleByType?.platelet).toBe(45);
  await page.reload();
  await page.getByRole("button", { name: /ตั้งค่า/ }).first().tap();
  await expect(page.locator("#cycle-platelet")).toHaveValue("45");
  assertNoErrors(page);
});

for (const width of [390, 320]) {
  test(`layout: four-type home, form and history have no overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await startFresh(page);
    await seed(page, { donations: [rec("a", daysAgo(120)), rec("b", daysAgo(3), "plasma"), rec("c", daysAgo(10), "platelet"), rec("d", daysAgo(20), "rbc")] });
    expect(await noOverflow(page)).toBe(true);
    const dialog = await openForm(page);
    await dialog.getByRole("radio", { name: "เฉพาะส่วน" }).tap();
    expect(await noOverflow(page)).toBe(true);
    assertNoErrors(page);
  });
}

test("backup: all four types survive an export and import (old 'component' reads as plasma)", async ({ page }) => {
  await startFresh(page);
  const all = [rec("a", daysAgo(100), "whole"), rec("b", daysAgo(80), "plasma"), rec("c", daysAgo(60), "platelet"), rec("d", daysAgo(40), "rbc"), rec("e", daysAgo(20), "component")];
  await seed(page, { donations: all, profile: { startingCountPlatelet: 3 } });
  await page.getByLabel("ตั้งค่า").tap();
  await page.getByRole("button", { name: "สำรอง/กู้คืนข้อมูล" }).tap();
  const pw = (await page.locator(".selectable").first().innerText()).trim();
  await page.locator("[role=dialog]").last().getByRole("button", { name: "ถัดไป", exact: true }).tap();
  await page.locator("#export-confirm-pw").fill(pw);
  const box = page.getByLabel("ข้อมูลสำรองที่เข้ารหัสแล้ว สำหรับคัดลอก");
  await expect(box).not.toHaveValue("");
  const text = await box.inputValue();
  await seed(page, { donations: [] });
  await page.getByLabel("ตั้งค่า").tap();
  await page.getByRole("button", { name: "สำรอง/กู้คืนข้อมูล" }).tap();
  await page.getByRole("button", { name: "กู้คืนข้อมูล" }).tap();
  await page.getByRole("radio", { name: "ข้อความ" }).tap();
  await page.getByLabel("วางข้อความ JSON สำรองที่คัดลอกไว้").fill(text);
  await page.locator("[role=dialog]").last().getByRole("button", { name: "ถัดไป", exact: true }).tap();
  await page.locator("[role=dialog]").last().locator("input[type=password], input[type=text]").last().fill(pw);
  await page.getByRole("button", { name: /ปลดล็อก/ }).tap();
  await page.locator("[role=dialog]").last().getByRole("button", { name: "นำเข้า", exact: true }).tap();
  await expect.poll(async () => (await stored(page, "donations"))?.length).toBe(5);
  const types = (await stored(page, "donations")).map((d) => d.type).sort();
  expect(types).toEqual(["platelet", "plasma", "plasma", "rbc", "whole"].sort());
  assertNoErrors(page);
});

// Real Mitr is wider than the fallback font; with it loaded the type tabs must still fit on one line from 360px up.
import fs from "fs";
for (const width of [414, 390, 360]) {
  test(`home: type tabs fit on one line with Mitr loaded at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await startFresh(page);
    await seed(page, { donations: [rec("a", daysAgo(120)), rec("b", daysAgo(3), "plasma"), rec("c", daysAgo(10), "platelet"), rec("d", daysAgo(20), "rbc")] });
    await page.addStyleTag({ content: fs.readFileSync(new URL("./mitr-font.css", import.meta.url), "utf8") });
    await page.evaluate(() => document.fonts.ready);
    const tabs = page.getByRole("tab");
    for (let i = 0; i < 4; i++) {
      await tabs.nth(i).tap(); await page.waitForTimeout(450);
      const [sw, cw] = await page.evaluate(() => { const t = document.querySelector("[role=tablist]"); return [t.scrollWidth, t.clientWidth]; });
      expect(sw, `tab ${i} row overflows`).toBeLessThanOrEqual(cw);
    }
    assertNoErrors(page);
  });
}

// With 3+ types the unselected tabs shrink to an icon. A donatable one must keep its type icon (the ✓ is a
// corner badge), or several ✓ tabs look identical; and the row still fits at 390px.
test("home: compact type tabs keep their type icon when donatable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(200)), rec("b", daysAgo(200), "plasma"), rec("c", daysAgo(10), "platelet"), rec("d", daysAgo(200), "rbc")] });
  await page.addStyleTag({ content: fs.readFileSync(new URL("./mitr-font.css", import.meta.url), "utf8") });
  await page.evaluate(() => document.fonts.ready);
  for (const name of ["พลาสมา", "เม็ดเลือดแดง"]) {
    const tab = page.getByRole("tab", { name: new RegExp(`^${name} 1 ครั้ง บริจาคได้แล้ว$`) });
    await expect(tab.getByTestId("tab-eligible-badge")).toHaveCount(1);
    await expect(tab.locator("svg")).toHaveCount(2); // type icon + the badge's check
  }
  await expect(page.getByRole("tab", { name: /^เกล็ดเลือด 1 ครั้ง$/ }).getByTestId("tab-eligible-badge")).toHaveCount(0);
  const tabs = page.getByRole("tab");
  for (let i = 0; i < 4; i++) {
    await tabs.nth(i).tap(); await page.waitForTimeout(450);
    const [sw, cw] = await page.evaluate(() => { const t = document.querySelector("[role=tablist]"); return [t.scrollWidth, t.clientWidth]; });
    expect(sw, `tab ${i} row overflows`).toBeLessThanOrEqual(cw);
  }
  assertNoErrors(page);
});

// The per-type liters pill sits beside the big count; with Mitr and a 3-digit
// count it must not wrap under it (that would make the hero card taller).
for (const width of [390, 320]) {
  test(`home: liters pill stays beside the count with Mitr loaded at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await startFresh(page);
    await seed(page, { donations: [rec("a", daysAgo(120)), rec("b", daysAgo(3), "plasma"), rec("c", daysAgo(10), "platelet"), rec("d", daysAgo(20), "rbc")], profile: { startingCountRbc: 120 } });
    await page.addStyleTag({ content: fs.readFileSync(new URL("./mitr-font.css", import.meta.url), "utf8") });
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole("tab", { name: /เม็ดเลือดแดง/ }).tap(); await page.waitForTimeout(450);
    const pill = page.getByTestId("hero-card").getByLabel(/^เม็ดเลือดแดง ประมาณ 48.4 ลิตร$/);
    await expect(pill).toBeVisible();
    const rowH = await pill.evaluate((el) => el.parentElement.getBoundingClientRect().height);
    expect(rowH, "count row wrapped").toBeLessThan(45);
    assertNoErrors(page);
  });
}

test("dashboard: the shown type stays put (no 30s rotation)", async ({ page }) => {
  await page.clock.install();
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(120)), rec("b", daysAgo(3), "plasma")] });
  await page.getByRole("button", { name: "แดชบอร์ด" }).tap();
  const shown = () => page.evaluate(() => [...document.querySelectorAll("button")].filter((b) => ["โลหิตรวม", "พลาสมา"].includes(b.textContent.trim()) && getComputedStyle(b).backgroundColor === "rgb(255, 247, 245)").map((b) => b.textContent.trim()));
  await expect.poll(shown).toHaveLength(1);
  const before = await shown();
  await page.clock.fastForward(95_000);
  await page.waitForTimeout(300);
  expect(await shown()).toEqual(before);
  assertNoErrors(page);
});
