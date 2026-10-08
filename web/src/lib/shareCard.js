import { DONATION_TYPES, normalizeDonationType, formatLiters } from "./donations.js";
import { parseLocalDate } from "./dates.js";

// Preset sizes matching how each platform actually displays a shared image,
// so the card isn't cropped awkwardly once posted.
export const CARD_SIZES = {
  square: { key: "square", w: 1080, h: 1080, label: "1:1", sub: "จัตุรัส • ฟีดโพสต์ Instagram / Facebook" },
  portrait45: { key: "portrait45", w: 1080, h: 1350, label: "4:5", sub: "แนวตั้ง • ฟีดโพสต์ Instagram / Facebook (เต็มจอมากขึ้น)" },
  story: { key: "story", w: 1080, h: 1920, label: "9:16", sub: "สตอรี่ • Instagram/Facebook Story, Reels, TikTok" },
  landscape: { key: "landscape", w: 1920, h: 1080, label: "16:9", sub: "แนวนอน • โพสต์แนวกว้าง, YouTube" },
};

export const DEFAULT_CARD_SIZE = "portrait45";

// --- Share-link token ---------------------------------------------------
// The external-browser download page (?dl=1&d=...) rebuilds the share card
// purely from what's in the URL, since LINE's embedded WebView and the
// external browser it opens are separate browser contexts with no shared
// storage — there's no way to hand off the already-generated image
// directly, only a small payload. Instead of named query params (kind=...,
// totalCount=..., nickname=...) the whole payload is packed into ONE
// AES-GCM encrypted token: nothing about its structure or contents is
// visible from the URL itself, it carries its own timestamp (for expiry)
// and its own tamper-check (GCM's authentication tag — decryption itself
// fails if a single byte was edited), so there's no separate signature
// param or field-by-field encoding to manage.
//
// Caveat (by design, not an oversight): the key is derived from a seed
// that ships inside the client JS bundle, same as any purely client-side
// app with no backend. Anyone willing to open dev tools and read the
// minified bundle can extract it and mint their own tokens too. This
// raises the bar against casual link-guessing/editing a lot further than
// plain query params did — it does not, and architecturally cannot,
// provide airtight protection without a server that independently knows
// the real donation data, which this local-storage-only app deliberately
// doesn't have.
export const SHARE_LINK_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const SHARE_LINK_TAG_BITS = 64; // AES-GCM default is 128; halving the auth

// tag halves its fixed per-token overhead. Forgery odds without the key go
// from ~1-in-2^128 to ~1-in-2^64 — astronomically still safe against
// someone editing a URL by hand, which is the actual threat model here.
export const SHARE_LINK_EPOCH_MS = Date.UTC(2025, 0, 1); // reference point for the

// The key seed isn't a plain string constant on purpose — a literal like
// `"bj-share-..."` sitting next to `crypto.subtle` / `"AES-GCM"` is exactly
// what a plain-text search of the built JS turns up first. Splitting it
// into three XOR-masked fragments (interleaved back together at runtime)
// doesn't make it a real secret — nothing shipped to the browser can be
// (see the note above) — but it means "search the bundle for a
// suspicious-looking string" no longer works, so extracting it takes
// actually tracing the code rather than a five-second Ctrl+F.
export const _skA = [57, 98, 60, 56, 60, 63, 111, 98, 99, 63, 56];

export const _skB = [108, 63, 56, 57, 107, 104, 98, 111, 99, 105, 110];

export const _skC = [105, 104, 110, 56, 105, 105, 108, 108, 110, 98];

export const _skMask = 0x5a;

export function _assembleShareLinkSeed() {
  const codes = [];
  let ai = 0, bi = 0, ci = 0;
  const total = _skA.length + _skB.length + _skC.length;
  for (let i = 0; i < total; i++) {
    const bucket = i % 3;
    codes.push(bucket === 0 ? _skA[ai++] : bucket === 1 ? _skB[bi++] : _skC[ci++]);
  }
  return codes.map((b) => String.fromCharCode(b ^ _skMask)).join("");
}

export let _shareLinkKeyPromise = null;

export function getShareLinkKey() {
  if (!_shareLinkKeyPromise) {
    _shareLinkKeyPromise = crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(_assembleShareLinkSeed()))
      .then((hash) => crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]));
  }
  return _shareLinkKeyPromise;
}

export function bytesToBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToBytes(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// --- Compact binary payload -------------------------------------------
// A JSON array (even the field-name-free version this replaces) still has
// syntax overhead — digits for a 13-digit millisecond timestamp, comma/
// quote characters — that costs real bytes once encrypted+base64'd.
// Packing the payload into a small byte buffer with fixed-width integers
// and bit-flags removes that overhead outright; nickname/location are the
// only genuinely variable-length parts left, since they're real user text
// with no formula to shrink them by.
//
// Byte layout (see openShareCardInExternalBrowser for how it's built):
//   [0]     flags — bit0 kind (0=record,1=achievement) | bits1-2 sizeIdx
//           | bit3 type/akind (0=whole|pin, 1=component|medal)
//           | bit4 isMonk (achievement) -- for a record, bit4 is the high bit of
//             the donation type: type index = bit3 | bit4<<1 (0=whole,1=plasma,
//             2=platelet,3=rbc). Older links never set bit4 on records, so their
//             "component" (bit3=1) reads as plasma and "whole" as whole.
//           | bits5-7 bloodType (0=A,1=B,2=AB,3=O,4=other)
//   [1..3]  minutes since SHARE_LINK_EPOCH_MS, uint24 big-endian (the
//           link's own timestamp, used for the expiry check)
//   achievement: [4..5] totalCount uint16 | [6] tier | [7] threshold
//                | [8..] nickname: 1-byte length + UTF-8 bytes
//                | [..]  estimated volume in 50 ml steps, uint16 (absent in
//                        links made before per-type volumes: totalCount*350)
//   record:      [4..5] order uint16 | [6..7] days-since-epoch uint16
//                | [8..9] minutes-since-midnight uint16 (0xFFFF = none)
//                | [..]  location: 1-byte length + UTF-8 bytes
//                | [..]  nickname: 1-byte length + UTF-8 bytes
export const BLOOD_TYPE_CODES = { A: 0, B: 1, AB: 2, O: 3 };

export const BLOOD_TYPE_FROM_CODE = ["A", "B", "AB", "O", ""];

// Rh rides as one trailing byte (1 = +, 2 = −; absent in older links), because the flags byte is full.
export const RH_TO_CODE = { "+": 1, "-": 2 };

export const RH_FROM_CODE = ["", "+", "-"];

// What a share card says after "หมู่โลหิต": the group, plus Rh only when it is known (same as the profile pill).
export function bloodCardLabel(bloodType, bloodRh) {
  if (!bloodType || bloodType === "ไม่ทราบ") return "";
  return bloodRh === "+" || bloodRh === "-" ? `${bloodType} Rh${bloodRh === "+" ? "+" : "−"}` : bloodType;
}

export function pushLenStr(out, str) {
  let bytes = Array.from(new TextEncoder().encode(str || ""));
  if (bytes.length > 255) bytes = bytes.slice(0, 255); // realistically only a pasted-in location could hit this
  out.push(bytes.length, ...bytes);
}

export function readLenStr(bytes, offset) {
  const len = bytes[offset];
  const str = new TextDecoder().decode(bytes.slice(offset + 1, offset + 1 + len));
  return [str, offset + 1 + len];
}

export function encodeSharePayload(payload) {
  const out = [];
  const sizeIdx = payload.sizeIdx & 0b11;
  const bloodCode = BLOOD_TYPE_CODES[payload.bloodType] ?? 4;
  const isAchievement = payload.kind === "a";
  const typeIdx = isAchievement ? 0 : Math.max(0, DONATION_TYPES.indexOf(normalizeDonationType(payload.type)));
  const flagBit3 = isAchievement ? (payload.akind === "m" ? 1 : 0) : (typeIdx & 1);
  const flagBit4 = isAchievement ? (payload.isMonk ? 1 : 0) : (typeIdx >> 1);
  const flags = (isAchievement ? 1 : 0) | (sizeIdx << 1) | (flagBit3 << 3)
    | (flagBit4 << 4) | (bloodCode << 5);
  out.push(flags & 0xff);

  const minutes = Math.max(0, Math.min(0xffffff, Math.round((Date.now() - SHARE_LINK_EPOCH_MS) / 60000)));
  out.push((minutes >> 16) & 0xff, (minutes >> 8) & 0xff, minutes & 0xff);

  if (isAchievement) {
    const totalCount = Number(payload.totalCount) || 0;
    out.push((totalCount >> 8) & 0xff, totalCount & 0xff, (Number(payload.tier) || 0) & 0xff, (Number(payload.threshold) || 0) & 0xff);
    pushLenStr(out, payload.nickname);
    const vol50 = Math.max(0, Math.min(0xffff, Math.round((Number(payload.estVolumeMl) || 0) / 50)));
    out.push((vol50 >> 8) & 0xff, vol50 & 0xff);
    out.push(RH_TO_CODE[payload.bloodRh] || 0);
  } else {
    const order = Number(payload.order) || 0;
    out.push((order >> 8) & 0xff, order & 0xff);
    // Days since the epoch of the donation's calendar date (its local year/month/day taken as a UTC day), so the
    // number does not depend on the sender's timezone; links made before this read the same for Thai senders.
    const local = payload.date ? parseLocalDate(payload.date) : null;
    const dayMs = local && !Number.isNaN(local.getTime()) ? Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()) : NaN;
    const days = Number.isFinite(dayMs) ? Math.max(0, Math.min(0xffff, Math.round((dayMs - SHARE_LINK_EPOCH_MS) / 86400000))) : 0;
    out.push((days >> 8) & 0xff, days & 0xff);
    let mins = 0xffff;
    if (payload.timeStr && /^\d{1,2}:\d{2}$/.test(payload.timeStr)) {
      const [h, m] = payload.timeStr.split(":").map(Number);
      mins = (h * 60 + m) & 0xffff;
    }
    out.push((mins >> 8) & 0xff, mins & 0xff);
    pushLenStr(out, payload.location);
    pushLenStr(out, payload.nickname);
    out.push(RH_TO_CODE[payload.bloodRh] || 0);
  }
  return new Uint8Array(out);
}

export function decodeSharePayload(bytes) {
  const flags = bytes[0];
  const kind = flags & 1 ? "a" : "r";
  const sizeIdx = (flags >> 1) & 0b11;
  const flagBit3 = (flags >> 3) & 1;
  const isMonk = !!((flags >> 4) & 1);
  const bloodType = BLOOD_TYPE_FROM_CODE[(flags >> 5) & 0b111] || "";
  const minutes = (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
  const ts = SHARE_LINK_EPOCH_MS + minutes * 60000;

  if (kind === "a") {
    const totalCount = (bytes[4] << 8) | bytes[5];
    const [nickname, off] = readLenStr(bytes, 8);
    const estVolumeMl = bytes.length >= off + 2 ? ((bytes[off] << 8) | bytes[off + 1]) * 50 : totalCount * 350;
    const bloodRh = bytes.length >= off + 3 ? RH_FROM_CODE[bytes[off + 2]] || "" : "";
    return { kind, sizeIdx, totalCount, estVolumeMl, tier: bytes[6], threshold: bytes[7], akind: flagBit3 ? "m" : "p", isMonk, bloodType, bloodRh, nickname, ts };
  }
  const order = (bytes[4] << 8) | bytes[5];
  const days = (bytes[6] << 8) | bytes[7];
  const minsOfDay = (bytes[8] << 8) | bytes[9];
  const [location, off] = readLenStr(bytes, 10);
  const [nickname, off2] = readLenStr(bytes, off);
  const bloodRh = bytes.length >= off2 + 1 ? RH_FROM_CODE[bytes[off2]] || "" : "";
  // The stored day is a calendar date: build it as a local date so a viewer west of UTC does not see the day before.
  const utcDay = new Date(SHARE_LINK_EPOCH_MS + days * 86400000);
  const dateObj = new Date(utcDay.getUTCFullYear(), utcDay.getUTCMonth(), utcDay.getUTCDate());
  const timeStr = minsOfDay === 0xffff ? "" : `${String(Math.floor(minsOfDay / 60)).padStart(2, "0")}:${String(minsOfDay % 60).padStart(2, "0")}`;
  return { kind, sizeIdx, order, dateObj, timeStr, type: DONATION_TYPES[flagBit3 | ((flags >> 4) & 1) << 1], location, bloodType, bloodRh, nickname, ts };
}

// Packs `payload` (see openShareCardInExternalBrowser for its shape) into
// the compact binary layout above, then AES-GCM encrypts it into one
// opaque, URL-safe token — this is what goes in the `d` param.
export async function encodeShareToken(payload) {
  const key = await getShareLinkKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encodeSharePayload(payload);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, tagLength: SHARE_LINK_TAG_BITS }, key, plaintext);
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return bytesToBase64Url(combined);
}

// Reverses encodeShareToken(): returns the decoded payload object if the
// token decrypts cleanly and isn't expired, or null if it's tampered,
// malformed, or too old to trust.
export async function decodeShareToken(token) {
  try {
    const key = await getShareLinkKey();
    const combined = base64UrlToBytes(token);
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: SHARE_LINK_TAG_BITS }, key, ciphertext);
    const payload = decodeSharePayload(new Uint8Array(plainBuf));
    const age = Date.now() - payload.ts;
    if (age > SHARE_LINK_TTL_MS || age < -60 * 1000) return null; // expired, or timestamp from the future beyond clock skew
    return payload;
  } catch (e) {
    return null; // wrong key, tampered ciphertext, or malformed token
  }
}

export function wrapCanvasText(ctx, text, maxWidth, maxLines) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines.slice(0, maxLines);
}

// Draws a single line of text shrunk to fit maxWidth (down to a floor size)
// instead of letting it overflow the canvas — used for the "โดย <nickname>"
// caption, which is free text (up to ~61 chars after two 30-char name
// fields are joined) with no wrap/measure guard elsewhere, unlike location
// and achievement description which already go through wrapCanvasText.
export function fillCanvasTextFit(ctx, text, x, y, maxWidth, weight, basePx, fontFamily, minPx = 14) {
  let px = basePx;
  ctx.font = `${weight} ${px}px ${fontFamily}`;
  while (px > minPx && ctx.measureText(text).width > maxWidth) {
    px -= 1;
    ctx.font = `${weight} ${px}px ${fontFamily}`;
  }
  ctx.fillText(text, x, y);
}

export function drawShareCardBackground(ctx, W, H) {
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#B5453B");
  grad.addColorStop(1, "#5E1F1A");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255,255,255,0.07)";
  const m = Math.min(W, H);
  [[0.13, 0.14, 0.19], [0.89, 0.17, 0.155], [0.17, 0.87, 0.22], [0.86, 0.91, 0.145]].forEach(([fx, fy, fr]) => {
    ctx.beginPath();
    ctx.arc(fx * W, fy * H, fr * m, 0, Math.PI * 2);
    ctx.fill();
  });
}

// Canvas counterparts of <PinIcon>/<MedalIcon>/<FanIcon> above, so the
// share-card PNG uses the same badge artwork as the Missions tab instead of
// a generic emoji. Drawn relative to (0,0) at the given radius `r`, then
// positioned via ctx.translate by the caller.
export function drawMedalBadgeCanvas(ctx, r, tier) {
  const RING_COLORS = { 1: "#D4AF37", 2: "#B7BCC4", 3: "#B08D57" };
  const ring = RING_COLORS[tier] || RING_COLORS[1];
  ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2); ctx.fillStyle = ring; ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.56, 0, Math.PI * 2); ctx.fillStyle = "#FFF7F0"; ctx.fill();
  const cw = r * 0.14, cl = r * 0.42;
  ctx.fillStyle = "#B3261E";
  ctx.fillRect(-cw / 2, -cl / 2, cw, cl);
  ctx.fillRect(-cl / 2, -cw / 2, cl, cw);
}

export function drawPinBadgeCanvas(ctx, r) {
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.05);
  ctx.bezierCurveTo(r * 0.75, -r * 0.55, r * 0.75, r * 0.35, 0, r * 0.85);
  ctx.bezierCurveTo(-r * 0.75, r * 0.35, -r * 0.75, -r * 0.55, 0, -r * 0.05);
  ctx.closePath();
  ctx.fillStyle = "#B3261E";
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(0, r * 0.12, r * 0.42, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#FFF7F0";
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, -r * 0.05);
  ctx.bezierCurveTo(r * 0.2, r * 0.18, r * 0.2, r * 0.38, 0, r * 0.42);
  ctx.bezierCurveTo(-r * 0.2, r * 0.38, -r * 0.2, r * 0.18, 0, -r * 0.05);
  ctx.closePath();
  ctx.fillStyle = "#B3261E";
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, -r * 0.95);
  ctx.lineTo(r * 0.28, -r * 0.6);
  ctx.lineTo(0, -r * 0.42);
  ctx.lineTo(-r * 0.28, -r * 0.6);
  ctx.closePath();
  ctx.fillStyle = "#E8C349";
  ctx.fill();

  const cw = r * 0.09, cl = r * 0.28;
  ctx.fillStyle = "#B3261E";
  ctx.fillRect(-cw / 2, -r * 0.85, cw, cl);
  ctx.fillRect(-cl * 0.4, -r * 0.75, cl * 0.8, cw);
}

export function drawFanBadgeCanvas(ctx, r) {
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.15, r * 0.7, r * 0.62, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#F5F1EA";
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.03);
  ctx.strokeStyle = "#C9A227";
  ctx.stroke();

  const cw = r * 0.14, cl = r * 0.42;
  ctx.fillStyle = "#B3261E";
  ctx.fillRect(-cw / 2, -r * 0.15 - cl / 2, cw, cl);
  ctx.fillRect(-cl / 2, -r * 0.15 - cw / 2, cl, cw);

  ctx.fillStyle = "#7a5230";
  ctx.fillRect(-r * 0.03, r * 0.42, r * 0.06, r * 0.5);
}

// achievement here carries { kind, tier, isMonk } — see openShareCard().
export function drawAchievementBadge(ctx, cx, cy, r, achievement) {
  ctx.save();
  ctx.translate(cx, cy);
  if (achievement.kind === "pin") {
    drawPinBadgeCanvas(ctx, r);
  } else if (achievement.isMonk) {
    drawFanBadgeCanvas(ctx, r);
  } else {
    drawMedalBadgeCanvas(ctx, r, achievement.tier);
  }
  ctx.restore();
}

// Portrait/square layout (1:1, 4:5, 9:16 all share width 1080). The design
// was tuned for 1080x1350 (4:5); shorter canvases (square) scale everything
// down proportionally to fit, taller canvases (story) keep the same size
// content vertically centered instead of stretching it thin.
export function drawPortraitShareCard(ctx, W, H, FONT, { totalCount, achievement, liters, bloodType, nickname }) {
  const BASE_H = 1350;
  const scale = H < BASE_H ? H / BASE_H : 1;
  const offsetY = H > BASE_H ? (H - BASE_H) / 2 : 0;
  const Y = (y) => y * scale + offsetY;
  const F = (px) => Math.max(10, Math.round(px * scale));

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#FFF7F5";

  ctx.font = `700 ${F(46)}px ${FONT}`;
  ctx.fillText("Blood Journey", W / 2, Y(150));
  ctx.font = `400 ${F(26)}px ${FONT}`;
  ctx.globalAlpha = 0.85;
  ctx.fillText("บันทึกบริจาคโลหิต", W / 2, Y(192));
  ctx.globalAlpha = 1;

  ctx.beginPath();
  ctx.arc(W / 2, Y(480), 165 * scale, 0, Math.PI * 2);
  ctx.fillStyle = "#FFF7F5";
  ctx.fill();
  drawAchievementBadge(ctx, W / 2, Y(480), 150 * scale, achievement);

  ctx.fillStyle = "#FFF7F5";
  ctx.font = `700 ${F(54)}px ${FONT}`;
  ctx.fillText(achievement.title, W / 2, Y(750));

  ctx.font = `400 ${F(30)}px ${FONT}`;
  ctx.globalAlpha = 0.88;
  const descLines = wrapCanvasText(ctx, achievement.desc, 820, 2);
  ctx.fillText(descLines[0] || "", W / 2, Y(795));
  if (descLines[1]) ctx.fillText(descLines[1], W / 2, Y(835));
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#FFF7F5";
  ctx.font = `700 ${F(150)}px ${FONT}`;
  ctx.fillText(String(totalCount), W / 2, Y(1015));
  ctx.font = `400 ${F(32)}px ${FONT}`;
  ctx.globalAlpha = 0.9;
  ctx.fillText("ครั้งที่บริจาคโลหิตสะสม", W / 2, Y(1060));
  ctx.globalAlpha = 1;

  const statParts = [`🩸 ประมาณ ${liters} ลิตร`];
  if (bloodType && bloodType !== "ไม่ทราบ") statParts.push(`หมู่โลหิต ${bloodType}`);
  ctx.font = `600 ${F(30)}px ${FONT}`;
  ctx.fillText(statParts.join("   •   "), W / 2, Y(1135));

  if (nickname) {
    ctx.globalAlpha = 0.85;
    fillCanvasTextFit(ctx, `โดย ${nickname}`, W / 2, Y(1178), W * 0.8, 400, F(26), FONT, F(14));
    ctx.globalAlpha = 1;
  }

  ctx.strokeStyle = "rgba(255,247,245,0.3)";
  ctx.beginPath();
  ctx.moveTo(W / 2 - 120 * scale, Y(1240));
  ctx.lineTo(W / 2 + 120 * scale, Y(1240));
  ctx.stroke();
  ctx.font = `400 ${F(24)}px ${FONT}`;
  ctx.globalAlpha = 0.7;
  const dateText = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
  ctx.fillText(dateText, W / 2, Y(1285));
  ctx.globalAlpha = 1;
}

// Landscape layout (16:9) — a portrait card just stretched sideways would
// leave huge dead space, so this arranges the medallion on the left and the
// stats as a left-aligned text block on the right instead.
export function drawLandscapeShareCard(ctx, W, H, FONT, { totalCount, achievement, liters, bloodType, nickname }) {
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#FFF7F5";

  ctx.textAlign = "left";
  ctx.font = `700 42px ${FONT}`;
  ctx.fillText("Blood Journey", 90, 120);
  ctx.font = `400 24px ${FONT}`;
  ctx.globalAlpha = 0.85;
  ctx.fillText("บันทึกบริจาคโลหิต", 90, 155);
  ctx.globalAlpha = 1;

  const cx = W * 0.24, cy = H * 0.58, r = H * 0.24;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#FFF7F5";
  ctx.fill();
  drawAchievementBadge(ctx, cx, cy, r * 0.92, achievement);

  const textX = W * 0.46;
  const maxTextWidth = W - textX - 90;
  ctx.textAlign = "left";
  ctx.fillStyle = "#FFF7F5";
  ctx.font = `700 50px ${FONT}`;
  ctx.fillText(achievement.title, textX, H * 0.32);

  ctx.font = `400 28px ${FONT}`;
  ctx.globalAlpha = 0.88;
  const descLines = wrapCanvasText(ctx, achievement.desc, maxTextWidth, 2);
  ctx.fillText(descLines[0] || "", textX, H * 0.32 + 45);
  if (descLines[1]) ctx.fillText(descLines[1], textX, H * 0.32 + 82);
  ctx.globalAlpha = 1;

  const numberY = H * 0.68;
  ctx.font = `700 120px ${FONT}`;
  ctx.fillText(String(totalCount), textX, numberY);
  ctx.font = `400 28px ${FONT}`;
  ctx.globalAlpha = 0.9;
  ctx.fillText("ครั้งที่บริจาคโลหิตสะสม", textX, numberY + 42);
  ctx.globalAlpha = 1;

  const statParts = [`🩸 ประมาณ ${liters} ลิตร`];
  if (bloodType && bloodType !== "ไม่ทราบ") statParts.push(`หมู่โลหิต ${bloodType}`);
  ctx.font = `600 26px ${FONT}`;
  ctx.fillText(statParts.join("   •   "), textX, numberY + 86);

  if (nickname) {
    ctx.globalAlpha = 0.85;
    fillCanvasTextFit(ctx, `โดย ${nickname}`, textX, numberY + 122, maxTextWidth, 400, 24, FONT, 14);
    ctx.globalAlpha = 1;
  }

  ctx.textAlign = "right";
  ctx.font = `400 22px ${FONT}`;
  ctx.globalAlpha = 0.7;
  const dateText = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
  ctx.fillText(dateText, W - 90, H - 60);
  ctx.globalAlpha = 1;
}

// Traces the same droplet silhouette used throughout the app's own UI
// (viewBox 0 0 24 24, tip at (12,2)) as a Canvas 2D path centered at
// (cx, cy) with the given radius, so the share-card badge matches the
// droplet icon shown on each history list item.
export function tracDropletPath(ctx, cx, cy, r) {
  const s = r / 11;
  const px = (x, y) => [cx + (x - 12) * s, cy + (y - 12) * s];
  ctx.beginPath();
  const start = px(12, 2);
  ctx.moveTo(start[0], start[1]);
  let c1 = px(12, 2), c2 = px(4, 12.5), e = px(4, 17);
  ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], e[0], e[1]);
  c1 = px(4, 21); c2 = px(7.6, 24); e = px(12, 24);
  ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], e[0], e[1]);
  c1 = px(16.4, 24); c2 = px(20, 21); e = px(20, 17);
  ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], e[0], e[1]);
  c1 = px(20, 12.5); c2 = px(12, 2); e = px(12, 2);
  ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], e[0], e[1]);
  ctx.closePath();
}

// Badge for a single-record share card: a droplet (matching the history
// list's own icon) with the record's sequence number ("ครั้งที่ N") inside,
// drawn the same way drawAchievementBadge draws a medal/pin/fan badge.
export function drawRecordBadge(ctx, cx, cy, r, order) {
  tracDropletPath(ctx, cx, cy, r);
  ctx.fillStyle = "#9A3B33";
  ctx.fill();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#FFF7F5";
  ctx.font = `800 ${Math.round(r * 0.62)}px 'Mitr', 'Inter', sans-serif`;
  ctx.fillText(String(order), cx, cy - r * 0.08);
  ctx.font = `400 ${Math.round(r * 0.19)}px 'Mitr', 'Inter', sans-serif`;
  ctx.globalAlpha = 0.85;
  ctx.fillText("ครั้งที่", cx, cy + r * 0.32);
  ctx.globalAlpha = 1;
  ctx.textBaseline = "alphabetic";
}

export function drawRoundedPill(ctx, cx, y, text, font, fillStyle, textColor) {
  ctx.font = font;
  const padX = 34;
  const h = 62;
  const w = ctx.measureText(text).width + padX * 2;
  const x = cx - w / 2;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, h / 2);
  else ctx.rect(x, y, w, h);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, y + h / 2 + 2);
  ctx.textBaseline = "alphabetic";
}

// Portrait/square layout for a single donation record card — mirrors the
// structure of drawPortraitShareCard (same header, badge position, divider,
// footer) but the content is this one record instead of overall totals.
export function drawPortraitRecordCard(ctx, W, H, FONT, { order, dateStr, timeStr, typeLabel, location, bloodType, nickname }) {
  const BASE_H = 1350;
  const scale = H < BASE_H ? H / BASE_H : 1;
  const offsetY = H > BASE_H ? (H - BASE_H) / 2 : 0;
  const Y = (y) => y * scale + offsetY;
  const F = (px) => Math.max(10, Math.round(px * scale));

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#FFF7F5";

  ctx.font = `700 ${F(46)}px ${FONT}`;
  ctx.fillText("Blood Journey", W / 2, Y(150));
  ctx.font = `400 ${F(26)}px ${FONT}`;
  ctx.globalAlpha = 0.85;
  ctx.fillText("บันทึกบริจาคโลหิต", W / 2, Y(192));
  ctx.globalAlpha = 1;

  ctx.beginPath();
  ctx.arc(W / 2, Y(480), 165 * scale, 0, Math.PI * 2);
  ctx.fillStyle = "#FFF7F5";
  ctx.fill();
  drawRecordBadge(ctx, W / 2, Y(480), 150 * scale, order);

  ctx.fillStyle = "#FFF7F5";
  ctx.font = `700 ${F(50)}px ${FONT}`;
  ctx.fillText(dateStr, W / 2, Y(760));

  ctx.font = `400 ${F(28)}px ${FONT}`;
  ctx.globalAlpha = 0.85;
  ctx.fillText(timeStr ? `เวลา ${timeStr} น.` : "บันทึกการบริจาคโลหิต", W / 2, Y(802));
  ctx.globalAlpha = 1;

  drawRoundedPill(ctx, W / 2, Y(855) - 31 * scale, typeLabel, `600 ${F(30)}px ${FONT}`, "rgba(255,247,245,0.18)", "#FFF7F5");

  let lineY = 1000;
  if (location) {
    ctx.globalAlpha = 0.85;
    fillCanvasTextFit(ctx, location, W / 2, Y(lineY), 780, 400, F(28), FONT, F(16));
    ctx.globalAlpha = 1;
    lineY += 48;
  }
  if (bloodType && bloodType !== "ไม่ทราบ") {
    ctx.font = `600 ${F(28)}px ${FONT}`;
    ctx.globalAlpha = 0.9;
    ctx.fillText(`หมู่โลหิต ${bloodType}`, W / 2, Y(lineY));
    ctx.globalAlpha = 1;
  }

  if (nickname) {
    ctx.globalAlpha = 0.85;
    fillCanvasTextFit(ctx, `โดย ${nickname}`, W / 2, Y(1178), W * 0.8, 400, F(26), FONT, F(14));
    ctx.globalAlpha = 1;
  }

  ctx.strokeStyle = "rgba(255,247,245,0.3)";
  ctx.beginPath();
  ctx.moveTo(W / 2 - 120 * scale, Y(1240));
  ctx.lineTo(W / 2 + 120 * scale, Y(1240));
  ctx.stroke();
  ctx.font = `400 ${F(24)}px ${FONT}`;
  ctx.globalAlpha = 0.7;
  ctx.fillText("บันทึกด้วย Blood Journey", W / 2, Y(1285));
  ctx.globalAlpha = 1;
}

// Landscape layout (16:9) for a single donation record card — mirrors
// drawLandscapeShareCard's left-badge / right-text arrangement.
export function drawLandscapeRecordCard(ctx, W, H, FONT, { order, dateStr, timeStr, typeLabel, location, bloodType, nickname }) {
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#FFF7F5";

  ctx.textAlign = "left";
  ctx.font = `700 42px ${FONT}`;
  ctx.fillText("Blood Journey", 90, 120);
  ctx.font = `400 24px ${FONT}`;
  ctx.globalAlpha = 0.85;
  ctx.fillText("บันทึกบริจาคโลหิต", 90, 155);
  ctx.globalAlpha = 1;

  const cx = W * 0.24, cy = H * 0.55, r = H * 0.24;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#FFF7F5";
  ctx.fill();
  drawRecordBadge(ctx, cx, cy, r * 0.92, order);

  const textX = W * 0.46;
  const maxTextWidth = W - textX - 90;
  ctx.textAlign = "left";
  ctx.fillStyle = "#FFF7F5";
  ctx.font = `700 48px ${FONT}`;
  ctx.fillText(dateStr, textX, H * 0.34);

  ctx.font = `400 26px ${FONT}`;
  ctx.globalAlpha = 0.85;
  ctx.fillText(timeStr ? `เวลา ${timeStr} น.` : "บันทึกการบริจาคโลหิต", textX, H * 0.34 + 40);
  ctx.globalAlpha = 1;

  ctx.font = `600 26px ${FONT}`;
  drawRoundedPill(ctx, textX + Math.min(ctx.measureText(typeLabel).width / 2 + 34, maxTextWidth / 2), H * 0.34 + 95, typeLabel, `600 26px ${FONT}`, "rgba(255,247,245,0.18)", "#FFF7F5");
  ctx.textAlign = "left";

  let lineY = H * 0.34 + 170;
  if (location) {
    ctx.globalAlpha = 0.85;
    fillCanvasTextFit(ctx, location, textX, lineY, maxTextWidth, 400, 26, FONT, 16);
    ctx.globalAlpha = 1;
    lineY += 40;
  }
  if (bloodType && bloodType !== "ไม่ทราบ") {
    ctx.font = `600 26px ${FONT}`;
    ctx.globalAlpha = 0.9;
    ctx.fillText(`หมู่โลหิต ${bloodType}`, textX, lineY);
    ctx.globalAlpha = 1;
  }

  if (nickname) {
    ctx.globalAlpha = 0.85;
    fillCanvasTextFit(ctx, `โดย ${nickname}`, textX, H - 90, maxTextWidth, 400, 24, FONT, 14);
    ctx.globalAlpha = 1;
  }

  ctx.textAlign = "right";
  ctx.font = `400 22px ${FONT}`;
  ctx.globalAlpha = 0.7;
  ctx.fillText("บันทึกด้วย Blood Journey", W - 90, H - 60);
  ctx.globalAlpha = 1;
}

// A canvas never fetches a font by itself: text drawn in a Mitr weight / script that no screen has used yet would come out in
// the system font. Ask for every face the cards use (Thai + digits/Latin in the three weights) and wait until they are in.
async function ensureCardFonts() {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    if (document.fonts.load) {
      await Promise.all(["400", "600", "700"].flatMap((w) => [document.fonts.load(`${w} 24px Mitr`, "ก"), document.fonts.load(`${w} 24px Mitr`, "0A")]));
    }
    if (document.fonts.ready) await document.fonts.ready;
  } catch (e) {}
}

// Draws a shareable card for a single donation record (date, sequence
// number, type, location) — same canvas-only approach as buildShareCardDataUrl
// below, kept as a separate function so the achievement-card flow is untouched.
export async function buildRecordShareCardDataUrl({ order, dateStr, timeStr, typeLabel, location, bloodType, bloodRh, nickname, width, height }) {
  if (typeof document === "undefined") throw new Error("no document");
  await ensureCardFonts();
  const W = width || 1080, H = height || 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  const FONT = "'Mitr', 'Inter', sans-serif";

  drawShareCardBackground(ctx, W, H);
  const content = { order, dateStr, timeStr, typeLabel, location, bloodType: bloodCardLabel(bloodType, bloodRh), nickname };

  if (W > H) {
    drawLandscapeRecordCard(ctx, W, H, FONT, content);
  } else {
    drawPortraitRecordCard(ctx, W, H, FONT, content);
  }

  return canvas.toDataURL("image/png");
}

// Draws a shareable "achievement card" entirely with the Canvas 2D API (no
// external library needed — safe to run inside any sandbox) and returns a
// PNG data URL, sized to whichever social-media preset was requested.
export async function buildShareCardDataUrl({ totalCount, achievement, estVolumeMl, bloodType, bloodRh, nickname, width, height }) {
  if (typeof document === "undefined") throw new Error("no document");
  await ensureCardFonts();
  const W = width || 1080, H = height || 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  const FONT = "'Mitr', 'Inter', sans-serif";

  drawShareCardBackground(ctx, W, H);
  const liters = formatLiters(estVolumeMl); // same function as the dashboard (a second formula here showed 0.3 for 350 ml, the dashboard 0.4)
  const content = { totalCount, achievement, liters, bloodType: bloodCardLabel(bloodType, bloodRh), nickname };

  if (W > H) {
    drawLandscapeShareCard(ctx, W, H, FONT, content);
  } else {
    drawPortraitShareCard(ctx, W, H, FONT, content);
  }

  return canvas.toDataURL("image/png");
}
