import { test, expect } from "@playwright/test";
import { startFresh, seed, rec, assertNoErrors } from "./helpers.js";

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); const p = (x) => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const openKnowledge = async (page) => { await page.locator("nav button[aria-label='ให้ความรู้']").click(); await expect(page.getByRole("heading", { level: 2, name: "ให้ความรู้เรื่องการบริจาคโลหิต" })).toBeVisible(); };
const section = (page, name) => page.getByRole("button", { name, exact: true });

test("knowledge: only the criteria start open, on the type donated last; sections fold and keep focus", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(200)), rec("b", daysAgo(5), "plasma")] });
  await openKnowledge(page);
  await expect(section(page, "เกณฑ์ผู้บริจาค")).toHaveAttribute("aria-expanded", "true");
  for (const s of ["เตรียมตัวก่อนบริจาค", "ขั้นตอนที่จุดรับบริจาค", "ดูแลตัวเองหลังบริจาค", "ความเข้าใจผิดที่พบบ่อย", "ประโยชน์ของการบริจาค", "ติดต่อศูนย์บริการโลหิตแห่งชาติ"]) {
    await expect(section(page, s)).toHaveAttribute("aria-expanded", "false");
  }
  await expect(page.getByRole("button", { name: "พลาสมา", exact: true })).toHaveAttribute("aria-pressed", "true");
  // each type button's tap area (button + invisible padding) is at least 44px tall
  const h = await page.getByRole("button", { name: "พลาสมา", exact: true }).evaluate((b) => { const r = b.getBoundingClientRect(), q = b.querySelector("span[aria-hidden=true]").getBoundingClientRect(); return Math.max(r.bottom, q.bottom) - Math.min(r.top, q.top); });
  expect(h).toBeGreaterThanOrEqual(44);
  await expect(page.getByText("บริจาคได้ทุก 14 วัน · ครั้งละประมาณ 45 นาที")).toBeVisible();
  await page.getByRole("button", { name: "เกล็ดเลือด", exact: true }).click();
  await expect(page.getByText(/^รับบริจาคจากเพศชายเท่านั้น/)).toBeVisible();
  await page.getByRole("button", { name: "โลหิตรวม", exact: true }).click();
  await expect(page.getByText("ต้องเว้นระยะก่อนบริจาค")).toBeVisible();
  // whole blood now has a cycle line like the other types (and no duplicate 90-day row)
  await expect(page.getByText("บริจาคได้ทุก 90 วัน", { exact: true })).toBeVisible();
  await expect(page.getByText(/^เว้นจากการบริจาคโลหิตรวมครั้งก่อน/)).toHaveCount(0);
  await expect(page.getByText("4 เดือน", { exact: true })).toBeVisible();

  const myths = section(page, "ความเข้าใจผิดที่พบบ่อย");
  await myths.focus();
  await page.keyboard.press("Enter");
  await expect(myths).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("บริจาคได้เมื่อพ้น 4 เดือนหลังสัก เจาะ หรือลบรอยสัก")).toBeVisible();
  expect(await myths.evaluate((b) => b === document.activeElement)).toBe(true);
  await page.keyboard.press("Enter");
  await expect(myths).toHaveAttribute("aria-expanded", "false");
  assertNoErrors(page);
});

test("knowledge: the home card's 'ดูวิธีเตรียมตัวก่อนบริจาค' opens that section; a later visit starts folded again", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(200))] });
  await page.getByRole("button", { name: /ดูวิธีเตรียมตัวก่อนบริจาค/ }).click();
  await expect(section(page, "เตรียมตัวก่อนบริจาค")).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("ดื่มน้ำ 300–500 ซีซี ก่อนบริจาค 30 นาที ช่วยลดอาการเป็นลม")).toBeInViewport();
  await page.locator("nav button[aria-label='หน้าหลัก']").click();
  await openKnowledge(page);
  await expect(section(page, "เตรียมตัวก่อนบริจาค")).toHaveAttribute("aria-expanded", "false");
  assertNoErrors(page);
});

test("knowledge: contact buttons call 1666 and open the blood centre's site", async ({ page }) => {
  await startFresh(page);
  await seed(page, { donations: [rec("a", daysAgo(30))] });
  await openKnowledge(page);
  await section(page, "ติดต่อศูนย์บริการโลหิตแห่งชาติ").click();
  await expect(page.getByRole("link", { name: "โทร 1666" })).toHaveAttribute("href", "tel:1666");
  const site = page.getByRole("link", { name: "เว็บไซต์ / หาจุดรับบริจาค" });
  await expect(site).toHaveAttribute("href", "https://thaibloodcentre.redcross.or.th/");
  await expect(site).toHaveAttribute("target", "_blank");
  for (const l of [page.getByRole("link", { name: "โทร 1666" }), site]) expect((await l.boundingBox()).height).toBeGreaterThanOrEqual(44);
  assertNoErrors(page);
});

test("knowledge: 320px + large text -- type buttons 2 x 2 without clipping, no sideways scroll", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await startFresh(page);
  await page.evaluate(() => localStorage.setItem("bloodjourney:uiMeta", JSON.stringify({ textLarge: true })));
  await seed(page, { donations: [rec("a", daysAgo(30))] });
  await openKnowledge(page);
  const r = await page.evaluate(() => {
    const bs = [...document.querySelectorAll("[aria-label='ประเภทการบริจาค'] button")];
    const clipped = bs.some((b) => { const rg = document.createRange(); rg.selectNodeContents(b.lastChild); const t = rg.getBoundingClientRect(), q = b.getBoundingClientRect(); return t.left < q.left + 2 || t.right > q.right - 2; });
    return { rows: new Set(bs.map((b) => Math.round(b.getBoundingClientRect().top))).size, clipped, ovx: document.documentElement.scrollWidth - innerWidth };
  });
  expect(r).toEqual({ rows: 2, clipped: false, ovx: 0 });
  assertNoErrors(page);
});
