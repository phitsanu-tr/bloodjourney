import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Droplet, Plus, PlusCircle, Calendar, MapPin, Trash2, Pencil, Download, Upload, ShieldCheck, X, Info, CheckCircle2, Clock, Home, BarChart3, Award, Gauge, Trophy, Lock, BookOpen, Sparkles, Moon, Utensils, GlassWater, Beef, CreditCard, Timer, Dumbbell, HeartPulse, AlertTriangle, User, Scale, Cake, Droplets, Share2, StickyNote, MoreVertical, Settings } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

const THAI_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const APP_VERSION = "1.0.0";
const CONSENT_VERSION = "v1";
const CYCLE_DAYS = 90;
const MIN_AGE = 17;
const MAX_AGE = 70;
const MIN_WEIGHT = 50;
const MAX_STARTING_COUNT = 999;
const BLOOD_TYPES = ["A", "B", "AB", "O", "ไม่ทราบ"];
const HISTORY_PAGE_SIZE = 10;
const MAX_LOCATION_LEN = 60;
const MAX_NOTE_LEN = 120;
const BACKUP_REMINDER_GAP = 3;

function toBuddhistDate(d) {
  const date = new Date(d);
  return `${date.getDate()} ${THAI_MONTHS[date.getMonth()]} ${date.getFullYear() + 543}`;
}
function toBuddhistDateTime(d) {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${toBuddhistDate(date)} เวลา ${hh}:${mm} น.`;
}
function daysBetween(a, b) {
  return Math.round((b.setHours(0,0,0,0) - a.setHours(0,0,0,0)) / 86400000);
}
// Relative "บันทึกเมื่อ..." wording for recent timestamps (loggedAt /
// startingCountUpdatedAt) — matches the common X/Twitter-style convention:
// relative wording (minutes/hours) within the first 24 hours, then straight
// to the full Buddhist date+time after that — no special "เมื่อวานนี้" step.
// Note: this doesn't re-render on a timer by itself, so "เมื่อสักครู่" etc.
// only updates when something else causes the component to re-render —
// acceptable for this lightweight metadata line.
function formatLoggedAt(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return toBuddhistDateTime(date);
  const diffMin = Math.floor(diffMs / 60000);
  // Note: these fragments are appended after the fixed "บันทึกเมื่อ" label in
  // the UI, so they deliberately omit their own leading "เมื่อ" (e.g.
  // "สักครู่") — otherwise it reads as "บันทึกเมื่อ เมื่อสักครู่" with "เมื่อ"
  // doubled up.
  if (diffMin < 1) return "สักครู่";
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} ชั่วโมงที่แล้ว`;
  if (diffHr === 24) return "1 วันที่แล้ว";
  return toBuddhistDateTime(date);
}
// Joins a label ("บันทึกเมื่อ" / "แก้ไขล่าสุดเมื่อ") with formatLoggedAt's
// result. Thai doesn't put a space before a plain word like "สักครู่" (it
// should read as one phrase, "บันทึกเมื่อสักครู่"), but a space before a
// number-led fragment ("5 นาทีที่แล้ว", a full date) keeps those readable —
// so only "สักครู่" attaches directly, everything else gets a space.
function joinLoggedLabel(label, iso) {
  const rel = formatLoggedAt(iso);
  if (!rel) return label;
  return rel === "สักครู่" ? `${label}สักครู่` : `${label} ${rel}`;
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function buddhistYear(dateStr) {
  return new Date(dateStr).getFullYear() + 543;
}
function startOfToday() {
  const d = new Date();
  d.setHours(0,0,0,0);
  return d;
}

// Storage adapter: prefers the Claude artifact `window.storage` bridge when it
// works, but transparently falls back to localStorage (and finally an
// in-memory object) whenever that bridge is missing OR throws for any reason
// (quota, network, running outside an artifact preview, etc). This keeps the
// app usable everywhere it might be opened, and mirrors the real localStorage
// implementation this app will use once it's a standalone LIFF page.
const memoryStore = {};
const LS_PREFIX = "bloodjourney:";
const storage = {
  async get(key) {
    try {
      if (typeof window !== "undefined" && window.storage && typeof window.storage.get === "function") {
        const res = await window.storage.get(key, false);
        if (res && typeof res.value !== "undefined" && res.value !== null) return res;
      }
    } catch (e) {}
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const raw = window.localStorage.getItem(LS_PREFIX + key);
        if (raw !== null) return { value: raw };
      }
    } catch (e) {}
    if (Object.prototype.hasOwnProperty.call(memoryStore, key)) return { value: memoryStore[key] };
    return null;
  },
  async set(key, value) {
    try {
      if (typeof window !== "undefined" && window.storage && typeof window.storage.set === "function") {
        await window.storage.set(key, value, false);
        return;
      }
    } catch (e) {}
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(LS_PREFIX + key, value);
        return;
      }
    } catch (e) {}
    memoryStore[key] = value;
  },
  async delete(key) {
    try {
      if (typeof window !== "undefined" && window.storage && typeof window.storage.delete === "function") {
        await window.storage.delete(key, false);
        return;
      }
    } catch (e) {}
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(LS_PREFIX + key);
        return;
      }
    } catch (e) {}
    delete memoryStore[key];
  },
};

// Donor type affects only the wording of the tier-3/2/1 awards — medals for
// general donors, ceremonial fans (พัดกาชาด) for Buddhist monks — per the
// Thai Red Cross National Blood Centre's official criteria:
// หลักเกณฑ์การมอบเข็มที่ระลึกและเหรียญกาชาดสมนาคุณ
// https://thaibloodcentre.redcross.or.th/credit-milestones-for-donor/
const DONOR_TYPES = [
  { key: "general", label: "บุคคลทั่วไป" },
  { key: "monk", label: "พระภิกษุสงฆ์" },
];
const DEFAULT_DONOR_TYPE = "general";

const PIN_MILESTONES = [1, 7, 16, 24, 36, 48, 60, 72, 84, 96, 108];
const MEDAL_TIERS = [
  { threshold: 50, tier: 3 },
  { threshold: 75, tier: 2 },
  { threshold: 100, tier: 1 },
];

// Builds the full milestone list (เข็มที่ระลึก + เหรียญ/พัดกาชาด) for the
// given donor type, sorted ascending by donation count. Visuals for each are
// rendered separately by <AchievementIcon> (DOM) and drawAchievementBadge()
// (canvas share card) based on `kind`/`tier`, styled after the real Thai Red
// Cross pin/medal/fan designs.
function buildAchievements(donorType) {
  const isMonk = donorType === "monk";
  const pins = PIN_MILESTONES.map((n) => ({
    id: `pin-${n}`,
    threshold: n,
    kind: "pin",
    title: n === 1 ? "หยดแรก" : `เข็มที่ระลึก ครั้งที่ ${n}`,
    desc: n === 1 ? "บริจาคเลือดครั้งแรกของคุณ" : `บริจาคโลหิตครบ ${n} ครั้ง`,
  }));
  const medals = MEDAL_TIERS.map(({ threshold, tier }) => ({
    id: `medal-${tier}`,
    threshold,
    kind: "medal",
    tier,
    title: isMonk ? `พัดกาชาด ชั้นที่ ${tier}` : `เหรียญกาชาดสมนาคุณ ชั้นที่ ${tier}`,
    desc: `บริจาคโลหิตครบ ${threshold} ครั้ง`,
  }));
  return [...pins, ...medals].sort((a, b) => a.threshold - b.threshold);
}

// Custom badge icons styled after the real Thai Red Cross designs: a
// heart-shaped enamel pin with a gold cross-topped crown for เข็มที่ระลึก, a
// ribboned circular medallion (gold/silver/bronze by tier) for เหรียญกาชาด
// สมนาคุณ, and a ceremonial hand fan on a stand for พัดกาชาด (monks). Drawn
// as inline SVG rather than referencing any real photo/artwork directly.
function PinIcon({ size = 22 }) {
  return (
    <svg width={size} height={Math.round(size * 1.15)} viewBox="0 0 32 37" fill="none" aria-hidden="true">
      <path d="M16 2 L19 8 L26 8 L20 12 L22 18 L16 14 L10 18 L12 12 L6 8 L13 8 Z" fill="#E8C349" stroke="#A9821E" strokeWidth="0.6" />
      <rect x="14.3" y="3.5" width="3.4" height="6.5" fill="#B3261E" />
      <path d="M16 14 C16 14 6 20.5 6 27 C6 31.7 10.7 35 16 35 C21.3 35 26 31.7 26 27 C26 20.5 16 14 16 14 Z" fill="#C0392B" stroke="#A9821E" strokeWidth="1" />
      <ellipse cx="16" cy="24.5" rx="7" ry="8" fill="#FFF7F0" />
      <path d="M16 19.5 C16 19.5 12 24.5 12 27 C12 28.9 13.8 30.5 16 30.5 C18.2 30.5 20 28.9 20 27 C20 24.5 16 19.5 16 19.5 Z" fill="#8A1620" />
    </svg>
  );
}

function MedalIcon({ tier = 1, size = 24 }) {
  const RING_COLORS = { 1: "#D4AF37", 2: "#B7BCC4", 3: "#B08D57" };
  const ring = RING_COLORS[tier] || RING_COLORS[1];
  return (
    <svg width={size} height={Math.round(size * 1.2)} viewBox="0 0 28 34" fill="none" aria-hidden="true">
      <rect x="10" y="0" width="8" height="13" fill="#F5F1EA" stroke="#D8C9A8" strokeWidth="0.5" />
      <circle cx="14" cy="23" r="9.5" fill={ring} stroke="#7a6320" strokeWidth="0.8" />
      <circle cx="14" cy="23" r="6.6" fill="#FFF7F0" />
      <path d="M11 23 h2.2v-2.2h1.6v2.2h2.2v1.6h-2.2v2.2h-1.6v-2.2h-2.2z" fill="#B3261E" />
    </svg>
  );
}

function FanIcon({ size = 24 }) {
  return (
    <svg width={size} height={Math.round(size * 1.4)} viewBox="0 0 24 34" fill="none" aria-hidden="true">
      <ellipse cx="12" cy="9" rx="9" ry="8" fill="#F5F1EA" stroke="#C9A227" strokeWidth="1" />
      <path d="M8.6 9 h2.4v-2.4h1.6v2.4h2.4v1.6h-2.4v2.4h-1.6v-2.4h-2.4z" fill="#B3261E" />
      <rect x="11" y="17" width="2" height="11" fill="#7a5230" />
      <rect x="6" y="28" width="12" height="3" rx="1" fill="#8a5a35" />
    </svg>
  );
}

function AchievementIcon({ achievement, isMonk, size = 22 }) {
  if (achievement.kind === "pin") return <PinIcon size={size} />;
  if (isMonk) return <FanIcon size={size} />;
  return <MedalIcon tier={achievement.tier} size={size} />;
}

const PRE_DONATION_TIPS = [
  { icon: Moon, text: "นอนหลับพักผ่อนให้เพียงพอ อย่างน้อย 6 ชั่วโมงก่อนวันบริจาค" },
  { icon: Utensils, text: "ทานอาหารมาก่อน ห้ามบริจาคขณะท้องว่าง" },
  { icon: GlassWater, text: "ดื่มน้ำเพิ่มอีก 3-4 แก้วก่อนไปบริจาค" },
  { icon: Beef, text: "งดอาหารไขมันสูงในมื้อก่อนบริจาค" },
  { icon: CreditCard, text: "พกบัตรประชาชนตัวจริงไปด้วยทุกครั้ง" },
];

const POST_DONATION_TIPS = [
  { icon: Timer, text: "นั่งพักตามคำแนะนำของเจ้าหน้าที่ ประมาณ 10-15 นาที ก่อนลุกเดิน" },
  { icon: GlassWater, text: "ดื่มน้ำหรือเครื่องดื่มที่จุดบริการเพิ่มเติม" },
  { icon: Dumbbell, text: "งดยกของหนักหรือออกกำลังกายหนักในวันนั้น" },
  { icon: HeartPulse, text: "หากมีอาการวิงเวียน ใจสั่น ให้รีบนั่งหรือนอนราบและแจ้งเจ้าหน้าที่ทันที" },
];

const ELIGIBILITY_CRITERIA = [
  { icon: Cake, text: "อายุระหว่าง 17-70 ปี" },
  { icon: Scale, text: "น้ำหนักไม่ต่ำกว่า 45 กิโลกรัม" },
  { icon: Clock, text: "เว้นระยะห่างจากการบริจาคครั้งก่อนอย่างน้อย 90 วัน" },
  { icon: AlertTriangle, text: "ไม่มีไข้หรืออาการป่วยในช่วง 14 วันที่ผ่านมา" },
  { icon: ShieldCheck, text: "ไม่มีพฤติกรรมเสี่ยงตามเกณฑ์ของสภากาชาดไทย" },
];

const DONATION_MYTHS = [
  { icon: Info, text: "เข้าใจผิด: บริจาคเลือดแล้วจะอ้วนขึ้นหรือผอมลง — ความจริงคือไม่มีผลต่อน้ำหนักตัวโดยตรง" },
  { icon: Info, text: "เข้าใจผิด: บริจาคเลือดทำให้ร่างกายอ่อนแอถาวร — ความจริงคือร่างกายสร้างเลือดทดแทนได้ภายในไม่กี่สัปดาห์" },
  { icon: Info, text: "เข้าใจผิด: คนมีรอยสักหรือเจาะร่างกายบริจาคไม่ได้เลย — ความจริงคือบริจาคได้หากพ้นระยะเวลาที่กำหนด (สอบถามเจ้าหน้าที่)" },
];

const DONATION_BENEFITS = [
  { icon: HeartPulse, text: "กระตุ้นการสร้างเม็ดเลือดใหม่ในร่างกาย" },
  { icon: Gauge, text: "ได้ตรวจสุขภาพเบื้องต้นฟรีทุกครั้ง (ความดัน ชีพจร ฮีโมโกลบิน)" },
  { icon: Sparkles, text: "ช่วยเหลือผู้ป่วยที่ต้องการโลหิตในการรักษา" },
];

// Preset sizes matching how each platform actually displays a shared image,
// so the card isn't cropped awkwardly once posted.
const CARD_SIZES = {
  square: { key: "square", w: 1080, h: 1080, label: "1:1", sub: "จัตุรัส • ฟีดโพสต์ Instagram / Facebook" },
  portrait45: { key: "portrait45", w: 1080, h: 1350, label: "4:5", sub: "แนวตั้ง • ฟีดโพสต์ Instagram / Facebook (เต็มจอมากขึ้น)" },
  story: { key: "story", w: 1080, h: 1920, label: "9:16", sub: "สตอรี่ • Instagram/Facebook Story, Reels, TikTok" },
  landscape: { key: "landscape", w: 1920, h: 1080, label: "16:9", sub: "แนวนอน • โพสต์แนวกว้าง, YouTube" },
};
const DEFAULT_CARD_SIZE = "portrait45";

function wrapCanvasText(ctx, text, maxWidth, maxLines) {
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

function drawShareCardBackground(ctx, W, H) {
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
function drawMedalBadgeCanvas(ctx, r, tier) {
  const RING_COLORS = { 1: "#D4AF37", 2: "#B7BCC4", 3: "#B08D57" };
  const ring = RING_COLORS[tier] || RING_COLORS[1];
  ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2); ctx.fillStyle = ring; ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.56, 0, Math.PI * 2); ctx.fillStyle = "#FFF7F0"; ctx.fill();
  const cw = r * 0.14, cl = r * 0.42;
  ctx.fillStyle = "#B3261E";
  ctx.fillRect(-cw / 2, -cl / 2, cw, cl);
  ctx.fillRect(-cl / 2, -cw / 2, cl, cw);
}

function drawPinBadgeCanvas(ctx, r) {
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.05);
  ctx.bezierCurveTo(r * 0.75, -r * 0.55, r * 0.75, r * 0.35, 0, r * 0.85);
  ctx.bezierCurveTo(-r * 0.75, r * 0.35, -r * 0.75, -r * 0.55, 0, -r * 0.05);
  ctx.closePath();
  ctx.fillStyle = "#C0392B";
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
  ctx.fillStyle = "#8A1620";
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

function drawFanBadgeCanvas(ctx, r) {
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
function drawAchievementBadge(ctx, cx, cy, r, achievement) {
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
function drawPortraitShareCard(ctx, W, H, FONT, { totalCount, achievement, liters, bloodType, nickname }) {
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
  ctx.fillText("ครั้งที่บริจาคเลือดสะสม", W / 2, Y(1060));
  ctx.globalAlpha = 1;

  const statParts = [`🩸 ประมาณ ${liters} ลิตร`];
  if (bloodType && bloodType !== "ไม่ทราบ") statParts.push(`หมู่เลือด ${bloodType}`);
  ctx.font = `600 ${F(30)}px ${FONT}`;
  ctx.fillText(statParts.join("   •   "), W / 2, Y(1135));

  if (nickname) {
    ctx.font = `400 ${F(26)}px ${FONT}`;
    ctx.globalAlpha = 0.85;
    ctx.fillText(`โดย ${nickname}`, W / 2, Y(1178));
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
function drawLandscapeShareCard(ctx, W, H, FONT, { totalCount, achievement, liters, bloodType, nickname }) {
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
  ctx.fillText("ครั้งที่บริจาคเลือดสะสม", textX, numberY + 42);
  ctx.globalAlpha = 1;

  const statParts = [`🩸 ประมาณ ${liters} ลิตร`];
  if (bloodType && bloodType !== "ไม่ทราบ") statParts.push(`หมู่เลือด ${bloodType}`);
  ctx.font = `600 26px ${FONT}`;
  ctx.fillText(statParts.join("   •   "), textX, numberY + 86);

  if (nickname) {
    ctx.font = `400 24px ${FONT}`;
    ctx.globalAlpha = 0.85;
    ctx.fillText(`โดย ${nickname}`, textX, numberY + 122);
    ctx.globalAlpha = 1;
  }

  ctx.textAlign = "right";
  ctx.font = `400 22px ${FONT}`;
  ctx.globalAlpha = 0.7;
  const dateText = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
  ctx.fillText(dateText, W - 90, H - 60);
  ctx.globalAlpha = 1;
}

// Draws a shareable "achievement card" entirely with the Canvas 2D API (no
// external library needed — safe to run inside any sandbox) and returns a
// PNG data URL, sized to whichever social-media preset was requested.
async function buildShareCardDataUrl({ totalCount, achievement, estVolumeMl, bloodType, nickname, width, height }) {
  if (typeof document === "undefined") throw new Error("no document");
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch (e) {}
  }
  const W = width || 1080, H = height || 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  const FONT = "'Noto Sans Thai', 'Inter', sans-serif";

  drawShareCardBackground(ctx, W, H);
  const liters = (estVolumeMl / 1000).toFixed(estVolumeMl % 1000 === 0 ? 0 : 1);
  const content = { totalCount, achievement, liters, bloodType, nickname };

  if (W > H) {
    drawLandscapeShareCard(ctx, W, H, FONT, content);
  } else {
    drawPortraitShareCard(ctx, W, H, FONT, content);
  }

  return canvas.toDataURL("image/png");
}

function AppInner() {
  const [phase, setPhase] = useState("loading"); // loading | consent | app | error
  const [tab, setTab] = useState("home"); // home | dashboard | missions | knowledge
  const [nickname, setNickname] = useState("");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [donorType, setDonorType] = useState(DEFAULT_DONOR_TYPE);
  const [startingCount, setStartingCount] = useState("");
  const [startingCountUpdatedAt, setStartingCountUpdatedAt] = useState("");
  // When the starting count was first set (distinct from startingCountUpdatedAt,
  // which moves every time it's edited) — lets the UI say "แก้ไขล่าสุดเมื่อ"
  // instead of "บันทึกเมื่อ" once it's been edited at least once. Legacy
  // profiles saved before this field existed fall back to treating
  // createdAt === updatedAt (i.e. "never edited yet") — see load().
  const [startingCountCreatedAt, setStartingCountCreatedAt] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ nickname: "", age: "", weight: "", bloodType: "", donorType: DEFAULT_DONOR_TYPE, startingCount: "" });
  const [profileError, setProfileError] = useState("");
  const [donations, setDonations] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editSnapshot, setEditSnapshot] = useState(null);
  const [formError, setFormError] = useState("");
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  // Which history card's overflow (⋮) action menu is currently open — replaces
  // the previous always-visible edit/delete icon pair to reduce visual
  // clutter, especially now that cards can grow taller with longer notes.
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const [editingStartingCount, setEditingStartingCount] = useState(false);
  const [startingCountDraft, setStartingCountDraft] = useState("");
  const [confirmDeleteStartingCount, setConfirmDeleteStartingCount] = useState(false);
  const [checkedConsent, setCheckedConsent] = useState(false);
  // First-time "+" tap onboarding: ask up front whether this is the user's
  // very first donation ever, or they've donated before (so we should
  // capture a running "ยอดยกมา" count instead of forcing a dated record).
  // Only relevant while there's truly nothing recorded yet (see
  // handleAddButtonClick) — once either a donation or a starting count
  // exists, "+" just opens the normal form directly.
  const [showOnboardingChoice, setShowOnboardingChoice] = useState(false);
  // Combined "เคยบริจาคแล้ว" entry: one modal capturing both the running
  // total count (which includes the most recent donation being logged here)
  // and that most-recent donation's own date/time/location/note, in a single
  // save. Replaces the earlier 2-step flow (count-only modal, then a
  // separate "จำวันที่บริจาคครั้งล่าสุดได้ไหม?" follow-up prompt) — see
  // handoff doc decision log for the reasoning. startingCount is always
  // derived as (entered total - 1) so the two records never double-count.
  const [showStartingCountQuickEntry, setShowStartingCountQuickEntry] = useState(false);
  const [quickStartingCountDraft, setQuickStartingCountDraft] = useState("");
  const [quickStartingCountError, setQuickStartingCountError] = useState("");
  const [quickEntryForm, setQuickEntryForm] = useState({ date: new Date().toISOString().slice(0,10), time: "", location: "", note: "" });
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0,10), time: "", location: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lastExportCount, setLastExportCount] = useState(0);
  const [backupSnoozeCount, setBackupSnoozeCount] = useState(null);
  const [seenAchievements, setSeenAchievements] = useState([]);
  const [importing, setImporting] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [exportJsonText, setExportJsonText] = useState("");
  const [showShareCard, setShowShareCard] = useState(false);
  const [shareCardDataUrl, setShareCardDataUrl] = useState("");
  const canShareFiles = useMemo(() => {
    try {
      if (typeof navigator === "undefined" || !navigator.share || !navigator.canShare) return false;
      const testFile = new File([""], "test.png", { type: "image/png" });
      return navigator.canShare({ files: [testFile] });
    } catch {
      return false;
    }
  }, []);
  const [sharingCard, setSharingCard] = useState(false);
  const [shareData, setShareData] = useState(null);
  const [cardSizeKey, setCardSizeKey] = useState(DEFAULT_CARD_SIZE);
  const [toast, setToast] = useState(null);
  const [historyYearFilter, setHistoryYearFilter] = useState("all");
  const [historyVisibleCount, setHistoryVisibleCount] = useState(HISTORY_PAGE_SIZE);
  const fileInputRef = useRef(null);
  const toastTimerRef = useRef(null);
  const exportTextareaRef = useRef(null);

  // Auto-select the backup text as soon as the export preview opens, so even
  // if both copy methods below fail the user can just hit Ctrl/Cmd+C right
  // away without hunting for the textarea themselves.
  useEffect(() => {
    if (showExportPreview && exportTextareaRef.current) {
      const el = exportTextareaRef.current;
      const t = setTimeout(() => {
        try { el.focus(); el.select(); } catch (e) {}
      }, 50);
      return () => clearTimeout(t);
    }
  }, [showExportPreview]);

  const showToast = useCallback((type, message, duration = 3500) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, message });
    toastTimerRef.current = setTimeout(() => setToast(null), duration);
  }, []);

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  // Ticks every 30s purely to force a re-render, so the relative "บันทึกเมื่อ..."
  // wording (formatLoggedAt) stays live/current without needing any user
  // interaction. Browsers/webviews (including LINE's in-app one) throttle or
  // pause timers automatically while backgrounded, so this has no meaningful
  // battery cost and never touches storage/network.
  const [, setRelativeTimeTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setRelativeTimeTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    setPhase("loading");
    setError("");
    try {
      const consentRes = await storage.get("consent").catch(() => null);
      if (!consentRes || !consentRes.value) {
        setPhase("consent");
        return;
      }
      const [profileRes, donationsRes, backupRes, uiRes] = await Promise.all([
        storage.get("profile").catch(() => null),
        storage.get("donations").catch(() => null),
        storage.get("backupMeta").catch(() => null),
        storage.get("uiMeta").catch(() => null),
      ]);
      if (profileRes && profileRes.value) {
        try {
          const p = JSON.parse(profileRes.value);
          setNickname(p.nickname || "");
          setAge(p.age || "");
          setWeight(p.weight || "");
          setBloodType(p.bloodType || "");
          setDonorType(p.donorType === "monk" ? "monk" : DEFAULT_DONOR_TYPE);
          setStartingCount(p.startingCount ? String(p.startingCount) : "");
          setStartingCountUpdatedAt(p.startingCountUpdatedAt || "");
          setStartingCountCreatedAt(p.startingCountCreatedAt || p.startingCountUpdatedAt || "");
        } catch {}
      }
      if (donationsRes && donationsRes.value) {
        try { setDonations(JSON.parse(donationsRes.value)); } catch { setDonations([]); }
      }
      if (backupRes && backupRes.value) {
        try { setLastExportCount(JSON.parse(backupRes.value).lastExportCount || 0); } catch {}
      }
      if (uiRes && uiRes.value) {
        try {
          const u = JSON.parse(uiRes.value);
          setSeenAchievements(Array.isArray(u.seenAchievements) ? u.seenAchievements : []);
          setBackupSnoozeCount(typeof u.backupSnoozeCount === "number" ? u.backupSnoozeCount : null);
        } catch {}
      }
      setPhase("app");
    } catch (e) {
      setPhase("error");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // close any open modal with Escape for keyboard users
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setShowProfile(false);
      setShowForm(false);
      setShowPrivacy(false);
      setShowReset(false);
      setConfirmDeleteId(null);
      setEditingStartingCount(false);
      setConfirmDeleteStartingCount(false);
      setShowOnboardingChoice(false);
      setShowStartingCountQuickEntry(false);
      setShowLogLastDonationPrompt(false);
      setPendingImport(null);
      setShowExportPreview(false);
      setShowShareCard(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const giveConsent = async () => {
    setSaving(true);
    setError("");
    try {
      await storage.set("consent", JSON.stringify({ given: true, at: new Date().toISOString(), version: CONSENT_VERSION }));
      setPhase("app");
    } catch (e) {
      setError("บันทึกความยินยอมไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  const saveDonations = async (next) => {
    setDonations(next);
    try {
      await storage.set("donations", JSON.stringify(next));
    } catch (e) {
      showToast("error", "บันทึกข้อมูลไม่สำเร็จ ลองอีกครั้ง");
    }
  };

  // Given the previous and next starting-count values, decides the
  // createdAt/updatedAt pair to persist: no real change keeps both as-is;
  // going from 0 -> nonzero is treated as a fresh "creation" (both stamped
  // to now); changing between two nonzero values is an edit (createdAt
  // preserved, updatedAt stamped to now); going to 0 clears both.
  const computeStartingCountStamps = (prevCount, nextCount) => {
    if (nextCount === prevCount) return { createdAt: startingCountCreatedAt, updatedAt: startingCountUpdatedAt };
    if (nextCount === 0) return { createdAt: "", updatedAt: "" };
    const now = new Date().toISOString();
    if (prevCount === 0) return { createdAt: now, updatedAt: now };
    return { createdAt: startingCountCreatedAt || startingCountUpdatedAt || now, updatedAt: now };
  };

  const persistUiMeta = async (patch) => {
    const next = { seenAchievements, backupSnoozeCount, ...patch };
    try { await storage.set("uiMeta", JSON.stringify(next)); } catch (e) {}
  };

  const openProfile = () => {
    setProfileDraft({
      nickname, age: age ? String(age) : "", weight: weight ? String(weight) : "", bloodType, donorType,
      startingCount: startingCount ? String(startingCount) : "",
    });
    setProfileError("");
    setShowProfile(true);
  };

  const saveProfile = async () => {
    const ageNum = profileDraft.age !== "" ? Number(profileDraft.age) : "";
    const weightNum = profileDraft.weight !== "" ? Number(profileDraft.weight) : "";
    const startingCountNum = profileDraft.startingCount !== "" ? Number(profileDraft.startingCount) : 0;
    if (ageNum !== "" && (Number.isNaN(ageNum) || ageNum < 0 || ageNum > 120)) {
      setProfileError("อายุต้องเป็นตัวเลขระหว่าง 0-120 ปี");
      return;
    }
    if (weightNum !== "" && (Number.isNaN(weightNum) || weightNum < 0 || weightNum > 300)) {
      setProfileError("น้ำหนักต้องเป็นตัวเลขระหว่าง 0-300 กก.");
      return;
    }
    if (profileDraft.startingCount !== "" && (Number.isNaN(startingCountNum) || !Number.isInteger(startingCountNum) || startingCountNum < 0 || startingCountNum > MAX_STARTING_COUNT)) {
      setProfileError(`ยอดสะสมยกมาต้องเป็นจำนวนเต็มระหว่าง 0-${MAX_STARTING_COUNT} ครั้ง`);
      return;
    }
    const { createdAt: nextStartingCountCreatedAt, updatedAt: nextStartingCountUpdatedAt } = computeStartingCountStamps(Number(startingCount) || 0, startingCountNum);
    const cleaned = {
      nickname: profileDraft.nickname.trim(),
      age: ageNum,
      weight: weightNum,
      bloodType: profileDraft.bloodType,
      donorType: profileDraft.donorType === "monk" ? "monk" : DEFAULT_DONOR_TYPE,
      startingCount: startingCountNum,
      startingCountCreatedAt: nextStartingCountCreatedAt,
      startingCountUpdatedAt: nextStartingCountUpdatedAt,
    };
    setProfileError("");
    setSaving(true);
    try {
      await storage.set("profile", JSON.stringify(cleaned));
      setNickname(cleaned.nickname);
      setAge(cleaned.age);
      setWeight(cleaned.weight);
      setBloodType(cleaned.bloodType);
      setDonorType(cleaned.donorType);
      setStartingCount(cleaned.startingCount ? String(cleaned.startingCount) : "");
      setStartingCountCreatedAt(nextStartingCountCreatedAt);
      setStartingCountUpdatedAt(nextStartingCountUpdatedAt);
      setShowProfile(false);
      showToast("success", "บันทึกโปรไฟล์แล้ว");
    } catch (e) {
      setProfileError("บันทึกโปรไฟล์ไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  const openAddForm = () => {
    setEditingId(null);
    setFormError("");
    setForm({ date: new Date().toISOString().slice(0,10), time: "", location: "", note: "" });
    setEditSnapshot(null);
    setShowForm(true);
  };

  const openEditForm = (record) => {
    setEditingId(record.id);
    setFormError("");
    const snapshot = { date: record.date, time: record.time || "", location: record.location || "", note: record.note || "" };
    setForm(snapshot);
    setEditSnapshot(snapshot);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormError("");
    setEditSnapshot(null);
  };

  // The very first tap of "+" — while there's truly nothing recorded yet
  // (no donations, no starting count) — asks up front whether this is the
  // user's first-ever donation or they've donated before. This replaces the
  // earlier approach of quietly bundling an optional "prior count" field
  // into the add-donation form itself (see handoff doc §4.14/§4.18): that
  // worked but relied on users noticing an optional field, and forced even
  // veteran donors who don't remember any specific date to invent one just
  // to submit the form. Once either a donation or a starting count exists,
  // "+" just opens the normal form directly — no more choice screen.
  const handleAddButtonClick = () => {
    if (donations.length === 0 && startingCountNum === 0) {
      setShowOnboardingChoice(true);
    } else {
      openAddForm();
    }
  };

  const chooseFirstDonation = () => {
    setShowOnboardingChoice(false);
    openAddForm();
  };

  const chooseHasStartingCount = () => {
    setShowOnboardingChoice(false);
    setQuickStartingCountDraft("");
    setQuickStartingCountError("");
    setQuickEntryForm({ date: new Date().toISOString().slice(0,10), time: "", location: "", note: "" });
    setShowStartingCountQuickEntry(true);
  };

  const cancelStartingCountQuickEntry = () => {
    setShowStartingCountQuickEntry(false);
    setQuickStartingCountDraft("");
    setQuickStartingCountError("");
  };

  const submitStartingCountQuickEntry = async () => {
    if (quickStartingCountDraft === "") {
      setQuickStartingCountError("กรุณาระบุจำนวนครั้งทั้งหมด");
      return;
    }
    const num = Number(quickStartingCountDraft);
    // The entered total INCLUDES the most-recent donation being logged in
    // this same form, so the minimum valid value is 1 (not 0) — see handoff
    // doc decision log ("แบบ A").
    if (Number.isNaN(num) || !Number.isInteger(num) || num < 1 || num > MAX_STARTING_COUNT) {
      setQuickStartingCountError(`จำนวนครั้งต้องเป็นจำนวนเต็มตั้งแต่ 1 ถึง ${MAX_STARTING_COUNT} ครั้ง`);
      return;
    }
    if (!quickEntryForm.date) {
      setQuickStartingCountError("กรุณาเลือกวันที่บริจาคล่าสุด");
      return;
    }
    const selected = new Date(quickEntryForm.date);
    if (Number.isNaN(selected.getTime())) {
      setQuickStartingCountError("วันที่ไม่ถูกต้อง");
      return;
    }
    if (selected.setHours(0,0,0,0) > startOfToday().getTime()) {
      setQuickStartingCountError("เลือกวันที่ในอนาคตไม่ได้");
      return;
    }
    setQuickStartingCountError("");
    setSaving(true);
    try {
      const startingCountNumNew = num - 1;
      // Reaching this modal only happens from the "เคยบริจาคแล้ว" onboarding
      // choice, gated on startingCountNum === 0 and donations.length === 0
      // (see handleAddButtonClick), so this is always a fresh "creation" —
      // createdAt and updatedAt start out equal.
      const stampedAt = startingCountNumNew > 0 ? new Date().toISOString() : "";
      const cleanedLocation = quickEntryForm.location.trim().slice(0, MAX_LOCATION_LEN);
      const cleanedNote = quickEntryForm.note.trim().slice(0, MAX_NOTE_LEN);
      const cleanedTime = quickEntryForm.time || "";
      const nowIso = new Date().toISOString();
      const record = { id: uid(), date: quickEntryForm.date, time: cleanedTime, location: cleanedLocation, note: cleanedNote, loggedAt: nowIso, createdAt: nowIso };
      const nextDonations = [...donations, record].sort((a, b) => new Date(b.date) - new Date(a.date));

      await storage.set("profile", JSON.stringify({ nickname, age, weight, bloodType, donorType, startingCount: startingCountNumNew, startingCountCreatedAt: stampedAt, startingCountUpdatedAt: stampedAt }));
      await saveDonations(nextDonations);

      setStartingCount(startingCountNumNew ? String(startingCountNumNew) : "");
      setStartingCountCreatedAt(stampedAt);
      setStartingCountUpdatedAt(stampedAt);
      setShowStartingCountQuickEntry(false);
      showToast("success", "บันทึกข้อมูลการบริจาคแล้ว");
    } catch (e) {
      setQuickStartingCountError("บันทึกไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  const submitDonation = async () => {
    if (!form.date) {
      setFormError("กรุณาเลือกวันที่บริจาค");
      return;
    }
    const selected = new Date(form.date);
    if (Number.isNaN(selected.getTime())) {
      setFormError("วันที่ไม่ถูกต้อง");
      return;
    }
    if (selected.setHours(0,0,0,0) > startOfToday().getTime()) {
      setFormError("เลือกวันที่ในอนาคตไม่ได้");
      return;
    }
    if (sameDateConflict) {
      setFormError(sameDateConflictMessage);
      return;
    }
    setFormError("");
    setSaving(true);
    try {
      const cleanedLocation = form.location.trim().slice(0, MAX_LOCATION_LEN);
      const cleanedNote = form.note.trim().slice(0, MAX_NOTE_LEN);
      const cleanedTime = form.time || "";
      const nowIso = new Date().toISOString();
      let next;
      if (editingId) {
        // loggedAt doubles as "last recorded/edited at" — updated on every
        // save (create or edit) so the subtle timestamp shown in the history
        // card always reflects the most recent time this entry was touched
        // in the app, distinct from the donation date/time the user chose.
        // createdAt is preserved across edits (falling back to the existing
        // loggedAt for records saved before this field existed) so the UI
        // can tell "never edited" apart from "edited at least once" and show
        // "บันทึกเมื่อ" vs "แก้ไขล่าสุดเมื่อ" accordingly.
        next = donations.map((d) => d.id === editingId
          ? { ...d, date: form.date, time: cleanedTime, location: cleanedLocation, note: cleanedNote, loggedAt: nowIso, createdAt: d.createdAt || d.loggedAt }
          : d);
      } else {
        const record = { id: uid(), date: form.date, time: cleanedTime, location: cleanedLocation, note: cleanedNote, loggedAt: nowIso, createdAt: nowIso };
        next = [...donations, record];
      }
      next = [...next].sort((a, b) => new Date(b.date) - new Date(a.date));
      await saveDonations(next);
      showToast("success", editingId ? "แก้ไขรายการแล้ว" : "บันทึกรายการแล้ว");
      closeForm();
    } finally {
      setSaving(false);
    }
  };

  const requestDeleteDonation = (id) => setConfirmDeleteId(id);

  const confirmDeleteDonation = async () => {
    const id = confirmDeleteId;
    if (!id) return;
    setConfirmDeleteId(null);
    await saveDonations(donations.filter(d => d.id !== id));
    showToast("success", "ลบรายการแล้ว");
  };

  // Inline edit/delete for the starting-count summary card in the history
  // list — kept lightweight on purpose (just the one number, no date/
  // location/note, no synthetic history rows) but lets the user change it
  // right there instead of jumping to the profile modal. Every profile write
  // still carries every other current field along, to avoid the silent-wipe
  // bug class noted earlier in the handoff doc.
  const openEditStartingCount = () => {
    setStartingCountDraft(startingCount || "");
    setEditingStartingCount(true);
  };

  const cancelEditStartingCount = () => {
    setEditingStartingCount(false);
    setStartingCountDraft("");
  };

  const saveStartingCountInline = async () => {
    const num = startingCountDraft !== "" ? Number(startingCountDraft) : 0;
    if (Number.isNaN(num) || !Number.isInteger(num) || num < 0 || num > MAX_STARTING_COUNT) {
      showToast("error", `จำนวนครั้งต้องเป็นจำนวนเต็มระหว่าง 0-${MAX_STARTING_COUNT} ครั้ง`);
      return;
    }
    try {
      const { createdAt: stampedCreatedAt, updatedAt: stampedAt } = computeStartingCountStamps(startingCountNum, num);
      await storage.set("profile", JSON.stringify({ nickname, age, weight, bloodType, donorType, startingCount: num, startingCountCreatedAt: stampedCreatedAt, startingCountUpdatedAt: stampedAt }));
      setStartingCount(num ? String(num) : "");
      setStartingCountCreatedAt(stampedCreatedAt);
      setStartingCountUpdatedAt(stampedAt);
      setEditingStartingCount(false);
      showToast("success", "แก้ไขยอดสะสมยกมาแล้ว");
    } catch (e) {
      showToast("error", "บันทึกไม่สำเร็จ ลองอีกครั้ง");
    }
  };

  const requestDeleteStartingCount = () => setConfirmDeleteStartingCount(true);

  const confirmDeleteStartingCountNow = async () => {
    setConfirmDeleteStartingCount(false);
    try {
      await storage.set("profile", JSON.stringify({ nickname, age, weight, bloodType, donorType, startingCount: 0, startingCountCreatedAt: "", startingCountUpdatedAt: "" }));
      setStartingCount("");
      setStartingCountCreatedAt("");
      setStartingCountUpdatedAt("");
      showToast("success", "ลบยอดสะสมยกมาแล้ว");
    } catch (e) {
      showToast("error", "ลบไม่สำเร็จ ลองอีกครั้ง");
    }
  };

  const resetAll = async () => {
    setSaving(true);
    try {
      await storage.delete("donations").catch(() => {});
      await storage.delete("profile").catch(() => {});
      await storage.delete("consent").catch(() => {});
      await storage.delete("backupMeta").catch(() => {});
      await storage.delete("uiMeta").catch(() => {});
      setDonations([]);
      setNickname("");
      setAge("");
      setWeight("");
      setBloodType("");
      setDonorType(DEFAULT_DONOR_TYPE);
      setStartingCount("");
      setStartingCountUpdatedAt("");
      setLastExportCount(0);
      setBackupSnoozeCount(null);
      setSeenAchievements([]);
      setShowReset(false);
      setPhase("consent");
      setCheckedConsent(false);
    } catch (e) {
      setError("ลบข้อมูลไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  // NOTE: exporting never throws past this function. Triggering a file
  // download (a.click() with a download attribute) can be blocked inside a
  // sandboxed preview (e.g. the Claude artifact iframe has no download
  // permission), and letting that exception escape uncaught used to blank
  // the whole page. Now we always show an on-screen preview the user can
  // copy manually, and only attempt the real download as a best-effort
  // bonus wrapped in its own try/catch.
  const exportData = async () => {
    try {
      const payload = { nickname, age, weight, bloodType, donorType, startingCount, startingCountCreatedAt, startingCountUpdatedAt, donations, exportedAt: new Date().toISOString() };
      const jsonText = JSON.stringify(payload, null, 2);
      setExportJsonText(jsonText);
      setShowExportPreview(true);
      try {
        await storage.set("backupMeta", JSON.stringify({ lastExportCount: donations.length, lastExportAt: new Date().toISOString() }));
        setLastExportCount(donations.length);
        setBackupSnoozeCount(null);
        await persistUiMeta({ backupSnoozeCount: null });
      } catch (e) {}
    } catch (e) {
      showToast("error", "เตรียมข้อมูลส่งออกไม่สำเร็จ ลองอีกครั้ง");
    }
  };

  const downloadExportFile = () => {
    try {
      const blob = new Blob([exportJsonText], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `donation-backup-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 2000);
      showToast("success", "เริ่มดาวน์โหลดไฟล์แล้ว");
    } catch (e) {
      showToast("error", "ดาวน์โหลดไฟล์อัตโนมัติไม่ได้ในหน้าพรีวิวนี้ — คัดลอกข้อความด้านล่างไปเก็บเองแทนได้เลย");
    }
  };

  const copyExportText = async () => {
    // Method 1: the modern Clipboard API. Sandboxed iframes (like an
    // artifact preview) often block this with a permissions-policy error,
    // so we never let it stop us from trying the older fallback below.
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(exportJsonText);
        showToast("success", "คัดลอกข้อมูลแล้ว — วางเก็บไว้ในไฟล์ข้อความหรือโน้ตของคุณได้เลย");
        return;
      }
    } catch (e) {}
    // Method 2: select the visible textarea's text and use the older
    // execCommand('copy'), which some sandboxes allow even when the modern
    // Clipboard API is blocked.
    try {
      const el = exportTextareaRef.current;
      if (el) {
        el.focus();
        el.select();
        el.setSelectionRange(0, el.value.length);
        const ok = document.execCommand && document.execCommand("copy");
        if (ok) {
          showToast("success", "คัดลอกข้อมูลแล้ว — วางเก็บไว้ในไฟล์ข้อความหรือโน้ตของคุณได้เลย");
          return;
        }
      }
    } catch (e) {}
    // Method 3: both automatic ways are blocked — the text is already
    // selected for the user, so ask them to finish it with the keyboard.
    try {
      const el = exportTextareaRef.current;
      if (el) { el.focus(); el.select(); }
    } catch (e) {}
    showToast("error", "คัดลอกอัตโนมัติไม่ได้ในหน้าพรีวิวนี้ — ข้อความถูกเลือกไว้ให้แล้ว กด Ctrl/Cmd+C เพื่อคัดลอกเองได้เลย");
  };

  const openShareCard = () => {
    const latestUnlocked = [...achievements].reverse().find(a => totalCount >= a.threshold);
    if (!latestUnlocked) {
      showToast("error", "บันทึกการบริจาคครั้งแรก หรือใส่ยอดสะสมยกมาที่โปรไฟล์ก่อน แล้วค่อยกลับมาแชร์ความสำเร็จกันนะ");
      return;
    }
    setShareData({
      totalCount,
      achievement: {
        title: latestUnlocked.title,
        desc: latestUnlocked.desc,
        kind: latestUnlocked.kind,
        tier: latestUnlocked.tier,
        isMonk: donorType === "monk",
      },
      estVolumeMl: totalCount * 350,
      bloodType,
      nickname,
    });
    setShowShareCard(true);
  };

  // Regenerate the card image whenever the modal is open and either the
  // snapshot of data or the chosen size preset changes — this is what makes
  // switching size chips instantly redraw at the new dimensions.
  useEffect(() => {
    if (!showShareCard || !shareData) return;
    let cancelled = false;
    setSharingCard(true);
    const size = CARD_SIZES[cardSizeKey] || CARD_SIZES[DEFAULT_CARD_SIZE];
    buildShareCardDataUrl({ ...shareData, width: size.w, height: size.h })
      .then((url) => { if (!cancelled) setShareCardDataUrl(url); })
      .catch(() => { if (!cancelled) showToast("error", "สร้างภาพไม่สำเร็จ ลองอีกครั้ง"); })
      .finally(() => { if (!cancelled) setSharingCard(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showShareCard, shareData, cardSizeKey]);

  const downloadShareCard = () => {
    try {
      const size = CARD_SIZES[cardSizeKey] || CARD_SIZES[DEFAULT_CARD_SIZE];
      const a = document.createElement("a");
      a.href = shareCardDataUrl;
      a.download = `bloodjourney-achievement-${size.key}-${new Date().toISOString().slice(0,10)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast("success", "เริ่มดาวน์โหลดภาพแล้ว");
    } catch (e) {
      showToast("error", "ดาวน์โหลดอัตโนมัติไม่ได้ในหน้าพรีวิวนี้ — กดค้างที่รูปด้านบน (มือถือ) หรือคลิกขวาแล้วเลือก \"บันทึกรูปภาพเป็น\" (คอมพิวเตอร์) แทนได้เลย");
    }
  };

  // Shares the actual generated image file (not a link) via the device's native
  // share sheet — same picture a manual download would produce, just skipping
  // the save-then-attach-manually step. Only wired up when the browser/device
  // actually supports sharing files (checked via canShareFiles below).
  const nativeShareCard = async () => {
    try {
      const size = CARD_SIZES[cardSizeKey] || CARD_SIZES[DEFAULT_CARD_SIZE];
      const res = await fetch(shareCardDataUrl);
      const blob = await res.blob();
      const file = new File([blob], `bloodjourney-achievement-${size.key}-${new Date().toISOString().slice(0,10)}.png`, { type: "image/png" });
      await navigator.share({ files: [file], title: "Blood Journey" });
    } catch (e) {
      if (e && e.name === "AbortError") return; // user cancelled the share sheet
      showToast("error", "แชร์ไม่สำเร็จ ลองดาวน์โหลดรูปภาพแทนได้เลย");
    }
  };

  const snoozeBackupReminder = async () => {
    setBackupSnoozeCount(donations.length);
    await persistUiMeta({ backupSnoozeCount: donations.length });
    showToast("success", "ได้เลย เดี๋ยวเตือนอีกทีนะ");
  };

  const triggerImport = () => {
    setError("");
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.donations)) {
        throw new Error("รูปแบบไฟล์ไม่ถูกต้อง");
      }
      const existingIds = new Set(donations.map(d => d.id));
      const incoming = parsed.donations.filter(d => d && d.date && !existingIds.has(d.id));
      const duplicateCount = parsed.donations.length - incoming.length;
      // Only offer to fill in profile fields that are currently empty —
      // never silently overwrite something the user already entered here.
      const profileFieldsToFill = {};
      if (!nickname && parsed.nickname) profileFieldsToFill.nickname = parsed.nickname;
      if (age === "" && parsed.age !== undefined && parsed.age !== "") profileFieldsToFill.age = parsed.age;
      if (weight === "" && parsed.weight !== undefined && parsed.weight !== "") profileFieldsToFill.weight = parsed.weight;
      if (!bloodType && parsed.bloodType) profileFieldsToFill.bloodType = parsed.bloodType;
      setPendingImport({
        incoming,
        duplicateCount,
        totalInFile: parsed.donations.length,
        profileFieldsToFill,
      });
    } catch (err) {
      showToast("error", "นำเข้าไฟล์ไม่สำเร็จ — ตรวจสอบว่าเป็นไฟล์สำรองที่ส่งออกจากแอปนี้");
    } finally {
      setImporting(false);
    }
  };

  const cancelImport = () => setPendingImport(null);

  const confirmImport = async () => {
    if (!pendingImport) return;
    const merged = [...donations, ...pendingImport.incoming].sort((a, b) => new Date(b.date) - new Date(a.date));
    await saveDonations(merged);
    const fill = pendingImport.profileFieldsToFill || {};
    if (Object.keys(fill).length > 0) {
      const nextProfile = {
        nickname: "nickname" in fill ? fill.nickname : nickname,
        age: "age" in fill ? fill.age : age,
        weight: "weight" in fill ? fill.weight : weight,
        bloodType: "bloodType" in fill ? fill.bloodType : bloodType,
        donorType,
        startingCount: Number(startingCount) || 0,
        startingCountCreatedAt,
        startingCountUpdatedAt,
      };
      if ("nickname" in fill) setNickname(fill.nickname);
      if ("age" in fill) setAge(fill.age);
      if ("weight" in fill) setWeight(fill.weight);
      if ("bloodType" in fill) setBloodType(fill.bloodType);
      await storage.set("profile", JSON.stringify(nextProfile)).catch(() => {});
    }
    showToast("success", `นำเข้าสำเร็จ — เพิ่มรายการใหม่ ${pendingImport.incoming.length} รายการ`);
    setPendingImport(null);
  };

  const needsBackupReminder = donations.length > 0
    && (donations.length - lastExportCount) >= BACKUP_REMINDER_GAP
    && (backupSnoozeCount === null || (donations.length - backupSnoozeCount) >= BACKUP_REMINDER_GAP);

  const sorted = [...donations].sort((a,b) => new Date(b.date) - new Date(a.date));
  const last = sorted[0];
  const startingCountNum = Number(startingCount) || 0;
  // "ยอดสะสมยกมา" (startingCount) is now just a running total the user enters
  // once, up front — it explicitly excludes their most recent donation, which
  // gets logged as a real, normal, fully editable/deletable record via the
  // usual "บันทึกบริจาคโลหิต" form (prompted inline the very first time that
  // form is opened — see submitDonation below). So the 90-day eligibility
  // countdown only ever needs the latest *real* record; no separate carried-
  // over date/location/note living in the profile anymore.
  const effectiveLastDateStr = last ? last.date : null;
  const nextEligible = effectiveLastDateStr ? new Date(new Date(effectiveLastDateStr).getTime() + CYCLE_DAYS * 86400000) : null;
  const daysLeft = nextEligible ? daysBetween(new Date(), new Date(nextEligible)) : 0;
  const isEligible = !nextEligible || daysLeft <= 0;
  const totalCount = startingCountNum + donations.length;

  const ageOutOfRange = age !== "" && (Number(age) < MIN_AGE || Number(age) > MAX_AGE);
  const weightBelowMin = weight !== "" && Number(weight) < MIN_WEIGHT;

  const achievements = useMemo(() => buildAchievements(donorType), [donorType]);
  const medalAchievements = useMemo(() => achievements.filter(a => a.kind === "medal"), [achievements]);
  const pinAchievements = useMemo(() => achievements.filter(a => a.kind === "pin"), [achievements]);

  const stats = useMemo(() => {
    const chronological = [...donations].sort((a,b) => new Date(a.date) - new Date(b.date));
    const yearMap = {};
    chronological.forEach(d => {
      const y = buddhistYear(d.date);
      yearMap[y] = (yearMap[y] || 0) + 1;
    });
    const yearData = Object.entries(yearMap).map(([year, count]) => ({ year, count }));

    let totalGapDays = 0, gapCount = 0;
    for (let i = 1; i < chronological.length; i++) {
      totalGapDays += daysBetween(new Date(chronological[i-1].date), new Date(chronological[i].date));
      gapCount++;
    }
    const avgGap = gapCount ? Math.round(totalGapDays / gapCount) : null;

    let busiestYear = null, busiestCount = 0;
    Object.entries(yearMap).forEach(([y, c]) => { if (c > busiestCount) { busiestYear = y; busiestCount = c; } });

    const estVolumeMl = totalCount * 350;

    const maxYearCount = yearData.reduce((m, y) => Math.max(m, y.count), 0);
    const nextAchievement = achievements.find(a => totalCount < a.threshold) || null;

    return { yearData, avgGap, busiestYear, busiestCount, estVolumeMl, maxYearCount, nextAchievement };
  }, [donations, achievements, totalCount]);

  const unlockedIds = useMemo(
    () => achievements.filter(a => totalCount >= a.threshold).map(a => a.id),
    [totalCount, achievements]
  );
  const hasNewAchievement = unlockedIds.some(id => !seenAchievements.includes(id));

  useEffect(() => {
    if (tab === "missions" && hasNewAchievement) {
      setSeenAchievements(unlockedIds);
      persistUiMeta({ seenAchievements: unlockedIds });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, hasNewAchievement]);

  const historyYears = useMemo(() => {
    const set = new Set(donations.map(d => String(buddhistYear(d.date))));
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [donations]);

  // Maps each donation id to its overall sequence number ("ครั้งที่ N"),
  // counting the carried-over starting count first, then each in-app record
  // in chronological (ascending date) order — independent of the year filter
  // or the newest-first sort used for display, so the number stays stable no
  // matter how the history list is currently filtered/sorted on screen.
  const donationOrderMap = useMemo(() => {
    const ascending = [...donations].sort((a, b) => {
      const dateDiff = new Date(a.date) - new Date(b.date);
      if (dateDiff !== 0) return dateDiff;
      const aLogged = a.loggedAt ? new Date(a.loggedAt).getTime() : 0;
      const bLogged = b.loggedAt ? new Date(b.loggedAt).getTime() : 0;
      return aLogged - bLogged;
    });
    const map = {};
    ascending.forEach((d, i) => { map[d.id] = startingCountNum + i + 1; });
    return map;
  }, [donations, startingCountNum]);

  const filteredHistory = useMemo(() => {
    if (historyYearFilter === "all") return sorted;
    return sorted.filter(d => String(buddhistYear(d.date)) === historyYearFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donations, historyYearFilter]);

  useEffect(() => { setHistoryVisibleCount(HISTORY_PAGE_SIZE); }, [historyYearFilter]);

  const visibleHistory = filteredHistory.slice(0, historyVisibleCount);

  // Exact same-date match against another existing record — this is a hard
  // block (not just a warning): the user confirmed donating twice on the
  // same date should never be allowed to save, since it's never medically
  // possible anyway. Applies whether creating a new record or editing an
  // existing one (editingId is excluded from the comparison so editing a
  // record without changing its date never blocks itself).
  const sameDateConflict = useMemo(() => {
    if (!form.date) return false;
    const target = new Date(form.date);
    if (Number.isNaN(target.getTime())) return false;
    return donations.some(d => {
      if (editingId && d.id === editingId) return false;
      return daysBetween(new Date(d.date), new Date(target)) === 0;
    });
  }, [form.date, donations, editingId]);

  const sameDateConflictMessage = "วันที่นี้มีรายการบริจาคโลหิตอยู่แล้ว กรุณาเลือกวันที่อื่น หรือกลับไปแก้ไขรายการเดิม";

  // Only relevant while editing an existing record — disables the save
  // button when nothing has actually changed from what was opened.
  const editFormUnchanged = useMemo(() => {
    if (!editingId || !editSnapshot) return false;
    return form.date === editSnapshot.date
      && form.time === editSnapshot.time
      && form.location === editSnapshot.location
      && form.note === editSnapshot.note;
  }, [form, editingId, editSnapshot]);

  const closeGapWarning = useMemo(() => {
    if (!form.date) return null;
    const target = new Date(form.date);
    if (Number.isNaN(target.getTime())) return null;
    let closest = null;
    donations.forEach(d => {
      if (editingId && d.id === editingId) return;
      const diff = Math.abs(daysBetween(new Date(d.date), new Date(target)));
      if (closest === null || diff < closest) closest = diff;
    });
    if (closest !== null && closest > 0 && closest < CYCLE_DAYS) {
      return `วันที่นี้ห่างจากรายการอื่นเพียง ${closest} วัน (เกณฑ์ทั่วไปคือ ${CYCLE_DAYS} วัน) - ระบบยังบันทึกข้อมูลให้ตามที่ระบุจริง แต่ควรตรวจสอบกับเจ้าหน้าที่ว่าบริจาคได้ตามรอบหรือไม่`;
    }
    return null;
  }, [form.date, donations, editingId]);

  if (phase === "loading") {
    return (
      <div style={{ minHeight: 500, display: "flex", alignItems: "center", justifyContent: "center", background: "#FBF6F5" }}>
        <div style={{ color: "#9A3B33", fontFamily: "'Noto Sans Thai', sans-serif" }}>กำลังโหลด...</div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Noto Sans Thai', 'Inter', sans-serif", background: "#FBF6F5", minHeight: "100vh", color: "#241A18" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .btn-primary { background: #9A3B33; color: #FFF7F5; }
        .btn-primary:active { background: #7E2F28; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-ghost { background: transparent; color: #9A3B33; border: 1px solid #E3C8C3; }
        .btn-ghost:disabled { opacity: 0.6; cursor: not-allowed; }
        button {
          -webkit-appearance: none;
          appearance: none;
          font-family: inherit;
        }
        select {
          font-family: inherit;
        }
      `}</style>

      {phase === "error" && (
        <div style={{ maxWidth: 420, margin: "0 auto", padding: "70px 24px", textAlign: "center" }}>
          <AlertTriangle size={28} color="#B3261E" />
          <div style={{ fontSize: 15.5, fontWeight: 700, margin: "14px 0 8px" }}>โหลดข้อมูลไม่สำเร็จ</div>
          <p style={{ fontSize: 13, color: "#5C4A46", lineHeight: 1.7, margin: "0 0 22px" }}>
            ไม่ต้องกังวล ข้อมูลของคุณยังปลอดภัยอยู่ในเครื่องนี้เหมือนเดิม ลองโหลดใหม่อีกครั้ง
          </p>
          <button onClick={load} className="btn-primary" style={{ padding: "12px 26px", borderRadius: 12, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            ลองใหม่อีกครั้ง
          </button>
        </div>
      )}

      {phase === "consent" && (
        <div style={{ maxWidth: 420, margin: "0 auto", padding: "32px 20px 40px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #B24A40 0%, #8A2F28 100%)", boxShadow: "0 6px 14px -4px rgba(122,42,35,0.55)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}>
              <Droplet size={20} color="#FFF7F5" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.25 }}>Blood Journey</div>
              <div style={{ fontSize: 12, color: "#8A7370", lineHeight: 1.25 }}>บันทึกบริจาคโลหิต</div>
            </div>
          </div>

          <h1 style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.4, margin: "0 0 8px" }}>ก่อนเริ่มใช้งาน</h1>
          <p style={{ fontSize: 14.5, color: "#5C4A46", lineHeight: 1.7, margin: "0 0 20px" }}>
            แอปนี้ช่วยให้คุณบันทึกวันที่บริจาคเลือดด้วยตัวเอง เพื่อดูจำนวนครั้งสะสมและวันที่บริจาคได้ครั้งถัดไป
          </p>

          <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 14, padding: 18, marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
              <ShieldCheck size={17} color="#9A3B33" />
              <div style={{ fontWeight: 600, fontSize: 14.5 }}>ข้อมูลของคุณจะถูกเก็บอย่างไร</div>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: "#5C4A46", lineHeight: 1.8 }}>
              <li>ข้อมูลวันที่บริจาคถือเป็น <b>ข้อมูลสุขภาพ</b> ซึ่งเป็นข้อมูลอ่อนไหวตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)</li>
              <li>เก็บเฉพาะสิ่งที่คุณกรอกเอง — วันที่, สถานที่ (ถ้าระบุ), บันทึกช่วยจำ</li>
              <li>ใช้เพื่อคำนวณจำนวนครั้งและวันครบกำหนดบริจาคครั้งถัดไปเท่านั้น ไม่แชร์ให้บุคคลหรือหน่วยงานอื่น</li>
              <li>คุณลบข้อมูลทั้งหมด หรือส่งออกข้อมูลเป็นไฟล์ได้ตลอดเวลาในหน้าตั้งค่า</li>
            </ul>
          </div>

          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "4px 2px", marginBottom: 20, cursor: "pointer" }}>
            <input type="checkbox" checked={checkedConsent} onChange={(e) => setCheckedConsent(e.target.checked)}
              style={{ marginTop: 3, width: 18, height: 18, accentColor: "#9A3B33" }} />
            <span style={{ fontSize: 13.5, color: "#3A2C29", lineHeight: 1.6 }}>
              ฉันยินยอมให้เก็บข้อมูลการบริจาคเลือดของฉันตามที่อธิบายไว้ข้างต้น
            </span>
          </label>

          {error && <div style={{ color: "#B3261E", fontSize: 13, marginBottom: 12 }} role="alert">{error}</div>}

          <button disabled={!checkedConsent || saving} onClick={giveConsent} className="btn-primary"
            style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", fontSize: 15, fontWeight: 600,
              opacity: checkedConsent ? 1 : 0.45, cursor: checkedConsent ? "pointer" : "not-allowed" }}>
            {saving ? "กำลังบันทึก..." : "ยินยอมและเริ่มใช้งาน"}
          </button>
        </div>
      )}

      {phase === "app" && (
        <div style={{ maxWidth: 420, margin: "0 auto", padding: "24px 20px 88px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg, #B24A40 0%, #8A2F28 100%)", boxShadow: "0 5px 12px -4px rgba(122,42,35,0.55)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}>
                <Droplet size={17} color="#FFF7F5" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.25 }}>Blood Journey</div>
                <div style={{ fontSize: 10.5, color: "#8A7370", lineHeight: 1.25 }}>บันทึกบริจาคโลหิต</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button onClick={openProfile} aria-label="โปรไฟล์ของฉัน" style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
                <User size={19} color="#9A3B33" />
              </button>
              <button onClick={() => setShowSettings(true)} aria-label="ตั้งค่า" style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
                <Settings size={19} color="#9A3B33" />
              </button>
              <button onClick={() => setShowPrivacy(true)} aria-label="เกี่ยวกับข้อมูลของคุณ" style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
                <Info size={19} color="#9A3B33" />
              </button>
            </div>
          </div>

          {tab === "home" && (
            <>
              {nickname && (
                <div style={{ fontSize: 14, fontWeight: 600, color: "#3A2C29", marginBottom: 4 }}>สวัสดี, {nickname} 👋</div>
              )}
              {(bloodType || age || weight) && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  {bloodType && bloodType !== "ไม่ทราบ" && (
                    <span style={{ fontSize: 11, background: "#F3EAE8", color: "#9A3B33", padding: "4px 9px", borderRadius: 20, fontWeight: 600 }}>หมู่เลือด {bloodType}</span>
                  )}
                  {age !== "" && <span style={{ fontSize: 11, background: "#F3EAE8", color: "#9A3B33", padding: "4px 9px", borderRadius: 20, fontWeight: 600 }}>{age} ปี</span>}
                  {weight !== "" && <span style={{ fontSize: 11, background: "#F3EAE8", color: "#9A3B33", padding: "4px 9px", borderRadius: 20, fontWeight: 600 }}>{weight} กก.</span>}
                </div>
              )}
              {(ageOutOfRange || weightBelowMin) && (
                <div style={{ background: "#FDF0E6", border: "1px solid #F0D9BE", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 16 }}>
                  <AlertTriangle size={16} color="#B5651D" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ fontSize: 11.5, color: "#8A6A45", lineHeight: 1.6 }}>
                    {ageOutOfRange && `อายุที่กรอกอยู่นอกเกณฑ์ทั่วไปที่บริจาคได้ (${MIN_AGE}-${MAX_AGE} ปี) `}
                    {weightBelowMin && `น้ำหนักที่กรอกต่ำกว่าเกณฑ์ขั้นต่ำทั่วไป (${MIN_WEIGHT} กก.) `}
                    ให้เจ้าหน้าที่ ณ จุดบริจาคเป็นผู้ประเมินสิทธิ์จริงอีกครั้ง
                  </div>
                </div>
              )}
              {needsBackupReminder && (
                <div style={{ background: "#FDF0E6", border: "1px solid #F0D9BE", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 16 }}>
                  <AlertTriangle size={16} color="#B5651D" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "#7A4A1D" }}>ยังไม่ได้สำรองข้อมูลนานแล้วนะ</div>
                    <div style={{ fontSize: 11.5, color: "#8A6A45", marginTop: 2, lineHeight: 1.5 }}>ข้อมูลของคุณถูกเก็บในเครื่องนี้เท่านั้น ส่งออกไฟล์ที่แท็บแดชบอร์ดเพื่อป้องกันข้อมูลหาย</div>
                    <button onClick={snoozeBackupReminder} style={{ marginTop: 8, background: "none", border: "none", padding: 0, color: "#9A3B33", fontSize: 11.5, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>
                      เตือนทีหลัง
                    </button>
                  </div>
                </div>
              )}
              <div style={{ background: "linear-gradient(135deg, #B24A40 0%, #8A2F28 100%)", boxShadow: "0 14px 32px -8px rgba(122,42,35,0.55)", borderRadius: 20, padding: "26px 22px", color: "#FFF7F5", marginBottom: 16, position: "relative", overflow: "hidden" }}>
                <svg width="60" height="60" viewBox="0 0 24 24" fill="rgba(255,247,245,0.08)" style={{ position: "absolute", top: -10, right: 120 }}><path d="M12 2 C12 2 4 12.5 4 17 C4 21 7.6 24 12 24 C16.4 24 20 21 20 17 C20 12.5 12 2 12 2 Z" /></svg>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="rgba(255,247,245,0.07)" style={{ position: "absolute", bottom: 8, left: -4 }}><path d="M12 2 C12 2 4 12.5 4 17 C4 21 7.6 24 12 24 C16.4 24 20 21 20 17 C20 12.5 12 2 12 2 Z" /></svg>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(255,247,245,0.06)" style={{ position: "absolute", bottom: 55, left: 60 }}><path d="M12 2 C12 2 4 12.5 4 17 C4 21 7.6 24 12 24 C16.4 24 20 21 20 17 C20 12.5 12 2 12 2 Z" /></svg>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, position: "relative", zIndex: 1 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 4 }}>บริจาคโลหิตสะสมทั้งหมด</div>
                    <div style={{ fontSize: 46, fontWeight: 700, lineHeight: 1 }}>{totalCount}<span style={{ fontSize: 18, fontWeight: 500 }}> ครั้ง</span></div>
                    {startingCountNum > 0 && (
                      <div style={{ fontSize: 11.5, opacity: 0.8, marginTop: 4 }}>รวมยอดสะสมยกมา {startingCountNum} ครั้ง + บันทึกในแอป {donations.length} ครั้ง</div>
                    )}
                  </div>
                  <div style={{ position: "relative", width: 84, height: 84, flexShrink: 0 }}>
                    <svg width="52" height="52" viewBox="0 0 24 24" fill="#FFF7F5" style={{ position: "absolute", top: 18, left: 26 }}><path d="M12 2 C12 2 4 12.5 4 17 C4 21 7.6 24 12 24 C16.4 24 20 21 20 17 C20 12.5 12 2 12 2 Z" /></svg>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="rgba(255,247,245,0.75)" style={{ position: "absolute", top: 50, left: 0 }}><path d="M12 2 C12 2 4 12.5 4 17 C4 21 7.6 24 12 24 C16.4 24 20 21 20 17 C20 12.5 12 2 12 2 Z" /></svg>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="rgba(255,247,245,0.55)" style={{ position: "absolute", top: 0, left: 0 }}><path d="M12 2 C12 2 4 12.5 4 17 C4 21 7.6 24 12 24 C16.4 24 20 21 20 17 C20 12.5 12 2 12 2 Z" /></svg>
                  </div>
                </div>

                <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(255,247,245,0.25)", display: "flex", alignItems: "center", gap: 10, position: "relative", zIndex: 1 }}>
                  {isEligible ? <CheckCircle2 size={18} /> : <Clock size={18} />}
                  <div style={{ fontSize: 13.5 }}>
                    {effectiveLastDateStr ? (
                      isEligible
                        ? "บริจาคได้แล้ววันนี้"
                        : `บริจาคครั้งถัดไปได้ตั้งแต่ ${toBuddhistDate(nextEligible)} (อีก ${daysLeft} วัน)`
                    ) : totalCount > 0 ? (
                      "มียอดสะสมยกมาแล้ว แต่ยังไม่มีวันที่บริจาคในระบบ — บันทึกการบริจาคครั้งล่าสุด (ถ้าจำได้) เพื่อคำนวณวันครบกำหนดถัดไป"
                    ) : "ยังไม่มีประวัติ — เริ่มบันทึกครั้งแรกได้เลย"}
                  </div>
                </div>
              </div>

              <p style={{ fontSize: 11.5, color: "#8A7370", margin: "0 0 18px", lineHeight: 1.6 }}>
                คำนวณจากเกณฑ์ทั่วไป {CYCLE_DAYS} วันต่อครั้ง เพื่อการเตือนคร่าว ๆ เท่านั้น โปรดยึดตามคำแนะนำของเจ้าหน้าที่ ณ จุดบริจาคจริง
              </p>

              <button onClick={handleAddButtonClick} className="btn-primary"
                style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", fontSize: 14.5, fontWeight: 600,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 26, cursor: "pointer" }}>
                <Plus size={18} style={{ flexShrink: 0 }} /> บันทึกบริจาคโลหิต
              </button>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#3A2C29" }}>ประวัติบริจาคโลหิต</div>
                {historyYears.length > 1 && (
                  <select
                    aria-label="กรองตามปี"
                    value={historyYearFilter}
                    onChange={(e) => setHistoryYearFilter(e.target.value)}
                    style={{ fontSize: 12, border: "1px solid #E3C8C3", borderRadius: 8, padding: "5px 8px", color: "#5C4A46", background: "#FFFFFF" }}>
                    <option value="all">ทุกปี</option>
                    {historyYears.map(y => <option key={y} value={y}>ปี {y}</option>)}
                  </select>
                )}
              </div>

              {filteredHistory.length === 0 && !(historyYearFilter === "all" && startingCountNum > 0) && (
                <div style={{ textAlign: "center", padding: "36px 0", color: "#B39B96", fontSize: 13.5 }}>
                  {donations.length === 0 ? "ยังไม่มีรายการ กดปุ่มด้านบนเพื่อเริ่มบันทึก" : "ไม่มีรายการในปีที่เลือก"}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {visibleHistory.map((d) => (
                  <div key={d.id} style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 14, padding: "13px 15px", display: "flex", gap: 12, justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ width: 46, height: 56, position: "relative", flexShrink: 0 }}>
                      <svg width="46" height="56" viewBox="0 0 46 56" fill="none" style={{ position: "absolute", inset: 0 }}>
                        <path d="M23 2 C23 2 40 24 40 35 C40 45.5 32.5 54 23 54 C13.5 54 6 45.5 6 35 C6 24 23 2 23 2 Z" fill="#9A3B33" />
                      </svg>
                      <div style={{ position: "absolute", inset: 0, top: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ fontSize: String(donationOrderMap[d.id]).length >= 3 ? 11.5 : 15, fontWeight: 800, color: "#FFF7F5", lineHeight: 1.1 }}>{donationOrderMap[d.id]}</div>
                        <div style={{ fontSize: 7.5, color: "#FFF7F5", opacity: 0.85, marginTop: 1 }}>ครั้งที่</div>
                      </div>
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 600, color: "#3A2C29" }}>
                        <Calendar size={14} color="#9A3B33" /> {toBuddhistDate(d.date)}{d.time ? ` เวลา ${d.time} น.` : ""}
                      </div>
                      {d.location && (
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 12.5, color: "#7A6360", marginTop: 5, wordBreak: "break-word" }}>
                          <MapPin size={13} style={{ flexShrink: 0, marginTop: 2 }} /> {d.location}
                        </div>
                      )}
                      {d.note && (
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 12.5, color: "#7A6360", marginTop: 4, wordBreak: "break-word" }}>
                          <StickyNote size={13} style={{ flexShrink: 0, marginTop: 2 }} /> {d.note}
                        </div>
                      )}
                      {d.loggedAt && (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "#B7A5A1", marginTop: 6 }}>
                          <Clock size={10.5} style={{ flexShrink: 0 }} /> {joinLoggedLabel((d.createdAt && d.createdAt !== d.loggedAt) ? "แก้ไขล่าสุดเมื่อ" : "บันทึกเมื่อ", d.loggedAt)}
                        </div>
                      )}
                    </div>
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <button onClick={() => setOpenActionMenuId(openActionMenuId === d.id ? null : d.id)} aria-label="ตัวเลือกเพิ่มเติม" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                        <MoreVertical size={17} color="#9A3B33" />
                      </button>
                      {openActionMenuId === d.id && (
                        <>
                          <div onClick={() => setOpenActionMenuId(null)} style={{ position: "fixed", inset: 0, zIndex: 55 }} />
                          <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 2, background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 12, boxShadow: "0 4px 14px rgba(36,26,24,0.15)", overflow: "hidden", zIndex: 56, minWidth: 120 }}>
                            <button onClick={() => { setOpenActionMenuId(null); openEditForm(d); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#3A2C29", fontFamily: "inherit" }}>
                              <Pencil size={14} color="#9A3B33" /> แก้ไข
                            </button>
                            <button onClick={() => { setOpenActionMenuId(null); requestDeleteDonation(d.id); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#C0392B", fontFamily: "inherit", borderTop: "1px solid #F3E7E4" }}>
                              <Trash2 size={14} color="#C0392B" /> ลบ
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {startingCountNum > 0 && historyYearFilter === "all" && filteredHistory.length <= historyVisibleCount && (
                  editingStartingCount ? (
                    <div style={{ background: "#F7F0EE", border: "1px dashed #E3C8C3", borderRadius: 14, padding: "13px 15px" }}>
                      <label style={{ fontSize: 12, color: "#7A6360", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><Trophy size={13} /> จำนวนครั้งที่เคยบริจาคมาก่อน (ไม่รวมครั้งล่าสุด)</label>
                      <input type="number" min="0" max={MAX_STARTING_COUNT} step="1" value={startingCountDraft} placeholder="0" autoFocus
                        onChange={(e) => setStartingCountDraft(e.target.value)}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #E3C8C3", fontSize: 14, fontFamily: "inherit", marginBottom: 10 }} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={cancelEditStartingCount} className="btn-ghost" style={{ flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 13, cursor: "pointer" }}>ยกเลิก</button>
                        <button onClick={saveStartingCountInline} className="btn-primary" style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>บันทึก</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: "#F7F0EE", border: "1px dashed #E3C8C3", borderRadius: 14, padding: "13px 15px", display: "flex", gap: 12, justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: "#FFFFFF", border: "1px solid #E3C8C3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#9A3B33", lineHeight: 1.1 }}>+{startingCountNum}</div>
                        <div style={{ fontSize: 8, color: "#9A3B33", opacity: 0.75, marginTop: 1 }}>สะสม</div>
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, color: "#7A6360" }}>
                          <Trophy size={14} color="#9A3B33" style={{ flexShrink: 0 }} /> เคยบริจาคมาแล้ว {startingCountNum} ครั้ง
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, opacity: 0.8, marginTop: 5 }}>
                          <StickyNote size={12} style={{ flexShrink: 0 }} /> ไม่ทราบวันที่แต่ละครั้ง
                        </div>
                        {startingCountUpdatedAt && (
                          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "#B7A5A1", marginTop: 4 }}>
                            <Clock size={10.5} style={{ flexShrink: 0 }} /> {joinLoggedLabel((startingCountCreatedAt && startingCountCreatedAt !== startingCountUpdatedAt) ? "แก้ไขล่าสุดเมื่อ" : "บันทึกเมื่อ", startingCountUpdatedAt)}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                        <button onClick={openEditStartingCount} aria-label="แก้ไขยอดสะสมยกมา" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                          <Pencil size={15} color="#9A3B33" />
                        </button>
                        <button onClick={requestDeleteStartingCount} aria-label="ลบยอดสะสมยกมา" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                          <Trash2 size={16} color="#C48A85" />
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>

              {filteredHistory.length > historyVisibleCount && (
                <button
                  onClick={() => setHistoryVisibleCount(c => c + HISTORY_PAGE_SIZE)}
                  className="btn-ghost"
                  style={{ width: "100%", padding: "10px 0", borderRadius: 10, fontSize: 13, marginTop: 12, cursor: "pointer" }}>
                  ดูเพิ่มเติม ({filteredHistory.length - historyVisibleCount} รายการ)
                </button>
              )}
            </>
          )}

          {tab === "dashboard" && (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: "#3A2C29" }}>แดชบอร์ดสรุปข้อมูล</div>
              <p style={{ fontSize: 12.5, color: "#8A7370", margin: "0 0 18px" }}>ภาพรวมพฤติกรรมการบริจาคของคุณ</p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 14, padding: 14 }}>
                  <Gauge size={16} color="#9A3B33" />
                  <div style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>{stats.avgGap ?? "—"}{stats.avgGap ? <span style={{ fontSize: 12, fontWeight: 500 }}> วัน</span> : ""}</div>
                  <div style={{ fontSize: 11.5, color: "#8A7370", marginTop: 2 }}>ระยะห่างเฉลี่ยระหว่างครั้ง</div>
                </div>
                <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 14, padding: 14 }}>
                  <Award size={16} color="#9A3B33" />
                  <div style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>{stats.busiestYear ? `ปี ${stats.busiestYear}` : "—"}</div>
                  <div style={{ fontSize: 11.5, color: "#8A7370", marginTop: 2 }}>
                    {stats.busiestYear ? `บริจาคมากสุด ${stats.busiestCount} ครั้ง` : "ยังไม่มีข้อมูลพอ"}
                  </div>
                </div>
                <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 14, padding: 14, gridColumn: "span 2" }}>
                  <Droplet size={16} color="#9A3B33" />
                  <div style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>
                    {(stats.estVolumeMl / 1000).toFixed(stats.estVolumeMl % 1000 === 0 ? 0 : 1)} <span style={{ fontSize: 12, fontWeight: 500 }}>ลิตร (โดยประมาณ)</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#8A7370", marginTop: 2 }}>ปริมาณโลหิตสะสม (คำนวณที่ 350 มล./ครั้ง)</div>
                </div>
              </div>

              <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 16, padding: "16px 12px 8px", marginBottom: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, paddingLeft: 4, color: "#3A2C29" }}>จำนวนครั้งต่อปี</div>
                {stats.yearData.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 0", color: "#B39B96", fontSize: 13 }}>ยังไม่มีข้อมูลให้แสดงกราฟ</div>
                ) : (
                  <div style={{ width: "100%", height: 180 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.yearData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#EEDEDA" vertical={false} />
                        <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#8A7370" }} axisLine={{ stroke: "#EEDEDA" }} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#8A7370" }} axisLine={false} tickLine={false} width={24} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #EEDEDA" }} formatter={(v) => [`${v} ครั้ง`, ""]} labelFormatter={(l) => `ปี ${l}`} />
                        <Bar dataKey="count" fill="#9A3B33" radius={[6, 6, 0, 0]} maxBarSize={36} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {startingCountNum > 0 && (
                  <p style={{ fontSize: 10.5, color: "#B39B96", margin: "8px 4px 4px", lineHeight: 1.5 }}>
                    * ไม่รวมยอดสะสมยกมา {startingCountNum} ครั้ง เนื่องจากไม่มีวันที่รายครั้งให้แสดงในกราฟ (แต่รวมอยู่ในจำนวนครั้งสะสมและปริมาณโลหิตด้านบนแล้ว)
                  </p>
                )}
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#3A2C29" }}>สำรอง / กู้คืนข้อมูล</div>
              <p style={{ fontSize: 11.5, color: "#8A7370", margin: "0 0 10px", lineHeight: 1.6 }}>
                ข้อมูลอยู่ในเครื่องนี้เท่านั้น ไม่มีการส่งขึ้นเซิร์ฟเวอร์ของเรา แนะนำให้ส่งออกไฟล์เก็บไว้ใน Google Drive หรือ iCloud Drive ของคุณเองเป็นระยะ
              </p>
              {lastExportCount > 0 && (
                <div style={{ fontSize: 11, color: "#B39B96", marginBottom: 10 }}>ส่งออกล่าสุดตอนมี {lastExportCount} รายการ</div>
              )}
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <button onClick={exportData} className="btn-ghost" style={{ flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }}>
                  <Download size={14} /> ส่งออกข้อมูล
                </button>
                <button onClick={triggerImport} disabled={importing} className="btn-ghost" style={{ flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }}>
                  <Upload size={14} /> {importing ? "กำลังอ่านไฟล์..." : "นำเข้าไฟล์"}
                </button>
              </div>
              <button onClick={() => setShowReset(true)} className="btn-ghost" style={{ width: "100%", padding: "10px 0", borderRadius: 10, fontSize: 13, cursor: "pointer" }}>
                ลบข้อมูลทั้งหมด
              </button>
            </>
          )}

          {tab === "missions" && (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 4 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#3A2C29" }}>ภารกิจนักบริจาค</div>
                </div>
                <button
                  onClick={openShareCard}
                  disabled={totalCount === 0 || sharingCard}
                  className="btn-ghost"
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10, fontSize: 12, whiteSpace: "nowrap", cursor: totalCount === 0 ? "not-allowed" : "pointer" }}>
                  <Share2 size={14} /> {sharingCard ? "กำลังสร้าง..." : "แชร์การให้ที่ยิ่งใหญ่ของคุณ"}
                </button>
              </div>
              <p style={{ fontSize: 12.5, color: "#8A7370", margin: "0 0 12px" }}>สะสมความสำเร็จและเตรียมตัวให้พร้อมทุกครั้งที่บริจาค</p>

              <p style={{ fontSize: 11, color: "#B39B96", lineHeight: 1.6, margin: "0 0 16px" }}>
                เกณฑ์เข็มที่ระลึกและเหรียญกาชาดสมนาคุณ/พัดกาชาดอ้างอิงจากศูนย์บริการโลหิตแห่งชาติ สภากาชาดไทย โปรดยืนยันสิทธิ์ที่ได้รับจริงกับเจ้าหน้าที่ ณ จุดบริจาคอีกครั้ง
              </p>

              {stats.nextAchievement && (
                <div style={{ background: "#9A3B33", borderRadius: 16, padding: "16px 18px", color: "#FFF7F5", marginBottom: 18 }}>
                  <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>ภารกิจถัดไป</div>
                  <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 10 }}>
                    อีก {stats.nextAchievement.threshold - totalCount} ครั้ง ถึง "{stats.nextAchievement.title}"
                  </div>
                  <div style={{ height: 7, borderRadius: 4, background: "rgba(255,247,245,0.3)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, (totalCount / stats.nextAchievement.threshold) * 100)}%`, background: "#FFF7F5", borderRadius: 4 }} />
                  </div>
                </div>
              )}

              <div style={{ fontSize: 13, fontWeight: 700, color: "#3A2C29", marginBottom: 10 }}>
                {donorType === "monk" ? "พัดกาชาด" : "เหรียญกาชาดสมนาคุณ"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 22 }}>
                {medalAchievements.map((a) => {
                  const unlocked = totalCount >= a.threshold;
                  return (
                    <div key={a.id} style={{
                      background: unlocked ? "#FFFFFF" : "#F3EAE8",
                      border: unlocked ? "1px solid #E3C8C3" : "1px solid #EEDEDA",
                      borderRadius: 14, padding: 12, opacity: unlocked ? 1 : 0.6, textAlign: "center",
                    }}>
                      <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                        {unlocked ? (
                          <AchievementIcon achievement={a} isMonk={donorType === "monk"} size={30} />
                        ) : (
                          <div style={{ width: 34, height: 34, borderRadius: 9, background: "#D8C6C2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Lock size={15} color="#8A7370" />
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#3A2C29", marginBottom: 3, lineHeight: 1.35 }}>{a.title}</div>
                      <div style={{ fontSize: 10.5, color: "#8A7370", lineHeight: 1.4 }}>
                        {unlocked ? a.desc : `อีก ${a.threshold - totalCount} ครั้ง`}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: "#3A2C29", marginBottom: 10 }}>เข็มที่ระลึก</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
                {pinAchievements.map((a) => {
                  const unlocked = totalCount >= a.threshold;
                  return (
                    <div key={a.id} style={{
                      background: unlocked ? "#FFFFFF" : "#F3EAE8",
                      border: unlocked ? "1px solid #E3C8C3" : "1px solid #EEDEDA",
                      borderRadius: 14, padding: 14, opacity: unlocked ? 1 : 0.6,
                    }}>
                      <div style={{ height: 40, display: "flex", alignItems: "center", marginBottom: 10 }}>
                        {unlocked ? (
                          <AchievementIcon achievement={a} isMonk={donorType === "monk"} size={26} />
                        ) : (
                          <div style={{ width: 34, height: 34, borderRadius: 9, background: "#D8C6C2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Lock size={15} color="#8A7370" />
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#3A2C29", marginBottom: 3 }}>{a.title}</div>
                      <div style={{ fontSize: 11, color: "#8A7370", lineHeight: 1.5 }}>
                        {unlocked ? a.desc : `อีก ${a.threshold - totalCount} ครั้งจะปลดล็อก`}
                      </div>
                    </div>
                  );
                })}
              </div>

            </>
          )}

          {tab === "knowledge" && (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#3A2C29", marginBottom: 4 }}>ให้ความรู้เรื่องการบริจาคโลหิต</div>
              <p style={{ fontSize: 12.5, color: "#8A7370", margin: "0 0 18px", lineHeight: 1.6 }}>
                ข้อมูลพื้นฐานที่ควรรู้ก่อนและหลังบริจาคโลหิต
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <ShieldCheck size={16} color="#9A3B33" />
                <div style={{ fontSize: 14, fontWeight: 700, color: "#3A2C29" }}>เกณฑ์คุณสมบัติผู้บริจาค</div>
              </div>
              <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 14, padding: "6px 15px", marginBottom: 18 }}>
                {ELIGIBILITY_CRITERIA.map((t, i) => {
                  const Icon = t.icon;
                  return (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 0", borderBottom: i < ELIGIBILITY_CRITERIA.length - 1 ? "1px solid #F3EAE8" : "none" }}>
                      <Icon size={16} color="#9A3B33" style={{ marginTop: 1, flexShrink: 0 }} />
                      <div style={{ fontSize: 13, color: "#3A2C29", lineHeight: 1.6 }}>{t.text}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <BookOpen size={16} color="#9A3B33" />
                <div style={{ fontSize: 14, fontWeight: 700, color: "#3A2C29" }}>เตรียมตัวก่อนบริจาค</div>
              </div>
              <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 14, padding: "6px 15px", marginBottom: 18 }}>
                {PRE_DONATION_TIPS.map((t, i) => {
                  const Icon = t.icon;
                  return (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 0", borderBottom: i < PRE_DONATION_TIPS.length - 1 ? "1px solid #F3EAE8" : "none" }}>
                      <Icon size={16} color="#9A3B33" style={{ marginTop: 1, flexShrink: 0 }} />
                      <div style={{ fontSize: 13, color: "#3A2C29", lineHeight: 1.6 }}>{t.text}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <HeartPulse size={16} color="#9A3B33" />
                <div style={{ fontSize: 14, fontWeight: 700, color: "#3A2C29" }}>ดูแลตัวเองหลังบริจาค</div>
              </div>
              <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 14, padding: "6px 15px", marginBottom: 18 }}>
                {POST_DONATION_TIPS.map((t, i) => {
                  const Icon = t.icon;
                  return (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 0", borderBottom: i < POST_DONATION_TIPS.length - 1 ? "1px solid #F3EAE8" : "none" }}>
                      <Icon size={16} color="#9A3B33" style={{ marginTop: 1, flexShrink: 0 }} />
                      <div style={{ fontSize: 13, color: "#3A2C29", lineHeight: 1.6 }}>{t.text}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Info size={16} color="#9A3B33" />
                <div style={{ fontSize: 14, fontWeight: 700, color: "#3A2C29" }}>ความเข้าใจผิดที่พบบ่อย</div>
              </div>
              <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 14, padding: "6px 15px", marginBottom: 18 }}>
                {DONATION_MYTHS.map((t, i) => {
                  const Icon = t.icon;
                  return (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 0", borderBottom: i < DONATION_MYTHS.length - 1 ? "1px solid #F3EAE8" : "none" }}>
                      <Icon size={16} color="#9A3B33" style={{ marginTop: 1, flexShrink: 0 }} />
                      <div style={{ fontSize: 13, color: "#3A2C29", lineHeight: 1.6 }}>{t.text}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <HeartPulse size={16} color="#9A3B33" />
                <div style={{ fontSize: 14, fontWeight: 700, color: "#3A2C29" }}>ประโยชน์ต่อร่างกาย</div>
              </div>
              <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 14, padding: "6px 15px", marginBottom: 18 }}>
                {DONATION_BENEFITS.map((t, i) => {
                  const Icon = t.icon;
                  return (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 0", borderBottom: i < DONATION_BENEFITS.length - 1 ? "1px solid #F3EAE8" : "none" }}>
                      <Icon size={16} color="#9A3B33" style={{ marginTop: 1, flexShrink: 0 }} />
                      <div style={{ fontSize: 13, color: "#3A2C29", lineHeight: 1.6 }}>{t.text}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <MapPin size={16} color="#9A3B33" />
                <div style={{ fontSize: 14, fontWeight: 700, color: "#3A2C29" }}>ช่องทางติดต่อศูนย์บริจาค</div>
              </div>
              <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 14, padding: "14px 15px", marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: "#3A2C29", lineHeight: 1.7 }}>
                  ศูนย์บริการโลหิตแห่งชาติ สภากาชาดไทย โทร. 1666 หรือค้นหาหน่วยรับบริจาคเคลื่อนที่ใกล้บ้านผ่านเว็บไซต์/แอปของสภากาชาดไทย
                </div>
              </div>

              <p style={{ fontSize: 11, color: "#B39B96", lineHeight: 1.6 }}>
                ข้อมูลทั่วไปเพื่อความรู้เบื้องต้นเท่านั้น ไม่ใช่คำแนะนำทางการแพทย์เฉพาะบุคคล หากมีข้อสงสัยให้สอบถามเจ้าหน้าที่ ณ จุดบริจาคโดยตรง
              </p>
            </>
          )}

          {error && <div style={{ color: "#B3261E", fontSize: 12.5, marginTop: 10 }} role="alert">{error}</div>}
        </div>
      )}

      {phase === "app" && (
        <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleImportFile} style={{ display: "none" }} aria-label="เลือกไฟล์สำรองข้อมูล" />
      )}

      {phase === "app" && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 40 }}>
          <div style={{ width: "100%", maxWidth: 420, background: "#FFFFFF", borderTop: "1px solid #EEDEDA", display: "flex", padding: "8px 20px calc(8px + env(safe-area-inset-bottom))" }}>
            <button onClick={() => setTab("home")} aria-label="หน้าหลัก" aria-current={tab === "home" ? "page" : undefined} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 0", color: tab === "home" ? "#9A3B33" : "#B39B96" }}>
              <Home size={19} />
              <span style={{ fontSize: 11, fontWeight: 600 }}>หน้าหลัก</span>
            </button>
            <button onClick={() => setTab("dashboard")} aria-label="แดชบอร์ด" aria-current={tab === "dashboard" ? "page" : undefined} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 0", color: tab === "dashboard" ? "#9A3B33" : "#B39B96" }}>
              <BarChart3 size={19} />
              <span style={{ fontSize: 11, fontWeight: 600 }}>แดชบอร์ด</span>
            </button>
            <button onClick={() => setTab("missions")} aria-label="ภารกิจ" aria-current={tab === "missions" ? "page" : undefined} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 0", color: tab === "missions" ? "#9A3B33" : "#B39B96" }}>
              <div style={{ position: "relative" }}>
                <Trophy size={19} />
                {hasNewAchievement && (
                  <span style={{ position: "absolute", top: -2, right: -3, width: 8, height: 8, borderRadius: "50%", background: "#B3261E", border: "1.5px solid #FFFFFF" }} />
                )}
              </div>
              <span style={{ fontSize: 11, fontWeight: 600 }}>ภารกิจ</span>
            </button>
            <button onClick={() => setTab("knowledge")} aria-label="ให้ความรู้" aria-current={tab === "knowledge" ? "page" : undefined} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 0", color: tab === "knowledge" ? "#9A3B33" : "#B39B96" }}>
              <BookOpen size={19} />
              <span style={{ fontSize: 11, fontWeight: 600 }}>ให้ความรู้</span>
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" style={{
          position: "fixed", bottom: phase === "app" ? 82 : 24, left: "50%", transform: "translateX(-50%)",
          background: toast.type === "error" ? "#B3261E" : "#2E5E4E", color: "#FFF7F5", padding: "10px 18px",
          borderRadius: 12, fontSize: 12.5, maxWidth: "88%", textAlign: "center", zIndex: 70, boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
          display: "flex", alignItems: "center", gap: 7, justifyContent: "center",
        }}>
          <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: "50%", background: "rgba(255,247,245,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {toast.type === "error" ? <AlertTriangle size={12} color="#FFF7F5" /> : <CheckCircle2 size={12} color="#FFF7F5" />}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      {showProfile && (
        <div role="dialog" aria-modal="true" aria-label="โปรไฟล์ของฉัน" style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "#FBF6F5", width: "100%", maxWidth: 420, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>โปรไฟล์ของฉัน</div>
              <button onClick={() => setShowProfile(false)} aria-label="ปิด" style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} /></button>
            </div>
            <p style={{ fontSize: 12, color: "#8A7370", lineHeight: 1.6, margin: "0 0 16px" }}>
              ทุกช่องเป็นข้อมูลไม่บังคับ ใส่หรือไม่ใส่ก็ได้ เก็บไว้ในเครื่องนี้เท่านั้นเหมือนข้อมูลบริจาคอื่น ๆ
            </p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12.5, color: "#7A6360", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}><User size={13} /> ชื่อเล่น</label>
              <input type="text" value={profileDraft.nickname} placeholder="ตั้งชื่อเล่นให้ตัวเอง" maxLength={30}
                onChange={(e) => setProfileDraft(f => ({ ...f, nickname: e.target.value }))}
                style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #E3C8C3", fontSize: 14, fontFamily: "inherit" }} />
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12.5, color: "#7A6360", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}><Cake size={13} /> อายุ (ปี)</label>
                <input type="number" min="0" max="120" value={profileDraft.age} placeholder="เช่น 28"
                  onChange={(e) => setProfileDraft(f => ({ ...f, age: e.target.value }))}
                  style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #E3C8C3", fontSize: 14, fontFamily: "inherit" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12.5, color: "#7A6360", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}><Scale size={13} /> น้ำหนัก (กก.)</label>
                <input type="number" min="0" max="300" value={profileDraft.weight} placeholder="เช่น 55"
                  onChange={(e) => setProfileDraft(f => ({ ...f, weight: e.target.value }))}
                  style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #E3C8C3", fontSize: 14, fontFamily: "inherit" }} />
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12.5, color: "#7A6360", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><Droplets size={13} /> หมู่โลหิต</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {BLOOD_TYPES.map((bt) => (
                  <button key={bt} onClick={() => setProfileDraft(f => ({ ...f, bloodType: f.bloodType === bt ? "" : bt }))}
                    style={{
                      padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer",
                      border: profileDraft.bloodType === bt ? "1px solid #9A3B33" : "1px solid #E3C8C3",
                      background: profileDraft.bloodType === bt ? "#9A3B33" : "#FFFFFF",
                      color: profileDraft.bloodType === bt ? "#FFF7F5" : "#3A2C29",
                    }}>
                    {bt}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 14, padding: 14, marginBottom: 20 }}>
              <label style={{ fontSize: 12.5, color: "#7A6360", display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}><Trophy size={13} /> เคยบริจาคมาก่อนใช้แอปนี้ไหม?</label>
              <p style={{ fontSize: 11.5, color: "#8A7370", lineHeight: 1.6, margin: "0 0 10px" }}>
                ใส่ยอดสะสมตรงนี้ได้เลย ไม่ต้องย้อนกลับไปกรอกทีละรายการ — <b>ไม่ต้องนับรวมครั้งล่าสุด</b> เพราะถ้าจำครั้งล่าสุดได้ ระบบจะให้กรอกเป็นรายการบริจาคจริงตอนกด "บันทึกบริจาคโลหิต" ครั้งแรกแทน (ถ้าจำยอดรวมไม่ได้แน่ชัด ลองเช็คจากเข็ม/เหรียญที่เคยได้รับก็ได้ เช่น มีเข็มครั้งที่ 84 แปลว่าบริจาคอย่างน้อย 84 ครั้งแล้ว)
              </p>
              <div>
                <label style={{ fontSize: 12, color: "#7A6360", display: "block", marginBottom: 6 }}>จำนวนครั้งที่เคยบริจาคมาก่อน (ไม่รวมครั้งล่าสุด)</label>
                <input type="number" min="0" max={MAX_STARTING_COUNT} step="1" value={profileDraft.startingCount} placeholder="0"
                  onChange={(e) => setProfileDraft(f => ({ ...f, startingCount: e.target.value }))}
                  style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #E3C8C3", fontSize: 14, fontFamily: "inherit" }} />
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12.5, color: "#7A6360", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><Award size={13} /> ประเภทผู้บริจาค (สำหรับเข็ม/เหรียญในหน้าภารกิจ)</label>
              <div style={{ display: "flex", gap: 8 }}>
                {DONOR_TYPES.map((dt) => (
                  <button key={dt.key} onClick={() => setProfileDraft(f => ({ ...f, donorType: dt.key }))}
                    style={{
                      flex: 1, padding: "9px 0", borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                      border: profileDraft.donorType === dt.key ? "1px solid #9A3B33" : "1px solid #E3C8C3",
                      background: profileDraft.donorType === dt.key ? "#9A3B33" : "#FFFFFF",
                      color: profileDraft.donorType === dt.key ? "#FFF7F5" : "#3A2C29",
                    }}>
                    {dt.label}
                  </button>
                ))}
              </div>
            </div>
            {profileError && <div style={{ color: "#B3261E", fontSize: 12.5, marginBottom: 10 }} role="alert">{profileError}</div>}
            <button onClick={saveProfile} disabled={saving} className="btn-primary" style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", fontSize: 14.5, fontWeight: 600, cursor: "pointer" }}>
              {saving ? "กำลังบันทึก..." : "บันทึกโปรไฟล์"}
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div role="dialog" aria-modal="true" aria-label={editingId ? "แก้ไขข้อมูลการบริจาคโลหิต" : "ระบุข้อมูลการบริจาคโลหิต"} style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "#FBF6F5", width: "100%", maxWidth: 420, borderRadius: "20px 20px 0 0", padding: "20px 20px 28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{editingId ? "แก้ไขข้อมูลการบริจาคโลหิต" : "ระบุข้อมูลการบริจาคโลหิต"}</div>
              <button onClick={closeForm} aria-label="ปิด" style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} /></button>
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: 12.5, color: "#7A6360", display: "block", marginBottom: 6 }}>วันที่บริจาคโลหิต</label>
                <input type="date" value={form.date} max={new Date().toISOString().slice(0,10)}
                  onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                  style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #E3C8C3", fontSize: 14, fontFamily: "inherit" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12.5, color: "#7A6360", display: "block", marginBottom: 6 }}>เวลา (ไม่บังคับ)</label>
                <input type="time" value={form.time}
                  onChange={(e) => setForm(f => ({ ...f, time: e.target.value }))}
                  style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #E3C8C3", fontSize: 14, fontFamily: "inherit" }} />
              </div>
            </div>
            {sameDateConflict ? (
              <div style={{ fontSize: 11.5, color: "#B3261E", lineHeight: 1.6, margin: "8px 0 0" }} role="alert">{sameDateConflictMessage}</div>
            ) : closeGapWarning && (
              <div style={{ fontSize: 11.5, color: "#B5651D", lineHeight: 1.6, margin: "8px 0 0" }}>{closeGapWarning}</div>
            )}
            <div style={{ marginTop: 14, marginBottom: 14 }}>
              <label style={{ fontSize: 12.5, color: "#7A6360", display: "block", marginBottom: 6 }}>สถานที่ (ไม่บังคับ)</label>
              <input type="text" value={form.location} placeholder="เช่น ศูนย์บริการโลหิตแห่งชาติ สภากาชาดไทย" maxLength={MAX_LOCATION_LEN}
                onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
                style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #E3C8C3", fontSize: 14, fontFamily: "inherit" }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12.5, color: "#7A6360", display: "block", marginBottom: 6 }}>บันทึกช่วยจำ (ไม่บังคับ)</label>
              <textarea value={form.note} placeholder="การบริจาคครั้งนี้เป็นอย่างไรบ้าง ?" maxLength={MAX_NOTE_LEN} rows={3}
                onChange={(e) => setForm(f => ({ ...f, note: e.target.value }))}
                style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #E3C8C3", fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
              <div style={{ fontSize: 11, color: "#B7A5A1", textAlign: "right", marginTop: 4 }}>{form.note.length}/{MAX_NOTE_LEN}</div>
            </div>
            {formError && <div style={{ color: "#B3261E", fontSize: 12.5, marginBottom: 10 }} role="alert">{formError}</div>}
            <button onClick={submitDonation} disabled={saving || sameDateConflict || editFormUnchanged} className="btn-primary" style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", fontSize: 14.5, fontWeight: 600, cursor: (saving || sameDateConflict || editFormUnchanged) ? "not-allowed" : "pointer", opacity: (sameDateConflict || editFormUnchanged) ? 0.55 : 1 }}>
              {saving ? "กำลังบันทึก..." : (editingId ? "บันทึกการแก้ไข" : "บันทึก")}
            </button>
          </div>
        </div>
      )}

      {showOnboardingChoice && (
        <div role="dialog" aria-modal="true" aria-label="เริ่มบันทึกการบริจาคเลือด" style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div style={{ background: "#FBF6F5", width: "100%", maxWidth: 380, borderRadius: 18, padding: 22, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 15.5, fontWeight: 700 }}>นี่คือการบริจาคโลหิตครั้งใด?</div>
              <button onClick={() => setShowOnboardingChoice(false)} aria-label="ปิด" style={{ background: "none", border: "none", cursor: "pointer" }}><X size={19} /></button>
            </div>
            <p style={{ fontSize: 12.5, color: "#8A7370", lineHeight: 1.6, margin: "0 0 16px" }}>
              เพื่อความถูกต้องในการนับจำนวนครั้ง
            </p>
            <button onClick={chooseFirstDonation}
              style={{ width: "100%", textAlign: "left", padding: "14px 15px", borderRadius: 14, border: "1px solid #EEDEDA", background: "#FFFFFF", marginBottom: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
              <Droplet size={20} color="#9A3B33" style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0, fontSize: 14, fontWeight: 600, color: "#3A2C29" }}>บริจาคครั้งแรก</div>
            </button>
            <button onClick={chooseHasStartingCount}
              style={{ width: "100%", textAlign: "left", padding: "14px 15px", borderRadius: 14, border: "1px solid #EEDEDA", background: "#FFFFFF", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
              <Trophy size={20} color="#9A3B33" style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0, fontSize: 14, fontWeight: 600, color: "#3A2C29" }}>เคยบริจาคแล้ว</div>
            </button>
          </div>
        </div>
      )}

      {showStartingCountQuickEntry && (
        <div role="dialog" aria-modal="true" aria-label="เคยบริจาคเลือดมาแล้วกี่ครั้ง" style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div style={{ background: "#FBF6F5", width: "100%", maxWidth: 380, maxHeight: "90vh", overflowY: "auto", borderRadius: 18, padding: 22 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 8 }}>เคยบริจาคเลือดมาแล้วกี่ครั้ง?</div>
            <p style={{ fontSize: 12, color: "#8A7370", lineHeight: 1.6, margin: "0 0 16px" }}>
              ระบุจำนวนครั้งทั้งหมด (รวมครั้งล่าสุด) และวันที่บริจาคล่าสุด ระบบจะแยกเก็บให้อัตโนมัติ
            </p>

            <label style={{ display: "block", fontSize: 12.5, color: "#5C4A46", marginBottom: 6, fontWeight: 500 }}>จำนวนครั้งที่เคยบริจาคทั้งหมด</label>
            <input type="number" min="1" max={MAX_STARTING_COUNT} step="1" value={quickStartingCountDraft} placeholder="0" autoFocus
              onChange={(e) => setQuickStartingCountDraft(e.target.value)}
              style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #E3C8C3", fontSize: 14, fontFamily: "inherit", marginBottom: 12 }} />

            <div style={{ display: "flex", gap: 8, background: "#F6EBE9", border: "1px solid #EEDEDA", borderRadius: 12, padding: "10px 12px", margin: "0 0 16px" }}>
              <Info size={14} color="#9A3B33" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 11.5, color: "#7A6360", lineHeight: 1.55 }}>
                หากต้องการบันทึกรายละเอียดการบริจาคทีละรายการทั้งหมดเอง กรุณาใส่ 1 แล้วกรอกรายการบริจาคแรกที่จำได้ด้านล่าง จากนั้นเพิ่มรายการที่เหลือได้ทีละรายการที่หน้าหลัก
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1.5, minWidth: 0 }}>
                <label style={{ display: "block", fontSize: 12.5, color: "#5C4A46", marginBottom: 6, fontWeight: 500 }}>วันที่บริจาคล่าสุด</label>
                <input type="date" value={quickEntryForm.date} max={new Date().toISOString().slice(0,10)}
                  onChange={(e) => setQuickEntryForm(f => ({ ...f, date: e.target.value }))}
                  style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #E3C8C3", fontSize: 14, fontFamily: "inherit" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ display: "block", fontSize: 12.5, color: "#5C4A46", marginBottom: 6, fontWeight: 500 }}>เวลา <span style={{ fontWeight: 400, color: "#B7A5A1", fontSize: 11 }}>(ไม่บังคับ)</span></label>
                <input type="time" value={quickEntryForm.time}
                  onChange={(e) => setQuickEntryForm(f => ({ ...f, time: e.target.value }))}
                  style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #E3C8C3", fontSize: 14, fontFamily: "inherit" }} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12.5, color: "#5C4A46", marginBottom: 6, fontWeight: 500 }}>สถานที่ <span style={{ fontWeight: 400, color: "#B7A5A1", fontSize: 11 }}>(ไม่บังคับ)</span></label>
              <input type="text" value={quickEntryForm.location} placeholder="เช่น ศูนย์บริการโลหิตแห่งชาติ สภากาชาดไทย" maxLength={MAX_LOCATION_LEN}
                onChange={(e) => setQuickEntryForm(f => ({ ...f, location: e.target.value }))}
                style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #E3C8C3", fontSize: 14, fontFamily: "inherit" }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12.5, color: "#5C4A46", marginBottom: 6, fontWeight: 500 }}>บันทึกช่วยจำ <span style={{ fontWeight: 400, color: "#B7A5A1", fontSize: 11 }}>(ไม่บังคับ)</span></label>
              <input type="text" value={quickEntryForm.note} placeholder="การบริจาคครั้งนี้เป็นอย่างไรบ้าง ?" maxLength={MAX_NOTE_LEN}
                onChange={(e) => setQuickEntryForm(f => ({ ...f, note: e.target.value }))}
                style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #E3C8C3", fontSize: 14, fontFamily: "inherit" }} />
            </div>

            {quickStartingCountError && <div style={{ color: "#B3261E", fontSize: 12.5, marginBottom: 10 }} role="alert">{quickStartingCountError}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={cancelStartingCountQuickEntry} disabled={saving} className="btn-ghost" style={{ flex: 1, padding: "11px 0", borderRadius: 10, fontSize: 13.5, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={submitStartingCountQuickEntry} disabled={saving} className="btn-primary" style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div role="dialog" aria-modal="true" aria-label="ตั้งค่า" style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div style={{ background: "#FBF6F5", width: "100%", maxWidth: 380, borderRadius: 18, padding: 22, maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 15.5, fontWeight: 700 }}>ตั้งค่า</div>
              <button onClick={() => setShowSettings(false)} aria-label="ปิด" style={{ background: "none", border: "none", cursor: "pointer" }}><X size={19} /></button>
            </div>

            <div style={{ fontSize: 11, color: "#9A3B33", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, margin: "0 0 6px" }}>ข้อมูลของฉัน</div>
            <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 12, padding: "0 4px", marginBottom: 18 }}>
              {lastExportCount > 0 && (
                <div style={{ fontSize: 11, color: "#B39B96", padding: "10px 8px 0" }}>ส่งออกล่าสุดตอนมี {lastExportCount} รายการ</div>
              )}
              <button onClick={exportData} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 8px", background: "none", border: "none", borderBottom: "1px solid #F3E7E4", cursor: "pointer", fontSize: 13.5, color: "#3A2C29", fontFamily: "inherit" }}>
                <Download size={16} color="#9A3B33" /> ส่งออกข้อมูล
              </button>
              <button onClick={triggerImport} disabled={importing} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 8px", background: "none", border: "none", borderBottom: "1px solid #F3E7E4", cursor: "pointer", fontSize: 13.5, color: "#3A2C29", fontFamily: "inherit" }}>
                <Upload size={16} color="#9A3B33" /> {importing ? "กำลังอ่านไฟล์..." : "นำเข้าไฟล์"}
              </button>
              <button onClick={() => { setShowSettings(false); setShowReset(true); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 8px", background: "none", border: "none", cursor: "pointer", fontSize: 13.5, color: "#C0392B", fontFamily: "inherit" }}>
                <Trash2 size={16} color="#C0392B" /> ลบข้อมูลทั้งหมด
              </button>
            </div>

            <div style={{ fontSize: 11, color: "#9A3B33", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, margin: "0 0 6px" }}>เกี่ยวกับ</div>
            <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 12, padding: "0 4px" }}>
              <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 8px", borderBottom: "1px solid #F3E7E4", fontSize: 13.5, color: "#3A2C29" }}>
                <span>เวอร์ชันแอป</span>
                <span style={{ color: "#8A7370", fontSize: 12 }}>{APP_VERSION}</span>
              </div>
              <button onClick={() => { setShowSettings(false); setShowPrivacy(true); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 8px", background: "none", border: "none", cursor: "pointer", fontSize: 13.5, color: "#3A2C29", fontFamily: "inherit" }}>
                <Info size={16} color="#9A3B33" /> ความเป็นส่วนตัว
              </button>
            </div>
          </div>
        </div>
      )}

      {showPrivacy && (
        <div role="dialog" aria-modal="true" aria-label="เกี่ยวกับข้อมูลของคุณ" style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div style={{ background: "#FBF6F5", width: "100%", maxWidth: 380, borderRadius: 18, padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 15.5, fontWeight: 700 }}>เกี่ยวกับข้อมูลของคุณ</div>
              <button onClick={() => setShowPrivacy(false)} aria-label="ปิด" style={{ background: "none", border: "none", cursor: "pointer" }}><X size={19} /></button>
            </div>
            <p style={{ fontSize: 13, color: "#5C4A46", lineHeight: 1.7, margin: "0 0 10px" }}>
              ข้อมูลทั้งหมดถูกกรอกโดยคุณเองและเก็บไว้เพื่อการใช้งานส่วนตัวเท่านั้น ไม่มีการเชื่อมต่อกับระบบของสภากาชาดไทยหรือหน่วยงานใด
            </p>
            <p style={{ fontSize: 13, color: "#5C4A46", lineHeight: 1.7, margin: "0 0 10px" }}>
              ช่องโปรไฟล์ (ชื่อเล่น, อายุ, น้ำหนัก, หมู่โลหิต, ยอดสะสมยกมา) เป็นข้อมูลไม่บังคับ ใส่หรือไม่ใส่ก็ได้ เก็บในเครื่องเช่นเดียวกัน แก้ไขได้จากไอคอนคนที่มุมขวาบน
            </p>
            <p style={{ fontSize: 13, color: "#5C4A46", lineHeight: 1.7, margin: "0 0 10px" }}>
              คุณสามารถส่งออกข้อมูลเป็นไฟล์ หรือลบข้อมูลทั้งหมดได้ตลอดเวลาที่แท็บแดชบอร์ด
            </p>
            <p style={{ fontSize: 13, color: "#5C4A46", lineHeight: 1.7, margin: "0 0 10px" }}>
              ให้ความยินยอมเมื่อ: {new Date().toLocaleDateString("th-TH")}
            </p>
            <p style={{ fontSize: 11, color: "#B7A5A1", lineHeight: 1.6, margin: 0 }}>
              เวอร์ชันแอป {APP_VERSION}
            </p>
          </div>
        </div>
      )}

      {showReset && (
        <div role="dialog" aria-modal="true" aria-label="ยืนยันการลบข้อมูลทั้งหมด" style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div style={{ background: "#FBF6F5", width: "100%", maxWidth: 360, borderRadius: 18, padding: 22 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 8 }}>ลบข้อมูลทั้งหมด?</div>
            <p style={{ fontSize: 13, color: "#5C4A46", lineHeight: 1.7, margin: "0 0 18px" }}>
              ประวัติการบริจาคทั้งหมด {donations.length} รายการ{startingCountNum > 0 ? ` และยอดสะสมยกมา ${startingCountNum} ครั้ง` : ""} จะถูกลบอย่างถาวรและกู้คืนไม่ได้
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowReset(false)} disabled={saving} className="btn-ghost" style={{ flex: 1, padding: "11px 0", borderRadius: 10, fontSize: 13.5, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={resetAll} disabled={saving} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: "#B3261E", color: "#FFF7F5", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
                {saving ? "กำลังลบ..." : "ลบข้อมูล"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div role="dialog" aria-modal="true" aria-label="ยืนยันการลบรายการ" style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div style={{ background: "#FBF6F5", width: "100%", maxWidth: 360, borderRadius: 18, padding: 22 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 8 }}>
              {(() => {
                const target = donations.find(d => d.id === confirmDeleteId);
                return target ? `ลบรายการบริจาคโลหิตวันที่ ${toBuddhistDate(target.date)} ?` : "ลบรายการนี้ ?";
              })()}
            </div>
            <p style={{ fontSize: 13, color: "#5C4A46", lineHeight: 1.7, margin: "0 0 18px" }}>
              รายการนี้จะถูกลบอย่างถาวร ไม่สามารถกู้คืนได้
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDeleteId(null)} className="btn-ghost" style={{ flex: 1, padding: "11px 0", borderRadius: 10, fontSize: 13.5, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={confirmDeleteDonation} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: "#B3261E", color: "#FFF7F5", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
                ลบรายการ
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteStartingCount && (
        <div role="dialog" aria-modal="true" aria-label="ยืนยันการลบยอดสะสมยกมา" style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div style={{ background: "#FBF6F5", width: "100%", maxWidth: 360, borderRadius: 18, padding: 22 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 8 }}>ลบยอดสะสมยกมา?</div>
            <p style={{ fontSize: 13, color: "#5C4A46", lineHeight: 1.7, margin: "0 0 18px" }}>
              จำนวนครั้งที่เคยบริจาคมาก่อนจะถูกล้างเป็น 0 (เหมือนยังไม่เคยกรอกมาก่อน) — กรอกใหม่ได้ทุกเมื่อ ไม่กระทบรายการบริจาคที่บันทึกในแอปโดยตรง
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDeleteStartingCount(false)} className="btn-ghost" style={{ flex: 1, padding: "11px 0", borderRadius: 10, fontSize: 13.5, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={confirmDeleteStartingCountNow} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: "#B3261E", color: "#FFF7F5", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
                ลบยอดสะสม
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingImport && (
        <div role="dialog" aria-modal="true" aria-label="ยืนยันการนำเข้าข้อมูล" style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div style={{ background: "#FBF6F5", width: "100%", maxWidth: 380, borderRadius: 18, padding: 22 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 10 }}>ยืนยันการนำเข้าข้อมูล</div>
            <p style={{ fontSize: 13, color: "#5C4A46", lineHeight: 1.8, margin: "0 0 6px" }}>ไฟล์นี้มีทั้งหมด {pendingImport.totalInFile} รายการ</p>
            <p style={{ fontSize: 13, color: "#5C4A46", lineHeight: 1.8, margin: "0 0 6px" }}>จะเพิ่มรายการใหม่ <b>{pendingImport.incoming.length}</b> รายการ</p>
            {pendingImport.duplicateCount > 0 && (
              <p style={{ fontSize: 13, color: "#8A7370", lineHeight: 1.8, margin: "0 0 8px" }}>ข้ามรายการที่มีอยู่แล้ว {pendingImport.duplicateCount} รายการ</p>
            )}
            {pendingImport.incoming.length === 0 && Object.keys(pendingImport.profileFieldsToFill || {}).length === 0 && (
              <p style={{ fontSize: 12.5, color: "#B39B96", lineHeight: 1.7, margin: "0 0 8px" }}>ไม่มีรายการใหม่ให้เพิ่ม — ข้อมูลในไฟล์นี้มีอยู่ในเครื่องแล้วทั้งหมด</p>
            )}
            {Object.keys(pendingImport.profileFieldsToFill || {}).length > 0 && (
              <p style={{ fontSize: 13, color: "#5C4A46", lineHeight: 1.8, margin: "0 0 8px" }}>
                จะเติมข้อมูลโปรไฟล์ที่ยังว่างอยู่ให้ด้วย: {Object.keys(pendingImport.profileFieldsToFill).map(k => ({ nickname: "ชื่อเล่น", age: "อายุ", weight: "น้ำหนัก", bloodType: "หมู่โลหิต" }[k])).join(", ")}
                <br /><span style={{ fontSize: 11.5, color: "#B39B96" }}>(ช่องที่คุณกรอกไว้แล้วจะไม่ถูกเขียนทับ)</span>
              </p>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button onClick={cancelImport} className="btn-ghost" style={{ flex: 1, padding: "11px 0", borderRadius: 10, fontSize: 13.5, cursor: "pointer" }}>ยกเลิก</button>
              <button
                onClick={confirmImport}
                disabled={pendingImport.incoming.length === 0 && Object.keys(pendingImport.profileFieldsToFill || {}).length === 0}
                className="btn-primary"
                style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
                นำเข้า
              </button>
            </div>
          </div>
        </div>
      )}

      {showExportPreview && (
        <div role="dialog" aria-modal="true" aria-label="ส่งออกข้อมูล" style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div style={{ background: "#FBF6F5", width: "100%", maxWidth: 420, borderRadius: 18, padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 15.5, fontWeight: 700 }}>ข้อมูลสำรองของคุณ</div>
              <button onClick={() => setShowExportPreview(false)} aria-label="ปิด" style={{ background: "none", border: "none", cursor: "pointer" }}><X size={19} /></button>
            </div>
            <p style={{ fontSize: 12.5, color: "#8A7370", lineHeight: 1.7, margin: "0 0 12px" }}>
              กด "ดาวน์โหลดไฟล์" เพื่อบันทึกเป็นไฟล์ หรือถ้าดาวน์โหลดไม่ได้ในหน้าพรีวิวนี้ ให้กด "คัดลอกข้อความ" แล้วนำไปวางเก็บไว้ในไฟล์ข้อความ/โน้ตของคุณแทนได้เลย
            </p>
            <textarea
              ref={exportTextareaRef}
              readOnly
              value={exportJsonText}
              onFocus={(e) => e.target.select()}
              aria-label="ข้อมูลสำรองแบบ JSON สำหรับคัดลอก — เลือกไว้ให้อัตโนมัติแล้ว กด Ctrl/Cmd+C เพื่อคัดลอกได้เลย"
              style={{ width: "100%", height: 140, borderRadius: 10, border: "1px solid #E3C8C3", padding: 10, fontSize: 11, fontFamily: "monospace", color: "#3A2C29", background: "#FFFFFF", marginBottom: 14, resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={copyExportText} className="btn-ghost" style={{ flex: 1, padding: "11px 0", borderRadius: 10, fontSize: 13, cursor: "pointer" }}>
                คัดลอกข้อความ
              </button>
              <button onClick={downloadExportFile} className="btn-primary" style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                ดาวน์โหลดไฟล์
              </button>
            </div>
          </div>
        </div>
      )}

      {showShareCard && (
        <div role="dialog" aria-modal="true" aria-label="แชร์ความสำเร็จ" style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div style={{ background: "#FBF6F5", width: "100%", maxWidth: 380, borderRadius: 18, padding: 20, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 15.5, fontWeight: 700 }}>แชร์การให้ที่ยิ่งใหญ่ของคุณ</div>
              <button onClick={() => setShowShareCard(false)} aria-label="ปิด" style={{ background: "none", border: "none", cursor: "pointer" }}><X size={19} /></button>
            </div>
            <div style={{ fontSize: 12, color: "#7A6360", marginBottom: 8, fontWeight: 500 }}>เลือกขนาดภาพ</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {Object.values(CARD_SIZES).map((size) => (
                <button
                  key={size.key}
                  onClick={() => setCardSizeKey(size.key)}
                  title={size.sub}
                  style={{
                    padding: "7px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    border: cardSizeKey === size.key ? "1px solid #9A3B33" : "1px solid #E3C8C3",
                    background: cardSizeKey === size.key ? "#9A3B33" : "#FFFFFF",
                    color: cardSizeKey === size.key ? "#FFF7F5" : "#3A2C29",
                  }}>
                  {size.label}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11.5, color: "#8A7370", margin: "0 0 12px" }}>
              {(CARD_SIZES[cardSizeKey] || CARD_SIZES[DEFAULT_CARD_SIZE]).sub}
            </p>
            <div style={{
              width: "100%",
              aspectRatio: `${(CARD_SIZES[cardSizeKey] || CARD_SIZES[DEFAULT_CARD_SIZE]).w} / ${(CARD_SIZES[cardSizeKey] || CARD_SIZES[DEFAULT_CARD_SIZE]).h}`,
              borderRadius: 14, marginBottom: 12, overflow: "hidden", background: "#3A2C29",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {shareCardDataUrl && !sharingCard ? (
                <img
                  src={shareCardDataUrl}
                  alt="ภาพความสำเร็จการบริจาคเลือดของคุณจาก Blood Journey พร้อมจำนวนครั้งสะสมและตราความสำเร็จล่าสุด"
                  style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                />
              ) : (
                <div style={{ color: "#FFF7F5", fontSize: 12.5, opacity: 0.8 }}>กำลังสร้างภาพ...</div>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              {canShareFiles && (
                <button onClick={nativeShareCard} disabled={sharingCard || !shareCardDataUrl} className="btn-primary" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px 0", borderRadius: 12, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  <Share2 size={16} /> แชร์
                </button>
              )}
              <button onClick={downloadShareCard} disabled={sharingCard || !shareCardDataUrl} className={canShareFiles ? "" : "btn-primary"} style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px 0", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer",
                ...(canShareFiles
                  ? { background: "#FFFFFF", color: "#9A3B33", border: "1.5px solid #9A3B33" }
                  : { border: "none" }),
              }}>
                <Download size={16} /> ดาวน์โหลด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Catches any error thrown while rendering the app below it (a coding bug,
// a browser API that's unexpectedly missing, etc.) so a crash shows a
// recoverable message instead of leaving the whole preview blank/white.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {
    // Intentionally no external logging — this app has no backend.
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: 400, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#FBF6F5", padding: 28, textAlign: "center", fontFamily: "'Noto Sans Thai', 'Inter', sans-serif" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#3A2C29", marginBottom: 8 }}>เกิดข้อผิดพลาดบางอย่าง</div>
          <p style={{ fontSize: 13, color: "#5C4A46", lineHeight: 1.7, marginBottom: 18 }}>
            ข้อมูลของคุณยังปลอดภัยอยู่ในเครื่องนี้ ไม่ได้หายไปไหน ลองกดปุ่มด้านล่างเพื่อโหลดหน้านี้ใหม่อีกครั้ง
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{ padding: "11px 22px", borderRadius: 12, border: "none", background: "#9A3B33", color: "#FFF7F5", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            ลองใหม่อีกครั้ง
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
