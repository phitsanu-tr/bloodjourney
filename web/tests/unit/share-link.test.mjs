import test from "node:test";
import assert from "node:assert/strict";
import { app } from "./_load.mjs";

const achievement = (extra = {}) => ({ kind: "a", estVolumeMl: 700, sizeIdx: 0, totalCount: 2, akind: "p", tier: 0, threshold: 1, isMonk: false, bloodType: "O", bloodRh: "+", nickname: "แพรว", ...extra });
const record = (extra = {}) => ({ kind: "r", sizeIdx: 1, order: 3, date: "2026-06-01", timeStr: "09:30", type: "plasma", location: "รพ.", bloodType: "B", bloodRh: "-", nickname: "แพรว", ...extra });

test("achievement share link round-trips blood group, Rh, volume and nickname", async () => {
  for (const [type, rh] of [["O", "+"], ["AB", "-"], ["A", ""]]) {
    const d = await app.decodeShareToken(await app.encodeShareToken(achievement({ bloodType: type, bloodRh: rh })));
    assert.equal(d.kind, "a");
    assert.equal(d.bloodType, type);
    assert.equal(d.bloodRh, rh);
    assert.equal(d.estVolumeMl, 700);
    assert.equal(d.totalCount, 2);
  }
});

test("record share link round-trips blood group, Rh, date, time and place", async () => {
  for (const [type, rh] of [["B", "+"], ["O", "-"], ["O", ""]]) {
    const d = await app.decodeShareToken(await app.encodeShareToken(record({ bloodType: type, bloodRh: rh })));
    assert.equal(d.kind, "r");
    assert.equal(d.bloodType, type);
    assert.equal(d.bloodRh, rh);
    assert.equal(d.timeStr, "09:30");
    assert.equal(d.location, "รพ.");
    assert.equal(app.dateToLocalStr(d.dateObj), "2026-06-01");
  }
});

test("a tampered or garbage token is rejected, not decoded", async () => {
  const token = await app.encodeShareToken(achievement());
  const flipped = token.slice(0, 20) + (token[20] === "A" ? "B" : "A") + token.slice(21);
  assert.equal(await app.decodeShareToken(flipped), null);
  assert.equal(await app.decodeShareToken("not-a-token"), null);
  assert.equal(await app.decodeShareToken(""), null);
});
