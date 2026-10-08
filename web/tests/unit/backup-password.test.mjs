import test from "node:test";
import assert from "node:assert/strict";
import { generateBackupPassword, BACKUP_PW_KINDS } from "../../src/lib/backup.js";

test("generated backup password: 16 chars, all four kinds, no look-alikes, no spaces/quotes", () => {
  for (let i = 0; i < 2000; i++) {
    const pw = generateBackupPassword();
    assert.equal(pw.length, 16);
    for (const kind of BACKUP_PW_KINDS) assert.ok([...pw].some((c) => kind.includes(c)), `${pw} lacks a kind`);
    assert.ok(!/[0O1lI\s"'`\\<>-]/.test(pw), `${pw} has a look-alike or awkward character`);
  }
});

test("generated backup passwords differ and cover the whole alphabet (unbiased draw)", () => {
  const seen = new Set();
  const first = new Set();
  for (let i = 0; i < 3000; i++) { const pw = generateBackupPassword(); first.add(pw); for (const c of pw) seen.add(c); }
  assert.equal(first.size, 3000);
  assert.equal(seen.size, BACKUP_PW_KINDS.join("").length);
});
