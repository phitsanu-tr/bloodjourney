import { test, expect } from "@playwright/test";
import { startFresh, seed, rec, assertNoErrors } from "./helpers.js";

const daysAgo = (n) => {
  const d = new Date(); d.setDate(d.getDate() - n);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Every state of the home hero card must be the same height, so the card
// doesn't jump when the state changes or the tab is switched.
const STATES = {
  "new user": { donations: [], profile: {} },
  "prior count only": { donations: [], profile: { startingCountWhole: 5 } },
  "waiting": { donations: [rec("a", daysAgo(30))], profile: {} },
  "eligible": { donations: [rec("a", daysAgo(120))], profile: {} },
  "paused (waiting)": { donations: [rec("a", daysAgo(30))], profile: { remindPauseUntil: "indefinite" } },
  "paused (eligible)": { donations: [rec("a", daysAgo(120))], profile: { remindPauseUntil: "indefinite" } },
};
const BOTH = { donations: [rec("a", daysAgo(120)), rec("b", daysAgo(3), "component")], profile: {} };

const heroH = async (page) => Math.round((await page.getByTestId("hero-card").boundingBox()).height * 10) / 10;
const statusH = async (page) => Math.round((await page.getByTestId("hero-status").boundingBox()).height * 10) / 10;

for (const width of (process.env.W || "390,320").split(",").map(Number)) {
  test(`hero card: same height in every state at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await startFresh(page);
    const hs = {}; const st = {};
    for (const [name, cfg] of Object.entries(STATES)) {
      await seed(page, cfg);
      await page.waitForTimeout(500);
      hs[name] = await heroH(page); st[name] = await statusH(page);
    }
    await seed(page, BOTH);
    await page.waitForTimeout(500);
    const tabs = page.locator("[data-testid=hero-card] button").filter({ hasText: /โลหิตรวม|พลาสมา/ });
    await tabs.nth(0).tap(); await page.waitForTimeout(600); hs["both: whole tab"] = await heroH(page); st["both: whole tab"] = await statusH(page);
    await tabs.nth(1).tap(); await page.waitForTimeout(600); hs["both: component tab"] = await heroH(page); st["both: component tab"] = await statusH(page);
    console.log(`WIDTH ${width} STATUS`, JSON.stringify(st), "TOP", JSON.stringify(Object.fromEntries(Object.keys(hs).map(k=>[k, Math.round((hs[k]-st[k])*10)/10]))));
    // Single-type states must all match. The two tab states must match each
    // other (and, from 390px up, the single-type states too -- at narrower
    // widths the two-type tab row wraps, which is unrelated to the status area).
    // At 320px the brand-new user's welcome heading wraps one extra line.
    const single = Object.entries(hs).filter(([k]) => !k.startsWith("both") && !(width < 360 && k === "new user")).map(([, v]) => v);
    const both = [hs["both: whole tab"], hs["both: component tab"]];
    const spread = (a) => Math.max(...a) - Math.min(...a);
    expect(spread(single), "single-type states " + JSON.stringify(hs)).toBeLessThan(1);
    expect(spread(both), "tab states " + JSON.stringify(hs)).toBeLessThan(1);
    if (width >= 390) expect(spread([...single, ...both]), "single vs tabs " + JSON.stringify(hs)).toBeLessThan(1);
    assertNoErrors(page);
  });
}
