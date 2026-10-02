import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from "react";
import { Droplet, Plus, PlusCircle, Calendar, MapPin, Trash2, Pencil, Download, Upload, ShieldCheck, X, Info, CheckCircle2, Clock, Home, BarChart3, Award, Gauge, Trophy, Lock, BookOpen, Sparkles, Moon, Utensils, GlassWater, Beef, CreditCard, Timer, Dumbbell, HeartPulse, AlertTriangle, AlertCircle, User, Scale, Weight, Cake, Droplets, Share2, StickyNote, MoreVertical, Settings, Mail, Camera, Image as ImageIcon, Eye, EyeOff, ChevronRight, SlidersHorizontal, Users, ChevronDown, PersonStanding, Ruler, BellOff, Copy, Pill, Unlock, Dices, Check } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
// @line/liff and recharts are loaded on demand (their own chunks) instead of
// being bundled into the main file -- together they were a large part of a
// ~980KB main bundle, slow to open in LINE on mobile data. liff is only ever
// used inside LINE (main.jsx loads and inits it there before render, so by
// the time anyone taps, this import resolves instantly); recharts is only
// the dashboard's yearly chart.
const openInExternalBrowser = (url) =>
  import("@line/liff").then(({ default: liff }) => liff.openWindow({ url, external: true }));

const YearAreaChart = React.lazy(() => import("recharts").then((R) => ({
  default: function YearAreaChart({ data }) {
    return (
      <R.ResponsiveContainer width="100%" height="100%">
        <R.AreaChart data={data} margin={{ top: 20, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="yearAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#9A3B33" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#9A3B33" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <R.CartesianGrid strokeDasharray="3 3" stroke="#EEDEDA" vertical={false} />
          <R.XAxis dataKey="year" tick={{ fontSize: 11, fill: "#7A6360" }} axisLine={{ stroke: "#EEDEDA" }} tickLine={false} />
          <R.YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#7A6360" }} axisLine={false} tickLine={false} width={24} />
          <R.Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #EEDEDA" }} formatter={(v) => [`${v} ครั้ง`, ""]} labelFormatter={(l) => `ปี ${l}`} />
          <R.Area type="monotone" dataKey="count" stroke="#9A3B33" strokeWidth={2.5} fill="url(#yearAreaGrad)" dot={{ r: 4, fill: "#9A3B33", strokeWidth: 0 }} activeDot={{ r: 5 }} />
        </R.AreaChart>
      </R.ResponsiveContainer>
    );
  },
})));

// True only when running inside the packaged iOS/Android app shell (Capacitor
// WebView), never inside the LINE LIFF web build — used to route persistence
// through the native Preferences API (real OS-level storage, no LINE/WebView
// storage-eviction risk) instead of localStorage, and later to gate native
// save/share/calendar features that don't exist in the LIFF web build.
const isNativeApp = (() => {
  try {
    return Capacitor.isNativePlatform();
  } catch (e) {
    return false;
  }
})();

// LINE's own in-app browser (used for both the rich-menu LIFF view and any
// link tapped inside a LINE chat) is the one context that blocks essentially
// every client-side save/share mechanism — confirmed this session across
// blob downloads, data: URI navigation, the Web Share API, and even the
// browser's native long-press-to-save. It's never true in the packaged
// native app (no WebView UA to sniff) or in a real browser tab.
const isLineInAppBrowser = !isNativeApp && typeof navigator !== "undefined" && (navigator.userAgent.includes("Line/") || navigator.userAgent.includes("LIFF/"));

const THAI_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const APP_VERSION = "1.0.340";
// v2 (v1.0.112): profile gained birth year, gender, height, donor ID and Rh,
// used for after-donation advice and a blood-volume estimate.
const CONSENT_VERSION = "v2";

// Full PDPA-style privacy policy shown in the "ความเป็นส่วนตัว" modal
// (Settings → ความเป็นส่วนตัว). Kept as data (not raw JSX) so it's easy to
// review/update on its own without touching the modal's rendering logic.
// PRIVACY_POLICY_CONTACT_EMAIL should be reviewed/replaced with whatever
// contact channel is actually appropriate before this goes to real users —
// currently set to the developer's own address as a placeholder.
const PRIVACY_POLICY_EFFECTIVE_DATE = "29 กันยายน 2569";
const PRIVACY_POLICY_CONTACT_EMAIL = "phitsanu.trs@gmail.com";
const PRIVACY_POLICY_SECTIONS = [
  {
    heading: "1. ภาพรวม",
    body: [
      "Blood Journey (\"แอป\") เป็นเครื่องมือส่วนตัวสำหรับบันทึกและติดตามประวัติการบริจาคโลหิตของคุณเอง แอปนี้พัฒนาโดยอิสระ ไม่ใช่ผลิตภัณฑ์หรือบริการของสภากาชาดไทย และไม่มีการเชื่อมต่อ ส่งข้อมูล หรือแลกเปลี่ยนข้อมูลใด ๆ กับระบบของสภากาชาดไทยหรือหน่วยงานราชการใด",
      "นโยบายนี้อธิบายว่าแอปเก็บ ใช้ และจัดการข้อมูลส่วนบุคคลของคุณอย่างไร ตามหลักการของพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)",
    ],
  },
  {
    heading: "2. ข้อมูลที่แอปเก็บรวบรวม",
    body: [
      "ข้อมูลโปรไฟล์ (ไม่บังคับทุกช่อง): ชื่อ-นามสกุลที่แสดง, ปีเกิด (แอปคำนวณอายุให้), เพศ, ส่วนสูง, น้ำหนัก, หมู่โลหิตและ Rh, เลขประจำตัวผู้บริจาคโลหิต, ประเภทผู้บริจาค, จำนวนครั้งที่เคยบริจาคมาก่อนใช้แอป (ยอดสะสมยกมา)",
      "การพักการเตือน: แอปเก็บเพียงวันที่ที่จะกลับมาเตือน ไม่ถามและไม่เก็บเหตุผลที่พัก (เช่น การตั้งครรภ์หรือให้นมบุตร)",
      "ข้อมูลรายการบริจาค: วันที่, เวลา, ประเภทการบริจาค (โลหิตรวม/พลาสมา-เกล็ดเลือด), สถานที่บริจาค, บันทึกช่วยจำที่คุณพิมพ์เอง — ทั้งหมดนี้กรอกโดยคุณเองทีละรายการ",
      "ข้อมูลการตั้งค่า: รอบระยะเวลาที่สามารถบริจาคซ้ำได้ (ค่าเริ่มต้น 90 วัน), สถานะการให้ความยินยอม และวันที่ให้ความยินยอม",
      "ข้อมูลจาก LINE (เฉพาะเมื่อเปิดผ่าน LINE): แอปขอสิทธิ์ LIFF เพียงขอบเขต openid เท่านั้น ซึ่งใช้ยืนยันบริบทการเปิดแอปผ่าน LINE ในทางเทคนิค แอปไม่ได้ดึงชื่อ รูปโปรไฟล์ หรือ LINE User ID ของคุณไปเก็บหรือใช้งานแต่อย่างใด",
      "แอปไม่เก็บและไม่ขอเลขบัตรประชาชน เบอร์โทรศัพท์ อีเมล หรือที่อยู่ ส่วนเลขประจำตัวผู้บริจาคโลหิตเก็บเฉพาะเมื่อคุณกรอกเอง เพื่อให้เปิดดูหรือคัดลอกได้สะดวกตอนกรอกใบสมัครบริจาค และจะไม่แสดงบนการ์ดแชร์",
    ],
  },
  {
    heading: "3. วัตถุประสงค์ในการเก็บและใช้ข้อมูล",
    body: [
      "เพื่อให้คุณสามารถบันทึกและดูประวัติการบริจาคโลหิตของตนเองได้",
      "เพื่อคำนวณสถิติ ความก้าวหน้า และวันที่สามารถบริจาคครั้งถัดไป",
      "เพื่อแสดงคำแนะนำหลังบริจาคที่เหมาะกับเพศที่คุณเลือก และประมาณปริมาณเลือดในร่างกายจากเพศ ส่วนสูง และน้ำหนัก (ค่าประมาณ ไม่ใช่การวินิจฉัยทางการแพทย์)",
      "เพื่อแสดงเหรียญ/ตราสัญลักษณ์ความสำเร็จตามจำนวนครั้งสะสม และสร้างการ์ดภาพสำหรับแชร์ (เมื่อคุณเลือกทำเอง)",
      "เพื่อแจ้งเตือนหรือช่วยเพิ่มกำหนดการบริจาคครั้งถัดไปลงในปฏิทินของคุณ (เมื่อคุณเลือกทำเอง)",
      "แอปไม่ใช้ข้อมูลของคุณเพื่อการโฆษณา การวิเคราะห์พฤติกรรมผู้ใช้ในภาพรวม (analytics) หรือส่งต่อให้บุคคลที่สามเพื่อวัตถุประสงค์ทางการตลาดใด ๆ",
    ],
  },
  {
    heading: "4. ฐานทางกฎหมายในการประมวลผลข้อมูล",
    body: [
      "แอปประมวลผลข้อมูลของคุณโดยอาศัยความยินยอม (consent) ที่คุณให้ไว้ในหน้าจอเริ่มต้นใช้งาน คุณสามารถถอนความยินยอมได้ทุกเมื่อโดยการลบข้อมูลทั้งหมดที่หน้าตั้งค่า ซึ่งจะมีผลเป็นการหยุดการเก็บและลบข้อมูลที่มีอยู่ทันที",
    ],
  },
  {
    heading: "5. สถานที่จัดเก็บข้อมูล",
    body: [
      "ข้อมูลทั้งหมดของคุณถูกจัดเก็บไว้ในเครื่อง/อุปกรณ์ของคุณเองเท่านั้น (local storage) แอปไม่มีเซิร์ฟเวอร์ฐานข้อมูลส่วนกลางสำหรับเก็บข้อมูลผู้ใช้ ไม่มีบัญชีผู้ใช้ และผู้พัฒนาแอปไม่สามารถเข้าถึงหรือมองเห็นข้อมูลของคุณได้เลย",
      "ไฟล์สำรองข้อมูลที่คุณส่งออกจะอยู่ในที่ที่คุณเลือกเก็บ (เช่น โฟลเดอร์ในเครื่อง หรือบริการคลาวด์ของคุณเอง) แอปเข้ารหัสไฟล์สำรองด้วยรหัสผ่านเป็นค่าเริ่มต้น (แอปสร้างรหัสให้ หรือคุณตั้งเองได้) การเข้ารหัสและถอดรหัสเกิดขึ้นในเครื่องของคุณเท่านั้น แอปไม่เก็บและไม่ส่งรหัสผ่านไปที่ใด หากลืมรหัสผ่านจะเปิดไฟล์นั้นไม่ได้และผู้พัฒนากู้คืนให้ไม่ได้ หากคุณเลือกส่งออกแบบไม่เข้ารหัสเอง ไฟล์นั้นจะเป็นข้อความธรรมดาที่ใครได้ไฟล์ไปก็อ่านได้",
      "เนื่องจากข้อมูลอยู่ในเครื่องเท่านั้น หากคุณล้างข้อมูลเบราว์เซอร์ ล้างแคชของแอป LINE ถอนการติดตั้ง หรือเปลี่ยนเครื่อง/เปลี่ยนเบราว์เซอร์ ข้อมูลที่ไม่ได้ส่งออกไว้อาจสูญหายและไม่สามารถกู้คืนได้ — แนะนำให้ใช้ฟังก์ชัน \"ส่งออกข้อมูล\" ที่หน้าตั้งค่าเพื่อสำรองข้อมูลเป็นระยะ",
    ],
  },
  {
    heading: "6. กรณีที่ข้อมูลออกจากเครื่องของคุณชั่วคราว",
    body: [
      "ฟีเจอร์ \"สร้างการ์ดแชร์ภาพ\" และ \"เพิ่มลงปฏิทิน\" เมื่อเปิดผ่าน LINE จะเปิดหน้าต่างเบราว์เซอร์ภายนอกของอุปกรณ์คุณเอง (เช่น Safari/Chrome) เพื่อให้สามารถบันทึกรูปภาพหรือไฟล์ปฏิทินได้ เนื่องจากเบราว์เซอร์ในแอป LINE มีข้อจำกัดทางเทคนิคที่ไม่รองรับการบันทึกไฟล์โดยตรง",
      "ในการทำเช่นนี้ ข้อมูลเท่าที่จำเป็นสำหรับสร้างภาพหรือไฟล์ปฏิทินเพียงรายการเดียว (เช่น จำนวนครั้งสะสม หมู่โลหิต ชื่อเล่นที่คุณตั้ง หรือวันที่นัดหมาย) จะถูกเข้ารหัสและแนบไปกับลิงก์ที่เปิดในเบราว์เซอร์ภายนอก ลิงก์นี้หมดอายุภายในเวลาสั้น ๆ (5 นาที) และถอดรหัสได้เฉพาะโดยแอปเท่านั้น เนื้อหาในลิงก์จะไม่ถูกจัดเก็บถาวรที่ใดนอกจากผ่านหน้าเว็บที่ให้บริการแอปนี้ในช่วงเวลาสั้น ๆ ที่ใช้เปิดลิงก์ดังกล่าว",
      "นอกเหนือจากกรณีนี้ ข้อมูลของคุณจะไม่ถูกส่งออกจากเครื่องโดยอัตโนมัติ",
    ],
  },
  {
    heading: "7. การเปิดเผยข้อมูลต่อบุคคลที่สาม",
    body: [
      "แอปไม่ขาย ให้เช่า หรือแบ่งปันข้อมูลส่วนบุคคลของคุณแก่บุคคลที่สามเพื่อวัตถุประสงค์ทางการตลาดหรือการค้าใด ๆ และไม่มีการเชื่อมต่อกับสภากาชาดไทยหรือหน่วยงานใดตามที่กล่าวไว้ในข้อ 1",
    ],
  },
  {
    heading: "8. ระยะเวลาการเก็บข้อมูล",
    body: [
      "ข้อมูลจะถูกเก็บไว้ในเครื่องของคุณตราบเท่าที่คุณยังใช้งานแอปอยู่ และจะถูกลบทันทีเมื่อคุณกดลบข้อมูลทั้งหมดที่หน้าตั้งค่า หรือเมื่อข้อมูลในเครื่อง/เบราว์เซอร์ของคุณถูกล้างไปด้วยเหตุผลอื่น",
    ],
  },
  {
    heading: "9. สิทธิของเจ้าของข้อมูล",
    body: [
      "เนื่องจากข้อมูลทั้งหมดอยู่ในความควบคุมของคุณโดยตรงภายในเครื่องของคุณเอง คุณจึงสามารถใช้สิทธิต่อไปนี้ได้ด้วยตนเองตลอดเวลาผ่านหน้าตั้งค่าของแอป โดยไม่ต้องติดต่อผู้พัฒนา:",
      "สิทธิเข้าถึงและตรวจสอบข้อมูล — ดูข้อมูลทั้งหมดได้ในแอปโดยตรง",
      "สิทธิแก้ไขข้อมูล — แก้ไขหรือลบรายการบริจาคแต่ละรายการ หรือข้อมูลโปรไฟล์ได้ทุกเมื่อ",
      "สิทธิลบข้อมูล/ถอนความยินยอม — ลบข้อมูลทั้งหมดได้ทันทีที่หน้าตั้งค่า",
      "สิทธิในการโอนย้ายข้อมูล — ส่งออกข้อมูลเป็นไฟล์เพื่อเก็บไว้เองหรือนำไปใช้ที่อื่นได้",
    ],
  },
  {
    heading: "10. มาตรการรักษาความปลอดภัย",
    body: [
      "ข้อมูลถูกเก็บในพื้นที่จัดเก็บของเบราว์เซอร์/อุปกรณ์คุณเอง ซึ่งโดยปกติเข้าถึงได้เฉพาะจากอุปกรณ์และผู้ใช้เครื่องนั้น ๆ",
      "ข้อมูลที่จำเป็นต้องส่งผ่านลิงก์ไปยังเบราว์เซอร์ภายนอกชั่วคราว (ตามข้อ 6) จะถูกเข้ารหัสด้วยมาตรฐาน AES-GCM และมีอายุการใช้งานจำกัดเพียง 5 นาที เพื่อป้องกันการเดาหรือปลอมแปลงลิงก์โดยบุคคลทั่วไป",
      "เนื่องจากแอปทำงานฝั่งอุปกรณ์ผู้ใช้ทั้งหมดโดยไม่มีเซิร์ฟเวอร์เก็บข้อมูล จึงไม่มีความเสี่ยงจากการรั่วไหลของข้อมูลผ่านฐานข้อมูลกลางหรือการโจมตีเซิร์ฟเวอร์",
    ],
  },
  {
    heading: "11. คุกกี้และการวิเคราะห์การใช้งาน",
    body: [
      "แอปไม่ใช้คุกกี้เพื่อการติดตามพฤติกรรม ไม่มีการฝังเครื่องมือวิเคราะห์การใช้งาน (analytics) หรือโฆษณาของบุคคลที่สามใด ๆ",
    ],
  },
  {
    heading: "12. การเปลี่ยนแปลงนโยบาย",
    body: [
      "หากมีการเปลี่ยนแปลงสาระสำคัญของนโยบายนี้ เช่น ประเภทข้อมูลที่เก็บหรือวิธีการใช้ข้อมูล แอปจะแจ้งให้ทราบผ่านหน้าจอขอความยินยอมใหม่ก่อนให้ใช้งานต่อ",
    ],
  },
  {
    heading: "13. ช่องทางติดต่อ",
    body: [
      `หากมีข้อสงสัยเกี่ยวกับนโยบายความเป็นส่วนตัวนี้ ติดต่อผู้พัฒนาแอปได้ที่ ${PRIVACY_POLICY_CONTACT_EMAIL}`,
    ],
  },
];
const DEFAULT_CYCLE_DAYS = 90;
const MIN_CYCLE_DAYS = 7;
const MAX_CYCLE_DAYS = 365;
const MIN_AGE = 17;
const MAX_AGE = 70;
const MIN_WEIGHT = 45; // matches ELIGIBILITY_CRITERIA text and the locked criteria in the handoff doc (was inconsistently 50 here)
// Official Thai Red Cross donation intervals per type (independent of
// cycleDays/componentCycleDays elsewhere, which are just the user's own
// adjustable REMINDER cadence, not a redefinition of the actual medical
// rule) -- used below to size the "เคยบริจาคมาแล้วกี่ครั้ง" (carried-over
// starting count) ceiling per donor, so a donor can't accidentally type in
// a number no real person in their situation could actually reach.
//   - โลหิตรวม (whole blood): every 90 days.
//   - พลาสมา/เกล็ดเลือด (plasma/platelet apheresis): every 14 days
//     ("สามารถบริจาคได้ทุก 14 วัน" -- thaibloodcentre.redcross.or.th).
const WHOLE_BLOOD_INTERVAL_DAYS = 90;
const COMPONENT_INTERVAL_DAYS = 14;
// Multiplier applied on top of the exact theoretical max (see
// maxStartingCountWhole/Component below) so the cap isn't a razor's edge
// against a perfectly-timed donor -- accounts for things like an early
// first-time donation right at MIN_AGE, or a slightly generous personal
// age estimate, without opening the door to obviously fabricated totals.
const STARTING_COUNT_CAP_MARGIN = 1.2;
const BLOOD_TYPES = ["A", "B", "AB", "O", "ไม่ทราบ"];
// Year / weight / height rulers: fold the panel a moment after the scale stops moving (cancelled if it moves again).
let pickerCloseTimer = null;
let pickerDirtyKey = null; // ruler row that saved something during this open, so the fold still says "saved" even if the last swipe landed on the same value
const ABO_ONLY = ["A", "B", "AB", "O"]; // what the profile picker offers ("ไม่ทราบ" stays valid for old data/imports)
const BLOOD_RH = [["+", "บวก (+)"], ["-", "ลบ (−)"], ["unknown", "ไม่ทราบ"]];
const GENDERS = [["male", "ชาย"], ["female", "หญิง"], ["none", "ไม่ระบุ"]];
const MIN_HEIGHT = 100;
const MAX_HEIGHT = 230;
// Profile stores the birth year (พ.ศ.) instead of an age, so the age keeps
// itself up to date. Age is "this year minus birth year" — may be one more
// than the donor's exact age before their birthday, which is fine for a
// 17-70 check.
const thaiYearNow = () => new Date().getFullYear() + 543;
// Estimated total blood volume in litres (Nadler 1962). Needs height (cm),
// weight (kg) and gender; "none" (ไม่ระบุ) uses the midpoint of the two
// formulas. Returns null when anything is missing.
function estimateBloodVolumeL(gender, heightCm, weightKg) {
  const h = Number(heightCm) / 100, w = Number(weightKg);
  if (!gender || !h || !w) return null;
  const male = 0.3669 * h ** 3 + 0.03219 * w + 0.6041;
  const female = 0.3561 * h ** 3 + 0.03308 * w + 0.1833;
  return gender === "male" ? male : gender === "female" ? female : (male + female) / 2;
}
// Reminder pause: "" (off), "indefinite", or a YYYY-MM-DD date the pause
// runs through. A date in the past simply means it's no longer paused.
const isRemindPaused = (until) => until === "indefinite" || (!!until && until >= todayLocalStr());
const REMIND_PAUSE_OPTIONS = [["3", "3 เดือน"], ["6", "6 เดือน"], ["12", "1 ปี"], ["indefinite", "จนกว่าจะเปิดเอง"]];
function remindPauseUntilFor(choice) {
  if (choice === "indefinite") return "indefinite";
  const d = new Date();
  d.setMonth(d.getMonth() + Number(choice));
  return dateToLocalStr(d);
}
// Thai consonants/vowels/tone marks (U+0E01–U+0E3A, U+0E40–U+0E4E) — this
// deliberately excludes the Thai digits (U+0E50–U+0E59) and punctuation
// (Fongman/Angkhankhu/Khomut) that sit in the same Unicode block, since the
// name fields should only accept letters, not numerals of either script.
const THAI_LETTERS = "\\u0E01-\\u0E3A\\u0E40-\\u0E4E";
const NAME_DISALLOWED_CHARS_RE = new RegExp(`[^A-Za-z${THAI_LETTERS}\\s]`, "gu");
// Strips digits (Arabic or Thai), symbols, punctuation, and emoji from a
// name field as the user types, leaving only Thai/English letters and
// spaces — used for the profile's ชื่อ/นามสกุล inputs.
// English words typed entirely in lower case ("john smith") get a capital first
// letter on save ("John Smith"); words that already contain a capital (McDonald,
// DeWitt, JOHN) and Thai words are left exactly as typed.
function capitalizeLowerWords(value) {
  return value.split(/(\s+)/).map(w => (/^[a-z]+$/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join("");
}
function sanitizeNameInput(value) {
  return value.replace(NAME_DISALLOWED_CHARS_RE, "");
}
const HISTORY_PAGE_SIZE = 10;
const YEAR_CHART_VISIBLE_COUNT = 5;
const MAX_LOCATION_LEN = 60;
const MAX_NOTE_LEN = 120;
const DEFAULT_BACKUP_REMINDER_GAP = 3;
const MIN_BACKUP_REMINDER_GAP = 1;
const MAX_BACKUP_REMINDER_GAP = 50;
const DEFAULT_COMPONENT_CYCLE_DAYS = 14;
const DEFAULT_DONATION_TYPE = "whole";
const TYPE_REQUIRED_MESSAGE = "ระบุประเภทการบริจาค";
const IMPORT_UNSUPPORTED_MESSAGE = "รูปแบบไม่รองรับ หรือไฟล์เสียหาย";
export const DONATION_TYPE_LABELS = { whole: "โลหิตรวม", component: "พลาสมา/เกล็ดเลือด" };
// Background/text tint per donation type, used only on the history list's
// type pill so the two types can be told apart at a glance without
// re-coloring every type pill/icon elsewhere in the app (which stays the
// existing single red-tint scheme).
const DONATION_TYPE_TINT = {
  whole: { bg: "#F3EAE8", text: "#9A3B33" },
  component: { bg: "#EFE3F0", text: "#6B3E78" },
};

export function toBuddhistDate(d) {
  const date = parseLocalDate(d);
  return `${date.getDate()} ${THAI_MONTHS[date.getMonth()]} ${date.getFullYear() + 543}`;
}
function toBuddhistDateTimeFull(d) {
  const date = parseLocalDate(d);
  if (Number.isNaN(date.getTime())) return "";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${date.getDate()} ${THAI_MONTHS_FULL[date.getMonth()]} ${date.getFullYear() + 543} เวลา\u00A0${hh}:${mm}\u00A0น.`;
}

function toBuddhistDateFull(d) {
  const date = parseLocalDate(d);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getDate()} ${THAI_MONTHS_FULL[date.getMonth()]} ${date.getFullYear() + 543}`;
}
function toBuddhistDateTime(d) {
  const date = parseLocalDate(d);
  if (Number.isNaN(date.getTime())) return "";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  // Non-breaking spaces inside the time part, so a narrow line wraps BEFORE "เวลา" instead of
  // leaving a lone "น." (or the clock) on its own line.
  return `${toBuddhistDate(date)} เวลา\u00A0${hh}:${mm}\u00A0น.`;
}
function daysBetween(a, b) {
  return Math.round((b.setHours(0,0,0,0) - a.setHours(0,0,0,0)) / 86400000);
}
// Local-timezone "YYYY-MM-DD" for a given date (or now) — for anything that
// means "today"/"this calendar day" in the user's own timezone. Deliberately
// NOT new Date().toISOString().slice(0,10), which is UTC-based and — for
// Thailand (UTC+7) — still reports "yesterday" for up to 7 hours after local
// midnight. That mismatch used to show up as: the date picker's max=today
// blocking today's real date from being selected in the early morning, new
// donation forms defaulting to yesterday's date, and the reminder dismiss
// "see you tomorrow" resetting hours earlier than an actual local midnight.
export function dateToLocalStr(d) {
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function todayLocalStr() {
  return dateToLocalStr(new Date());
}
// The mirror-image problem to dateToLocalStr above: parsing a bare
// "YYYY-MM-DD" string (as stored in donation.date) back into a Date. Per the
// ECMAScript date-time string spec, a date-ONLY ISO string parses as UTC
// midnight, but everywhere this app reads a calendar field back off the
// result (.getDate()/.getMonth()/.getFullYear() are local-time getters) —
// so for any viewer west of UTC, plain `new Date("2024-01-01")` reads back
// as 2023-12-31 local. Route every such parse through this instead: a
// Date instance or a full timestamp string (which already carries an
// explicit instant) passes through unchanged; only the bare-date-only case
// gets an explicit local-time-of-day appended so it parses as local
// midnight, matching how the date was actually entered/stored.
function parseLocalDate(d) {
  if (d instanceof Date) return d;
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) return new Date(`${d}T00:00:00`);
  return new Date(d);
}
export function buildIcsForReminder(date, title) {
  const dt = new Date(date);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  const dateStr = `${y}${m}${d}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const uid = `blood-journey-${dateStr}-${Math.random().toString(36).slice(2, 10)}@bloodjourney.local`;
  const escText = (s) => String(s).replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Blood Journey//TH",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${dateStr}`,
    `DTEND;VALUE=DATE:${dateStr}`,
    `SUMMARY:${escText(title)}`,
    `DESCRIPTION:${escText("แจ้งเตือนจากแอป Blood Journey — วันที่คำนวณจากรอบบริจาคที่ตั้งไว้ กรุณายึดตามคำแนะนำของเจ้าหน้าที่ ณ จุดบริจาคจริง")}`,
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    "DESCRIPTION:แจ้งเตือนวันบริจาคโลหิต",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
// Plain https:// link (no blob/data-URI/download mechanics at all) — the
// only "add to calendar" approach confirmed, via on-device testing, to work
// inside LINE's in-app browser on both iOS and Android. Used for the LIFF
// web build; the native app build uses a real .ics file via the OS share
// sheet instead (see nativeSaveAndShare).
function buildGoogleCalendarUrl(date, title, details) {
  const dt = new Date(date);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  const dateStr = `${y}${m}${d}`;
  const next = new Date(dt);
  next.setDate(next.getDate() + 1);
  const ny = next.getFullYear();
  const nm = String(next.getMonth() + 1).padStart(2, "0");
  const nd = String(next.getDate()).padStart(2, "0");
  const nextStr = `${ny}${nm}${nd}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${dateStr}/${nextStr}`,
    details: details || "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
function downloadIcsFile(icsContent, filename) {
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
// Native-only (Capacitor app shell) file save/share — writes a file into the
// app's cache directory via the real OS filesystem, then hands it to the
// native share sheet (Share.share). This is the one mechanism this whole
// project confirmed *cannot* be blocked the way LINE's in-app browser blocks
// every blob/data-URI download: it's the same OS-level share sheet every
// other app uses, so from there the user can pick "Save Image"/"Add to
// Calendar"/"Save to Files" etc. Only ever called when isNativeApp is true.
async function nativeSaveAndShare({ base64Data, filename, mimeType, dialogTitle }) {
  await Filesystem.writeFile({ path: filename, data: base64Data, directory: Directory.Cache });
  const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
  await Share.share({ url: uri, dialogTitle });
}
function dataUrlToBase64(dataUrl) {
  const idx = dataUrl.indexOf(",");
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
}
function icsContentToBase64(icsContent) {
  // btoa only handles Latin1 — the .ics body here is escaped ASCII (Thai
  // text is only ever inside SUMMARY/DESCRIPTION, already UTF-8 bytes), so
  // encode via TextEncoder first to survive any non-ASCII bytes safely.
  const bytes = new TextEncoder().encode(icsContent);
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
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
  return parseLocalDate(dateStr).getFullYear() + 543;
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
// Set once a write ever falls all the way through to memoryStore (quota
// exceeded, private/incognito mode blocking storage, etc) — i.e. genuinely
// NOT persisted, unlike the native-bridge/localStorage tiers above it.
// Deliberately never reset back to false within a session: even if a later
// write happens to succeed, whatever fell through earlier this session is
// still only in memory and still at risk, so telling the user "you're fine
// now" would be misleading. AppInner polls storage.degraded to show a
// one-time warning modal plus a persistent home-tab banner.
let storageDegradedFlag = false;
const storage = {
  async get(key) {
    if (isNativeApp) {
      try {
        const res = await Preferences.get({ key: LS_PREFIX + key });
        if (res && typeof res.value !== "undefined" && res.value !== null) return { value: res.value };
      } catch (e) {}
      // Deliberately no further fallback tiers on native: Preferences is
      // backed by the OS (UserDefaults/EncryptedSharedPreferences) and should
      // never realistically fail. Falling through to localStorage/memory in
      // the packaged app would silently split data across two stores.
      if (Object.prototype.hasOwnProperty.call(memoryStore, key)) return { value: memoryStore[key] };
      return null;
    }
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
    if (isNativeApp) {
      try {
        await Preferences.set({ key: LS_PREFIX + key, value });
        return;
      } catch (e) {}
      memoryStore[key] = value;
      storageDegradedFlag = true;
      return;
    }
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
    storageDegradedFlag = true;
  },
  isDegraded() {
    return storageDegradedFlag;
  },
  async delete(key) {
    if (isNativeApp) {
      try {
        await Preferences.remove({ key: LS_PREFIX + key });
      } catch (e) {}
      delete memoryStore[key];
      return;
    }
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
    desc: n === 1 ? "บริจาคโลหิตครั้งแรกของคุณ" : `บริจาคโลหิตครบ ${n} ครั้ง`,
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

// Regenerates an achievement's title/desc from its {kind, tier, isMonk,
// threshold} — the exact same formula buildAchievements() uses above. Lets
// the external-browser download page reconstruct the Thai title/desc text
// itself instead of carrying it as plaintext in the URL (see
// openShareCardInExternalBrowser).
export function deriveAchievementText({ kind, tier, isMonk, threshold }) {
  const n = Number(threshold) || 0;
  if (kind === "medal") {
    return {
      title: isMonk ? `พัดกาชาด ชั้นที่ ${tier}` : `เหรียญกาชาดสมนาคุณ ชั้นที่ ${tier}`,
      desc: `บริจาคโลหิตครบ ${n} ครั้ง`,
    };
  }
  return {
    title: n === 1 ? "หยดแรก" : `เข็มที่ระลึก ครั้งที่ ${n}`,
    desc: n === 1 ? "บริจาคโลหิตครั้งแรกของคุณ" : `บริจาคโลหิตครบ ${n} ครั้ง`,
  };
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
      <path d="M16 14 C16 14 6 20.5 6 27 C6 31.7 10.7 35 16 35 C21.3 35 26 31.7 26 27 C26 20.5 16 14 16 14 Z" fill="#B3261E" stroke="#A9821E" strokeWidth="1" />
      <ellipse cx="16" cy="24.5" rx="7" ry="8" fill="#FFF7F0" />
      <path d="M16 19.5 C16 19.5 12 24.5 12 27 C12 28.9 13.8 30.5 16 30.5 C18.2 30.5 20 28.9 20 27 C20 24.5 16 19.5 16 19.5 Z" fill="#B3261E" />
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

// One row of the auto-checked criteria list on the "เช็คคุณสมบัติก่อนบริจาค"
// page — pass (green check) / fail (red x) / unknown (gray, missing profile
// data) share the same layout, so this is just the status → color/icon map.
function EligibilityCheckRow({ label, status, detail }) {
  const cfg = status === "pass"
    ? { Icon: CheckCircle2, color: "#3A7D5C" }
    : status === "fail"
      ? { Icon: AlertTriangle, color: "#B3261E" }
      : { Icon: Info, color: "#B39B96" };
  const { Icon, color } = cfg;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 0" }}>
      <Icon size={17} color={color} style={{ marginTop: 1, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#3A2C29", marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 12, color: "#7A6360", lineHeight: 1.5 }}>{detail}</div>
      </div>
    </div>
  );
}

// Replaces the native <input type="time"> in the record/edit donation forms.
// That native control turned out to be unstyleable in a way that couldn't be
// fixed from CSS alone: Safari on a real iPhone ignores text-align on it and
// keeps an invisible AM/PM sub-field in its internal layout even on a
// 24-hour-region device that never displays one, so the visible digits kept
// drifting off-center no matter which ::-webkit-datetime-edit-* pseudo-
// element trick was tried (confirmed by direct user testing on-device,
// since this sandbox has no real iOS Safari to check against). A first fix
// (two plain <select> elements) solved the centering, but the user then
// asked for a fuller redesign: a tap opens a dialog (centered on screen,
// matching the app's other modals) with a scrolling hour/minute wheel picker
// and an explicit "ยืนยัน" (confirm) step, so nothing is set until the user
// deliberately confirms it. Stores/returns the same "HH:MM" string the rest
// of the app already uses (donation.time / form.time / tf.time), so no
// other code had to change.
const WHEEL_ITEM_HEIGHT = 40;
const WHEEL_VISIBLE_ROWS = 3;
const WHEEL_HEIGHT = WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ROWS;

// One scrolling column (hours, or minutes). Scroll-snap does the physical
// snapping; the onScroll handler just figures out, after scrolling settles,
// which item ended up centered and reports its index upward. initialIndex is
// only consulted on mount -- the column intentionally does not re-scroll
// itself if its index prop changes later, so the parent remounts it (via a
// `key`) whenever the sheet is freshly opened instead of fighting an
// in-progress scroll.
function TimeWheelColumn({ items, initialIndex, onSettle, ariaLabel }) {
  const scrollRef = useRef(null);
  const settleTimer = useRef(null);
  // centerIndex drives which item is styled bold/dark (vs. the dimmed rest) --
  // updated on every scroll frame, cheap since there are at most 60 items and
  // only one of them ever needs the "active" class at a time. Separate from
  // onSettle below, which only fires once scrolling has actually stopped and
  // is what reports the value upward / snaps the scroll position exactly.
  const [centerIndex, setCenterIndex] = useState(initialIndex);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = initialIndex * WHEEL_ITEM_HEIGHT;
    }
    return () => { if (settleTimer.current) clearTimeout(settleTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (el) {
      const live = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / WHEEL_ITEM_HEIGHT)));
      setCenterIndex(live);
    }
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      if (!el) return;
      const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / WHEEL_ITEM_HEIGHT)));
      el.scrollTop = i * WHEEL_ITEM_HEIGHT; // snap exactly, in case of rubber-band overscroll
      onSettle(i);
    }, 110);
  };

  return (
    <div ref={scrollRef} onScroll={handleScroll} aria-label={ariaLabel} className="no-scrollbar time-wheel-col">
      <div style={{ height: WHEEL_ITEM_HEIGHT }} aria-hidden="true" />
      {items.map((label, i) => (
        <div key={label} className={i === centerIndex ? "time-wheel-item time-wheel-item-active" : "time-wheel-item"}>{label}</div>
      ))}
      <div style={{ height: WHEEL_ITEM_HEIGHT }} aria-hidden="true" />
    </div>
  );
}

// The picker dialog itself: two wheels + confirm/cancel/clear. Nothing here
// touches the parent's value until "ยืนยัน" is pressed (or "ล้างเวลา" for an
// explicit clear) -- scrolling the wheels only updates this component's own
// state, so backing out via "ยกเลิก" or tapping the backdrop leaves the
// donation form's saved time completely untouched.
function TimeBottomSheet({ value, onConfirm, onClose, ariaLabelPrefix }) {
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")), []);
  // The very first time this field is opened for a record (no time saved
  // yet), default the wheels to the current time instead of 00:00 -- once a
  // real value exists, that's what the wheels start at, same as before.
  const [vh, vm] = value
    ? value.split(":")
    : [String(new Date().getHours()).padStart(2, "0"), String(new Date().getMinutes()).padStart(2, "0")];
  const initialHIndex = Math.max(0, hours.indexOf(vh));
  const initialMIndex = Math.max(0, minutes.indexOf(vm));
  const [selH, setSelH] = useState(initialHIndex);
  const [selM, setSelM] = useState(initialMIndex);
  // Separate from selH/selM: this is what the wheels actually mount at (via
  // the key below), so "ตอนนี้" can re-scroll them to the current time
  // without touching the parent's saved value -- that still only happens
  // when "ยืนยัน" is pressed.
  const [wheelH, setWheelH] = useState(initialHIndex);
  const [wheelM, setWheelM] = useState(initialMIndex);
  // Bumped on every "ตอนนี้" tap and folded into the wheels' key below. Just
  // setWheelH/setWheelM isn't enough on its own: if the wheels were opened
  // (or last snapped to "now") within the same minute the user later taps
  // "ตอนนี้" again, the freshly computed hi/mi come out identical to the
  // current wheelH/wheelM, React sees no state change, the key stays the
  // same, and the wheel never remounts -- so a wheel the user had manually
  // scrolled elsewhere just stays put instead of snapping back to now
  // (reported directly by the user). This nonce guarantees the key changes
  // on every tap regardless of whether the index itself changed.
  const [nowNonce, setNowNonce] = useState(0);

  const fillNow = () => {
    const now = new Date();
    const hi = Math.max(0, hours.indexOf(String(now.getHours()).padStart(2, "0")));
    const mi = Math.max(0, minutes.indexOf(String(now.getMinutes()).padStart(2, "0")));
    setWheelH(hi);
    setWheelM(mi);
    setSelH(hi);
    setSelM(mi);
    setNowNonce((n) => n + 1);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={`ระบุ${ariaLabelPrefix}`}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: "100%", maxWidth: 340, background: "#FFFFFF", borderRadius: 18, padding: 20, boxShadow: "0 12px 30px rgba(122,42,35,0.22)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#3A2C29" }}>ระบุ{ariaLabelPrefix}</div>
          <DialogX onClick={onClose} />
        </div>
        {/* No ชั่วโมง/นาที column labels above the wheel: tried tightening the
            gap with a negative margin + clip, but real momentum scrolling
            can still overshoot past the clipped sliver and re-expose a
            digit peeking into the label text. Simpler and more reliable to
            leave the labels out; the hour:minute layout with the colon
            between the two columns already reads clearly on its own. */}
        {/* width: "fit-content" + margin auto -- without it this div (a
            block-level flex container) stretches to the full width of the
            dialog card, and the highlight overlay below (left:0/right:0,
            positioned relative to THIS div) stretched with it: the two
            horizontal lines ran edge-to-edge of the card, well past the
            actual hour:minute digits (reported directly by the user from a
            screenshot). Shrinking this wrapper to just its content width
            makes the overlay hug the two wheel columns instead. */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "fit-content", margin: "0 auto" }}>
          <TimeWheelColumn key={`h-${wheelH}-${nowNonce}`} items={hours} initialIndex={wheelH}
            ariaLabel={`${ariaLabelPrefix} ชั่วโมง`} onSettle={setSelH} />
          <span style={{ fontSize: 19, fontWeight: 700, color: "#3A2C29", fontFamily: "'Mitr', 'Inter', sans-serif" }}>:</span>
          <TimeWheelColumn key={`m-${wheelM}-${nowNonce}`} items={minutes} initialIndex={wheelM}
            ariaLabel={`${ariaLabelPrefix} นาที`} onSettle={setSelM} />
          <div style={{ position: "absolute", top: WHEEL_ITEM_HEIGHT, left: 0, right: 0, height: WHEEL_ITEM_HEIGHT, borderTop: "1px solid #E3C8C3", borderBottom: "1px solid #E3C8C3", pointerEvents: "none" }} aria-hidden="true" />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 8 }}>
          {value && (
            <button type="button" onClick={() => onConfirm("")}
              style={{ padding: "0 14px", height: 26, borderRadius: 999, border: "1px solid #E3C8C3", background: "none", color: "#7A6360", fontSize: 11, fontWeight: 600, fontFamily: "'Mitr', 'Inter', sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}>
              ไม่ระบุเวลา
            </button>
          )}
          <button type="button" onClick={fillNow}
            style={{ padding: "0 14px", height: 26, borderRadius: 999, border: "1px solid #9A3B33", background: "none", color: "#9A3B33", fontSize: 11, fontWeight: 600, fontFamily: "'Mitr', 'Inter', sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}>
            ตอนนี้
          </button>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button type="button" onClick={onClose}
            style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "1px solid #E3C8C3", background: "#FFFFFF", color: "#5C4A46", fontSize: 13, fontWeight: 600, fontFamily: "'Mitr', 'Inter', sans-serif", cursor: "pointer" }}>
            ยกเลิก
          </button>
          <button type="button" onClick={() => onConfirm(`${hours[selH]}:${minutes[selM]}`)}
            style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: "#9A3B33", color: "#FFF7F5", fontSize: 13, fontWeight: 600, fontFamily: "'Mitr', 'Inter', sans-serif", cursor: "pointer" }}>
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  );
}

// The field as it sits in the form: a button showing the current value (or a
// placeholder), which opens the TimeBottomSheet above on tap. `sheetKey`
// forces a fresh TimeBottomSheet (and fresh wheel scroll positions) every
// time it's reopened, rather than reusing one left over from a previous open.
function TimeHourMinuteSelect({ value, onChange, ariaLabelPrefix, height = 44, fontSize = 14 }) {
  const [open, setOpen] = useState(false);
  const [sheetKey, setSheetKey] = useState(0);
  return (
    <>
      <button type="button" onClick={() => { setSheetKey((k) => k + 1); setOpen(true); }}
        aria-label={`${ariaLabelPrefix}${value ? `: ${value}` : ": ยังไม่ระบุ"}`}
        style={{ width: "100%", height, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "'Mitr', 'Inter', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: value ? fontSize : fontSize - 1, fontWeight: value ? 600 : 400, color: value ? "#3A2C29" : "#A38D89", textAlign: "center" }}>
        {!value && <Clock size={14} color="#A38D89" />}
        {value ? `${value} น.` : "ระบุเวลา"}
      </button>
      {open && (
        <TimeBottomSheet key={sheetKey} value={value} ariaLabelPrefix={ariaLabelPrefix}
          onConfirm={(next) => { onChange(next); setOpen(false); }}
          onClose={() => setOpen(false)} />
      )}
    </>
  );
}

// Replaces the native <input type="date"> in the record/edit donation forms.
// The native control worked fine functionally, but visually it's the OS's
// own calendar sheet -- grey, English month names, a "Reset" button -- which
// looked jarring right next to the app's own themed time-picker dialog above
// (direct user feedback from a real-device screenshot). This draws the same
// calendar everyone already recognizes (month/year header with </> nav, a
// 7-column day grid) but in the app's own cream/maroon palette with Thai
// month names and a Buddhist-era year, matching toBuddhistDate's format used
// everywhere else donation dates are displayed. Tapping a valid day both
// selects and closes the dialog, same as a native date picker's own tap-to-
// pick behavior -- there's no separate confirm step here, unlike the time
// picker, since a single tap is already unambiguous for a calendar grid.
const THAI_MONTHS_FULL = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const THAI_WEEKDAYS_SHORT = ["จ.","อ.","พ.","พฤ.","ศ.","ส.","อา."]; // Monday-first, matching Thai calendar convention

// How far back the year list in the header dropdown reaches. A donor's
// history can plausibly go back decades (first donation as a young adult,
// logged years later), and the month-by-month </> nav alone would take
// dozens of taps to get there -- this lets a 10-20-year-old date be reached
// in two taps (open year list, tap the year) instead.
const DATE_PICKER_YEARS_BACK = 100;

function DateCalendarDialog({ value, maxDate, onConfirm, onClose, ariaLabelPrefix }) {
  const selected = value ? parseLocalDate(value) : null;
  const initial = selected || (maxDate ? parseLocalDate(maxDate) : new Date());
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  // Year selection is two levels deep: pick a decade first, then a year
  // within it, so jumping back 10-20 years is a couple of taps through
  // short lists rather than one long scroll through ~100 individual years.
  const [yearMode, setYearMode] = useState("calendar"); // "calendar" | "decade" | "year"
  const [selectedDecadeStart, setSelectedDecadeStart] = useState(null);
  const pickingYear = yearMode !== "calendar";
  // Swipe left/right on the calendar grid to move a month, same as the
  // </> buttons. The grid visually tracks the finger in real time (via a
  // ref + direct style writes, not state -- a drag can fire touchmove dozens
  // of times a second, far more often than we want a React re-render), and
  // only turns into an actual month change once the finger lifts.
  const gridRef = useRef(null);
  const dragRef = useRef({ startX: 0, startY: 0, dragging: false, horizontal: false });
  // Direction of the most recent month change (1 = moved forward, -1 = moved
  // back), purely to pick which slide-in animation class to play next render.
  const [slideDir, setSlideDir] = useState(0);
  // Tapping a day only stages it here (highlighted, like the time picker's
  // wheels) -- nothing reaches the parent until "ยืนยัน" is pressed, so
  // backing out via "ยกเลิก" or the backdrop leaves the saved date untouched.
  // Defaults to `initial` (the saved date if there is one, otherwise
  // today/maxDate) so a field with nothing saved yet still opens with
  // today already staged, ready to confirm in one tap -- same idea as the
  // time picker defaulting its wheels to the current time.
  const [pendingDate, setPendingDate] = useState(initial);

  const max = maxDate ? parseLocalDate(maxDate) : null;
  const today = new Date();

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // JS: 0=Sun..6=Sat -> 0=Mon..6=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  // Always pad out to exactly 6 rows (42 cells): a month can need 4, 5, or 6
  // calendar rows depending on where it starts, and without this the whole
  // dialog visibly grows/shrinks a row's height when navigating between
  // months. Rather than leaving that padding as a dead blank row, it's
  // filled with the next month's leading days (muted, non-interactive) --
  // the common "overflow days" pattern most calendar UIs use.
  const cells = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, overflow: false })),
  ];
  let nextDay = 1;
  while (cells.length < 42) cells.push({ day: nextDay++, overflow: true });

  const isFuture = (d) => !!max && new Date(viewYear, viewMonth, d) > max;
  const isSelected = (d) => !!pendingDate && viewYear === pendingDate.getFullYear() && viewMonth === pendingDate.getMonth() && d === pendingDate.getDate();
  const isToday = (d) => viewYear === today.getFullYear() && viewMonth === today.getMonth() && d === today.getDate();
  const canGoNext = !max || viewYear < max.getFullYear() || (viewYear === max.getFullYear() && viewMonth < max.getMonth());
  // "ยืนยัน" should only ever commit a date the user can actually see
  // highlighted on screen right now -- not a value staged earlier (by the
  // initial auto-stage-today, or an explicit tap) that's since scrolled out
  // of view because the user browsed to a different month/year/decade
  // picker. Without this, browsing away from the staged month left the
  // button enabled and ready to silently confirm a date nothing on screen
  // pointed at (reported directly by the user, who found it confusing).
  const pendingVisible = yearMode === "calendar" && !!pendingDate && viewYear === pendingDate.getFullYear() && viewMonth === pendingDate.getMonth();

  const goPrev = () => { setSlideDir(-1); if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); } else setViewMonth((m) => m - 1); };
  const goNext = () => { if (!canGoNext) return; setSlideDir(1); if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); } else setViewMonth((m) => m + 1); };
  const pick = (d) => { if (!isFuture(d)) setPendingDate(new Date(viewYear, viewMonth, d)); };

  const DRAG_MAX = 90; // px the grid will visually follow the finger before resisting further
  const SWIPE_COMMIT_PX = 16; // same threshold the old tap-only swipe used

  const handleGridTouchStart = (e) => {
    const t = e.touches[0];
    dragRef.current = { startX: t.clientX, startY: t.clientY, dragging: true, horizontal: false };
  };
  const handleGridTouchMove = (e) => {
    const state = dragRef.current;
    if (!state.dragging) return;
    const t = e.touches[0];
    const dx = t.clientX - state.startX;
    const dy = t.clientY - state.startY;
    if (!state.horizontal) {
      // Decide once, past a small deadzone, whether this is a deliberate
      // horizontal swipe or a vertical scroll/stray tap -- don't drag the
      // grid sideways in response to what's actually a vertical gesture.
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      state.horizontal = Math.abs(dx) > Math.abs(dy) * 1.5;
      if (!state.horizontal) { state.dragging = false; return; }
    }
    // Rubber-band resistance when dragging toward a month that's out of
    // range (past maxDate), so the finger still gets some feedback instead
    // of the grid feeling stuck in place.
    let px = dx;
    if (dx < 0 && !canGoNext) px = dx / 3;
    px = Math.max(-DRAG_MAX, Math.min(DRAG_MAX, px));
    if (gridRef.current) {
      gridRef.current.style.transition = "none";
      gridRef.current.style.transform = `translateX(${px}px)`;
    }
  };
  const handleGridTouchEnd = (e) => {
    const state = dragRef.current;
    state.dragging = false;
    if (!state.horizontal) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - state.startX;
    const el = gridRef.current;
    const commit = Math.abs(dx) > SWIPE_COMMIT_PX && ((dx < 0 && canGoNext) || dx > 0);
    if (!el) {
      if (commit) { if (dx < 0) goNext(); else goPrev(); }
      return;
    }
    el.style.transition = "transform 0.16s ease-in";
    if (commit) {
      // Flick the current grid the rest of the way off-screen in the same
      // direction the finger was already moving it, then swap the month --
      // the incoming grid's own slide-in animation picks up from there.
      el.style.transform = `translateX(${dx < 0 ? -140 : 140}px)`;
      window.setTimeout(() => { if (dx < 0) goNext(); else goPrev(); }, 150);
    } else {
      // Not a deliberate enough swipe -- spring the grid back to rest
      // instead of changing the month.
      el.style.transform = "translateX(0px)";
    }
  };

  const maxYear = max ? max.getFullYear() : today.getFullYear();
  const years = useMemo(() => Array.from({ length: DATE_PICKER_YEARS_BACK + 1 }, (_, i) => maxYear - i), [maxYear]);
  // Decade groups are computed on the Buddhist-Era year (what's actually
  // displayed), not the raw Gregorian one -- otherwise a Gregorian-aligned
  // decade like 2020-2029 shows up as the odd-looking "2563-2572" instead
  // of the round "2560-2569" a Thai user expects. selectedDecadeStart is
  // therefore stored as a BE year throughout.
  const decades = useMemo(() => {
    const starts = new Set(years.map((y) => Math.floor((y + 543) / 10) * 10));
    return Array.from(starts).sort((a, b) => b - a);
  }, [years]);
  const pickYear = (y) => {
    setViewYear(y);
    // If jumping to the max year would leave viewMonth past max's own month
    // (e.g. currently viewing December but max is only up to June this
    // year), pull the month back in-bounds too -- same clamp goNext already
    // enforces one month at a time, just applied in one jump here.
    if (max && y === max.getFullYear() && viewMonth > max.getMonth()) setViewMonth(max.getMonth());
    // Back to the month grid (for the newly picked year), not straight to
    // the calendar -- picking a year is almost always in service of then
    // picking a month too.
    setYearMode("month");
  };
  const isMonthFuture = (m) => !!max && viewYear === max.getFullYear() && m > max.getMonth();
  const pickMonth = (m) => { if (!isMonthFuture(m)) { setViewMonth(m); setYearMode("calendar"); } };
  // Tapping the header now opens the month grid directly, for the year
  // already being viewed -- jumping to a different month within the same
  // year is by far the more common case, so it shouldn't require detouring
  // through a decade/year picker first. Jumping further back in time is
  // still there, just one (or two) levels deeper: see openYearListPicker.
  const openYearPicker = () => {
    setYearMode(yearMode === "calendar" ? "month" : "calendar");
  };
  // Reached by tapping the year number shown inside the month grid. Same
  // idea as the month-first change above: jumps straight to the list of
  // years in the CURRENT decade (2560-2569 for example), since picking a
  // year close to the one already showing is the common case -- jumping to
  // a different decade entirely is one tap further still, via "เลือกช่วงปีอื่น"
  // inside that year list.
  const openYearListPicker = () => {
    setSelectedDecadeStart(Math.floor((viewYear + 543) / 10) * 10);
    setYearMode("year");
  };
  const pickDecade = (start) => { setSelectedDecadeStart(start); setYearMode("year"); };
  const backToDecades = () => setYearMode("decade");
  const backToYear = () => setYearMode("year");

  const todayPillStyle = { padding: 0, height: 26, borderRadius: 999, border: "1px solid #9A3B33", background: "none", color: "#9A3B33", fontSize: 11, fontWeight: 600, fontFamily: "'Mitr', 'Inter', sans-serif", cursor: "pointer", whiteSpace: "nowrap" };
  const todayBtn = (extra) => (<button type="button" onClick={fillToday} style={{ ...todayPillStyle, ...extra }}>วันนี้</button>);
  const fillToday = () => {
    // Respects the max-date constraint (normally "today" itself, but a
    // caller could in principle pass an earlier max) rather than always
    // jumping to the real calendar today regardless of that limit. Only
    // navigates to and stages today's date (highlighted, like tapping a
    // day) -- nothing is saved until "ยืนยัน" is pressed, same as the time
    // picker's "ตอนนี้".
    const target = max && today > max ? max : today;
    setViewYear(target.getFullYear());
    setViewMonth(target.getMonth());
    setYearMode("calendar");
    setPendingDate(target);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={`ระบุ${ariaLabelPrefix}`}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: "100%", maxWidth: 340, background: "#FFFFFF", borderRadius: 18, padding: 20, boxShadow: "0 12px 30px rgba(122,42,35,0.22)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#3A2C29" }}>ระบุ{ariaLabelPrefix}</div>
          <DialogX onClick={onClose} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <button type="button" onClick={goPrev} aria-label="เดือนก่อนหน้า" disabled={pickingYear}
            style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #E3C8C3", background: "#FFFFFF", color: pickingYear ? "#D9C7C3" : "#9A3B33", fontSize: 16, lineHeight: 1, cursor: pickingYear ? "default" : "pointer" }}>
            ‹
          </button>
          <button type="button" onClick={openYearPicker} aria-expanded={pickingYear}
            style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", fontSize: 14, fontWeight: 600, color: "#3A2C29", fontFamily: "'Mitr', 'Inter', sans-serif", cursor: "pointer", padding: "4px 8px" }}>
            {yearMode === "calendar"
              ? `${THAI_MONTHS_FULL[viewMonth]} ${viewYear + 543}`
              : yearMode === "decade"
              ? "เลือกช่วงปี"
              : yearMode === "year"
              ? `${selectedDecadeStart}-${Math.min(selectedDecadeStart + 9, maxYear + 543)}`
              : "เลือกเดือน"}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: pickingYear ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <button type="button" onClick={goNext} aria-label="เดือนถัดไป" disabled={!canGoNext || pickingYear}
            style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #E3C8C3", background: "#FFFFFF", color: (canGoNext && !pickingYear) ? "#9A3B33" : "#D9C7C3", fontSize: 16, lineHeight: 1, cursor: (canGoNext && !pickingYear) ? "pointer" : "default" }}>
            ›
          </button>
        </div>
        {yearMode === "decade" ? (
          <>
            {/* The decade list is now reached FROM the year list (via its
                own "ย้อนกลับ", one level below), so backing out of it
                returns to that year list, not the month grid. */}
            <button type="button" onClick={backToYear}
              style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#9A3B33", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "2px 0", marginBottom: 8, fontFamily: "'Mitr', 'Inter', sans-serif" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              ย้อนกลับ
            </button>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, maxHeight: 232, overflowY: "auto" }} className="no-scrollbar">
            {decades.map((start) => {
              const isCurrentDecade = Math.floor((viewYear + 543) / 10) * 10 === start;
              return (
                <button key={start} type="button" onClick={() => pickDecade(start)}
                  style={{
                    padding: "12px 0", borderRadius: 10, border: "none",
                    background: isCurrentDecade ? "#9A3B33" : "#FBEAE7",
                    color: isCurrentDecade ? "#FFF7F5" : "#3A2C29",
                    fontWeight: isCurrentDecade ? 700 : 500,
                    fontSize: 13, cursor: "pointer", fontFamily: "'Mitr', 'Inter', sans-serif",
                  }}>
                  {start}-{Math.min(start + 9, maxYear + 543)}
                </button>
              );
            })}
          </div>
          {/* Outside the scrolling list so it is always visible, not buried at the end of it. */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>{todayBtn({ padding: "0 14px" })}</div>
          </>
        ) : yearMode === "year" ? (
          <>
            {/* This isn't really "back" -- it's a jump one level up to the
                full decade list, so it gets its own wording rather than
                reusing the "ย้อนกลับ" of the decade view (which really is a
                back-navigation, to the year list it came from). */}
            <button type="button" onClick={backToDecades}
              style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#9A3B33", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "2px 0", marginBottom: 8, fontFamily: "'Mitr', 'Inter', sans-serif" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              เลือกช่วงปีอื่น
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, maxHeight: 200, overflowY: "auto" }} className="no-scrollbar">
              {years.filter((y) => Math.floor((y + 543) / 10) * 10 === selectedDecadeStart).map((y) => (
                <button key={y} type="button" onClick={() => pickYear(y)}
                  style={{
                    padding: "9px 0", borderRadius: 8, border: "none",
                    background: y === viewYear ? "#9A3B33" : "transparent",
                    color: y === viewYear ? "#FFF7F5" : "#3A2C29",
                    fontWeight: y === viewYear ? 700 : 400,
                    fontSize: 12.5, cursor: "pointer", fontFamily: "'Mitr', 'Inter', sans-serif",
                  }}>
                  {y + 543}
                </button>
              ))}
              {(() => { const n = years.filter((y) => Math.floor((y + 543) / 10) * 10 === selectedDecadeStart).length; const blanks = (4 - ((n + 1) % 4)) % 4;
                return (<>{Array.from({ length: blanks }, (_, b) => <div key={`yb${b}`} aria-hidden="true" />)}<div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>{todayBtn({ width: "100%" })}</div></>); })()}
            </div>
          </>
        ) : yearMode === "month" ? (
          <>
            {/* The year is a separate, deliberately tappable control here --
                jumping between months within this same year is the common
                case (just tap a month below), while changing the year at
                all is the deeper, less common action this button leads to. */}
            <button type="button" onClick={openYearListPicker}
              style={{ display: "flex", alignItems: "center", gap: 4, background: "#FBEAE7", border: "none", borderRadius: 999, color: "#9A3B33", fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: "5px 12px", marginBottom: 10, fontFamily: "'Mitr', 'Inter', sans-serif" }}>
              ปี {viewYear + 543}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              {THAI_MONTHS_FULL.map((label, m) => {
                const future = isMonthFuture(m);
                const isCurrentMonth = m === viewMonth;
                return (
                  <button key={label} type="button" onClick={() => pickMonth(m)} disabled={future}
                    style={{
                      padding: "10px 0", borderRadius: 8, border: "none",
                      background: isCurrentMonth ? "#9A3B33" : "transparent",
                      color: future ? "#D9C7C3" : isCurrentMonth ? "#FFF7F5" : "#3A2C29",
                      fontWeight: isCurrentMonth ? 700 : 400,
                      fontSize: 12.5, cursor: future ? "default" : "pointer", fontFamily: "'Mitr', 'Inter', sans-serif",
                    }}>
                    {THAI_MONTHS[m]}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>{todayBtn({ padding: "0 14px" })}</div>
          </>
        ) : (
          // The weekday header (จ. อ. พ. ...) never changes between months,
          // so it stays put -- only the day-number grid underneath slides or
          // drags. Touch handlers sit on this outer wrapper (not the grid
          // itself) so a swipe started anywhere in the calendar area, header
          // row included, still moves the month.
          <div style={{ touchAction: "pan-y" }} onTouchStart={handleGridTouchStart} onTouchMove={handleGridTouchMove} onTouchEnd={handleGridTouchEnd}>
            {/* Weekend (ส./อา.) is called out in maroon, both in this header
                and in the day numbers below, and the whole header row sits
                on a light rounded card so it reads as a distinct "table
                head" instead of blending into the day grid underneath. */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, background: "#FBF6F5", borderRadius: 10, padding: "6px 0", marginBottom: 8 }}>
              {THAI_WEEKDAYS_SHORT.map((w, i) => {
                const isWeekend = i === 5 || i === 6;
                return (
                  <div key={w} style={{ textAlign: "center", fontSize: 11.5, color: isWeekend ? "#9A3B33" : "#7A6360", fontWeight: isWeekend ? 700 : 600, padding: "4px 0", fontFamily: "'Mitr', 'Inter', sans-serif" }}>{w}</div>
                );
              })}
            </div>
            {/* overflow: hidden here clips the sliding/dragging grid to the
                card's own width -- without it, a drag or the flick-out/
                slide-in animation visibly pokes the day numbers out past
                the dialog's rounded edges into the dimmed backdrop. */}
            <div style={{ overflow: "hidden" }}>
            <div
              key={`${viewYear}-${viewMonth}`}
              ref={gridRef}
              className={slideDir === 1 ? "calendar-slide-next" : slideDir === -1 ? "calendar-slide-prev" : undefined}
              style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}
            >
              {cells.map((cell, i) => {
                // A leading gap (before day 1) is still a plain blank -- but
                // it still needs the same aspect-ratio square as a real day
                // button, otherwise a row made entirely of blanks has
                // nothing to size it and CSS grid collapses that row's
                // height to near zero instead of matching the other rows.
                if (cell === null) return <div key={`e${i}`} style={{ aspectRatio: "1" }} aria-hidden="true" />;
                const { day: d, overflow } = cell;
                // Trailing padding is filled with the next month's leading
                // days instead, muted and non-interactive -- purely to keep
                // the grid visually filled, not a real navigation shortcut.
                if (overflow && i === cells.length - 1) {
                  return <div key="today-cell" style={{ aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center" }}>{todayBtn({ width: "100%" })}</div>;
                }
                if (overflow) {
                  return (
                    <div key={`n${i}`} aria-hidden="true"
                      style={{ aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#EADEDB", fontFamily: "'Mitr', 'Inter', sans-serif" }}>
                      {d}
                    </div>
                  );
                }
                const isWeekend = i % 7 === 5 || i % 7 === 6;
                return (
                  <button key={d} type="button" onClick={() => pick(d)} disabled={isFuture(d)}
                    style={{
                      aspectRatio: "1", borderRadius: "50%", border: "none",
                      background: isSelected(d) ? "#9A3B33" : "transparent",
                      color: isFuture(d) ? "#D9C7C3" : isSelected(d) ? "#FFF7F5" : isToday(d) ? "#9A3B33" : isWeekend ? "#9A3B33" : "#3A2C29",
                      fontWeight: isSelected(d) || isToday(d) ? 700 : 400,
                      fontSize: 13, cursor: isFuture(d) ? "default" : "pointer",
                      fontFamily: "'Mitr', 'Inter', sans-serif",
                    }}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="button" onClick={onClose}
            style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "1px solid #E3C8C3", background: "#FFFFFF", color: "#5C4A46", fontSize: 13, fontWeight: 600, fontFamily: "'Mitr', 'Inter', sans-serif", cursor: "pointer" }}>
            ยกเลิก
          </button>
          <button type="button" disabled={!pendingVisible} onClick={() => onConfirm(dateToLocalStr(pendingDate))}
            style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: pendingVisible ? "#9A3B33" : "#E3C8C3", color: "#FFF7F5", fontSize: 13, fontWeight: 600, fontFamily: "'Mitr', 'Inter', sans-serif", cursor: pendingVisible ? "pointer" : "default" }}>
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  );
}

// The field as it sits in the form: a button showing the current value (via
// toBuddhistDate, same format used everywhere else in the app) which opens
// DateCalendarDialog above on tap. dialogKey forces a fresh dialog (and a
// fresh viewYear/viewMonth reset to the current value) every time it's
// reopened, same reasoning as TimeHourMinuteSelect's sheetKey above.
// Wrapped in forwardRef because a couple of call sites keep a ref to the
// underlying field to call .focus() on it after a validation error (it used
// to be the native <input>'s own ref) -- forwarding it to this button gives
// the same "put the user's attention there" behavior.
// ---- Password-protected backup (design 3 of backup-encrypt-designs.html) ----
// The whole backup JSON is encrypted as one block with AES-256-GCM, using a key
// derived from the donor's password (PBKDF2-SHA256). Everything happens in the
// browser; the password and the data never leave the device. The small
// header (format, KDF settings, salt, IV) is not secret. The header's
// app/format/version are bound in as additional authenticated data, so
// editing them makes decryption fail instead of silently proceeding.
// v3 = minified JSON, deflate-compressed before encryption (much shorter file);
// v2 files (no compression) still open.
const BACKUP_FORMAT_VERSION = 3;
const BACKUP_KDF_ITERATIONS = 600000;
const backupAad = (v) => new TextEncoder().encode(`BloodJourney|backup|${v}`);
const canCompressBackup = () => typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined" && typeof Response !== "undefined";
async function pipeBackupBytes(u8, stream) {
  return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(stream)).arrayBuffer());
}
const backupCryptoError = (code) => Object.assign(new Error(code), { code });
const canEncryptBackup = () => typeof crypto !== "undefined" && !!crypto.subtle && typeof crypto.getRandomValues === "function";
const bytesToB64 = (u8) => {
  let out = "";
  for (let i = 0; i < u8.length; i += 0x8000) out += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(out);
};
const b64ToBytes = (b64) => {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
};
async function deriveBackupKey(password, salt, iterations, usage) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(password).normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, [usage]);
}
async function encryptBackupText(plainText, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupKey(password, salt, BACKUP_KDF_ITERATIONS, "encrypt");
  let text = plainText;
  try { text = JSON.stringify(JSON.parse(plainText)); } catch (e) {}
  let bytes = new TextEncoder().encode(text);
  let compress = "";
  if (canCompressBackup()) {
    try { bytes = await pipeBackupBytes(bytes, new CompressionStream("deflate-raw")); compress = "deflate-raw"; }
    catch (e) { bytes = new TextEncoder().encode(text); }
  }
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: backupAad(BACKUP_FORMAT_VERSION) }, key, bytes);
  const header = {
    app: "BloodJourney", format: "backup", version: BACKUP_FORMAT_VERSION, encrypted: true,
    kdf: { name: "PBKDF2-SHA256", iterations: BACKUP_KDF_ITERATIONS, salt: bytesToB64(salt) },
    cipher: { name: "AES-256-GCM", iv: bytesToB64(iv) },
  };
  if (compress) header.compress = compress;
  header.data = bytesToB64(new Uint8Array(ct));
  return JSON.stringify(header);
}
// The parsed header when `text` is an encrypted backup, otherwise null.
function readEncryptedBackup(text) {
  const t = String(text || "").trim();
  if (t[0] !== "{") return null;
  try {
    const p = JSON.parse(t);
    if (p && p.encrypted === true && p.format === "backup" && typeof p.data === "string") return p;
  } catch (e) {}
  return null;
}
// Throws an Error with code "BAD_PASSWORD" (wrong password or a modified file
// -- AES-GCM can't tell those apart) or "UNSUPPORTED" (unreadable header).
async function decryptBackupText(header, password) {
  let salt, iv, data, iterations;
  try {
    iterations = Number(header && header.kdf && header.kdf.iterations);
    // Capped so a hand-made file can't make the phone grind for minutes.
    if ((header.version !== 2 && header.version !== 3) || (header.compress && header.compress !== "deflate-raw") || !Number.isInteger(iterations) || iterations < 100000 || iterations > 2000000) throw new Error("x");
    salt = b64ToBytes(header.kdf.salt);
    iv = b64ToBytes(header.cipher.iv);
    data = b64ToBytes(header.data);
    if (salt.length !== 16 || iv.length !== 12) throw new Error("x");
  } catch (e) {
    throw backupCryptoError("UNSUPPORTED");
  }
  const key = await deriveBackupKey(password, salt, iterations, "decrypt");
  try {
    let plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: backupAad(header.version) }, key, data));
    if (header.compress) {
      if (!canCompressBackup()) throw backupCryptoError("UNSUPPORTED");
      plain = await pipeBackupBytes(plain, new DecompressionStream("deflate-raw"));
    }
    return new TextDecoder().decode(plain);
  } catch (e) {
    throw e && e.code === "UNSUPPORTED" ? e : backupCryptoError("BAD_PASSWORD");
  }
}
// Random passphrase for the "สร้างรหัสให้" button: 5 words out of 2,048 (11 bits
// each, ~55 bits). 65,536 is a multiple of 2,048, so masking is unbiased.
function generateBackupPassphrase(words = 5) {
  const list = BACKUP_WORDLIST.split(" ");
  return Array.from(crypto.getRandomValues(new Uint16Array(words)), (n) => list[n & 2047]).join("-");
}
// level 0 = not accepted, 1 = อ่อน, 2 = พอใช้, 3 = แข็งแรง
function backupPasswordStrength(pw) {
  if (pw.length < 8) return { level: 0, ok: false, label: "" };
  const COMMON = ["12345678", "123456789", "1234567890", "password", "password1", "qwertyui", "qwerty123", "11111111", "00000000", "abcdefgh", "iloveyou"];
  if (new Set(pw).size < 4 || COMMON.includes(pw.toLowerCase())) return { level: 0, ok: false, label: "เดาง่ายเกินไป ลองเปลี่ยนหรือกดสร้างรหัสให้" };
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(pw)).length;
  const score = (pw.length >= 12 ? 1 : 0) + (pw.length >= 16 ? 1 : 0) + (classes >= 2 ? 1 : 0) + (classes >= 3 ? 1 : 0);
  if (score <= 1) return { level: 1, ok: true, label: "อ่อน · ยิ่งยาวยิ่งดี" };
  if (score <= 3) return { level: 2, ok: true, label: "พอใช้" };
  return { level: 3, ok: true, label: "แข็งแรง" };
}

// Horizontal ruler (design 4 of profile-number-picker-designs.html): the
// value reads big above, the scale slides left/right under a fixed red line.
// Used for height (1 cm ticks) and weight (0.1 kg ticks). Horizontal so it
// works the same for left- and right-handed use.
const RULER_TICK = 8;
// Scroll area under a fixed modal header. Once scrolled, the top 18px fades out
// so content melts into the header instead of being cut off (no divider line).
function FadeScroll({ children, style, scrollRef }) {
  const [scrolled, setScrolled] = useState(false);
  const fade = "linear-gradient(transparent 0, #000 18px)";
  return (
    <div ref={scrollRef} className="no-scrollbar"
      onScroll={(e) => { const v = e.currentTarget.scrollTop > 2; setScrolled(p => (p === v ? p : v)); }}
      style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", ...(scrolled ? { WebkitMaskImage: fade, maskImage: fade } : null), ...style }}>
      {children}
    </div>
  );
}

// Close "✕" for dialogs that had none (confirm dialogs, storage warning): same icon and
// colour as the profile/settings ✕, with a roomier tap area.
// Field-level error: sits right under the field it is about (icon + red 12px text, no box). The bottom box in the
// donation form is kept only for errors that are not about one field (e.g. a failed save).
// Amber note for a browser/page limitation (not a failure): what to do instead.
function FieldNote({ children }) {
  return (
    <div role="note" style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FFF3DC", border: "1px solid #F2D9A4", borderRadius: 12, padding: "9px 12px", margin: "8px 0 0", fontSize: 12, lineHeight: 1.55, color: "#6B4A00" }}>
      <AlertTriangle size={13} color="#B7791F" aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }} />
      <span>{children}</span>
    </div>
  );
}

// Renders exportMsg / importMsg ({ kind: "err" | "note", text, at }) when it belongs to the given slot.
function BackupMsg({ msg, at }) {
  if (!msg || msg.at !== at) return null;
  return msg.kind === "note" ? <FieldNote>{msg.text}</FieldNote> : <FieldError>{msg.text}</FieldError>;
}

function FieldError({ children }) {
  return (
    <div role="alert" style={{ display: "flex", gap: 6, alignItems: "flex-start", margin: "8px 0 0", fontSize: 12, lineHeight: 1.5, color: "#B3261E" }}>
      <AlertCircle size={13} color="#B3261E" style={{ flexShrink: 0, marginTop: 3 }} />
      <span>{children}</span>
    </div>
  );
}

function DialogX({ onClick, disabled, style }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label="ปิด"
      style={{ position: "relative", background: "none", border: "none", padding: 0, cursor: disabled ? "not-allowed" : "pointer", color: "#3A2C29", display: "flex", flexShrink: 0, opacity: disabled ? 0.4 : 1, ...style }}>
      <span aria-hidden="true" style={{ position: "absolute", inset: -12 }} />
      <X size={20} />
    </button>
  );
}

function HorizontalRuler({ min, max, step = 1, decimals = 0, majorEvery, midEvery, value, unit, unitBefore, caption, onChange, onSettle, label, ariaUnit }) {
  const ref = useRef(null);
  const count = Math.round((max - min) / step) + 1;
  const valAt = (i) => Math.round((min + i * step) * 10 ** decimals) / 10 ** decimals;
  const idxOf = (v) => Math.max(0, Math.min(count - 1, Math.round((v - min) / step)));
  const idxRef = useRef(idxOf(value));
  const settleTimer = useRef(null);
  const userScrolled = useRef(false);
  const [idx, setIdx] = useState(idxRef.current);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    el.scrollLeft = idxRef.current * RULER_TICK;
    // A mouse wheel / trackpad scrolling vertically moves the scale too.
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); el.scrollLeft += e.deltaY; }
      userScrolled.current = true;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => { el.removeEventListener("wheel", onWheel); clearTimeout(settleTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pick = (i) => {
    i = Math.max(0, Math.min(count - 1, i));
    idxRef.current = i; setIdx(i);
    ref.current?.scrollTo({ left: i * RULER_TICK, behavior: "smooth" });
    onChange?.(valAt(i));
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => onSettle?.(valAt(i)), 250);
  };
  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const i = Math.max(0, Math.min(count - 1, Math.round(el.scrollLeft / RULER_TICK)));
    if (i !== idxRef.current) { idxRef.current = i; setIdx(i); onChange?.(valAt(i)); }
    if (!userScrolled.current) return;
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => onSettle?.(valAt(idxRef.current)), 180);
  };
  const markUser = () => { userScrolled.current = true; };
  // Whole numbers drop the ".0" (50 rather than 50.0).
  const shown = String(Number(valAt(idx).toFixed(decimals)));
  return (
    <div>
      <div aria-hidden="true" style={{ textAlign: "center", fontVariantNumeric: "tabular-nums", marginBottom: 2 }}>
        {/* Thai puts พ.ศ. before the year ("พ.ศ. 2546"), units after (162 ซม.). */}
        {unitBefore && <span style={{ fontSize: 13, color: "#7A6360", marginRight: 5 }}>{unitBefore}</span>}
        <span style={{ fontSize: 28, fontWeight: 700, color: "#9A3B33" }}>{shown}</span>
        {unit && <span style={{ fontSize: 13, color: "#7A6360", marginLeft: 4 }}>{unit}</span>}
        {caption && <span style={{ fontSize: 12, color: "#7A6360", marginLeft: 6 }}>· {caption(valAt(idx))}</span>}
      </div>
      <div style={{ position: "relative", height: 58 }}>
        <div aria-hidden="true" style={{ position: "absolute", left: "50%", top: 2, width: 3, height: 40, marginLeft: -1.5, borderRadius: 2, background: "#9A3B33", zIndex: 1, pointerEvents: "none" }} />
        <div ref={ref} className="no-scrollbar" onScroll={onScroll} onTouchStart={markUser} onPointerDown={markUser}
          role="spinbutton" tabIndex={0} aria-label={label} aria-valuenow={valAt(idx)} aria-valuetext={`${unitBefore ? unitBefore + " " : ""}${shown}${unit ? " " + (ariaUnit || unit) : ""}${caption ? " " + caption(valAt(idx)) : ""}`}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); markUser(); pick(idxRef.current + 1); }
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); markUser(); pick(idxRef.current - 1); }
          }}
          style={{ height: "100%", overflowX: "scroll", overflowY: "hidden", scrollSnapType: "x mandatory", overscrollBehavior: "contain", outline: "none", display: "flex",
            WebkitMaskImage: "linear-gradient(to right, transparent, #000 22%, #000 78%, transparent)", maskImage: "linear-gradient(to right, transparent, #000 22%, #000 78%, transparent)" }}>
          <div style={{ flex: `0 0 calc(50% - ${RULER_TICK / 2}px)` }} />
          {Array.from({ length: count }, (_, i) => {
            // Ticks keyed to the value itself (not the index), so labels land
            // on round numbers like 2540 or 160 whatever the range starts at.
            const k = Math.round(valAt(i) / step);
            const major = k % majorEvery === 0;
            const mid = !major && midEvery && k % midEvery === 0;
            return (
              <div key={i} style={{ position: "relative", flex: `0 0 ${RULER_TICK}px`, height: "100%", scrollSnapAlign: "center" }}>
                <span style={{ position: "absolute", left: RULER_TICK / 2 - 0.5, top: 6, width: 1, height: major ? 28 : mid ? 20 : 12, background: major ? "#B7A5A1" : "#D9C3BE" }} />
                {major && <span style={{ position: "absolute", left: RULER_TICK / 2, top: 40, transform: "translateX(-50%)", fontSize: 11, color: "#7A6360", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{Math.round(valAt(i))}</span>}
              </div>
            );
          })}
          <div style={{ flex: `0 0 calc(50% - ${RULER_TICK / 2}px)` }} />
        </div>
      </div>
    </div>
  );
}

const DateField = React.forwardRef(function DateField({ value, onChange, maxDate, ariaLabelPrefix, height = 44, fontSize = 14 }, ref) {
  const [open, setOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  return (
    <>
      <button ref={ref} type="button" onClick={() => { setDialogKey((k) => k + 1); setOpen(true); }}
        aria-label={`${ariaLabelPrefix}${value ? `: ${toBuddhistDate(value)}` : ""}`}
        style={{ width: "100%", height, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "'Mitr', 'Inter', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: value ? fontSize : fontSize - 1, fontWeight: value ? 600 : 400, color: value ? "#3A2C29" : "#A38D89", textAlign: "center" }}>
        {!value && <Calendar size={14} color="#A38D89" />}
        {value ? toBuddhistDate(value) : "ระบุวันที่"}
      </button>
      {open && (
        <DateCalendarDialog key={dialogKey} value={value} maxDate={maxDate} ariaLabelPrefix={ariaLabelPrefix}
          onConfirm={(next) => { onChange(next); setOpen(false); }}
          onClose={() => setOpen(false)} />
      )}
    </>
  );
});

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

// FAQ content is specifically about using THIS APP (data/privacy, LINE
// quirks, how features work) — general blood-donation knowledge already has
// its own place in the "ให้ความรู้" (knowledge) tab, so this list
// deliberately doesn't duplicate that.
const APP_FAQ_ITEMS = [
  {
    q: "ข้อมูลที่ฉันกรอกไว้เก็บอยู่ที่ไหน ปลอดภัยแค่ไหน",
    a: "เก็บอยู่ในเครื่อง/เบราว์เซอร์ของคุณเท่านั้น ไม่มีเซิร์ฟเวอร์กลางเก็บข้อมูลผู้ใช้ และผู้พัฒนาแอปเข้าถึงข้อมูลของคุณไม่ได้เลย ดูรายละเอียดเพิ่มเติมได้ที่นโยบายความเป็นส่วนตัว (ตั้งค่า → ความเป็นส่วนตัว)",
  },
  {
    q: "แอปนี้เชื่อมต่อหรือดึงข้อมูลจากระบบของสภากาชาดไทยหรือไม่",
    a: "ไม่เชื่อมต่อ แอปนี้พัฒนาโดยอิสระ ข้อมูลทั้งหมดมาจากที่คุณกรอกเองเท่านั้น ไม่ได้ดึงหรือส่งข้อมูลไปยังระบบของสภากาชาดไทยหรือหน่วยงานใด",
  },
  {
    q: "ถ้าเปลี่ยนเครื่อง ลง LINE ใหม่ หรือล้างแคช ข้อมูลจะหายไหม",
    a: "มีความเสี่ยงที่ข้อมูลจะหาย เพราะข้อมูลอยู่ในเครื่องเดิมเท่านั้นและไม่มีการซิงก์อัตโนมัติ แนะนำให้กด \"ส่งออกข้อมูล\" ที่หน้าตั้งค่าเก็บเป็นไฟล์สำรองไว้เป็นระยะ แล้วนำเข้าใหม่ได้เมื่อเปลี่ยนเครื่อง",
  },
  {
    q: "ทำไมเปิดลิงก์แอปผ่าน Chrome/Safari ตรง ๆ (ไม่ผ่าน LINE) ไม่ได้",
    a: "แอปนี้ตั้งใจให้เปิดผ่าน LINE เท่านั้น เพื่อให้ผู้ใช้เข้าถึงจากช่องทางเดียวที่ชัดเจน หากต้องการใช้งาน ให้เปิดผ่านริชเมนูหรือลิงก์ในแชทของ LINE Official Account",
  },
  {
    q: "เข็มที่ระลึกและเหรียญกาชาดสมนาคุณนับจากอะไร",
    a: "นับจากจำนวนครั้งสะสมที่คุณบันทึกไว้ในแอป อ้างอิงเกณฑ์จากศูนย์บริการโลหิตแห่งชาติ สภากาชาดไทย แต่สิทธิ์ที่ได้รับจริงควรยืนยันกับเจ้าหน้าที่ ณ จุดบริจาคอีกครั้ง เพราะแอปไม่มีการเชื่อมต่อกับระบบของสภากาชาดไทย",
  },
  {
    q: "ลืมบันทึกบางครั้งไปแล้ว ย้อนกลับมาเพิ่มทีหลังได้ไหม",
    a: "ได้ เพิ่ม แก้ไข หรือลบรายการบริจาคย้อนหลังได้ตลอดเวลาที่หน้าหลัก",
  },
  {
    q: "เจอปัญหาการใช้งานหรือมีข้อเสนอแนะ ต้องแจ้งยังไง",
    a: "แจ้งผ่านปุ่ม \"แจ้งปัญหา\" ในริชเมนูของ LINE Official Account ได้เลย",
  },
  {
    q: "แอปนี้ฟรีไหม ใครเป็นผู้พัฒนา",
    a: "ใช้งานได้ฟรี พัฒนาโดยผู้ใช้อิสระ ไม่ใช่ผลิตภัณฑ์ของสภากาชาดไทยหรือหน่วยงานราชการใด",
  },
  {
    q: "ทำไมต้องกดยินยอมก่อนเริ่มใช้งาน",
    a: "เพราะข้อมูลวันที่บริจาคโลหิตถือเป็นข้อมูลสุขภาพ ซึ่งเป็นข้อมูลอ่อนไหวตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA) แอปจึงขอความยินยอมก่อนเริ่มเก็บข้อมูลเสมอ",
  },
  {
    q: "อยากลบข้อมูลทั้งหมดหรือถอนความยินยอม ทำยังไง",
    a: "ไปที่ตั้งค่า → ลบข้อมูลทั้งหมด ข้อมูลทุกอย่างในเครื่องจะถูกลบทันทีและกู้คืนไม่ได้",
  },
];

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
const SHARE_LINK_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SHARE_LINK_TAG_BITS = 64; // AES-GCM default is 128; halving the auth
// tag halves its fixed per-token overhead. Forgery odds without the key go
// from ~1-in-2^128 to ~1-in-2^64 — astronomically still safe against
// someone editing a URL by hand, which is the actual threat model here.
const SHARE_LINK_EPOCH_MS = Date.UTC(2025, 0, 1); // reference point for the
// compact timestamp/date fields below, so they can be small integers
// instead of full millisecond-since-1970 values.

// The key seed isn't a plain string constant on purpose — a literal like
// `"bj-share-..."` sitting next to `crypto.subtle` / `"AES-GCM"` is exactly
// what a plain-text search of the built JS turns up first. Splitting it
// into three XOR-masked fragments (interleaved back together at runtime)
// doesn't make it a real secret — nothing shipped to the browser can be
// (see the note above) — but it means "search the bundle for a
// suspicious-looking string" no longer works, so extracting it takes
// actually tracing the code rather than a five-second Ctrl+F.
const _skA = [57, 98, 60, 56, 60, 63, 111, 98, 99, 63, 56];
const _skB = [108, 63, 56, 57, 107, 104, 98, 111, 99, 105, 110];
const _skC = [105, 104, 110, 56, 105, 105, 108, 108, 110, 98];
const _skMask = 0x5a;
function _assembleShareLinkSeed() {
  const codes = [];
  let ai = 0, bi = 0, ci = 0;
  const total = _skA.length + _skB.length + _skC.length;
  for (let i = 0; i < total; i++) {
    const bucket = i % 3;
    codes.push(bucket === 0 ? _skA[ai++] : bucket === 1 ? _skB[bi++] : _skC[ci++]);
  }
  return codes.map((b) => String.fromCharCode(b ^ _skMask)).join("");
}

let _shareLinkKeyPromise = null;
function getShareLinkKey() {
  if (!_shareLinkKeyPromise) {
    _shareLinkKeyPromise = crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(_assembleShareLinkSeed()))
      .then((hash) => crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]));
  }
  return _shareLinkKeyPromise;
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(str) {
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
//           | bit4 isMonk | bits5-7 bloodType (0=A,1=B,2=AB,3=O,4=other)
//   [1..3]  minutes since SHARE_LINK_EPOCH_MS, uint24 big-endian (the
//           link's own timestamp, used for the expiry check)
//   achievement: [4..5] totalCount uint16 | [6] tier | [7] threshold
//                | [8..] nickname: 1-byte length + UTF-8 bytes
//   record:      [4..5] order uint16 | [6..7] days-since-epoch uint16
//                | [8..9] minutes-since-midnight uint16 (0xFFFF = none)
//                | [..]  location: 1-byte length + UTF-8 bytes
//                | [..]  nickname: 1-byte length + UTF-8 bytes
const BLOOD_TYPE_CODES = { A: 0, B: 1, AB: 2, O: 3 };
const BLOOD_TYPE_FROM_CODE = ["A", "B", "AB", "O", ""];

function pushLenStr(out, str) {
  let bytes = Array.from(new TextEncoder().encode(str || ""));
  if (bytes.length > 255) bytes = bytes.slice(0, 255); // realistically only a pasted-in location could hit this
  out.push(bytes.length, ...bytes);
}
function readLenStr(bytes, offset) {
  const len = bytes[offset];
  const str = new TextDecoder().decode(bytes.slice(offset + 1, offset + 1 + len));
  return [str, offset + 1 + len];
}

function encodeSharePayload(payload) {
  const out = [];
  const sizeIdx = payload.sizeIdx & 0b11;
  const bloodCode = BLOOD_TYPE_CODES[payload.bloodType] ?? 4;
  const isAchievement = payload.kind === "a";
  const flagBit3 = isAchievement ? (payload.akind === "m" ? 1 : 0) : (payload.type === "c" ? 1 : 0);
  const flags = (isAchievement ? 1 : 0) | (sizeIdx << 1) | (flagBit3 << 3)
    | ((isAchievement && payload.isMonk ? 1 : 0) << 4) | (bloodCode << 5);
  out.push(flags & 0xff);

  const minutes = Math.max(0, Math.min(0xffffff, Math.round((Date.now() - SHARE_LINK_EPOCH_MS) / 60000)));
  out.push((minutes >> 16) & 0xff, (minutes >> 8) & 0xff, minutes & 0xff);

  if (isAchievement) {
    const totalCount = Number(payload.totalCount) || 0;
    out.push((totalCount >> 8) & 0xff, totalCount & 0xff, (Number(payload.tier) || 0) & 0xff, (Number(payload.threshold) || 0) & 0xff);
    pushLenStr(out, payload.nickname);
  } else {
    const order = Number(payload.order) || 0;
    out.push((order >> 8) & 0xff, order & 0xff);
    const dateMs = payload.date ? parseLocalDate(payload.date).getTime() : NaN;
    const days = Number.isFinite(dateMs) ? Math.max(0, Math.min(0xffff, Math.round((dateMs - SHARE_LINK_EPOCH_MS) / 86400000))) : 0;
    out.push((days >> 8) & 0xff, days & 0xff);
    let mins = 0xffff;
    if (payload.timeStr && /^\d{1,2}:\d{2}$/.test(payload.timeStr)) {
      const [h, m] = payload.timeStr.split(":").map(Number);
      mins = (h * 60 + m) & 0xffff;
    }
    out.push((mins >> 8) & 0xff, mins & 0xff);
    pushLenStr(out, payload.location);
    pushLenStr(out, payload.nickname);
  }
  return new Uint8Array(out);
}

function decodeSharePayload(bytes) {
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
    const [nickname] = readLenStr(bytes, 8);
    return { kind, sizeIdx, totalCount, tier: bytes[6], threshold: bytes[7], akind: flagBit3 ? "m" : "p", isMonk, bloodType, nickname, ts };
  }
  const order = (bytes[4] << 8) | bytes[5];
  const days = (bytes[6] << 8) | bytes[7];
  const minsOfDay = (bytes[8] << 8) | bytes[9];
  const [location, off] = readLenStr(bytes, 10);
  const [nickname] = readLenStr(bytes, off);
  const dateObj = new Date(SHARE_LINK_EPOCH_MS + days * 86400000);
  const timeStr = minsOfDay === 0xffff ? "" : `${String(Math.floor(minsOfDay / 60)).padStart(2, "0")}:${String(minsOfDay % 60).padStart(2, "0")}`;
  return { kind, sizeIdx, order, dateObj, timeStr, type: flagBit3 ? "c" : "w", location, bloodType, nickname, ts };
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

// Draws a single line of text shrunk to fit maxWidth (down to a floor size)
// instead of letting it overflow the canvas — used for the "โดย <nickname>"
// caption, which is free text (up to ~61 chars after two 30-char name
// fields are joined) with no wrap/measure guard elsewhere, unlike location
// and achievement description which already go through wrapCanvasText.
function fillCanvasTextFit(ctx, text, x, y, maxWidth, weight, basePx, fontFamily, minPx = 14) {
  let px = basePx;
  ctx.font = `${weight} ${px}px ${fontFamily}`;
  while (px > minPx && ctx.measureText(text).width > maxWidth) {
    px -= 1;
    ctx.font = `${weight} ${px}px ${fontFamily}`;
  }
  ctx.fillText(text, x, y);
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
function tracDropletPath(ctx, cx, cy, r) {
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
function drawRecordBadge(ctx, cx, cy, r, order) {
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

function drawRoundedPill(ctx, cx, y, text, font, fillStyle, textColor) {
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
function drawPortraitRecordCard(ctx, W, H, FONT, { order, dateStr, timeStr, typeLabel, location, bloodType, nickname }) {
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
    ctx.fillText(`หมู่เลือด ${bloodType}`, W / 2, Y(lineY));
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
function drawLandscapeRecordCard(ctx, W, H, FONT, { order, dateStr, timeStr, typeLabel, location, bloodType, nickname }) {
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
    ctx.fillText(`หมู่เลือด ${bloodType}`, textX, lineY);
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

// Draws a shareable card for a single donation record (date, sequence
// number, type, location) — same canvas-only approach as buildShareCardDataUrl
// below, kept as a separate function so the achievement-card flow is untouched.
export async function buildRecordShareCardDataUrl({ order, dateStr, timeStr, typeLabel, location, bloodType, nickname, width, height }) {
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
  const FONT = "'Mitr', 'Inter', sans-serif";

  drawShareCardBackground(ctx, W, H);
  const content = { order, dateStr, timeStr, typeLabel, location, bloodType, nickname };

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
export async function buildShareCardDataUrl({ totalCount, achievement, estVolumeMl, bloodType, nickname, width, height }) {
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
  const FONT = "'Mitr', 'Inter', sans-serif";

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

// Extracted + React.memo'd so that with a long donation history (500-1000+
// records) paged in via "โหลดเพิ่ม", an unrelated state change elsewhere in
// AppInner (a toast, a timer tick, opening a different modal) doesn't force
// every already-rendered row to re-render — only the row(s) whose own props
// actually changed do. isMenuOpen is passed as a plain boolean (not the
// whole openActionMenuId string) precisely so that opening the menu on ONE
// row doesn't also cause every other row's memo comparison to fail.
// Fixed 14px icon column for the meta lines of a history row, so every line's text starts at the
// same x (icons of 13-14px are centred in it) instead of drifting with each icon's own width.
// One-line "saved / last edited" note under the detail modal's table. The row labels above are one
// block centred in a 50px column (as wide as the word "ประเภท"), so this line starts at that block's
// left edge: we measure a hidden "ประเภท" at the label font size (12px) and indent by (50 - width) / 2.
function ModalMetaLine({ children }) {
  const ghostRef = useRef(null);
  const [pad, setPad] = useState(5.5);
  useLayoutEffect(() => {
    const measure = () => {
      const w = ghostRef.current ? ghostRef.current.getBoundingClientRect().width : 0;
      if (w > 0 && w < 50) setPad((50 - w) / 2);
    };
    measure();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure).catch(() => {});
  }, []);
  return (
    <div style={{ position: "relative", padding: `10px 0 2px ${pad}px`, fontSize: 10, color: "#B5A29E", lineHeight: 1.6 }}>
      <span ref={ghostRef} aria-hidden="true" style={{ position: "absolute", visibility: "hidden", whiteSpace: "nowrap", fontSize: 12 }}>ประเภท</span>
      {children}
    </div>
  );
}
// Faint dividers between the options of a segmented picker (white outlined track + pale-pink sliding pill).
// Shown only while nothing is chosen, so the empty control still reads as N separate choices; once an option
// is picked they all fade out (a leftover lone divider read as a grouping, e.g. "A B AB | O").
function SegDividers({ n, sel }) {
  return Array.from({ length: n - 1 }, (_, i) => {
    const k = i + 1; // divider between option k-1 and option k
    return (
      <span key={k} aria-hidden="true" style={{ position: "absolute", top: 10, bottom: 10, left: `calc(4px + ${k} * (100% - 8px) / ${n})`, width: 1, marginLeft: -0.5, background: "#E6D3CF", opacity: sel >= 0 ? 0 : 1, transition: "opacity .18s", pointerEvents: "none" }} />
    );
  });
}

const HIST_ICON_BOX = { width: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const HistoryRow = React.memo(function HistoryRow({ d, orderNumber, isMenuOpen, onToggleMenu, onView, onEdit, onShare, onDelete }) {
  // Used for the type pill only -- the order-number droplet badge below is
  // deliberately kept a single consistent color regardless of type (per
  // explicit user feedback), rather than tinting it per donation type.
  const tint = DONATION_TYPE_TINT[d.type === "component" ? "component" : "whole"];
  return (
    <div className="hist-card" role="button" tabIndex={0} aria-label="ดูรายละเอียดรายการบริจาค" onClick={onView} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onView(); } }} style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 14, padding: "13px 6px 13px 13px", display: "flex", gap: 10, justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" }}>
      <div style={{ width: 46, height: 56, position: "relative", flexShrink: 0 }}>
        <svg width="46" height="56" viewBox="0 0 46 56" fill="none" style={{ position: "absolute", inset: 0 }}>
          <path d="M23 2 C23 2 40 24 40 35 C40 45.5 32.5 54 23 54 C13.5 54 6 45.5 6 35 C6 24 23 2 23 2 Z" fill="#9A3B33" />
        </svg>
        <div style={{ position: "absolute", inset: 0, top: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: String(orderNumber).length >= 3 ? 12 : 14, fontWeight: 800, color: "#FFF7F5", lineHeight: 1.1 }}>{orderNumber}</div>
          <div style={{ fontSize: 10, color: "#FFF7F5", opacity: 0.9, marginTop: 1 }}>ครั้งที่</div>
        </div>
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#3A2C29", lineHeight: 1.5, display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: 7 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}><span style={{ ...HIST_ICON_BOX, alignSelf: "center" }}><Calendar size={12} color="#9A3B33" /></span>{toBuddhistDateFull(d.date)}</span>
          {d.time && <span style={{ fontSize: 12, fontWeight: 400, color: "#8E7773", whiteSpace: "nowrap" }}>{`เวลา\u00A0${d.time}\u00A0น.`}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5 }}>
          <span style={HIST_ICON_BOX}>{d.type === "component" ? <Droplets size={12} color="#7A6360" /> : <Droplet size={12} color="#7A6360" />}</span>
          <span style={{ display: "inline-flex", alignItems: "center", fontSize: 12, color: tint.text, fontWeight: 600 }}>{DONATION_TYPE_LABELS[d.type === "component" ? "component" : "whole"]}</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 12, color: d.location ? "#7A6360" : "#A38D89", marginTop: 5 }}>
          <span style={{ ...HIST_ICON_BOX, marginTop: 2 }}><MapPin size={12} /></span> <span style={{ minWidth: 0, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.location || "—"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 12, color: d.note ? "#7A6360" : "#A38D89", marginTop: 5 }}>
          <span style={{ ...HIST_ICON_BOX, marginTop: 2 }}><StickyNote size={12} /></span> <span style={{ minWidth: 0, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.note || "—"}</span>
        </div>
      </div>
      <div className="hist-more" onClick={(e) => e.stopPropagation()} style={{ position: "relative", flexShrink: 0 }}>
        <button onClick={onToggleMenu} aria-label="ตัวเลือกเพิ่มเติม" style={{ background: "none", border: "none", cursor: "pointer", padding: 13.5, margin: "-10px -3px -10px 0", lineHeight: 0 }}>
          <MoreVertical size={17} color="#9A3B33" />
        </button>
        {isMenuOpen && (
          <>
            <div onClick={onToggleMenu} style={{ position: "fixed", inset: 0, zIndex: 55 }} />
            <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 2, background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 12, boxShadow: "0 4px 14px rgba(36,26,24,0.15)", overflow: "hidden", zIndex: 56, minWidth: 120 }}>
              <button onClick={onEdit} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#3A2C29", fontFamily: "inherit" }}>
                <Pencil size={14} color="#9A3B33" /> แก้ไข
              </button>
              <button onClick={onShare} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#3A2C29", fontFamily: "inherit", borderTop: "1px solid #F3E7E4" }}>
                <Share2 size={14} color="#9A3B33" /> แชร์
              </button>
              <button onClick={onDelete} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#B3261E", fontFamily: "inherit", borderTop: "1px solid #F3E7E4" }}>
                <Trash2 size={14} color="#B3261E" /> ลบ
              </button>
                          </div>
          </>
        )}
      </div>
    </div>
  );
});

// Lets a rich-menu button (or any external link) deep-link straight into a
// specific tab via ?tab=dashboard etc., instead of always landing on หน้าหลัก.
//
// This is NOT as simple as reading window.location.search: when LINE opens
// a liff.line.me URL that has extra query params, it doesn't forward them
// as-is — it wraps the whole original query (and path) into a single
// `liff.state` param on the endpoint URL, e.g. requesting
// `.../?tab=dashboard` actually arrives here as
// `...?liff.state=%2F%3Ftab%3Ddashboard`. liff.init() does not reliably
// unwrap that back into a plain `?tab=dashboard` on window.location before
// we read it, so we have to unwrap `liff.state` ourselves. main.jsx
// snapshots the raw query string into window.__bjInitialSearch *before*
// calling liff.init() (in case init() rewrites/clears the address bar) —
// read once, lazily, from AppInner's useState initializer so this runs on
// first render rather than at module-eval time.
const VALID_TABS = ["home", "dashboard", "missions", "knowledge", "eligibility", "faq"];
function initialTabFromUrl() {
  try {
    const raw = typeof window.__bjInitialSearch === "string" ? window.__bjInitialSearch : window.location.search;
    let params = new URLSearchParams(raw);
    const liffState = params.get("liff.state");
    if (liffState) {
      const decoded = decodeURIComponent(liffState);
      const qIndex = decoded.indexOf("?");
      if (qIndex !== -1) params = new URLSearchParams(decoded.slice(qIndex + 1));
    }
    const t = params.get("tab");
    return VALID_TABS.includes(t) ? t : "home";
  } catch (e) {
    return "home";
  }
}

function AppInner() {
  const [phase, setPhase] = useState("loading"); // loading | consent | app | error
  const [tab, setTab] = useState(initialTabFromUrl); // home | dashboard | missions | knowledge | eligibility | faq
  const [nickname, setNickname] = useState("");
  const [photo, setPhoto] = useState("");
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState(null); // index of the expanded FAQ item, or null
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoCameraInputRef = useRef(null);
  const photoGalleryInputRef = useRef(null);
  const profileOpenerRef = useRef(null);
  // Bumped every time the profile modal is (re)opened. A photo pick made
  // inside the modal captures the token at selection time; if the modal
  // gets closed and reopened (a fresh profileDraft) before the async
  // resize resolves, the token no longer matches and the stale pick is
  // dropped instead of silently merging into the new, unrelated draft.
  const profileEditSessionRef = useRef(0);
  const nicknameFirstInputRef = useRef(null);
  const nicknameLastInputRef = useRef(null);
  const [birthYear, setBirthYear] = useState(""); // พ.ศ. (number) or ""
  // true when birthYear was worked out from an age saved by an older
  // version (age → this year minus age), until the donor confirms/edits it.
  const [birthYearApprox, setBirthYearApprox] = useState(false);
  const age = birthYear === "" ? "" : Math.max(0, thaiYearNow() - birthYear);
  const [gender, setGender] = useState(""); // "male" | "female" | "none" | ""
  const [height, setHeight] = useState(""); // cm or ""
  const [donorId, setDonorId] = useState(""); // เลขประจำตัวผู้บริจาคโลหิต
  const [bloodRh, setBloodRh] = useState(""); // "+" | "-" | "unknown" | ""
  const [remindPauseUntil, setRemindPauseUntil] = useState(""); // YYYY-MM-DD or ""
  // Latest values of the newer profile fields, so every existing
  // persistProfile call site keeps them without threading each one through.
  const profileExtrasRef = useRef({});
  profileExtrasRef.current = { birthYear, birthYearApprox, gender, height, donorId, bloodRh, remindPauseUntil };
  // Per-donor ceilings on the "เคยบริจาคมาแล้วกี่ครั้ง" starting-count inputs
  // (see WHOLE_BLOOD_INTERVAL_DAYS/COMPONENT_INTERVAL_DAYS/
  // STARTING_COUNT_CAP_MARGIN above): scoped to this donor's own actual
  // eligible years so far (their entered age minus MIN_AGE), not one flat
  // number that's the same for a 25-year-old and a 65-year-old -- someone
  // who says they're 25 could only ever have been eligible for ~8 years,
  // nowhere near the full MIN_AGE-MAX_AGE (17-70) window. Falls back to
  // that full window when age hasn't been entered yet, since there's
  // nothing more specific to go on yet. donorEligibleYears is clamped to at
  // least 1 so the cap can never collapse to (near) zero and block a
  // legitimate first entry.
  const donorEligibleYears = useMemo(() => {
    const parsedAge = Number(age);
    if (age === "" || Number.isNaN(parsedAge)) return MAX_AGE - MIN_AGE;
    return Math.max(1, Math.min(parsedAge, MAX_AGE) - MIN_AGE);
  }, [age]);
  const maxStartingCountWhole = useMemo(
    () => Math.max(10, Math.round(donorEligibleYears * (365.25 / WHOLE_BLOOD_INTERVAL_DAYS) * STARTING_COUNT_CAP_MARGIN)),
    [donorEligibleYears]
  );
  const maxStartingCountComponent = useMemo(
    () => Math.max(10, Math.round(donorEligibleYears * (365.25 / COMPONENT_INTERVAL_DAYS) * STARTING_COUNT_CAP_MARGIN)),
    [donorEligibleYears]
  );
  const [weight, setWeight] = useState("");
  const [bloodType, setBloodType] = useState("");
  // "" until the donor picks one in their profile (no default is pre-selected
  // there any more). Everything that depends on it only checks === "monk",
  // so an unset type still behaves as บุคคลทั่วไป for badges/milestones.
  const [donorType, setDonorType] = useState("");
  // "ยอดสะสมยกมา" (donations before this app was used) is stored split by
  // donation type — startingCountWhole / startingCountComponent — same as
  // real dated records, so the countdown/eligibility logic and any future
  // breakdown displays stay consistent. Older saved profiles only have a
  // single combined `startingCount` number; those are migrated on load by
  // attributing the whole legacy total to "whole" (โลหิตรวม), since the
  // donation-type concept didn't exist when they were saved — see load().
  const [startingCountWhole, setStartingCountWhole] = useState("");
  const [startingCountComponent, setStartingCountComponent] = useState("");
  const [startingCountUpdatedAt, setStartingCountUpdatedAt] = useState("");
  // When the starting count was first set (distinct from startingCountUpdatedAt,
  // which moves every time it's edited) — lets the UI say "แก้ไขล่าสุดเมื่อ"
  // instead of "บันทึกเมื่อ" once it's been edited at least once. Legacy
  // profiles saved before this field existed fall back to treating
  // createdAt === updatedAt (i.e. "never edited yet") — see load().
  const [startingCountCreatedAt, setStartingCountCreatedAt] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ nicknameFirst: "", nicknameLast: "", age: "", weight: "", bloodType: "", donorType: DEFAULT_DONOR_TYPE, photo: null });
  const [profileError, setProfileError] = useState("");
  // Profile box with inline editing (design 1 from
  // profile-inline-edit-designs.html): each row's value is typed straight
  // into the row (borderless, the row tints while editing) and saved on its
  // own on blur / Enter; blood type and donor type expand their options
  // inside the row. No pop-up sheet, no whole-form save button.
  const [profileInline, setProfileInline] = useState({ first: "", last: "", birthYear: "", weight: "", height: "", donorId: "" });
  const [profileInlineError, setProfileInlineError] = useState({});
  const [profileOpenChoice, setProfileOpenChoice] = useState(null); // "bloodType" | "donorType" | null
  const [profileSavedKey, setProfileSavedKey] = useState(null);
  const [pickerPreview, setPickerPreview] = useState(null); // { key, value } while a picker scrolls
  const profileSavedTimerRef = useRef(null);
  const [showRemindPause, setShowRemindPause] = useState(false);
  const [remindPauseChoice, setRemindPauseChoice] = useState("6");
  const showRemindPauseRef = useRef(false);
  showRemindPauseRef.current = showRemindPause;
  const showClearProfileRef = useRef(false);
  const showResetRef = useRef(false);
  const [donations, setDonations] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editSnapshot, setEditSnapshot] = useState(null);
  const [formError, setFormError] = useState("");
  const lastTypeIdxRef = useRef(0); // where the type pill fades out from after being cleared
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showClearProfile, setShowClearProfile] = useState(false);
  showClearProfileRef.current = showClearProfile;
  showResetRef.current = showReset;
  const profileBoxRef = useRef(null);
  const lastPickedRef = useRef({}); // last chosen option per profile row, so the highlight can fade out in place
  const profileScrollRef = useRef(null);
  const [profileScrolled, setProfileScrolled] = useState(false);
  // Profile dialog: move focus into it, keep Tab inside it, and stop the page behind from scrolling.
  useEffect(() => {
    if (!showProfile) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setProfileScrolled(false);
    // No focus move on open (on phones it pops the keyboard / jumps the page); Tab is still trapped below.
    const onKey = (e) => {
      if (e.key !== "Tab") return;
      const box = profileBoxRef.current;
      if (!box) return;
      const dialogs = document.querySelectorAll('[role="dialog"]');
      const top = dialogs[dialogs.length - 1];
      if (!top || !top.contains(box)) return; // another dialog is on top of the profile
      const f = [...box.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(el => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1], a = document.activeElement;
      if (!box.contains(a)) { e.preventDefault(); first.focus(); return; }
      if (e.shiftKey && (a === first || a === box)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow; document.removeEventListener("keydown", onKey);
    };
  }, [showProfile]);
  // Opening a row near the bottom: scroll the box so the whole panel is visible.
  useEffect(() => {
    if (!showProfile || !profileOpenChoice) return undefined;
    const t = setTimeout(() => {
      const el = profileScrollRef.current?.querySelector(`[data-prow="${profileOpenChoice}"]`);
      el?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    }, 120);
    return () => clearTimeout(t);
  }, [showProfile, profileOpenChoice]);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [formSaveError, setFormSaveError] = useState("");
  const [importConfirmError, setImportConfirmError] = useState("");
  const [importSaving, setImportSaving] = useState(false);
  const [startCountDeleteError, setStartCountDeleteError] = useState("");
  const [clearProfileError, setClearProfileError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [exportMsg, setExportMsg] = useState(null);
  const [importMsg, setImportMsg] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [viewDonationId, setViewDonationId] = useState(null);
  // Which history card's overflow (⋮) action menu is currently open — replaces
  // the previous always-visible edit/delete icon pair to reduce visual
  // clutter, especially now that cards can grow taller with longer notes.
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const [editingStartingCount, setEditingStartingCount] = useState(false);
  const [viewStartingCount, setViewStartingCount] = useState(false);
  const [startingCountEditError, setStartingCountEditError] = useState("");
  const [startingCountEditField, setStartingCountEditField] = useState(""); // "whole" | "component" | "" (non-field error)
  const [startingCountDraftWhole, setStartingCountDraftWhole] = useState("");
  const [startingCountDraftComponent, setStartingCountDraftComponent] = useState("");
  const [confirmDeleteStartingCount, setConfirmDeleteStartingCount] = useState(false);
  const [checkedConsent, setCheckedConsent] = useState(false);
  // true when an older consent version is on file (returning user asked to
  // confirm the updated policy) rather than a first-time user.
  const [consentIsUpdate, setConsentIsUpdate] = useState(false);
  // First-time "+" tap onboarding: ask up front whether this is the user's
  // very first donation ever, or they've donated before (so we should
  // capture a running "ยอดยกมา" count instead of forcing a dated record).
  // Only relevant while there's truly nothing recorded yet (see
  // handleAddButtonClick) — once either a donation or a starting count
  // exists, "+" just opens the normal form directly.
  const [showOnboardingChoice, setShowOnboardingChoice] = useState(false);
  // True when the add form was opened from the first-use choice ("นี่คือการบริจาคโลหิตครั้งใด?"), so the
  // form's ยกเลิก button steps back to that choice instead of dropping the user on the home screen.
  const [formFromChoice, setFormFromChoice] = useState(false);
  // Combined "เคยบริจาคแล้ว" entry: one modal capturing both the running
  // total count (which includes the most recent donation being logged here)
  // and that most-recent donation's own date/time/location/note, in a single
  // save. Replaces the earlier 2-step flow (count-only modal, then a
  // separate "จำวันที่บริจาคครั้งล่าสุดได้ไหม?" follow-up prompt) — see
  // handoff doc decision log for the reasoning. startingCount is always
  // derived as (entered total - 1) so the two records never double-count.
  const [showStartingCountQuickEntry, setShowStartingCountQuickEntry] = useState(false);
  const [quickStartingCountError, setQuickStartingCountError] = useState("");
  // Which field the current quick-entry error is about ("whole-count", "component-date", ...), so that
  // field gets the red edge like the main donation form does. Only shown while the error text is set.
  const [quickErrorField, setQuickErrorField] = useState("");
  const [quickTypeOnWhole, setQuickTypeOnWhole] = useState(false);
  const [quickTypeOnComponent, setQuickTypeOnComponent] = useState(false);
  const [quickStartingCountWholeDraft, setQuickStartingCountWholeDraft] = useState("");
  const [quickStartingCountComponentDraft, setQuickStartingCountComponentDraft] = useState("");
  const [quickEntryFormWhole, setQuickEntryFormWhole] = useState({ date: "", time: "", location: "", note: "" });
  const [quickEntryFormComponent, setQuickEntryFormComponent] = useState({ date: "", time: "", location: "", note: "" });
  const quickCountInputRefWhole = useRef(null);
  const quickCountInputRefComponent = useRef(null);
  const quickDateInputRefWhole = useRef(null);
  const quickDateInputRefComponent = useRef(null);
  // date starts blank (not pre-filled with today) -- opening the date field
  // still defaults to today inside the calendar dialog itself (see
  // DateCalendarDialog's `initial`), it's just not assumed/shown until the
  // user actually opens and confirms it.
  const [form, setForm] = useState({ date: "", time: "", location: "", note: "", type: "" });
  // Lets submitDonation below put the user's attention directly on the date
  // field when it's the reason validation failed ("ระบุวันที่บริจาค") -- previously the error
  // text appeared above the บันทึก button but nothing pointed back up at
  // the actual empty/invalid field, so on a longer form it was easy to miss
  // which field the error was even about (reported directly by the user).
  const formDateFieldRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lastExportCount, setLastExportCount] = useState(0);
  const [backupSnoozeCount, setBackupSnoozeCount] = useState(null);
  const [cycleDays, setCycleDays] = useState(DEFAULT_CYCLE_DAYS);
  const [componentCycleDays, setComponentCycleDays] = useState(DEFAULT_COMPONENT_CYCLE_DAYS);
  const [backupReminderGap, setBackupReminderGap] = useState(DEFAULT_BACKUP_REMINDER_GAP);
  // The number inputs below bind directly to the raw state above so the
  // user can freely type/clear digits, only clamped to range on blur — but
  // that means the raw state can transiently hold an out-of-range or
  // unparseable value while typing. Eligibility math, the backup-reminder
  // check, and anything else derived from these settings should never see
  // that transient value, so they read the "effective" (always in-range)
  // versions below instead.
  const effectiveCycleDays = cycleDays !== "" && Number.isFinite(Number(cycleDays))
    ? Math.min(MAX_CYCLE_DAYS, Math.max(MIN_CYCLE_DAYS, Math.round(Number(cycleDays)))) : DEFAULT_CYCLE_DAYS;
  const effectiveComponentCycleDays = componentCycleDays !== "" && Number.isFinite(Number(componentCycleDays))
    ? Math.min(MAX_CYCLE_DAYS, Math.max(MIN_CYCLE_DAYS, Math.round(Number(componentCycleDays)))) : DEFAULT_COMPONENT_CYCLE_DAYS;
  const effectiveBackupReminderGap = backupReminderGap !== "" && Number.isFinite(Number(backupReminderGap))
    ? Math.min(MAX_BACKUP_REMINDER_GAP, Math.max(MIN_BACKUP_REMINDER_GAP, Math.round(Number(backupReminderGap)))) : DEFAULT_BACKUP_REMINDER_GAP;
  const [dismissedEligibilityAge, setDismissedEligibilityAge] = useState(null);
  const [dismissedEligibilityWeight, setDismissedEligibilityWeight] = useState(null);
  const [dismissedCareFor, setDismissedCareFor] = useState(null); // donation id whose after-care card was closed
  // Snoozes the home-tab "อยากให้เตือนวันครบกำหนดไหม ?" prompt for the rest of
  // the day it was dismissed on. Stored per donation type — { whole: { dueDate,
  // dismissedOn }, component: {...} } — so dismissing one type's reminder never
  // overwrites/loses the other type's separate dismissal. Each entry reappears
  // immediately if that type's due date changes (new donation logged, cycle
  // days edited), and on its own the next day even if the due date is
  // unchanged.
  const [dismissedReminders, setDismissedReminders] = useState({});
  // Blood group / age / weight / donor ID on Home: blurred by default; the profile switch
  // "ซ่อนข้อมูลบนหน้าแรก" turns the blur off (persisted).
  const [blurInfoPills, setBlurInfoPills] = useState(true);
  const pillsHidden = blurInfoPills;
  // True once storage.isDegraded() has ever returned true this session —
  // meaning a write fell all the way through to the in-memory fallback and
  // is NOT actually persisted. Drives a one-time warning modal (see
  // showStorageDegradedModal) plus a persistent home-tab banner. Checked
  // after the app's most frequent/important writes (persistUiMeta,
  // submitDonation, saveProfile) via checkStorageHealth() below.
  const [storageDegraded, setStorageDegraded] = useState(false);
  const [showStorageDegradedModal, setShowStorageDegradedModal] = useState(false);
  const storageDegradedNotifiedRef = useRef(false);
  const checkStorageHealth = () => {
    if (storage.isDegraded() && !storageDegradedNotifiedRef.current) {
      storageDegradedNotifiedRef.current = true;
      setStorageDegraded(true);
      setShowStorageDegradedModal(true);
    }
  };
  // Which donation type the home-tab summary card is currently showing, when
  // the donor has logged both types. Starts on whichever is soonest, then
  // auto-rotates every 30s (see the effect below); tapping a pill on that
  // card overrides it immediately.
  const [countdownTab, setCountdownTab] = useState(null);
  // Same idea, but for the dashboard-tab summary card — kept as its own state
  // (rather than reusing countdownTab) so each card's pill tap and rotation
  // only affects that one card, never the other.
  const [dashboardRotateType, setDashboardRotateType] = useState(null);
  // Captured once when the dashboard tab's data loads, not recomputed on every
  // render — otherwise the 30s auto-rotate above (which re-renders the whole
  // app) would make this "as of" timestamp silently tick forward on its own,
  // even though nothing about the cumulative stats actually changed.
  const [dashboardLoadedAt] = useState(() => new Date());
  const [seenAchievements, setSeenAchievements] = useState([]);
  const [importing, setImporting] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);
  const [pasteImportText, setPasteImportText] = useState("");
  const [pasteImportError, setPasteImportError] = useState("");
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [exportJsonText, setExportJsonText] = useState("");
  // The unified "สำรอง/กู้คืนข้อมูล" hub (replaces separate export/import
  // entry points in Settings with one tabbed dialog). showExportPreview above
  // still gates the auto-select-textarea effect below and is kept true
  // whenever this hub's export tab is open.
  const [showBackupRestore, setShowBackupRestore] = useState(false);
  const showBackupRestoreRef = useRef(false);
  showBackupRestoreRef.current = showBackupRestore;
  const [backupRestoreTab, setBackupRestoreTab] = useState("export");
  const backupDialogRef = useRef(null);
  const exportTabIdx = backupRestoreTab === "export" ? 0 : -1;
  const importTabIdx = backupRestoreTab === "import" ? 0 : -1;
  // Password-protected backup (design 3 of backup-encrypt-designs.html).
  // Passwords live only in memory and are cleared whenever the hub opens or closes.
  // Encrypted by default (design 3 of backup-force-encrypt-designs.html): the
  // hub opens with a generated passphrase; a plain file is a small link that
  // goes through a warning. exportGenPw = generated mode, empty = own password.
  const [exportProtect, setExportProtect] = useState(true);
  const [exportStep, setExportStep] = useState(1); // generated mode: 1 = show the passphrase, 2 = type it back
  const [exportConfirmPw, setExportConfirmPw] = useState("");
  const [showPlainWarn, setShowPlainWarn] = useState(false);
  const [plainWarnAck, setPlainWarnAck] = useState(false);
  const [exportPw, setExportPw] = useState("");
  const [exportPw2, setExportPw2] = useState("");
  const [exportShowPw, setExportShowPw] = useState(false);
  const [exportGenPw, setExportGenPw] = useState(""); // non-empty = the generated passphrase is in use
  const [exportEncrypted, setExportEncrypted] = useState(null); // { key, text }
  const [exportEncrypting, setExportEncrypting] = useState(false);
  const exportEncryptRunRef = useRef(0);
  const [importLock, setImportLock] = useState(null); // { text, name } while asking for the file's password
  const [importLockPw, setImportLockPw] = useState("");
  const [importLockShow, setImportLockShow] = useState(false);
  const [importLockError, setImportLockError] = useState("");
  const [importLockBusy, setImportLockBusy] = useState(false);
  const importBroken = importLockError === IMPORT_UNSUPPORTED_MESSAGE;
  const exportStrength = backupPasswordStrength(exportPw);
  const exportEffectivePw = exportGenPw || (exportStrength.ok && exportPw === exportPw2 ? exportPw : "");
  const exportKey = exportEffectivePw && exportJsonText ? `${exportEffectivePw}\u0000${exportJsonText}` : "";
  // What the textarea / download / copy use: the plain JSON, or the
  // ciphertext once it has been made for the current data + password.
  const exportOutText = !exportProtect ? exportJsonText : (exportEncrypted && exportKey && exportEncrypted.key === exportKey ? exportEncrypted.text : "");
  const exportTypedOk = !!exportGenPw && exportConfirmPw.trim().toLowerCase() === exportGenPw;
  const exportReady = !!exportOutText && (!exportProtect || !exportGenPw || (exportStep === 2 && exportTypedOk));
  const [showShareCard, setShowShareCard] = useState(false);
  const [shareCardDataUrl, setShareCardDataUrl] = useState("");
  const canShareFiles = useMemo(() => {
    if (isNativeApp) return true; // native share sheet via @capacitor/share, always available
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
  // When set, the share-card modal is generating/showing a single donation
  // record's card instead of the overall achievement card (shareData above).
  // Only one of the two is ever active at a time — openShareCard/openRecordShareCard
  // and closeShareCard keep them mutually exclusive.
  const [shareRecordData, setShareRecordData] = useState(null);
  const [cardSizeKey, setCardSizeKey] = useState(DEFAULT_CARD_SIZE);
  // When true, shows the small "Google Calendar / .ics" choice popover next
  // to the "เพิ่มลงปฏิทิน" button (see handleAddToCalendar) instead of
  // picking one automatically — non-native builds only, since the native
  // app's OS share sheet already lets the user pick their calendar app.
  const [showCalendarChoice, setShowCalendarChoice] = useState(false);
  // Collapsed by default -- the "คำนวณจากเกณฑ์...วันต่อครั้ง" disclaimer used to
  // print as a standalone 3-line paragraph on every load; now it's tucked
  // behind a small (i) toggle right next to the countdown text it explains.
  const [showCycleInfo, setShowCycleInfo] = useState(false);
  // Which slide of the home-tab reminder carousel is in view (drives the
  // dots under it). Updated from the scroller's own scroll position.
  const [reminderIdx, setReminderIdx] = useState(0);
  const reminderScrollerRef = useRef(null);
  // Auto-advance for that carousel: every 5s, move to the next slide (looping
  // back to the first). Any touch/click/hover/keyboard focus inside it pauses
  // auto-advance until 8s after the last interaction, so it never slides out
  // from under someone reading or about to tap. Skipped entirely with
  // prefers-reduced-motion, while the calendar picker is open, when the page
  // is in the background, or off the home tab.
  const reminderLastTouchRef = useRef(0);
  // Auto-advance plays through the queue once (ending back on the first
  // slide) and then stops; swiping and the dots keep working.
  const reminderAutoStepsRef = useRef(0);
  const [toast, setToast] = useState(null);
  const [historyYearFilter, setHistoryYearFilter] = useState("all");
  // Bottom sheet holding the history type + year filters (see the
  // "ตัวกรอง" button above the history list).
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  // Exit animation (design "2" from filter-sheet-exit-7-designs.html): the
  // sheet drops away quickly (0.16s) while the dimmed backdrop fades a beat
  // behind it, then unmounts. With prefers-reduced-motion it just closes.
  const [filterSheetClosing, setFilterSheetClosing] = useState(false);
  // Draft filters edited inside the sheet. The list behind no longer
  // updates on every chip tap -- the draft is only committed to
  // historyTypeFilter/historyYearFilter when "เสร็จ" is pressed; ✕, a
  // backdrop tap or Escape close the sheet and discard the draft.
  const [draftTypeFilter, setDraftTypeFilter] = useState("all");
  const [draftYearFilter, setDraftYearFilter] = useState("all");
  const filterCloseTimerRef = useRef(null);
  const closeFilterSheet = () => {
    let reduce = false;
    try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
    if (reduce) { setShowFilterSheet(false); return; }
    setFilterSheetClosing(true);
    clearTimeout(filterCloseTimerRef.current);
    filterCloseTimerRef.current = setTimeout(() => {
      setShowFilterSheet(false);
      setFilterSheetClosing(false);
    }, 300);
  };
  const [historyTypeFilter, setHistoryTypeFilter] = useState("all");
  const [historyVisibleCount, setHistoryVisibleCount] = useState(HISTORY_PAGE_SIZE);
  const fileInputRef = useRef(null);
  const toastTimerRef = useRef(null);
  const exportTextareaRef = useRef(null);
  const yearChartScrollRef = useRef(null);


  // Any full-screen dialog (settings, backup/restore, confirm prompts, the
  // share-card modal, etc.) is rendered as its own position:fixed overlay,
  // but the page underneath it was never actually prevented from
  // scrolling — on mobile (especially LINE's in-app browser / iOS Safari)
  // a finger-drag over the dialog visibly scrolls the background behind it
  // too. Lock the page in place for as long as *any* dialog is open, and
  // restore the exact scroll position it was at once the last one closes.
  const scrollLockYRef = useRef(0);
  const anyModalOpen = showStorageDegradedModal || showProfile || showForm || showOnboardingChoice
    || showStartingCountQuickEntry || showSettings || showPrivacy || showReset
    || !!confirmDeleteId || confirmDeleteStartingCount || !!pendingImport
    || showBackupRestore || showShareCard || showFilterSheet || !!viewDonationId
    || viewStartingCount || editingStartingCount;
  useEffect(() => {
    if (anyModalOpen) {
      scrollLockYRef.current = window.scrollY || window.pageYOffset || 0;
      const body = document.body;
      body.style.position = "fixed";
      body.style.top = `-${scrollLockYRef.current}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      return () => {
        body.style.position = "";
        body.style.top = "";
        body.style.left = "";
        body.style.right = "";
        body.style.width = "";
        window.scrollTo(0, scrollLockYRef.current);
      };
    }
  }, [anyModalOpen]);

  // Header show/hide on scroll direction, matching the familiar Facebook-app
  // pattern: scrolling DOWN slides the top bar away (giving content the
  // full screen), scrolling UP even slightly brings it right back, and it's
  // always shown near the very top of the page regardless of direction, so
  // it never starts a fresh scroll session hidden. A small threshold (6px)
  // stops it from twitching on tiny/jittery scroll events, and it's skipped
  // while any modal has the page scroll-locked (anyModalOpen above) since
  // window.scrollY doesn't meaningfully change then anyway.
  const [headerVisible, setHeaderVisible] = useState(true);
  // Pull to refresh (design "3" from refresh-update-designs.html: arrow +
  // "ดึงลงเพื่อรีเฟรช" -> "ปล่อยเพื่อรีเฟรช" -> "กำลังโหลด…"). Data is local, so
  // a refresh re-reads storage in place (load({ soft: true }), no splash).
  // (An automatic "มีเวอร์ชันใหม่" slide was tried in v1.0.100-101 and
  // removed on request.) Touch only, only
  // from the very top of the page, and never while a dialog, sheet or popup
  // menu is open (a reload there would throw away what was being typed).
  // The content column moves via direct style writes (no re-render per
  // finger move); React state only tracks the three text states.
  const PTR_THRESHOLD = 70;
  const PTR_MAX = 110;
  const [ptrState, setPtrState] = useState("pull"); // "pull" | "ready" | "load"
  const ptrShellRef = useRef(null);
  const ptrIndRef = useRef(null);
  const ptrBlockRef = useRef(false);
  const ptrStateRef = useRef("pull");
  const lastScrollYRef = useRef(0);
  useEffect(() => {
    if (phase !== "app" || anyModalOpen) return;
    lastScrollYRef.current = window.scrollY || window.pageYOffset || 0;
    const HIDE_THRESHOLD = 6;
    const NEAR_TOP = 8;
    const onScroll = () => {
      const y = window.scrollY || window.pageYOffset || 0;
      const delta = y - lastScrollYRef.current;
      if (y <= NEAR_TOP) {
        setHeaderVisible(true);
      } else if (delta > HIDE_THRESHOLD) {
        setHeaderVisible(false);
      } else if (delta < -HIDE_THRESHOLD) {
        setHeaderVisible(true);
      }
      lastScrollYRef.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [phase, anyModalOpen]);

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
    const id = setInterval(() => {
      setRelativeTimeTick(t => t + 1);
      // Safety net for storage degradation detection: checkStorageHealth()
      // is also called right after the app's three main write paths
      // (saveDonations, saveProfile, persistUiMeta) for fast detection, but
      // storage.set() is actually called from several more places (starting
      // -count edits, backup-export bookkeeping, consent, photo removal via
      // saveProfile's other callers, etc) that don't each individually call
      // it. Piggybacking on this existing 30s tick means degraded storage
      // is never missed for more than ~30s no matter which write path hit
      // it, without having to thread the check through every call site.
      checkStorageHealth();
    }, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // load({ soft: true }) is the pull-to-refresh path: re-reads everything
  // from storage and redraws in place -- no splash, no phase change, no
  // minimum wait. (A plain load() -- first open, the error screen's retry,
  // after deleting all data -- still goes through the splash.)
  const load = useCallback(async (opts) => {
    const soft = !!(opts && opts.soft === true);
    if (!soft) {
      setPhase("loading");
      setError("");
    }
    // Reading from localStorage below is essentially instant, so without a
    // floor here the "loading" phase (and its splash screen) would resolve
    // and get replaced within a handful of milliseconds — long before a
    // single frame of it actually gets painted to the screen. finishLoading
    // tops that up to MIN_LOADING_MS so the splash is actually visible, but
    // never adds delay on top of a load that's already slower than that.
    // 3 full loops of the 1s breathe/blink icon animation below -- skipped for
    // a soft refresh (no splash then).
    const MIN_LOADING_MS = soft ? 0 : 3000;
    const loadStartedAt = Date.now();
    const finishLoading = async (nextPhase) => {
      const elapsed = Date.now() - loadStartedAt;
      if (elapsed < MIN_LOADING_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_LOADING_MS - elapsed));
      }
      setPhase(nextPhase);
    };
    // Safety net: storage.get()/set() already catch their own errors and
    // fall back to an in-memory store as a last resort, so nothing below is
    // expected to hang forever. But if something ever did stall (e.g. a
    // future native storage bridge that never calls back), the loading
    // screen would otherwise be stuck on-screen indefinitely with no way
    // out. LOAD_TIMEOUT_MS caps that wait: if the real load hasn't finished
    // within 8s, give up and show the existing error screen (which already
    // has a "ลองใหม่อีกครั้ง" retry button) instead of a spinner forever.
    // The `settled` flag stops this timer and the normal success/failure
    // paths below from ever fighting over which phase should win.
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled || soft) return;
      settled = true;
      setPhase("error");
    }, 8000);
    try {
      const consentRes = await storage.get("consent").catch(() => null);
      // CONSENT_VERSION exists so a future change to what's being consented
      // to (the privacy policy, what data is collected, etc.) can force
      // existing users back through the consent screen — but that only
      // works if the stored version is actually compared against it here.
      // Previously this only checked *presence* of a consent record, so a
      // version bump would silently do nothing and every returning user
      // would skip straight past the (changed) consent screen forever.
      let consentValid = false;
      if (consentRes && consentRes.value) {
        try {
          const parsedConsent = JSON.parse(consentRes.value);
          consentValid = !!parsedConsent?.given && parsedConsent.version === CONSENT_VERSION;
          setConsentIsUpdate(!!parsedConsent?.given && !consentValid);
        } catch (e) {
          consentValid = false;
        }
      }
      if (!consentValid) {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        await finishLoading("consent");
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
          setPhoto(p.photo || "");
          // Plain `|| ""` would turn a legitimately saved age/weight of 0
          // (saveProfile explicitly allows 0) back into "" on every reload —
          // same bug class as the sibling numeric settings loaded just below
          // (cycleDays etc.), which correctly gate on `typeof === "number"`.
          if (typeof p.birthYear === "number") {
            setBirthYear(p.birthYear);
            setBirthYearApprox(!!p.birthYearApprox);
          } else if (typeof p.age === "number") {
            // Saved by a version that stored age: estimate the birth year once.
            setBirthYear(thaiYearNow() - p.age);
            setBirthYearApprox(true);
          } else {
            setBirthYear("");
            setBirthYearApprox(false);
          }
          setGender(["male", "female", "none"].includes(p.gender) ? p.gender : "");
          setHeight(typeof p.height === "number" ? p.height : "");
          setDonorId(typeof p.donorId === "string" ? p.donorId : "");
          setBloodRh(["+", "-", "unknown"].includes(p.bloodRh) ? p.bloodRh : "");
          setRemindPauseUntil(typeof p.remindPauseUntil === "string" ? p.remindPauseUntil : "");
          setWeight(typeof p.weight === "number" ? p.weight : "");
          setBloodType(p.bloodType || "");
          // Older versions could save "general" without the donor choosing it
          // (a pre-selected default, then the reset bug), so "general" only
          // counts when saved with donorTypePicked (v1.0.113+). "monk" was
          // never a default, so it's always kept.
          setDonorType(p.donorType === "monk" ? "monk" : (p.donorType === "general" && p.donorTypePicked) ? "general" : "");
          // Migrate legacy single-number profiles (saved before donation
          // type existed) by attributing the whole prior total to "whole".
          const legacyStartingCount = typeof p.startingCount === "number" ? p.startingCount : 0;
          const wholeStartingCount = typeof p.startingCountWhole === "number" ? p.startingCountWhole : legacyStartingCount;
          const componentStartingCount = typeof p.startingCountComponent === "number" ? p.startingCountComponent : 0;
          setStartingCountWhole(wholeStartingCount ? String(wholeStartingCount) : "");
          setStartingCountComponent(componentStartingCount ? String(componentStartingCount) : "");
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
          setCycleDays(typeof u.cycleDays === "number" && u.cycleDays >= MIN_CYCLE_DAYS && u.cycleDays <= MAX_CYCLE_DAYS ? u.cycleDays : DEFAULT_CYCLE_DAYS);
          setComponentCycleDays(typeof u.componentCycleDays === "number" && u.componentCycleDays >= MIN_CYCLE_DAYS && u.componentCycleDays <= MAX_CYCLE_DAYS ? u.componentCycleDays : DEFAULT_COMPONENT_CYCLE_DAYS);
          setBackupReminderGap(typeof u.backupReminderGap === "number" && u.backupReminderGap >= MIN_BACKUP_REMINDER_GAP && u.backupReminderGap <= MAX_BACKUP_REMINDER_GAP ? u.backupReminderGap : DEFAULT_BACKUP_REMINDER_GAP);
          setDismissedEligibilityAge(typeof u.dismissedEligibilityAge === "number" ? u.dismissedEligibilityAge : null);
          setDismissedEligibilityWeight(typeof u.dismissedEligibilityWeight === "number" ? u.dismissedEligibilityWeight : null);
          setDismissedCareFor(typeof u.dismissedCareFor === "string" ? u.dismissedCareFor : null);
          if (typeof u.blurInfoPills === "boolean") setBlurInfoPills(u.blurInfoPills);
          if (u.dismissedReminders && typeof u.dismissedReminders === "object") {
            setDismissedReminders(u.dismissedReminders);
          } else if (typeof u.dismissedReminderKey === "string" && typeof u.dismissedReminderDate === "string") {
            // One-time migration from the old single-slot format (pre-fix for
            // the "dismissing one type loses the other type's dismissal" bug).
            const [legacyType, legacyDueDate] = u.dismissedReminderKey.split("|");
            if (legacyType) {
              setDismissedReminders({ [legacyType]: { dueDate: legacyDueDate || "", dismissedOn: u.dismissedReminderDate } });
            }
          }
        } catch {}
      }
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      await finishLoading("app");
    } catch (e) {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      if (!soft) setPhase("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab !== "home") return;
    let reduce = false;
    try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
    if (reduce) return;
    const id = setInterval(() => {
      const el = reminderScrollerRef.current;
      if (!el || el.children.length < 2) return;
      if (document.hidden || showCalendarChoice) return;
      if (Date.now() - reminderLastTouchRef.current < 8000) return;
      if (el.contains(document.activeElement)) return;
      if (reminderAutoStepsRef.current >= el.children.length) return;
      const step = el.clientWidth + 8;
      const cur = Math.round(el.scrollLeft / step);
      const next = (cur + 1) % el.children.length;
      reminderAutoStepsRef.current += 1;
      el.scrollTo({ left: next * step, behavior: "smooth" });
    }, 5000);
    return () => clearInterval(id);
  }, [tab, showCalendarChoice]);

  // Exit animation for centered dialogs: each one is rendered conditionally,
  // so React removes it from the DOM the instant it closes. Rather than
  // threading a "closing" state through every dialog, watch for a dialog
  // node being removed and put a static, non-interactive clone of it back
  // for 0.16s while it fades out and sinks 8px (see the timings in the CSS
  // above). The clone has no role/ARIA and can't be tapped, and it's
  // skipped entirely with prefers-reduced-motion.
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const obs = new MutationObserver((mutations) => {
      let reduce = false;
      try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
      if (reduce) return;
      for (const m of mutations) {
        for (const node of m.removedNodes) {
          if (!(node instanceof HTMLElement) || node.classList.contains("dlg-exit-clone")) continue;
          const dialogs = node.matches('[role="dialog"][aria-modal="true"]') ? [node] : [...node.querySelectorAll('[role="dialog"][aria-modal="true"]')];
          for (const d of dialogs) {
            if (d.hasAttribute("data-own-motion")) continue;
            const clone = d.cloneNode(true);
            clone.removeAttribute("role");
            clone.removeAttribute("aria-modal");
            clone.removeAttribute("aria-label");
            clone.setAttribute("aria-hidden", "true");
            clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
            clone.classList.add("dlg-exit-clone");
            // The clone is appended to <body>, outside the app root that carries the
            // font / colour / alignment -- without these it fell back to the browser's
            // default (serif) font for the 0.2s it is visible.
            clone.style.fontFamily = "'Mitr', 'Inter', sans-serif";
            clone.style.color = "#241A18";
            clone.style.textAlign = "left";
            // The app's <style> block is not mounted while the splash shows (e.g. right after
            // "ลบข้อมูลทั้งหมด"), so give the clone the scrim look inline as well.
            let noBlur = false;
            try { noBlur = window.matchMedia("(prefers-reduced-transparency: reduce)").matches; } catch (e) {}
            if (!noBlur) {
              clone.style.background = "rgba(36, 26, 24, 0.3)";
              clone.style.webkitBackdropFilter = "blur(3px)";
              clone.style.backdropFilter = "blur(3px)";
            }
            document.body.appendChild(clone);
            setTimeout(() => clone.remove(), 200);
          }
        }
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  // Warm the dashboard chart's chunk well after the first screen is up
  // (8s, then whenever the browser is idle), so switching to แดชบอร์ด later
  // draws the chart at once and it lands in the service worker cache for
  // offline opens -- without competing with the first load on slow mobile
  // data. Skipped when the phone asks to save data; the chart then simply
  // loads when the dashboard is opened.
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.connection && navigator.connection.saveData) return;
    let idleId = null;
    const warm = () => { import("recharts").catch(() => {}); };
    const t = setTimeout(() => {
      if (typeof window.requestIdleCallback === "function") idleId = window.requestIdleCallback(warm, { timeout: 5000 });
      else warm();
    }, 8000);
    return () => { clearTimeout(t); if (idleId != null && window.cancelIdleCallback) window.cancelIdleCallback(idleId); };
  }, []);

  // close any open modal with Escape for keyboard users
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      // The pause sheet sits on top of the profile: close just that one.
      if (showRemindPauseRef.current) { setShowRemindPause(false); return; }
      // The clear-profile confirm also sits on top of the profile: Escape closes only it.
      if (showClearProfileRef.current) { setShowClearProfile(false); return; }
      // The delete-all confirm sits on top of Settings: Escape closes only it.
      if (showResetRef.current) { setShowReset(false); return; }
      setShowProfile(false);
      setProfileOpenChoice(null);
      setShowForm(false);
      setShowSettings(false);
      setShowPrivacy(false);
      setShowReset(false);
      setConfirmDeleteId(null);
      setViewDonationId(null);
      setEditingStartingCount(false);
      setViewStartingCount(false);
      setConfirmDeleteStartingCount(false);
      setShowOnboardingChoice(false);
      setShowStartingCountQuickEntry(false);
      // (A stale setShowLogLastDonationPrompt call used to sit here -- that
      // state no longer exists, so it threw a ReferenceError on every Escape
      // and silently skipped every close call below it.)
      setPendingImport(null);
      setShowExportPreview(false);
      closeShareCard();
      // The photo menu and a history record's "⋮" action menu are small
      // popups whose only other dismissal is a non-focusable click-outside
      // backdrop — a keyboard-only user opening either had no way to close
      // it without picking an option. Escape now closes these too.
      closeFilterSheet();
      setShowPhotoMenu(false);
      setOpenActionMenuId(null);
      setShowStorageDegradedModal(false);
      setShowCalendarChoice(false);
      // The backup/restore hub was missing from this list, so Escape left it
      // open. Closing it goes through the same path as its ✕ (back to
      // Settings unless it was opened from home) -- but only when it's
      // actually open, or this would pop Settings open on every Escape.
      if (showBackupRestoreRef.current) {
        setShowBackupRestore(false);
        if (!backupOpenedFromHomeRef.current) setShowSettings(true);
        backupOpenedFromHomeRef.current = false;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Popups that aren't role="dialog" (row "⋮" menus, photo menu, calendar
  // choice) and the inline carried-over-count editor also block the pull.
  ptrBlockRef.current = !!(openActionMenuId || showPhotoMenu || showCalendarChoice || showFilterSheet || editingStartingCount);
  useEffect(() => {
    if (phase !== "app") return;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let y0 = null, x0 = 0, engaged = false, dist = 0;
    const paint = (d, animate) => {
      dist = d;
      const shell = ptrShellRef.current, ind = ptrIndRef.current;
      const tr = animate && !reduce ? "transform 0.25s cubic-bezier(.2,.8,.2,1)" : "none";
      if (shell) { shell.style.transition = tr; shell.style.transform = d > 0 ? `translateY(${d}px)` : ""; }
      if (ind) {
        ind.style.transition = animate && !reduce ? "opacity 0.2s, transform 0.25s cubic-bezier(.2,.8,.2,1)" : "none";
        ind.style.opacity = String(Math.min(1, d / (PTR_THRESHOLD * 0.6)));
        ind.style.transform = `translate(-50%, ${Math.max(0, d / 2 - 12)}px)`;
      }
    };
    const setState = (st) => { if (ptrStateRef.current !== st) { ptrStateRef.current = st; setPtrState(st); } };
    const blocked = () => ptrBlockRef.current || !!document.querySelector('[role="dialog"]') || ptrStateRef.current === "load";
    const onStart = (e) => {
      if (e.touches.length !== 1 || window.scrollY > 0 || blocked()) { y0 = null; return; }
      y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; engaged = false;
    };
    const onMove = (e) => {
      if (y0 == null) return;
      const dy = e.touches[0].clientY - y0, dx = e.touches[0].clientX - x0;
      if (!engaged) {
        if (Math.abs(dx) > Math.abs(dy) || dy < 0) { if (Math.abs(dx) > 8 || dy < -8) y0 = null; return; }
        if (dy < 8 || window.scrollY > 0) return;
        engaged = true;
      }
      if (e.cancelable) e.preventDefault();
      const d = Math.min(Math.max(0, dy - 8) * 0.5, PTR_MAX);
      paint(d, false);
      setState(d >= PTR_THRESHOLD ? "ready" : "pull");
    };
    const onEnd = () => {
      if (y0 == null) return;
      y0 = null;
      if (!engaged) return;
      engaged = false;
      if (dist >= PTR_THRESHOLD) {
        setState("load");
        paint(48, true);
        const minShow = new Promise((r) => setTimeout(r, 600));
        const refresh = loadRef.current({ soft: true }).catch(() => {});
        Promise.all([minShow, refresh]).then(() => {
          paint(0, true);
          setState("pull");
        });
      } else {
        paint(0, true);
        setState("pull");
      }
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const giveConsent = async () => {
    setSaving(true);
    setError("");
    try {
      await storage.set("consent", JSON.stringify({ given: true, at: new Date().toISOString(), version: CONSENT_VERSION }));
      // load() stopped at the consent check, so a returning user's profile
      // and history haven't been read yet -- read them now (soft: no splash)
      // before showing the app, or it would start from empty state.
      if (consentIsUpdate) {
        setConsentIsUpdate(false);
        await loadRef.current({ soft: true });
      } else {
        setPhase("app");
      }
    } catch (e) {
      setError("บันทึกไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  // Chained like uiMetaWriteQueueRef below (see the comment there for the
  // full reasoning): two storage.set("donations", ...) calls fired close
  // together (e.g. delete one record, then immediately add another before
  // the first write lands) could otherwise resolve out of order through an
  // async storage bridge, letting the older call's stale snapshot silently
  // overwrite the newer one in persisted storage — data that's still shown
  // on screen for the rest of the session but has actually vanished on
  // reload. Chaining ensures only one write is ever in flight at a time, in
  // call order, so this can't happen.
  const donationsWriteQueueRef = useRef(Promise.resolve());
  // strict: the caller shows its own in-page error, so a failed write rolls the
  // optimistic state back and rejects instead of raising the toast.
  const saveDonations = (next, { strict = false } = {}) => {
    const prev = donations;
    setDonations(next);
    const write = donationsWriteQueueRef.current
      .then(() => storage.set("donations", JSON.stringify(next)))
      .then(checkStorageHealth);
    donationsWriteQueueRef.current = write.catch(() => {});
    if (strict) return write.catch((e) => { setDonations(prev); throw e; });
    return write.catch(() => showToast("error", "บันทึกไม่สำเร็จ ลองอีกครั้ง"));
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

  // uiMetaRef accumulates every patch synchronously, and uiMetaWriteQueueRef
  // chains the actual storage.set() calls so they always run (and land) in
  // request order, each one flushing the ref's latest merged value at the
  // moment it runs rather than a snapshot frozen when it was queued. Without
  // this, two persistUiMeta calls fired close together (e.g. tap the
  // eye-icon toggle, then immediately dismiss a calendar reminder) could
  // race: each built its payload from this render's closure state for every
  // OTHER field, so if the earlier call's write happened to resolve after
  // the later one's (a real possibility once storage.set goes through an
  // async native bridge, not just localStorage), its older snapshot would
  // silently overwrite the field the later call had just changed — showing
  // correctly in memory but reverting on the next reload. Chaining plus
  // always reading uiMetaRef.current at execution time means every queued
  // write is a superset of the ones before it, so completion order no
  // longer matters for correctness.
  const uiMetaRef = useRef({});
  const uiMetaWriteQueueRef = useRef(Promise.resolve());
  const persistUiMeta = (patch) => {
    uiMetaRef.current = {
      seenAchievements, backupSnoozeCount, cycleDays: effectiveCycleDays, componentCycleDays: effectiveComponentCycleDays, backupReminderGap: effectiveBackupReminderGap,
      dismissedEligibilityAge, dismissedEligibilityWeight, dismissedReminders, blurInfoPills,
      ...uiMetaRef.current, ...patch,
    };
    uiMetaWriteQueueRef.current = uiMetaWriteQueueRef.current
      .then(() => storage.set("uiMeta", JSON.stringify(uiMetaRef.current)))
      .then(checkStorageHealth)
      .catch(() => {});
    return uiMetaWriteQueueRef.current;
  };

  // Same write-ordering protection as uiMetaWriteQueueRef above, applied to
  // "profile" — which used to be written directly via storage.set from six
  // different call sites (persistPhoto, saveProfile, the starting-count
  // flows, confirmImport), any two of which firing close together could
  // otherwise land out of order and silently drop the more recent change.
  // Routing every profile write through this one queued function closes
  // that gap the same way it was closed for uiMeta and donations.
  const profileWriteQueueRef = useRef(Promise.resolve());
  // strict: the caller shows its own in-page error, so the returned promise rejects
  // when the write fails (the queue itself is never left rejected).
  const persistProfile = (payload, { strict = false } = {}) => {
    // Every caller passes the current donorType from state, which is only
    // ever non-empty once the donor picked it (see the load() migration), so
    // the flag can be derived here instead of threading it through each call.
    // `age` is derived from birthYear now and is never stored; the newer
    // fields come from profileExtrasRef unless the caller passes them.
    const { age: _derivedAge, ...rest } = payload;
    // donorTypePicked replaces donorTypeSet (v1.0.113): "ลบข้อมูลทั้งหมด" used
    // to reset the state to "general", so the next save marked it as picked.
    const { donorTypeSet: _oldFlag, ...clean } = { ...profileExtrasRef.current, ...rest };
    const withFlag = { ...clean, donorTypePicked: payload.donorType === "general" || payload.donorType === "monk" };
    const write = profileWriteQueueRef.current
      .then(() => storage.set("profile", JSON.stringify(withFlag)));
    profileWriteQueueRef.current = write.catch(() => {});
    return strict ? write : profileWriteQueueRef.current;
  };

  const updateCycleDays = (raw) => {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) { setCycleDays(effectiveCycleDays); return; }
    const clamped = Math.min(MAX_CYCLE_DAYS, Math.max(MIN_CYCLE_DAYS, n));
    setCycleDays(clamped);
    persistUiMeta({ cycleDays: clamped });
    if (clamped !== n) showToast("success", `ปรับค่าให้อยู่ในช่วงที่กำหนดแล้ว (${MIN_CYCLE_DAYS}-${MAX_CYCLE_DAYS} วัน)`);
  };

  const updateComponentCycleDays = (raw) => {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) { setComponentCycleDays(effectiveComponentCycleDays); return; }
    const clamped = Math.min(MAX_CYCLE_DAYS, Math.max(MIN_CYCLE_DAYS, n));
    setComponentCycleDays(clamped);
    persistUiMeta({ componentCycleDays: clamped });
    if (clamped !== n) showToast("success", `ปรับค่าให้อยู่ในช่วงที่กำหนดแล้ว (${MIN_CYCLE_DAYS}-${MAX_CYCLE_DAYS} วัน)`);
  };

  const updateBackupReminderGap = (raw) => {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) { setBackupReminderGap(effectiveBackupReminderGap); return; }
    const clamped = Math.min(MAX_BACKUP_REMINDER_GAP, Math.max(MIN_BACKUP_REMINDER_GAP, n));
    setBackupReminderGap(clamped);
    persistUiMeta({ backupReminderGap: clamped });
    if (clamped !== n) showToast("success", `ปรับค่าให้อยู่ในช่วงที่กำหนดแล้ว (${MIN_BACKUP_REMINDER_GAP}-${MAX_BACKUP_REMINDER_GAP} รายการ)`);
  };

  // Center-crops to a square then downsizes, so a multi-MB phone photo
  // becomes a small (~20-40KB) JPEG data URL before it ever touches
  // localStorage — full-size photos would blow past storage limits fast.
  const resizeImageToDataUrl = async (file, size = 240, quality = 0.85) => {
    // Prefer createImageBitmap with imageOrientation: "from-image" — this
    // asks the browser's own image decoder to apply the photo's EXIF
    // orientation tag exactly once, reliably. The plain <img>-based path
    // below doesn't read EXIF at all, so a portrait phone photo whose
    // sensor orientation differs from its EXIF tag can come out sideways
    // after the crop/resize. We don't hand-parse EXIF bytes ourselves to
    // "fix" that, because several browsers already auto-orient <img>
    // elements inconsistently across versions — doing both would risk a
    // double-rotation that's worse than doing nothing. createImageBitmap
    // is the one API that lets us ask for the correction explicitly and
    // exactly once, so we use it when available and fall back untouched
    // otherwise.
    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
        try {
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          const side = Math.min(bitmap.width, bitmap.height);
          const sx = (bitmap.width - side) / 2;
          const sy = (bitmap.height - side) / 2;
          ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
          return canvas.toDataURL("image/jpeg", quality);
        } finally {
          bitmap.close?.();
        }
      } catch (err) {
        // A browser can support createImageBitmap but reject the
        // imageOrientation option, or fail on a particular file — fall
        // through to the <img>-based path rather than failing the upload.
      }
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          const side = Math.min(img.width, img.height);
          const sx = (img.width - side) / 2;
          const sy = (img.height - side) / 2;
          ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (e) {
          reject(e);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("โหลดรูปไม่สำเร็จ")); };
      img.src = url;
    });
  };

  const persistPhoto = async (nextPhoto) => {
    await persistProfile({
      nickname, photo: nextPhoto, age, weight, bloodType, donorType,
      startingCountWhole: Number(startingCountWhole) || 0,
      startingCountComponent: Number(startingCountComponent) || 0,
      startingCountCreatedAt, startingCountUpdatedAt,
    }, { strict: true });
    setPhoto(nextPhoto);
  };

  const handlePhotoFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // Lock in whether this pick started from inside the profile modal (draft
    // mode) right now, at selection time — not by re-reading showProfile
    // after the async resize below, which can have changed (e.g. the modal
    // was opened or closed while the resize was still in flight) and would
    // otherwise send the photo down the wrong path (immediate persist vs draft).
    // The profile page no longer has a whole-form draft (each field saves on
    // its own), so a new photo is saved straight away from anywhere.
    const editingInModal = false;
    const editSession = profileEditSessionRef.current;
    setShowPhotoMenu(false);
    setPhotoError("");
    if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name || "")) {
      setPhotoError("เบราว์เซอร์นี้เปิดไฟล์ HEIC ไม่ได้ ลองเลือก JPG หรือ PNG");
      return;
    }
    setPhotoBusy(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      if (editingInModal) {
        // If the modal was closed and reopened (a fresh draft) while this
        // resize was in flight, the session token has moved on — drop the
        // stale pick instead of merging it into the new, unrelated draft.
        if (editSession === profileEditSessionRef.current) {
          setProfileDraft(f => ({ ...f, photo: dataUrl }));
        }
      } else {
        await persistPhoto(dataUrl);
        showToast("success", "อัปเดตรูปโปรไฟล์แล้ว");
      }
    } catch (err) {
      console.error("[BloodJourney] photo upload failed:", file && file.type, err);
      setPhotoError("อัปโหลดรูปไม่สำเร็จ ลองเลือกไฟล์ JPG หรือ PNG");
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    setShowPhotoMenu(false);
    setPhotoError("");
    setPhotoBusy(true);
    try {
      await persistPhoto("");
      showToast("success", "ลบรูปโปรไฟล์แล้ว");
    } catch (err) {
      setPhotoError("ลบรูปไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setPhotoBusy(false);
    }
  };

  const openProfile = () => {
    const parts = nickname.trim().split(/\s+/).filter(Boolean);
    setProfileInline({
      first: parts[0] || "",
      last: parts.slice(1).join(" "),
      birthYear: birthYear === "" ? "" : String(birthYear),
      weight: (weight === "" || weight == null) ? "" : String(weight),
      height: height === "" ? "" : String(height),
      donorId,
    });
    setProfileInlineError({});
    setProfileOpenChoice(null);
    setShowPhotoMenu(false);
    profileOpenerRef.current = document.activeElement;
    profileEditSessionRef.current += 1;
    setShowProfile(true);
  };


  // Shared close path for the X button and the click-outside backdrop — both
  // discard any unsaved profileDraft changes (the draft is only ever
  // committed by saveProfile) and also close the photo submenu, which
  // previously could stay open (sharing the showPhotoMenu flag with the
  // home-header's own dropdown) and pop back up on the home tab right after
  // the modal closed.
  const closeProfile = () => {
    setShowPhotoMenu(false);
    setPhotoError("");
    setProfileOpenChoice(null);
    setShowProfile(false);
    profileOpenerRef.current?.focus?.();
  };

  // sanitizeNameInput can remove characters from the middle of what the
  // user just typed/pasted, which — left to React's default controlled-
  // input handling — snaps the caret to the end of the field instead of
  // staying where the user was editing. This maps the caret's position in
  // the raw (pre-sanitize) value to its equivalent position in the
  // sanitized value (by re-sanitizing just the prefix up to the caret) and
  // restores it once the sanitized value has actually committed to the DOM.
  // Also clamps to 30 letters *after* sanitizing, rather than relying on
  // the input's maxLength (which truncates the raw paste before invalid
  // characters are stripped, and could cut off valid letters that followed
  // them).
  const handleNameFieldChange = (field, ref) => (e) => {
    const raw = e.target.value;
    const rawCursor = e.target.selectionStart ?? raw.length;
    const sanitized = sanitizeNameInput(raw).slice(0, 30);
    const newCursor = Math.min(sanitizeNameInput(raw.slice(0, rawCursor)).length, sanitized.length);
    setProfileInline(f => ({ ...f, [field]: sanitized }));
    requestAnimationFrame(() => {
      const el = ref.current;
      if (el && document.activeElement === el) {
        try { el.setSelectionRange(newCursor, newCursor); } catch (err) {}
      }
    });
  };

  // Saves one or more profile fields straight away (inline editing), keeping
  // every other saved field as it is.
  const commitProfile = async (patch, key) => {
    const next = { nickname, photo, weight, bloodType, donorType, ...profileExtrasRef.current, ...patch };
    try {
      await persistProfile({
        nickname: next.nickname, photo: next.photo, weight: next.weight,
        bloodType: next.bloodType, donorType: next.donorType === "monk" || next.donorType === "general" ? next.donorType : "",
        birthYear: next.birthYear, birthYearApprox: next.birthYearApprox, gender: next.gender, height: next.height,
        donorId: next.donorId, bloodRh: next.bloodRh, remindPauseUntil: next.remindPauseUntil,
        startingCountWhole: Number(startingCountWhole) || 0,
        startingCountComponent: Number(startingCountComponent) || 0,
        startingCountCreatedAt, startingCountUpdatedAt,
      });
      checkStorageHealth();
      setNickname(next.nickname);
      setWeight(next.weight);
      setBloodType(next.bloodType);
      setBirthYear(next.birthYear);
      setBirthYearApprox(next.birthYearApprox);
      setGender(next.gender);
      setHeight(next.height);
      setDonorId(next.donorId);
      setBloodRh(next.bloodRh);
      setRemindPauseUntil(next.remindPauseUntil);
      setDonorType(next.donorType === "monk" || next.donorType === "general" ? next.donorType : "");
      setProfileSavedKey(key);
      clearTimeout(profileSavedTimerRef.current);
      profileSavedTimerRef.current = setTimeout(() => setProfileSavedKey(null), 1400);
    } catch (e) {
      // storage.set never throws (it degrades to memory + shows the storage-problem dialog), so this is only a guard.
    }
  };

  const commitProfileField = (key) => {
    const d = profileInline;
    if (key === "first" || key === "last") {
      const nf = capitalizeLowerWords(d.first.trim());
      const nl = capitalizeLowerWords(d.last.trim());
      if (nf !== d.first || nl !== d.last) setProfileInline(f => ({ ...f, first: capitalizeLowerWords(f.first.trim()), last: capitalizeLowerWords(f.last.trim()) }));
      const nn = [nf, nl].filter(Boolean).join(" ");
      if (nn !== nickname) commitProfile({ nickname: nn }, key);
      return;
    }
    const raw = (d[key] || "").trim();
    const current = { birthYear, weight, height, donorId }[key];
    const revert = () => setProfileInline(f => ({ ...f, [key]: (current === "" || current == null) ? "" : String(current) }));
    const fail = (msg) => { setProfileInlineError(er => ({ ...er, [key]: msg })); revert(); };
    if (key === "donorId") {
      const v = raw.replace(/\s+/g, " ").slice(0, 20);
      if (v === donorId) { revert(); return; }
      if (v !== "" && !/^\d{10}$/.test(v)) { fail("ระบุ 10 หลัก"); return; }
      setProfileInline(f => ({ ...f, donorId: v }));
      commitProfile({ donorId: v }, key);
      return;
    }
    // birthYear / weight / height are scroll pickers (committed elsewhere); only name fields and donorId are typed.
  };

  const openAddForm = () => {
    setFormFromChoice(false);
    setEditingId(null);
    setFormError("");
    // type starts empty on purpose: the user must pick whole blood vs plasma/platelets
    // themselves (submitDonation requires it) rather than silently inheriting a default.
    setForm({ date: "", time: "", location: "", note: "", type: "" });
    setEditSnapshot(null);
    setShowForm(true);
  };

  const openEditForm = (record) => {
    setFormFromChoice(false);
    setEditingId(record.id);
    setFormError("");
    const snapshot = { date: record.date, time: record.time || "", location: record.location || "", note: record.note || "", type: record.type || DEFAULT_DONATION_TYPE };
    setForm(snapshot);
    setEditSnapshot(snapshot);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormError("");
    setFormSaveError("");
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
    setFormFromChoice(true);
  };

  // ยกเลิก on the form: step back to wherever the user came from.
  const cancelForm = () => {
    const back = formFromChoice;
    closeForm();
    setFormFromChoice(false);
    if (back) setShowOnboardingChoice(true);
  };

  const chooseHasStartingCount = () => {
    setShowOnboardingChoice(false);
    setQuickStartingCountError("");
    setQuickTypeOnWhole(false);
    setQuickTypeOnComponent(false);
    setQuickStartingCountWholeDraft("");
    setQuickStartingCountComponentDraft("");
    setQuickEntryFormWhole({ date: "", time: "", location: "", note: "" });
    setQuickEntryFormComponent({ date: "", time: "", location: "", note: "" });
    setShowStartingCountQuickEntry(true);
  };

  // The quick-entry form is only reachable from the first-use choice, so its ยกเลิก
  // button goes back there (the ✕ button closes it outright).
  const backFromStartingCountQuickEntry = () => {
    cancelStartingCountQuickEntry();
    setShowOnboardingChoice(true);
  };

  const cancelStartingCountQuickEntry = () => {
    setShowStartingCountQuickEntry(false);
    setQuickStartingCountError("");
    setQuickTypeOnWhole(false);
    setQuickTypeOnComponent(false);
    setQuickStartingCountWholeDraft("");
    setQuickStartingCountComponentDraft("");
    setQuickEntryFormWhole({ date: "", time: "", location: "", note: "" });
    setQuickEntryFormComponent({ date: "", time: "", location: "", note: "" });
  };

  const quickSameDateLive = !!(quickTypeOnWhole && quickTypeOnComponent && quickEntryFormWhole.date && quickEntryFormComponent.date && daysBetween(new Date(quickEntryFormWhole.date), new Date(quickEntryFormComponent.date)) === 0);
  const submitStartingCountQuickEntry = async () => {
    // Each donation type has its own on/off switch — only the type(s) the
    // donor turns on get a count field and a required last-donation record.
    // A donor who only ever donated whole blood turns on just that switch;
    // a donor who's done both turns on both, each with its own total and
    // last-donation date/time/location/note.
    // (The save button is only rendered while at least one switch is on, so this is just a guard.)
    if (!quickTypeOnWhole && !quickTypeOnComponent) return;
    const wholeTotalRaw = quickTypeOnWhole ? (quickStartingCountWholeDraft === "" ? NaN : Number(quickStartingCountWholeDraft)) : 0;
    const componentTotalRaw = quickTypeOnComponent ? (quickStartingCountComponentDraft === "" ? NaN : Number(quickStartingCountComponentDraft)) : 0;
    // Validate one card fully (count, then date) before moving to the next,
    // so the first error a donor sees always belongs to the card at the top
    // of the form rather than jumping between cards.
    for (const [key, on, totalRaw, countRef, f, dateRef, typeMax] of [
      ["whole", quickTypeOnWhole, wholeTotalRaw, quickCountInputRefWhole, quickEntryFormWhole, quickDateInputRefWhole, maxStartingCountWhole],
      ["component", quickTypeOnComponent, componentTotalRaw, quickCountInputRefComponent, quickEntryFormComponent, quickDateInputRefComponent, maxStartingCountComponent],
    ]) {
      if (!on) continue;
      // The entered total INCLUDES the most-recent donation being logged in
      // this same form, so the minimum valid value is 1 (not 0) — see
      // handoff doc decision log ("แบบ A"). The upper bound is type- AND
      // donor-specific (see maxStartingCountWhole/Component above, scoped to
      // this donor's own age): no real person in this donor's situation
      // could exceed it given Thai Red Cross's own donation intervals, so
      // this message tells the donor the number they typed isn't
      // realistically possible rather than just "too big".
      if (Number.isNaN(totalRaw) || !Number.isInteger(totalRaw) || totalRaw < 1 || totalRaw > typeMax) {
        setQuickStartingCountError(`ระบุ 1-${typeMax} ครั้ง (ตามช่วงอายุและรอบบริจาค)`);
        setQuickErrorField(`${key}-count`);
        countRef.current?.focus();
        return;
      }
      // One message for every unusable date (empty, unparsable, after today). The calendar picker can only
      // produce the first, so the other two are just a safety net.
      const d = f.date ? new Date(f.date) : null;
      if (!d || Number.isNaN(d.getTime()) || d.setHours(0,0,0,0) > startOfToday().getTime()) {
        setQuickStartingCountError("ระบุวันที่บริจาค (ครั้งล่าสุด)");
        setQuickErrorField(`${key}-date`);
        dateRef.current?.focus();
        return;
      }
    }
    // Same invariant as sameDateConflict below (two donations — of any
    // type — never share a date, since it's never medically possible in a
    // single day): the per-card loop above only validates each date on its
    // own, so a donor turning on both type switches here could otherwise
    // save two brand-new records dated the same day, something the normal
    // add/edit form already hard-blocks everywhere else in the app.
    if (quickTypeOnWhole && quickTypeOnComponent && quickEntryFormWhole.date && quickEntryFormComponent.date
      && daysBetween(new Date(quickEntryFormWhole.date), new Date(quickEntryFormComponent.date)) === 0) {
      setQuickStartingCountError("วันที่ของโลหิตรวมกับพลาสมาซ้ำกัน เลือกวันอื่น");
      setQuickErrorField("component-date");
      quickDateInputRefComponent.current?.focus();
      return;
    }
    setQuickStartingCountError("");
    setSaving(true);
    try {
      const createWholeRecord = quickTypeOnWhole;
      const createComponentRecord = quickTypeOnComponent;
      const priorWhole = createWholeRecord ? Math.max(0, wholeTotalRaw - 1) : wholeTotalRaw;
      const priorComponent = createComponentRecord ? Math.max(0, componentTotalRaw - 1) : componentTotalRaw;
      const stampedAt = (priorWhole + priorComponent) > 0 ? new Date().toISOString() : "";
      const nowIso = new Date().toISOString();

      const newRecords = [];
      if (createWholeRecord) {
        newRecords.push({
          id: uid(), date: quickEntryFormWhole.date, time: quickEntryFormWhole.time || "",
          location: quickEntryFormWhole.location.trim().slice(0, MAX_LOCATION_LEN),
          note: quickEntryFormWhole.note.trim().slice(0, MAX_NOTE_LEN),
          type: "whole", loggedAt: nowIso, createdAt: nowIso,
        });
      }
      if (createComponentRecord) {
        newRecords.push({
          id: uid(), date: quickEntryFormComponent.date, time: quickEntryFormComponent.time || "",
          location: quickEntryFormComponent.location.trim().slice(0, MAX_LOCATION_LEN),
          note: quickEntryFormComponent.note.trim().slice(0, MAX_NOTE_LEN),
          type: "component", loggedAt: nowIso, createdAt: nowIso,
        });
      }
      const nextDonations = [...donations, ...newRecords].sort((a, b) => new Date(b.date) - new Date(a.date));

      const prevDonations = donations;
      await saveDonations(nextDonations, { strict: true });
      try {
        await persistProfile({ nickname, photo, age, weight, bloodType, donorType, startingCountWhole: priorWhole, startingCountComponent: priorComponent, startingCountCreatedAt: stampedAt, startingCountUpdatedAt: stampedAt }, { strict: true });
      } catch (e) {
        // Keep the two stores consistent: undo the donations write, then report.
        saveDonations(prevDonations).catch(() => {});
        throw e;
      }

      setStartingCountWhole(priorWhole ? String(priorWhole) : "");
      setStartingCountComponent(priorComponent ? String(priorComponent) : "");
      setStartingCountCreatedAt(stampedAt);
      setStartingCountUpdatedAt(stampedAt);
      setShowStartingCountQuickEntry(false);
      showToast("success", "บันทึกข้อมูลการบริจาคแล้ว");
    } catch (e) {
      setQuickStartingCountError("บันทึกไม่สำเร็จ ลองอีกครั้ง");
      setQuickErrorField("");
    } finally {
      setSaving(false);
    }
  };

  const submitDonation = async () => {
    // One message for every unusable date (empty, unparsable, or after today). The calendar picker cannot
    // produce the latter two (no typing, future days disabled), so this is only a safety net.
    const selected = form.date ? new Date(form.date) : null;
    if (!selected || Number.isNaN(selected.getTime()) || selected.setHours(0,0,0,0) > startOfToday().getTime()) {
      setFormError("ระบุวันที่บริจาค");
      formDateFieldRef.current?.focus();
      return;
    }
    if (form.type !== "whole" && form.type !== "component") {
      setFormError(TYPE_REQUIRED_MESSAGE);
      return;
    }
    if (sameDateConflict) {
      setFormError(sameDateConflictMessage);
      return;
    }
    setFormError("");
    setFormSaveError("");
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
          ? { ...d, date: form.date, time: cleanedTime, location: cleanedLocation, note: cleanedNote, type: form.type || DEFAULT_DONATION_TYPE, loggedAt: nowIso, createdAt: d.createdAt || d.loggedAt }
          : d);
      } else {
        const record = { id: uid(), date: form.date, time: cleanedTime, location: cleanedLocation, note: cleanedNote, type: form.type || DEFAULT_DONATION_TYPE, loggedAt: nowIso, createdAt: nowIso };
        next = [...donations, record];
      }
      next = [...next].sort((a, b) => new Date(b.date) - new Date(a.date));
      await saveDonations(next, { strict: true });
      showToast("success", editingId ? "แก้ไขรายการแล้ว" : "บันทึกรายการแล้ว");
      closeForm();
    } catch (e) {
      setFormSaveError("บันทึกไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  const requestDeleteDonation = (id) => { setDeleteError(""); setConfirmDeleteId(id); };

  const confirmDeleteDonation = async () => {
    const id = confirmDeleteId;
    if (!id) return;
    setDeleteError("");
    setSaving(true);
    try {
      await saveDonations(donations.filter(d => d.id !== id), { strict: true });
      setConfirmDeleteId(null);
      showToast("success", "ลบรายการแล้ว");
    } catch (e) {
      setDeleteError("ลบไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  // Inline edit/delete for the starting-count summary card in the history
  // list — kept lightweight on purpose (just the one number, no date/
  // location/note, no synthetic history rows) but lets the user change it
  // right there instead of jumping to the profile modal. Every profile write
  // still carries every other current field along, to avoid the silent-wipe
  // bug class noted earlier in the handoff doc.
  const openEditStartingCount = () => {
    setStartingCountDraftWhole(startingCountWhole || "");
    setStartingCountDraftComponent(startingCountComponent || "");
    setStartingCountEditError("");
    setViewStartingCount(false);
    setEditingStartingCount(true);
  };

  const cancelEditStartingCount = () => {
    setEditingStartingCount(false);
    setStartingCountEditError("");
    setStartingCountDraftWhole("");
    setStartingCountDraftComponent("");
  };

  const saveStartingCountInline = async () => {
    // The edit dialog follows the history type filter: a type hidden by the filter isn't shown, so it
    // keeps its stored value untouched (and isn't validated -- the user can't see or fix it here).
    const editWhole = historyTypeFilter !== "component";
    const editComponent = historyTypeFilter !== "whole";
    const numWhole = !editWhole ? startingCountWholeNum : (startingCountDraftWhole !== "" ? Number(startingCountDraftWhole) : 0);
    const numComponent = !editComponent ? startingCountComponentNum : (startingCountDraftComponent !== "" ? Number(startingCountDraftComponent) : 0);
    // Each type validated against its own realistic, donor-age-scoped
    // ceiling (see maxStartingCountWhole/Component above) and reported by
    // name, so a number that's fine for one type but not the other doesn't
    // get folded into one generic message that doesn't say which field is
    // the problem.
    if (editWhole && (Number.isNaN(numWhole) || !Number.isInteger(numWhole) || numWhole < 0 || numWhole > maxStartingCountWhole)) {
      setStartingCountEditError(`ระบุ 0-${maxStartingCountWhole} ครั้ง (ตามช่วงอายุและรอบบริจาค)`); setStartingCountEditField("whole");
      return;
    }
    if (editComponent && (Number.isNaN(numComponent) || !Number.isInteger(numComponent) || numComponent < 0 || numComponent > maxStartingCountComponent)) {
      setStartingCountEditError(`ระบุ 0-${maxStartingCountComponent} ครั้ง (ตามช่วงอายุและรอบบริจาค)`); setStartingCountEditField("component");
      return;
    }
    if (numWhole + numComponent === 0) {
      // Clearing both totals is really "delete the carried-over count" -- route it through the same
      // confirmation as the ⋮ menu's ลบ instead of silently wiping it on a plain save.
      setEditingStartingCount(false);
      setStartingCountEditError("");
      requestDeleteStartingCount();
      return;
    }
    setStartingCountEditError("");
    try {
      const { createdAt: stampedCreatedAt, updatedAt: stampedAt } = computeStartingCountStamps(startingCountNum, numWhole + numComponent);
      await persistProfile({ nickname, photo, age, weight, bloodType, donorType, startingCountWhole: numWhole, startingCountComponent: numComponent, startingCountCreatedAt: stampedCreatedAt, startingCountUpdatedAt: stampedAt });
      setStartingCountWhole(numWhole ? String(numWhole) : "");
      setStartingCountComponent(numComponent ? String(numComponent) : "");
      setStartingCountCreatedAt(stampedCreatedAt);
      setStartingCountUpdatedAt(stampedAt);
      setEditingStartingCount(false);
      showToast("success", "แก้ไขยอดสะสมยกมาแล้ว");
    } catch (e) {
      setStartingCountEditError("บันทึกไม่สำเร็จ ลองอีกครั้ง"); setStartingCountEditField("");
    }
  };

  const requestDeleteStartingCount = () => { setStartCountDeleteError(""); setConfirmDeleteStartingCount(true); };

  const confirmDeleteStartingCountNow = async () => {
    setStartCountDeleteError("");
    setSaving(true);
    try {
      await persistProfile({ nickname, photo, age, weight, bloodType, donorType, startingCountWhole: 0, startingCountComponent: 0, startingCountCreatedAt: "", startingCountUpdatedAt: "" }, { strict: true });
      setStartingCountWhole("");
      setStartingCountComponent("");
      setStartingCountCreatedAt("");
      setStartingCountUpdatedAt("");
      setConfirmDeleteStartingCount(false);
      showToast("success", "ลบยอดสะสมยกมาแล้ว");
    } catch (e) {
      setStartCountDeleteError("ลบไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  // Clears only the profile fields (name, photo, birth year, sex, height, weight, blood group, Rh, donor type, donor id).
  // Donations and the carried-over starting counts stay.
  const clearProfileData = async () => {
    setClearProfileError("");
    setSaving(true);
    try {
      await persistProfile({
        nickname: "", photo: "", weight: "", bloodType: "", donorType: "",
        birthYear: "", birthYearApprox: false, gender: "", height: "", donorId: "", bloodRh: "",
        remindPauseUntil,
        startingCountWhole: Number(startingCountWhole) || 0,
        startingCountComponent: Number(startingCountComponent) || 0,
        startingCountCreatedAt, startingCountUpdatedAt,
      }, { strict: true });
      setNickname(""); setPhoto(""); setWeight(""); setBloodType(""); setDonorType("");
      setBirthYear(""); setBirthYearApprox(false); setGender(""); setHeight(""); setDonorId(""); setBloodRh("");
      setProfileInline({ first: "", last: "", birthYear: "", weight: "", height: "", donorId: "" });
      setProfileInlineError({}); setProfileOpenChoice(null); setPickerPreview(null); setProfileSavedKey(null);
      setPhotoError("");
      setShowClearProfile(false);
      showToast("success", "ลบข้อมูลโปรไฟล์แล้ว");
    } catch (e) {
      setClearProfileError("ลบไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setSaving(false);
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
      setPhoto("");
      setBirthYear("");
      setBirthYearApprox(false);
      setGender("");
      setHeight("");
      setDonorId("");
      setBloodRh("");
      setRemindPauseUntil("");
      setWeight("");
      setBloodType("");
      setDonorType("");
      setStartingCountWhole("");
      setStartingCountComponent("");
      setStartingCountCreatedAt("");
      setStartingCountUpdatedAt("");
      setLastExportCount(0);
      setBackupSnoozeCount(null);
      setSeenAchievements([]);
      setCycleDays(DEFAULT_CYCLE_DAYS);
      setComponentCycleDays(DEFAULT_COMPONENT_CYCLE_DAYS);
      setBackupReminderGap(DEFAULT_BACKUP_REMINDER_GAP);
      setDismissedEligibilityAge(null);
      setDismissedEligibilityWeight(null);
      setDismissedReminders({});
      setBlurInfoPills(true);
      setShowReset(false);
      setShowSettings(false);
      // resetAll wipes everything back to a fresh start, but never touched
      // `tab` -- so if the user happened to be on, say, the knowledge tab
      // when they deleted their data, re-consenting dropped them right
      // back on that same tab instead of the home dashboard a first-time
      // user would land on. Reset it here to match every other piece of
      // state above.
      setTab("home");
      setCheckedConsent(false);
      // Jumping straight to setPhase("consent") skipped the loading splash
      // that every other route to the consent screen (a cold app open with
      // no stored consent yet) goes through -- so a full data wipe looked
      // different from a genuine first run, when it should look identical.
      // load() re-reads storage (now empty, so it resolves to "consent"
      // after its usual splash) instead of setting the phase directly,
      // making a wipe indistinguishable from opening the app fresh.
      await load();
    } catch (e) {
      setError("ลบไม่สำเร็จ ลองอีกครั้ง");
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
  // Records that a backup actually left the app. Previously exportData()
  // did this the moment the export preview merely *opened*, so just peeking
  // at the export hub and closing it silenced the home-tab "ยังไม่ได้สำรอง
  // ข้อมูล" banner without anything being saved. Now it's only called once
  // a file save/share or a copy has actually succeeded.
  const markBackedUp = async () => {
    try {
      await storage.set("backupMeta", JSON.stringify({ lastExportCount: donations.length, lastExportAt: new Date().toISOString() }));
      setLastExportCount(donations.length);
      setBackupSnoozeCount(null);
      await persistUiMeta({ backupSnoozeCount: null });
    } catch (e) {}
  };

  // Encrypts ahead of time (not on the tap) so the share sheet, which needs
  // to open straight from the tap, has the file ready. Re-runs when the
  // password or the data changes; the run counter drops stale results.
  useEffect(() => {
    if (!exportProtect || !exportKey) {
      exportEncryptRunRef.current += 1;
      setExportEncrypting(false);
      return undefined;
    }
    const run = ++exportEncryptRunRef.current;
    setExportMsg(null);
    setExportEncrypting(true);
    const timer = setTimeout(async () => {
      try {
        const text = await encryptBackupText(exportJsonText, exportEffectivePw);
        if (run === exportEncryptRunRef.current) setExportEncrypted({ key: exportKey, text });
      } catch (e) {
        if (run === exportEncryptRunRef.current) {
          setExportEncrypted(null);
          setExportMsg({ kind: "err", at: "pre", text: "เข้ารหัสไม่สำเร็จ ลองอีกครั้ง หรือสุ่มรหัสใหม่" });
        }
      } finally {
        if (run === exportEncryptRunRef.current) setExportEncrypting(false);
      }
    }, exportGenPw ? 0 : 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportProtect, exportKey]);

  const resetBackupProtection = () => {
    setExportMsg(null);
    setExportProtect(true);
    setExportStep(1);
    setExportConfirmPw("");
    setShowPlainWarn(false);
    setPlainWarnAck(false);
    setExportPw("");
    setExportPw2("");
    setExportShowPw(false);
    setExportGenPw("");
    setExportEncrypted(null);
    setImportLock(null);
    setImportLockPw("");
    setImportLockShow(false);
    setImportLockError("");
    setImportLockBusy(false);
  };
  // Every time the hub opens: encrypted, with a passphrase already waiting.
  // (Browsers without WebCrypto fall back to the plain file.)
  useEffect(() => {
    if (!showBackupRestore) return;
    if (!canEncryptBackup()) { setExportProtect(false); return; }
    if (exportProtect && !exportGenPw && !exportPw) setExportGenPw(generateBackupPassphrase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBackupRestore]);
  const generateExportPassword = () => {
    setExportProtect(true);
    setExportGenPw(generateBackupPassphrase());
    setExportStep(1);
    setExportConfirmPw("");
    setExportPw("");
    setExportPw2("");
  };
  const useOwnExportPassword = () => {
    setExportGenPw("");
    setExportStep(1);
    setExportConfirmPw("");
  };
  const goPlainExport = () => {
    setShowPlainWarn(false);
    setPlainWarnAck(false);
    setExportProtect(false);
    setExportGenPw(""); setExportPw(""); setExportPw2(""); setExportEncrypted(null);
  };
  const backToEncryptedExport = () => generateExportPassword();
  const copyGeneratedPassword = async () => {
    setExportMsg(null);
    try {
      await navigator.clipboard.writeText(exportGenPw);
      showToast("success", "คัดลอกรหัสผ่านแล้ว — เก็บไว้ในที่ปลอดภัย เช่นตัวจัดการรหัสผ่านของมือถือ");
    } catch (e) {
      setExportMsg({ kind: "note", at: "pw", text: "คัดลอกไม่ได้ จดหรือแคปหน้าจอรหัสนี้ไว้" });
    }
  };

  const exportData = async () => {
    setExportMsg(null);
    try {
      const payload = { nickname, age, birthYear, birthYearApprox, gender, height, donorId, bloodRh, remindPauseUntil, weight, bloodType, donorType, startingCountWhole, startingCountComponent, startingCountCreatedAt, startingCountUpdatedAt, donations, cycleDays: effectiveCycleDays, componentCycleDays: effectiveComponentCycleDays, backupReminderGap: effectiveBackupReminderGap, exportedAt: new Date().toISOString() };
      const jsonText = JSON.stringify(payload, null, 2);
      setExportJsonText(jsonText);
      setShowExportPreview(true);
    } catch (e) {
      setExportMsg({ kind: "err", at: "pre", text: "เตรียมไฟล์ไม่สำเร็จ ลองอีกครั้ง" });
    }
  };

  // Same underlying bug as the share-card image and the calendar .ics file
  // earlier in this project: a blob-URL anchor click is silently a no-op
  // inside LINE's in-app browser — it doesn't throw, so the old code always
  // showed "เริ่มดาวน์โหลดไฟล์แล้ว" whether or not anything actually happened.
  // Fixed with the same two mechanisms already proven to work elsewhere in
  // this file: the native OS share sheet in the packaged app, and the Web
  // Share API (navigator.share with a real File) in the browser — the one
  // web mechanism that keeps working inside LINE's WebView even though
  // blob-anchor downloads don't. The old blob-download is kept only as a
  // last-resort fallback for a plain desktop/mobile browser outside LINE.
  const downloadExportFile = async () => {
    if (!exportReady) return;
    setExportMsg(null);
    const filename = `donation-backup-${todayLocalStr()}.json`;
    if (isNativeApp) {
      try {
        const base64Data = btoa(unescape(encodeURIComponent(exportOutText)));
        await nativeSaveAndShare({ base64Data, filename, mimeType: "application/json", dialogTitle: "บันทึกไฟล์สำรองข้อมูล" });
        showToast("success", "เปิดเมนูบันทึก/แชร์ไฟล์แล้ว");
        markBackedUp();
      } catch (e) {
        setExportMsg({ kind: "err", at: "mid", text: 'บันทึกไฟล์ไม่สำเร็จ ลองอีกครั้ง หรือกด "คัดลอกข้อความ"' });
      }
      return;
    }
    try {
      if (typeof navigator !== "undefined" && navigator.share && navigator.canShare) {
        const file = new File([exportOutText], filename, { type: "application/json" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "Blood Journey - ข้อมูลสำรอง" });
          showToast("success", "เปิดเมนูแชร์ไฟล์แล้ว — เลือก \"บันทึกลงไฟล์\" หรือส่งเก็บไว้กับตัวเองได้เลย");
          markBackedUp();
          return;
        }
      }
    } catch (e) {
      if (e && e.name === "AbortError") return; // user cancelled the share sheet — not an error
    }
    // Web Share isn't available (older/unsupported browser) — try a plain
    // blob download (works fine outside LINE, e.g. a desktop browser or PWA
    // launch), and if this is still inside LINE where that's a silent no-op,
    // tell the user honestly to use "คัดลอกข้อความ" instead rather than
    // claiming success. No further escape attempted: unlike the share-card
    // token, an export backup has no fixed size, so there's no size-safe way
    // to hand the full data off through a URL to an external browser — the
    // copy-to-clipboard fallback below has no such limit, so it's the
    // reliable last resort instead.
    try {
      const blob = new Blob([exportOutText], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 2000);
      if (isLineInAppBrowser) {
        // LINE no-ops this click instead of throwing, so success here can't
        // actually be confirmed — tell the user plainly instead of claiming it worked.
        showToast("success", "ถ้าไฟล์ไม่ถูกดาวน์โหลดอัตโนมัติ ให้กด \"คัดลอกข้อความ\" แล้ววางเก็บเองแทน");
      } else {
        showToast("success", "เริ่มดาวน์โหลดไฟล์แล้ว");
        // Only outside LINE -- inside LINE this click can be a silent no-op,
        // so it isn't counted as a confirmed backup there.
        markBackedUp();
      }
    } catch (e) {
      setExportMsg({ kind: "note", at: "mid", text: 'ดาวน์โหลดไม่ได้ในหน้านี้ ใช้ "คัดลอกข้อความ" แทน' });
    }
  };

  const copyExportText = async () => {
    if (!exportReady) return;
    setExportMsg(null);
    // Method 1: the modern Clipboard API. Sandboxed iframes (like an
    // artifact preview) often block this with a permissions-policy error,
    // so we never let it stop us from trying the older fallback below.
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(exportOutText);
        showToast("success", "คัดลอกข้อมูลแล้ว — วางเก็บไว้ในไฟล์ข้อความหรือโน้ตของคุณได้เลย");
        markBackedUp();
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
          markBackedUp();
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
    setExportMsg({ kind: "note", at: "post", text: "คัดลอกอัตโนมัติไม่ได้ เลือกข้อความไว้แล้ว กด Ctrl/Cmd+C เอง" });
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
        threshold: latestUnlocked.threshold,
        isMonk: donorType === "monk",
      },
      estVolumeMl: totalCount * 350,
      bloodType,
      nickname,
    });
    setShareRecordData(null);
    setShowShareCard(true);
  };

  // Opens the same share-card modal, but pointed at one donation record from
  // the history list instead of the overall achievement totals — the modal
  // and its size chips/download/share buttons are shared between the two,
  // only the generated image content differs (see the useEffect below).
  const openRecordShareCard = (d) => {
    setShareRecordData({
      order: donationOrderMap[d.id] || "",
      date: d.date || "",
      dateStr: toBuddhistDate(d.date),
      timeStr: d.time || "",
      type: d.type === "component" ? "component" : "whole",
      typeLabel: DONATION_TYPE_LABELS[d.type === "component" ? "component" : "whole"],
      location: d.location || "",
      bloodType,
      nickname,
    });
    setShareData(null);
    setShowShareCard(true);
  };

  const closeShareCard = () => {
    setShowShareCard(false);
    setShareData(null);
    setShareRecordData(null);
    setShareCardDataUrl("");
    // Closing mid-generation used to leave sharingCard stuck true forever
    // (the in-flight effect's cleanup marks itself cancelled and skips its
    // own setSharingCard(false), and the next effect run bails out early
    // without touching it either) — permanently disabling the share button
    // until a full page reload. Reset it explicitly here as a safety net.
    setSharingCard(false);
  };

  // Regenerate the card image whenever the modal is open and either the
  // snapshot of data (achievement or single-record) or the chosen size
  // preset changes — this is what makes switching size chips instantly
  // redraw at the new dimensions.
  useEffect(() => {
    if (!showShareCard || (!shareData && !shareRecordData)) return;
    let cancelled = false;
    setSharingCard(true);
    const size = CARD_SIZES[cardSizeKey] || CARD_SIZES[DEFAULT_CARD_SIZE];
    const builder = shareRecordData
      ? buildRecordShareCardDataUrl({ ...shareRecordData, width: size.w, height: size.h })
      : buildShareCardDataUrl({ ...shareData, width: size.w, height: size.h });
    builder
      .then((url) => { if (!cancelled) setShareCardDataUrl(url); })
      .catch(() => { if (!cancelled) showToast("error", "สร้างภาพไม่สำเร็จ ลองอีกครั้ง"); })
      .finally(() => { if (!cancelled) setSharingCard(false); });
    // If this effect is torn down mid-generation (modal closed, or
    // shareData/shareRecordData/cardSizeKey changed before the async draw
    // finished), the `finally` above is skipped by the `cancelled` guard —
    // reset sharingCard here too so it can't get stuck true. A subsequent
    // effect run that starts a new generation will set it true again right
    // after, so this is safe even on a deps change rather than a real close.
    return () => { cancelled = true; setSharingCard(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showShareCard, shareData, shareRecordData, cardSizeKey]);

  const downloadShareCard = async () => {
    const size = CARD_SIZES[cardSizeKey] || CARD_SIZES[DEFAULT_CARD_SIZE];
    const filePrefix = shareRecordData ? "bloodjourney-donation" : "bloodjourney-achievement";
    const filename = `${filePrefix}-${size.key}-${todayLocalStr()}.png`;
    if (isNativeApp) {
      // Real OS filesystem + native share sheet — the packaged app isn't
      // sandboxed inside LINE's WebView, so this reaches Photos/Files
      // directly instead of needing the screenshot workaround.
      try {
        await nativeSaveAndShare({
          base64Data: dataUrlToBase64(shareCardDataUrl),
          filename,
          mimeType: "image/png",
          dialogTitle: "บันทึกรูปภาพ",
        });
      } catch (e) {
        showToast("error", "บันทึกรูปภาพไม่สำเร็จ ลองอีกครั้ง");
      }
      return;
    }
    try {
      const a = document.createElement("a");
      a.href = shareCardDataUrl;
      a.download = filename;
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
    const size = CARD_SIZES[cardSizeKey] || CARD_SIZES[DEFAULT_CARD_SIZE];
    const filePrefix = shareRecordData ? "bloodjourney-donation" : "bloodjourney-achievement";
    const filename = `${filePrefix}-${size.key}-${todayLocalStr()}.png`;
    if (isNativeApp) {
      try {
        await nativeSaveAndShare({
          base64Data: dataUrlToBase64(shareCardDataUrl),
          filename,
          mimeType: "image/png",
          dialogTitle: "แชร์ภาพ Blood Journey",
        });
      } catch (e) {
        showToast("error", "แชร์ไม่สำเร็จ ลองดาวน์โหลดรูปภาพแทนได้เลย");
      }
      return;
    }
    try {
      const res = await fetch(shareCardDataUrl);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: "image/png" });
      await navigator.share({ files: [file], title: "Blood Journey" });
    } catch (e) {
      if (e && e.name === "AbortError") return; // user cancelled the share sheet
      showToast("error", "แชร์ไม่สำเร็จ ลองดาวน์โหลดรูปภาพแทนได้เลย");
    }
  };

  // LINE's in-app browser blocks every client-side save mechanism, but it's
  // just a WebView wrapper — a real external browser tab has none of those
  // restrictions. This re-opens the same share card in the device's actual
  // browser (Safari/Chrome) via liff.openWindow({external:true}), pointed at
  // a lightweight "download page" (?dl=1&...) that redraws the exact same
  // card from URL params and auto-triggers the save there. Only offered
  // inside LINE — regular browser tabs already have working download/share
  // buttons and don't need this detour.
  const openShareCardInExternalBrowser = async () => {
    try {
      const size = CARD_SIZES[cardSizeKey] || CARD_SIZES[DEFAULT_CARD_SIZE];
      const sizeIdx = Object.keys(CARD_SIZES).indexOf(size.key);
      let payload;
      if (shareRecordData) {
        // Field shape consumed by encodeSharePayload — see its comment for
        // the exact byte layout this gets packed into.
        payload = {
          kind: "r",
          sizeIdx,
          order: shareRecordData.order ?? 0,
          date: shareRecordData.date || "",
          timeStr: shareRecordData.timeStr || "",
          type: shareRecordData.type === "component" ? "c" : "w",
          location: shareRecordData.location || "",
          bloodType: shareRecordData.bloodType || "",
          nickname: shareRecordData.nickname || "",
        };
      } else if (shareData) {
        // estVolumeMl isn't included — it's always totalCount*350 (see
        // openShareCard), so DownloadPage.jsx recomputes it instead of
        // carrying a redundant field.
        payload = {
          kind: "a",
          sizeIdx,
          totalCount: shareData.totalCount ?? 0,
          akind: shareData.achievement?.kind === "medal" ? "m" : "p",
          tier: shareData.achievement?.tier ?? 0,
          threshold: shareData.achievement?.threshold ?? 0,
          isMonk: !!shareData.achievement?.isMonk,
          bloodType: shareData.bloodType || "",
          nickname: shareData.nickname || "",
        };
      } else {
        return;
      }
      // The entire payload — including its timestamp — is packed into one
      // AES-GCM encrypted token (see encodeShareToken), so the URL carries
      // no field names or values in the clear, just `?dl=1&d=<token>`.
      const token = await encodeShareToken(payload);
      const url = `${window.location.origin}${window.location.pathname}?dl=1&d=${token}`;
      await openInExternalBrowser(url);
    } catch (e) {
      showToast("error", "เปิดเบราว์เซอร์ภายนอกไม่สำเร็จ");
    }
  };

  const snoozeBackupReminder = async () => {
    setBackupSnoozeCount(donations.length);
    await persistUiMeta({ backupSnoozeCount: donations.length });
    showToast("success", "ได้เลย เดี๋ยวเตือนอีกทีนะ");
  };


  // Per-item dismissals for the home reminder carousel, where the age and
  // weight warnings are now two separate slides -- each only records its own
  // value, so dismissing one doesn't silence the other.
  const dismissAgeWarning = async () => {
    const ageVal = age === "" ? null : Number(age);
    setDismissedEligibilityAge(ageVal);
    await persistUiMeta({ dismissedEligibilityAge: ageVal });
    showToast("success", "ได้เลย เดี๋ยวเตือนอีกทีถ้าข้อมูลเปลี่ยน");
  };
  const dismissWeightWarning = async () => {
    const weightVal = weight === "" ? null : Number(weight);
    setDismissedEligibilityWeight(weightVal);
    await persistUiMeta({ dismissedEligibilityWeight: weightVal });
    showToast("success", "ได้เลย เดี๋ยวเตือนอีกทีถ้าข้อมูลเปลี่ยน");
  };

  const dismissCalendarReminder = async () => {
    const dueDate = nextEligible ? dateToLocalStr(nextEligible) : "";
    const todayStr = todayLocalStr();
    const next = { ...dismissedReminders, [activeCountdownType]: { dueDate, dismissedOn: todayStr } };
    setDismissedReminders(next);
    await persistUiMeta({ dismissedReminders: next });
    showToast("success", "ได้เลย เดี๋ยวเตือนอีกทีพรุ่งนี้นะ");
  };

  // Persist the blood type/age/weight blur toggle so it survives a reload —
  // otherwise a donor who hides it in public would find it visible again
  // the moment the app restarts, defeating the point of hiding it.
  const toggleBlurInfoPills = () => {
    const next = !blurInfoPills;
    setBlurInfoPills(next);
    persistUiMeta({ blurInfoPills: next });
  };

  const triggerImport = () => {
    setError("");
    fileInputRef.current?.click();
  };

  // Shared by both import entry points — picking a file (handleImportFile)
  // and pasting text (confirmPasteImport, for when the export's file
  // download didn't work and the user only has the copied JSON text — see
  // "คัดลอกข้อความ" in the export modal). Throws on malformed input; callers
  // decide how to report that.
  const processImportedText = async (text, meta) => {
    // A password-protected backup: ask for the password first, then run the
    // decrypted text through this same function.
    if (readEncryptedBackup(text)) {
      if (!canEncryptBackup()) {
        setImportMsg({ kind: "note", at: meta && meta.name ? "file" : "paste", text: "เบราว์เซอร์นี้ถอดรหัสไม่ได้ ลองเปิดด้วยเบราว์เซอร์อื่น" });
        return;
      }
      setImportLock({ text, name: (meta && meta.name) || "" });
      setImportLockPw("");
      setImportLockShow(false);
      setImportLockError("");
      return;
    }
    const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.donations)) {
        throw new Error("รูปแบบไฟล์ไม่ถูกต้อง");
      }
      const existingIds = new Set(donations.map(d => d.id));
      // A hand-edited or corrupted backup file could carry donation records
      // with an invalid/future date, or overlong location/note text that
      // the normal add-donation form would never allow through — apply the
      // same validation and clamping here so import can't reintroduce data
      // the manual-entry path exists to prevent.
      const todayTime = startOfToday().getTime();
      // Keep "already imported" (duplicateCount) and "structurally invalid,
      // silently dropped" (invalidCount) as separate tallies — collapsing
      // them into one number used to tell the user every skipped record was
      // a harmless duplicate, even when some were actually malformed
      // records that got discarded with no way for the user to notice.
      const sanitizeImportedDonation = (d) => {
        if (!d || !d.date) return { kind: "invalid" };
        if (existingIds.has(d.id)) return { kind: "duplicate" };
        const parsedDate = new Date(d.date);
        if (Number.isNaN(parsedDate.getTime())) return { kind: "invalid" };
        if (parsedDate.setHours(0, 0, 0, 0) > todayTime) return { kind: "invalid" };
        return {
          kind: "ok",
          record: {
            id: d.id || uid(),
            date: d.date,
            time: typeof d.time === "string" ? d.time : "",
            location: typeof d.location === "string" ? d.location.trim().slice(0, MAX_LOCATION_LEN) : "",
            note: typeof d.note === "string" ? d.note.trim().slice(0, MAX_NOTE_LEN) : "",
            type: d.type === "component" ? "component" : DEFAULT_DONATION_TYPE,
            loggedAt: typeof d.loggedAt === "string" ? d.loggedAt : new Date().toISOString(),
            createdAt: typeof d.createdAt === "string" ? d.createdAt : (typeof d.loggedAt === "string" ? d.loggedAt : new Date().toISOString()),
          },
        };
      };
      const classified = parsed.donations.map(sanitizeImportedDonation);
      const incoming = classified.filter(c => c.kind === "ok").map(c => c.record);
      const duplicateCount = classified.filter(c => c.kind === "duplicate").length;
      const invalidCount = classified.filter(c => c.kind === "invalid").length;
      // Only offer to fill in profile fields that are currently empty —
      // never silently overwrite something the user already entered here.
      // Apply the exact same bounds saveProfile enforces on manual entry so
      // a corrupted/hand-edited backup can't sneak an out-of-range value in.
      const profileFieldsToFill = {};
      // A hand-edited or corrupted backup file could carry a nickname with
      // digits/symbols/emoji the profile modal's own input no longer lets
      // you type — sanitize it here too so the import path can't
      // reintroduce what sanitizeNameInput exists to prevent.
      if (!nickname && parsed.nickname) {
        const sanitizedImportedNickname = sanitizeNameInput(String(parsed.nickname)).trim();
        if (sanitizedImportedNickname) profileFieldsToFill.nickname = sanitizedImportedNickname;
      }
      if (birthYear === "") {
        const nowBE = thaiYearNow();
        const byNum = Number(parsed.birthYear);
        const ageNum = Number(parsed.age);
        if (parsed.birthYear !== undefined && parsed.birthYear !== "" && Number.isInteger(byNum) && byNum >= nowBE - 120 && byNum <= nowBE) {
          profileFieldsToFill.birthYear = byNum;
          profileFieldsToFill.birthYearApprox = !!parsed.birthYearApprox;
        } else if (parsed.age !== undefined && parsed.age !== "" && Number.isInteger(ageNum) && ageNum >= 0 && ageNum <= 120) {
          profileFieldsToFill.birthYear = nowBE - ageNum;
          profileFieldsToFill.birthYearApprox = true;
        }
      }
      if (!gender && ["male", "female", "none"].includes(parsed.gender)) profileFieldsToFill.gender = parsed.gender;
      if (height === "" && Number(parsed.height) >= MIN_HEIGHT && Number(parsed.height) <= MAX_HEIGHT) profileFieldsToFill.height = Math.round(Number(parsed.height) * 10) / 10;
      if (!donorId && typeof parsed.donorId === "string" && /^\d{10}$/.test(parsed.donorId.trim())) profileFieldsToFill.donorId = parsed.donorId.trim();
      if (!bloodRh && ["+", "-", "unknown"].includes(parsed.bloodRh)) profileFieldsToFill.bloodRh = parsed.bloodRh;
      if (!remindPauseUntil && typeof parsed.remindPauseUntil === "string" && (parsed.remindPauseUntil === "indefinite" || /^\d{4}-\d{2}-\d{2}$/.test(parsed.remindPauseUntil))) profileFieldsToFill.remindPauseUntil = parsed.remindPauseUntil;
      if (weight === "" && parsed.weight !== undefined && parsed.weight !== "") {
        const weightNum = Number(parsed.weight);
        if (!Number.isNaN(weightNum) && weightNum >= 0 && weightNum <= 300) profileFieldsToFill.weight = Math.round(weightNum * 10) / 10;
      }
      if (!bloodType && parsed.bloodType && BLOOD_TYPES.includes(parsed.bloodType)) profileFieldsToFill.bloodType = parsed.bloodType;
      if (!donorType && (parsed.donorType === "general" || parsed.donorType === "monk")) profileFieldsToFill.donorType = parsed.donorType;
    setPendingImport({
      incoming,
      duplicateCount,
      invalidCount,
      totalInFile: parsed.donations.length,
      profileFieldsToFill,
    });
    // The confirm-import dialog below renders after (later in the JSX tree
    // than) the backup/restore hub, so at equal z-index it painted on top
    // and blocked taps on "นำเข้า"/"ยกเลิก" — close the hub whenever the
    // confirm dialog is about to take over, from either entry point (file
    // picker or paste-text).
    setShowBackupRestore(false);
    setShowExportPreview(false);
  };

  // Shortcut for the paste-import textarea: read the clipboard directly
  // instead of making the user long-press → วาง themselves. Clipboard READ
  // access is stricter than the writeText() used elsewhere in this file
  // (e.g. copyExportText) — some browsers/webviews (LINE's in-app browser
  // especially) don't support it or silently deny it — so this is treated
  // as a pure convenience shortcut: on any failure, fall back to telling
  // the user to paste into the box manually, which still works exactly as
  // before and is unaffected by this.
  const pasteFromClipboard = async () => {
    setImportMsg(null);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setPasteImportText(text);
          return;
        }
      }
    } catch (e) {}
    setImportMsg({ kind: "note", at: "paste", text: 'วางอัตโนมัติไม่ได้ กดค้างในช่องแล้วเลือก "วาง"' });
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportMsg(null);
    setImporting(true);
    try {
      const text = await file.text();
      await processImportedText(text, { name: file.name });
    } catch (err) {
      setImportMsg({ kind: "err", at: "file", text: "อ่านไฟล์ไม่ได้ ใช้ไฟล์สำรองจากแอปนี้" });
    } finally {
      setImporting(false);
    }
  };

  // Single entry point for the unified "สำรอง/กู้คืนข้อมูล" hub dialog —
  // replaces the three separate Settings rows (ส่งออกข้อมูล / นำเข้าไฟล์ /
  // วางข้อความสำรอง) with one dialog that switches between an export tab and
  // an import tab. Reuses exportData/exportJsonText and
  // pasteImportText/confirmPasteImport exactly as before — only the entry
  // point and the surrounding chrome changed.
  // Remembers where the hub was opened from, so closing it returns there:
  // Settings when opened from the Settings rows, or straight back to the
  // home tab when opened from the home "ยังไม่ได้สำรองข้อมูล" banner.
  const backupOpenedFromHomeRef = useRef(false);
  const privacyFromProfileRef = useRef(false); // privacy opened from the profile footer → closing returns there, not to settings
  const openBackupRestore = (tab, { fromHome = false } = {}) => {
    backupOpenedFromHomeRef.current = fromHome;
    setImportMsg(null);
    setShowSettings(false);
    setError("");
    resetBackupProtection();
    setBackupRestoreTab(tab);
    setShowBackupRestore(true);
    if (tab === "export") {
      exportData();
    } else {
      setPasteImportText("");
    }
  };

  const switchBackupRestoreTab = (tab) => {
    setImportMsg(null);
    setBackupRestoreTab(tab);
    if (backupDialogRef.current) backupDialogRef.current.scrollTop = 0;
    // Switching tabs should never throw away what the user already typed —
    // only regenerate the export preview (cheap, local, always up to date).
    // pasteImportText is left untouched here; it's only ever cleared by a
    // fresh open (openBackupRestore) or an actually-confirmed import.
    if (tab === "export") {
      exportData();
    }
  };

  const closeBackupRestore = () => {
    setShowBackupRestore(false);
    setShowExportPreview(false);
    resetBackupProtection();
    if (!backupOpenedFromHomeRef.current) setShowSettings(true);
    backupOpenedFromHomeRef.current = false;
  };

  const confirmPasteImport = async () => {
    const text = pasteImportText.trim();
    if (!text) return;
    setPasteImportError("");
    setImporting(true);
    try {
      // Don't clear the textarea yet — it only got as far as the confirm
      // dialog. If the user cancels there, cancelImport() reopens this tab
      // and the pasted text should still be sitting in the box, not gone.
      // It's cleared for real once the import is actually confirmed
      // (see confirmImport) or the hub is closed/reset for a fresh entry.
      await processImportedText(text);
    } catch (err) {
      setPasteImportError('ข้อความที่วางไม่ถูกต้อง ลองคัดลอกใหม่จากแอปนี้');
    } finally {
      setImporting(false);
    }
  };

  const unlockImport = async () => {
    if (!importLock || !importLockPw || importLockBusy) return;
    setImportLockBusy(true);
    setImportLockError("");
    let plain = null;
    try {
      plain = await decryptBackupText(readEncryptedBackup(importLock.text), importLockPw);
    } catch (e) {
      setImportLockError(e && e.code === "UNSUPPORTED"
        ? IMPORT_UNSUPPORTED_MESSAGE
        : "รหัสผ่านไม่ถูกต้อง หรือไฟล์ถูกแก้ไข");
      setImportLockBusy(false);
      return;
    }
    try {
      setImportLock(null);
      setImportLockPw("");
      await processImportedText(plain);
    } catch (e) {
      setImportMsg({ kind: "err", at: "file", text: "อ่านไฟล์ไม่ได้ ใช้ไฟล์สำรองจากแอปนี้" });
    } finally {
      setImportLockBusy(false);
    }
  };

  const cancelImport = () => {
    setImportConfirmError("");
    setPendingImport(null);
    // The confirm dialog only ever appears after processImportedText closed
    // the backup/restore hub (see there) — on cancel, reopen it on the same
    // tab so the user lands back where they were instead of having to dig
    // back in through Settings.
    setShowBackupRestore(true);
  };

  const confirmImport = async () => {
    if (!pendingImport) return;
    const merged = [...donations, ...pendingImport.incoming].sort((a, b) => new Date(b.date) - new Date(a.date));
    setImportConfirmError("");
    setImportSaving(true);
    const prevDonations = donations;
    try {
      await saveDonations(merged, { strict: true });
    } catch (e) {
      setImportConfirmError("นำเข้าไม่สำเร็จ ลองอีกครั้ง");
      setImportSaving(false);
      return;
    }
    const fill = pendingImport.profileFieldsToFill || {};
    if (Object.keys(fill).length > 0) {
      const nextProfile = {
        nickname: "nickname" in fill ? fill.nickname : nickname,
        photo,
        ...profileExtrasRef.current,
        ...Object.fromEntries(["birthYear", "birthYearApprox", "gender", "height", "donorId", "bloodRh", "remindPauseUntil"].filter(k => k in fill).map(k => [k, fill[k]])),
        weight: "weight" in fill ? fill.weight : weight,
        bloodType: "bloodType" in fill ? fill.bloodType : bloodType,
        donorType: "donorType" in fill ? fill.donorType : donorType,
        startingCountWhole: Number(startingCountWhole) || 0,
        startingCountComponent: Number(startingCountComponent) || 0,
        startingCountCreatedAt,
        startingCountUpdatedAt,
      };
      try {
        await persistProfile(nextProfile, { strict: true });
      } catch (e) {
        saveDonations(prevDonations).catch(() => {});
        setImportConfirmError("นำเข้าไม่สำเร็จ ลองอีกครั้ง");
        setImportSaving(false);
        return;
      }
      if ("nickname" in fill) setNickname(fill.nickname);
      if ("birthYear" in fill) { setBirthYear(fill.birthYear); setBirthYearApprox(!!fill.birthYearApprox); }
      if ("gender" in fill) setGender(fill.gender);
      if ("height" in fill) setHeight(fill.height);
      if ("donorId" in fill) setDonorId(fill.donorId);
      if ("bloodRh" in fill) setBloodRh(fill.bloodRh);
      if ("remindPauseUntil" in fill) setRemindPauseUntil(fill.remindPauseUntil);
      if ("weight" in fill) setWeight(fill.weight);
      if ("bloodType" in fill) setBloodType(fill.bloodType);
      if ("donorType" in fill) setDonorType(fill.donorType);
    }
    showToast("success", `นำเข้าสำเร็จ — เพิ่มรายการใหม่ ${pendingImport.incoming.length} รายการ`);
    setShowBackupRestore(false);
    setShowExportPreview(false);
    setPasteImportText("");
    setPendingImport(null);
    setImportSaving(false);
  };

  const needsBackupReminder = donations.length > 0
    && (donations.length - lastExportCount) >= effectiveBackupReminderGap
    && (backupSnoozeCount === null || (donations.length - backupSnoozeCount) >= effectiveBackupReminderGap);

  // Was previously recomputed (copy + Date-parse + sort of the whole
  // donation history) on every render, including every 30s tick from the
  // auto-rotate/relative-time timers below even while idle on another tab —
  // cost grows with years of history for no reason since it only actually
  // needs to change when donations itself changes.
  const sorted = useMemo(() => [...donations].sort((a,b) => new Date(b.date) - new Date(a.date)), [donations]);
  const last = sorted[0];
  // After-donation care card (design 5 of profile-gender-height-designs.html):
  // on home for the day of the latest donation and the two days after.
  const careDaysSince = last ? daysBetween(parseLocalDate(last.date), new Date()) : null;
  const showCareCard = !!last && careDaysSince >= 0 && careDaysSince <= 2 && dismissedCareFor !== last.id;
  const startingCountWholeNum = Number(startingCountWhole) || 0;
  const startingCountComponentNum = Number(startingCountComponent) || 0;
  const startingCountNum = startingCountWholeNum + startingCountComponentNum;
  const startingCountEditUnchanged = editingStartingCount
    && (historyTypeFilter === "component" || (Number(startingCountDraftWhole) || 0) === startingCountWholeNum)
    && (historyTypeFilter === "whole" || (Number(startingCountDraftComponent) || 0) === startingCountComponentNum);
  // "ยอดสะสมยกมา" (startingCount) is now just a running total the user enters
  // once, up front — it explicitly excludes their most recent donation, which
  // gets logged as a real, normal, fully editable/deletable record via the
  // usual "บันทึกบริจาคโลหิต" form (prompted inline the very first time that
  // form is opened — see submitDonation below). So the 90-day eligibility
  // countdown only ever needs the latest *real* record; no separate carried-
  // over date/location/note living in the profile anymore.
  //
  // Donations are optionally tagged with a "type" (โลหิตรวม/whole vs
  // พลาสมา-เกล็ดเลือด/component) since Thai Red Cross rules give each a very
  // different re-donation interval (~90 days vs ~14 days). Untagged records
  // (created before this field existed) are treated as "whole" so nothing
  // about existing data or countdowns silently changes. When a donor has
  // logged BOTH types at least once, the home card shows tabs to switch
  // which type's countdown is being viewed (countdownTab); otherwise it
  // just follows whichever type the latest record actually is.
  const sortedWhole = sorted.filter(d => (d.type || DEFAULT_DONATION_TYPE) === "whole");
  const sortedComponent = sorted.filter(d => d.type === "component");
  const lastWhole = sortedWhole[0] || null;
  const lastComponent = sortedComponent[0] || null;
  const wholeTotalCount = startingCountWholeNum + sortedWhole.length;
  const componentTotalCount = startingCountComponentNum + sortedComponent.length;
  const hasBothDonationTypes = wholeTotalCount > 0 && componentTotalCount > 0;
  const activeCountdownType = hasBothDonationTypes
    ? (countdownTab || (last && last.type === "component" ? "component" : "whole"))
    : (wholeTotalCount > 0 ? "whole" : componentTotalCount > 0 ? "component" : (last && last.type === "component" ? "component" : "whole"));
  const activeLastRecord = activeCountdownType === "component" ? lastComponent : lastWhole;
  const activeCycleDays = activeCountdownType === "component" ? effectiveComponentCycleDays : effectiveCycleDays;
  const activeTypeTotalCount = activeCountdownType === "component" ? componentTotalCount : wholeTotalCount;
  const effectiveLastDateStr = activeLastRecord ? activeLastRecord.date : null;
  const nextEligible = effectiveLastDateStr ? new Date(parseLocalDate(effectiveLastDateStr).getTime() + activeCycleDays * 86400000) : null;
  const daysLeft = nextEligible ? daysBetween(new Date(), new Date(nextEligible)) : 0;
  const isEligible = !nextEligible || daysLeft <= 0;
  const remindPaused = isRemindPaused(remindPauseUntil);
  const activeTypeDismiss = dismissedReminders[activeCountdownType];
  const reminderDismissed = !!activeTypeDismiss
    && activeTypeDismiss.dueDate === (nextEligible ? dateToLocalStr(nextEligible) : "")
    && activeTypeDismiss.dismissedOn === todayLocalStr();
  // Per-type next-eligible countdown, used only by the dashboard-tab summary
  // card's auto-rotating display below — kept independent of activeCountdownType
  // (the home-tab toggle's shared state) so the dashboard card can cycle on
  // its own timer without flipping the home-tab card along with it.
  const wholeNextEligible = lastWhole ? new Date(parseLocalDate(lastWhole.date).getTime() + effectiveCycleDays * 86400000) : null;
  const wholeDaysLeft = wholeNextEligible ? daysBetween(new Date(), new Date(wholeNextEligible)) : 0;
  const wholeIsEligible = !wholeNextEligible || wholeDaysLeft <= 0;
  const componentNextEligible = lastComponent ? new Date(parseLocalDate(lastComponent.date).getTime() + effectiveComponentCycleDays * 86400000) : null;
  const componentDaysLeft = componentNextEligible ? daysBetween(new Date(), new Date(componentNextEligible)) : 0;
  const componentIsEligible = !componentNextEligible || componentDaysLeft <= 0;
  const wholeComparableDays = !lastWhole ? Infinity : (wholeIsEligible ? 0 : wholeDaysLeft);
  const componentComparableDays = !lastComponent ? Infinity : (componentIsEligible ? 0 : componentDaysLeft);
  const soonestDonationType = componentComparableDays < wholeComparableDays ? "component" : "whole";
  const dashboardShownType = hasBothDonationTypes ? (dashboardRotateType || soonestDonationType) : activeCountdownType;
  const dashboardShownRecord = dashboardShownType === "component" ? lastComponent : lastWhole;
  const dashboardShownCycleDays = dashboardShownType === "component" ? effectiveComponentCycleDays : effectiveCycleDays;
  const dashboardShownTotalCount = dashboardShownType === "component" ? componentTotalCount : wholeTotalCount;
  const dashboardShownLastDateStr = dashboardShownRecord ? dashboardShownRecord.date : null;
  const dashboardShownNextEligible = dashboardShownLastDateStr ? new Date(new Date(dashboardShownLastDateStr).getTime() + dashboardShownCycleDays * 86400000) : null;
  const dashboardShownDaysLeft = dashboardShownNextEligible ? daysBetween(new Date(), new Date(dashboardShownNextEligible)) : 0;
  const dashboardShownIsEligible = !dashboardShownNextEligible || dashboardShownDaysLeft <= 0;
  // Auto-rotate the dashboard card's shown type every 30s while the donor has
  // both types logged. Starts on whichever is soonest; a manual pill tap sets
  // dashboardRotateType immediately, and the next tick continues the cycle
  // from there. Only runs while the dashboard tab is actually the one on
  // screen — otherwise this (and the home-tab timer below) kept forcing a
  // full re-render of the whole app, including a full re-sort of the
  // donation history, every 30s no matter which tab the donor was looking
  // at. Pausing/resuming loses no state: countdownTab/dashboardRotateType
  // pick up right where they left off next time that tab is active.
  useEffect(() => {
    if (!hasBothDonationTypes || tab !== "dashboard") return;
    setDashboardRotateType(prev => prev || soonestDonationType);
    const id = setInterval(() => {
      setDashboardRotateType(prev => (prev === "component" ? "whole" : "component"));
    }, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBothDonationTypes, tab]);
  // Same auto-rotation for the home-tab summary card's countdownTab, on its
  // own independent 30s timer — this card cycles/overrides separately from
  // the dashboard card above.
  // Once the user taps a type tab themselves, auto-rotation stops for the
  // rest of the session -- it used to keep going (and the 30s timer wasn't
  // reset), so a tap could be flipped back a second later.
  const countdownManualRef = useRef(false);
  useEffect(() => {
    if (!hasBothDonationTypes || tab !== "home") return;
    setCountdownTab(prev => prev || soonestDonationType);
    if (countdownManualRef.current) return;
    const id = setInterval(() => {
      if (countdownManualRef.current) { clearInterval(id); return; }
      setCountdownTab(prev => (prev === "component" ? "whole" : "component"));
    }, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBothDonationTypes, tab]);
  const totalCount = startingCountNum + donations.length;
  // Rough, clearly-labeled estimate only (350ml/donation) — not meant to be
  // precise, just to give the cumulative count some tangible meaning.
  const estLiters = Math.round(totalCount * 0.35 * 10) / 10;
  // Native app: a real .ics file through the OS share sheet already lets the
  // user pick whichever calendar app they use — no ambiguity to resolve, so
  // this bypasses the popover entirely. Non-native: opens the small
  // "Google Calendar / .ics" choice popover instead of guessing, since
  // Google Calendar only helps someone who actually uses a Google account —
  // an iOS user on Apple's own Calendar app needs the .ics option instead
  // (see addToCalendarIcs).
  const handleAddToCalendar = async () => {
    if (!nextEligible) return;
    if (isNativeApp) {
      const title = `วันบริจาคโลหิตครั้งถัดไป (${DONATION_TYPE_LABELS[activeCountdownType]})`;
      try {
        const ics = buildIcsForReminder(nextEligible, title);
        await nativeSaveAndShare({
          base64Data: icsContentToBase64(ics),
          filename: `blood-donation-reminder-${toBuddhistDate(nextEligible).replace(/\s+/g, "-")}.ics`,
          mimeType: "text/calendar",
          dialogTitle: "เพิ่มลงปฏิทิน",
        });
      } catch (e) {
        showToast("error", "เพิ่มลงปฏิทินไม่สำเร็จ ลองอีกครั้ง");
      }
      return;
    }
    setShowCalendarChoice(true);
  };

  // Plain link navigation (no blob/download mechanics) — but Google's own
  // sign-in/Calendar pages separately refuse to load inside *any* embedded
  // WebView (LINE, Facebook, Instagram, ...), showing their own "this
  // browser may not be secure" block, regardless of what LINE itself
  // allows. Same fix as the share-card image: escape to the device's real
  // browser via liff.openWindow — Google's WebView check doesn't trigger
  // there. No token/encryption needed here like the image download, since a
  // calendar link only carries a date/title, not data worth forging.
  const addToCalendarGoogle = () => {
    setShowCalendarChoice(false);
    if (!nextEligible) return;
    const title = `วันบริจาคโลหิตครั้งถัดไป (${DONATION_TYPE_LABELS[activeCountdownType]})`;
    const details = "แจ้งเตือนจากแอป Blood Journey — วันที่คำนวณจากรอบบริจาคที่ตั้งไว้ กรุณายึดตามคำแนะนำของเจ้าหน้าที่ ณ จุดบริจาคจริง";
    const calendarUrl = buildGoogleCalendarUrl(nextEligible, title, details);
    if (isLineInAppBrowser) {
      openInExternalBrowser(calendarUrl).catch(() => window.open(calendarUrl, "_blank"));
    } else {
      window.open(calendarUrl, "_blank");
    }
  };

  // .ics works with any calendar app (Apple Calendar, Google Calendar,
  // Outlook, ...) — the universal option. Outside LINE we're already in a
  // real browser, so the file can just be built and downloaded right here.
  // Inside LINE, the same blob-download block that affects the share-card
  // image applies, so this escapes to the real browser the same way: via a
  // small landing page (?ics=1&date=...&title=...) opened through
  // liff.openWindow, which builds and downloads the .ics itself once it's
  // actually running in Safari/Chrome instead of LINE's WebView. No
  // encryption needed (see addToCalendarGoogle) — the params are passed
  // in the clear.
  const addToCalendarIcs = () => {
    setShowCalendarChoice(false);
    if (!nextEligible) return;
    const title = `วันบริจาคโลหิตครั้งถัดไป (${DONATION_TYPE_LABELS[activeCountdownType]})`;
    if (isLineInAppBrowser) {
      const params = new URLSearchParams();
      params.set("ics", "1");
      params.set("date", dateToLocalStr(nextEligible));
      params.set("title", title);
      const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
      openInExternalBrowser(url).catch(() => window.open(url, "_blank"));
      return;
    }
    try {
      const ics = buildIcsForReminder(nextEligible, title);
      const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `blood-donation-reminder-${toBuddhistDate(nextEligible).replace(/\s+/g, "-")}.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (e) {
      showToast("error", "เพิ่มลงปฏิทินไม่สำเร็จ ลองอีกครั้ง");
    }
  };

  const ageOutOfRange = age !== "" && (Number(age) < MIN_AGE || Number(age) > MAX_AGE);
  const weightBelowMin = weight !== "" && Number(weight) < MIN_WEIGHT;
  const ageWarningDismissed = age !== "" && Number(age) === dismissedEligibilityAge;
  const weightWarningDismissed = weight !== "" && Number(weight) === dismissedEligibilityWeight;

  // Feeds the "เช็คคุณสมบัติก่อนบริจาค" (?tab=eligibility) page — reuses the
  // same profile fields and next-eligible-date math already computed above
  // instead of asking the user to re-enter anything, per data-minimization.
  const ageCheck = age === ""
    ? { status: "unknown", detail: "ยังไม่ได้กรอกอายุที่หน้าโปรไฟล์" }
    : ageOutOfRange
      ? { status: "fail", detail: `อายุ ${age} ปี อยู่นอกเกณฑ์ (${MIN_AGE}-${MAX_AGE} ปี)` }
      : { status: "pass", detail: `อายุ ${age} ปี อยู่ในเกณฑ์ (${MIN_AGE}-${MAX_AGE} ปี)` };
  const weightCheck = weight === ""
    ? { status: "unknown", detail: "ยังไม่ได้กรอกน้ำหนักที่หน้าโปรไฟล์" }
    : weightBelowMin
      ? { status: "fail", detail: `น้ำหนัก ${weight} กก. ต่ำกว่าเกณฑ์ขั้นต่ำ (${MIN_WEIGHT} กก.)` }
      : { status: "pass", detail: `น้ำหนัก ${weight} กก. อยู่ในเกณฑ์ (ขั้นต่ำ ${MIN_WEIGHT} กก.)` };
  const intervalCheck = !effectiveLastDateStr
    ? { status: "pass", detail: "ยังไม่มีประวัติบริจาคในแอป ถือว่าเว้นระยะครบแล้ว" }
    : nextEligible && Date.now() >= nextEligible.getTime()
      ? { status: "pass", detail: `ครบกำหนดแล้วตั้งแต่วันที่ ${toBuddhistDate(nextEligible)}` }
      : { status: "fail", detail: `ยังไม่ครบกำหนด — บริจาคได้อีกครั้งวันที่ ${toBuddhistDate(nextEligible)}` };

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

    // Averaging gaps across BOTH donation types together is misleading once
    // someone donates both whole blood (~90-day cycle) and plasma/platelets
    // (~14-day cycle) — the blended number doesn't represent either cycle.
    // So also compute per-type averages to show separately when relevant.
    const computeAvgGap = (arr) => {
      let total = 0, count = 0;
      for (let i = 1; i < arr.length; i++) {
        total += daysBetween(new Date(arr[i-1].date), new Date(arr[i].date));
        count++;
      }
      return count ? Math.round(total / count) : null;
    };
    // The single all-time average above (and the per-type ones below) can
    // look misleadingly large after someone takes a long break and then
    // resumes: one multi-year hiatus gap gets averaged in with the same
    // weight as every normal gap, dragging the number well above what the
    // donor's *current* rhythm actually is. Rather than guess a threshold
    // for what counts as "a break" (any cutoff feels arbitrary), we just
    // also surface the single most recent gap alongside the average so the
    // donor can see both the long-run figure and where they stand today.
    const lastGapOf = (arr) => arr.length >= 2 ? daysBetween(new Date(arr[arr.length - 2].date), new Date(arr[arr.length - 1].date)) : null;
    const wholeChronological = chronological.filter(d => (d.type || DEFAULT_DONATION_TYPE) === "whole");
    const componentChronological = chronological.filter(d => d.type === "component");
    const avgGapWhole = computeAvgGap(wholeChronological);
    const avgGapComponent = computeAvgGap(componentChronological);
    const lastGap = lastGapOf(chronological);
    const lastGapWhole = lastGapOf(wholeChronological);
    const lastGapComponent = lastGapOf(componentChronological);

    // On a tie, prefer the more recent year — sort ascending by year first
    // (explicitly, rather than relying on numeric-string object-key
    // iteration order) and use >= so a later year with the same count
    // overwrites an earlier one instead of losing to the strict ">" a
    // first-one-wins comparison would apply.
    let busiestYear = null, busiestCount = 0;
    yearData.slice().sort((a, b) => Number(a.year) - Number(b.year)).forEach(({ year, count }) => {
      if (count >= busiestCount) { busiestYear = year; busiestCount = count; }
    });

    const estVolumeMl = totalCount * 350;

    const nextAchievement = achievements.find(a => totalCount < a.threshold) || null;

    const currentYear = buddhistYear(new Date());
    const thisYearCount = yearMap[currentYear] || 0;
    const lastYearCount = yearMap[currentYear - 1] || 0;

    const monthNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const monthCounts = new Array(12).fill(0);
    chronological.forEach(d => {
      const m = parseLocalDate(d.date).getMonth();
      monthCounts[m]++;
    });
    const monthData = monthCounts.map((count, i) => ({ month: monthNames[i], count }));
    const maxMonthCount = monthCounts.reduce((m, c) => Math.max(m, c), 0);
    let busiestMonthIdx = null;
    monthCounts.forEach((c, i) => { if (c > 0 && c === maxMonthCount && busiestMonthIdx === null) busiestMonthIdx = i; });

    return { yearData, avgGap, avgGapWhole, avgGapComponent, lastGap, lastGapWhole, lastGapComponent, busiestYear, busiestCount, estVolumeMl, nextAchievement, thisYearCount, lastYearCount, monthData, maxMonthCount, busiestMonthIdx };
  }, [donations, achievements, totalCount]);

  // Keep the "yearly count" chart scrolled to the latest years by default —
  // it only scrolls (shows a fixed per-year width) once there are more than
  // YEAR_CHART_VISIBLE_COUNT years of data.
  useEffect(() => {
    if (yearChartScrollRef.current) {
      yearChartScrollRef.current.scrollLeft = yearChartScrollRef.current.scrollWidth;
    }
  }, [stats.yearData.length]);

  const unlockedIds = useMemo(
    () => achievements.filter(a => totalCount >= a.threshold).map(a => a.id),
    [totalCount, achievements]
  );
  const hasNewAchievement = unlockedIds.some(id => !seenAchievements.includes(id));

  // seenAchievements should only ever contain ids that are BOTH previously
  // seen AND currently unlocked — otherwise an achievement that gets
  // downgraded (e.g. a donation deleted drops totalCount below its
  // threshold) then re-earned later stays permanently marked "seen" from
  // its earlier unlock, and the "new!" celebration never fires again for
  // it. Prune stale ids on every change to unlockedIds, not just when the
  // missions tab happens to be open.
  const unlockedIdsKey = unlockedIds.join(",");
  useEffect(() => {
    setSeenAchievements(prev => {
      const pruned = prev.filter(id => unlockedIds.includes(id));
      if (pruned.length === prev.length) return prev;
      persistUiMeta({ seenAchievements: pruned });
      return pruned;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockedIdsKey]);

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
  //
  // Combined across BOTH donation types (โลหิตรวม + พลาสมา/เกล็ดเลือด), not
  // counted separately per type -- this was tried as a per-type split for one
  // version (v1.0.50) after a screenshot showing "ครั้งที่ 1000" looked like a
  // mismatch, but the user confirmed directly afterward that the combined,
  // single running total across both types is the intended/correct behavior.
  // Reverted back to combined counting; don't re-introduce the per-type split
  // without the user explicitly asking for it again.
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

  const topLocations = useMemo(() => {
    const counts = {};
    donations.forEach(d => {
      const loc = (d.location || "").trim();
      if (!loc) return;
      counts[loc] = (counts[loc] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [donations]);

  const filteredHistory = useMemo(() => {
    let list = historyYearFilter === "all" ? sorted : sorted.filter(d => String(buddhistYear(d.date)) === historyYearFilter);
    if (historyTypeFilter !== "all") {
      list = list.filter(d => (d.type || DEFAULT_DONATION_TYPE) === historyTypeFilter);
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donations, historyYearFilter, historyTypeFilter]);

  // The "ยอดยกมา" (carried-over starting count) card at the end of the
  // history list used to only ever show/hide based on the COMBINED total
  // (startingCountNum), even while historyTypeFilter narrowed the list to
  // just one type -- so switching to, say, "พลาสมา/เกล็ดเลือด" made the whole
  // card disappear even though that type does have its own carried-over
  // count sitting behind it (reported directly by the user: "ทำไมจำนวนยอด
  // ยกมาไม่แสดงให้ด้วยอ่ะ" after filtering to one type). This tracks
  // whichever total actually applies to the currently selected filter, so
  // the card's visibility and its number both follow the active filter.
  const displayedStartingCount = historyTypeFilter === "whole" ? startingCountWholeNum
    : historyTypeFilter === "component" ? startingCountComponentNum
    : startingCountNum;

  useEffect(() => { setHistoryVisibleCount(HISTORY_PAGE_SIZE); }, [historyYearFilter, historyTypeFilter]);

  // Auto-clear a filter once its own picker UI disappears — otherwise the
  // filter value keeps silently applying in filteredHistory above with no
  // visible control left to explain or reset it. Concretely: pick "type =
  // พลาสมา/เกล็ดเลือด", then delete every component-type record (and its
  // starting count) — hasBothDonationTypes goes false, the type-filter chip
  // row disappears, but historyTypeFilter was still "component" in state,
  // so every real (whole-blood) record kept getting filtered out of the
  // list with no chip on screen to show why. Same class of bug existed for
  // the year filter (its <select> also only renders conditionally) whenever
  // the selected year's last record gets deleted/edited away.
  useEffect(() => {
    if (!hasBothDonationTypes && historyTypeFilter !== "all") setHistoryTypeFilter("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBothDonationTypes]);
  useEffect(() => {
    if (historyYearFilter !== "all" && !historyYears.includes(historyYearFilter)) setHistoryYearFilter("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyYears]);

  const visibleHistory = filteredHistory.slice(0, historyVisibleCount);

  // Year dividers -- design 3 from history-year-dividers-7-designs.html:
  // big faded year on the left, "N ครั้ง" on the right. (Earlier: design 1
  // without its hairline.) (Tried the
  // design 5 timeline rail first; user preferred this.) Counts come from the whole
  // filtered list (not just the loaded page) so "· N ครั้ง" is the year's
  // real total under the active type filter. Shown whenever the list has
  // records -- including while a year/type filter is active and when the
  // list covers a single year (user asked for it to show under filters too).
  const historyYearCounts = useMemo(() => {
    const counts = {};
    filteredHistory.forEach(d => { const y = buddhistYear(d.date); counts[y] = (counts[y] || 0) + 1; });
    return counts;
  }, [filteredHistory]);
  const showHistoryYearDividers = filteredHistory.length > 0;

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

  const sameDateConflictMessage = "วันที่นี้มีรายการบันทึกแล้ว เลือกวันอื่น";

  // Whether the currently-shown formError is the date-specific
  // validation message --
  // drives the date field's red-border highlight below, so the field itself
  // stays neutral for errors that have nothing to do with it.
  const dateFieldHasError = formError === "ระบุวันที่บริจาค";

  // Only relevant while editing an existing record — disables the save
  // button when nothing has actually changed from what was opened.
  const editFormUnchanged = useMemo(() => {
    if (!editingId || !editSnapshot) return false;
    return form.date === editSnapshot.date
      && form.time === editSnapshot.time
      && form.location === editSnapshot.location
      && form.note === editSnapshot.note
      && form.type === editSnapshot.type;
  }, [form, editingId, editSnapshot]);

  const closeGapWarning = useMemo(() => {
    if (!form.date) return null;
    const target = new Date(form.date);
    if (Number.isNaN(target.getTime())) return null;
    if (!form.type) return null;
    const formType = form.type;
    const relevantCycleDays = formType === "component" ? effectiveComponentCycleDays : effectiveCycleDays;
    let closest = null;
    donations.forEach(d => {
      if (editingId && d.id === editingId) return;
      if ((d.type || DEFAULT_DONATION_TYPE) !== formType) return;
      const diff = Math.abs(daysBetween(new Date(d.date), new Date(target)));
      if (closest === null || diff < closest) closest = diff;
    });
    if (closest !== null && closest > 0 && closest < relevantCycleDays) {
      return `วันที่นี้ห่างจากรายการ${DONATION_TYPE_LABELS[formType]}อื่นเพียง ${closest} วัน (เกณฑ์ทั่วไปคือ ${relevantCycleDays} วัน) - ระบบยังบันทึกข้อมูลให้ตามที่ระบุจริง แต่ควรตรวจสอบกับเจ้าหน้าที่ว่าบริจาคได้ตามรอบหรือไม่`;
    }
    return null;
  }, [form.date, form.type, donations, editingId, effectiveCycleDays, effectiveComponentCycleDays]);

  if (phase === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FBF6F5" }}>
        <style>{`
          @keyframes bjSplashSpin { to { transform: rotate(360deg); } }
          /* Staggered fade-up for the splash text: the title settles in
             first, then the subtitle follows ~0.35s later so the eye reads
             them as two beats instead of one flat block appearing at once.
             Both finish comfortably inside the 2s minimum the splash is
             guaranteed to stay on screen (see MIN_LOADING_MS in load()). */
          @keyframes bjSplashFadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
          /* Splash mark "combo" animation, chosen from a 10-variant preview:
             a slow breathing scale on the whole droplet plus a periodic
             blink on the eyes only -- picked over louder options (bounce,
             wobble, sparkle, rapid flutter) because a health app's loading
             moment should read as calm, not playful. The 1s/1s looping
             version (needed to fill the old 2s floor) felt too busy once
             the floor grew to 3s, so this plays just once at the original,
             slower 2.6s pace: a single gentle breathe with one blink
             landing near the 82-94% mark (~2.1s-2.4s in), settling back to
             rest well before the 3s MIN_LOADING_MS floor above ends.
             Respects prefers-reduced-motion below. */
          @keyframes bjFaceBreathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.045); } }
          @keyframes bjFaceBlink { 0%, 82%, 100% { transform: scaleY(1); } 88% { transform: scaleY(0.12); } 94% { transform: scaleY(1); } }
          .bj-splash-drop { transform-origin: 12px 13px; animation: bjFaceBreathe 2.6s ease-in-out 1; }
          .bj-splash-eye { transform-origin: center; animation: bjFaceBlink 2.6s ease-in-out 1; }
          @media (prefers-reduced-motion: reduce) {
            .bj-splash-drop, .bj-splash-eye { animation: none !important; }
          }
        `}</style>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ position: "relative", width: 130, height: 130, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
            <div style={{ position: "absolute", inset: 0, animation: "bjSplashSpin 2s linear infinite" }}>
              <div style={{ position: "absolute", top: -2, left: "50%", transform: "translateX(-50%)", width: 9, height: 9, borderRadius: "50%", background: "#9A3B33" }} />
            </div>
            <div style={{ width: 92, height: 92, borderRadius: 26, background: "#FFFFFF", boxShadow: "0 14px 30px rgba(154,59,51,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg className="bj-splash-drop" width="56" height="68" viewBox="0 0 24 24" fill="#9A3B33">
                <path d="M12 2 C12 2 4 12.5 4 17 C4 21 7.6 24 12 24 C16.4 24 20 21 20 17 C20 12.5 12 2 12 2 Z"/>
                <path className="bj-splash-eye" d="M8 14.6 Q9.5 13.1 11 14.6" stroke="#FFF7F5" strokeWidth="0.9" fill="none" strokeLinecap="round"/>
                <path className="bj-splash-eye" d="M13 14.6 Q14.5 13.1 16 14.6" stroke="#FFF7F5" strokeWidth="0.9" fill="none" strokeLinecap="round"/>
                <circle cx="7" cy="17.6" r="1.15" fill="#F4A6A0" opacity="0.85"/>
                <circle cx="17" cy="17.6" r="1.15" fill="#F4A6A0" opacity="0.85"/>
                <path d="M9 17.6 Q12 20.4 15 17.6" stroke="#FFF7F5" strokeWidth="1" fill="none" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#241A18", textAlign: "center", marginBottom: 8, fontFamily: "'Mitr', 'Inter', sans-serif", opacity: 0, animation: "bjSplashFadeUp 0.5s cubic-bezier(.2,.7,.3,1) forwards" }}>Blood Journey</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#9A8580", textAlign: "center", fontFamily: "'Mitr', 'Inter', sans-serif", letterSpacing: "0.06em", opacity: 0, animation: "bjSplashFadeUp 0.5s cubic-bezier(.2,.7,.3,1) forwards", animationDelay: "0.35s" }}>บันทึกบริจาคโลหิต</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Mitr', 'Inter', sans-serif", background: "#FBF6F5", minHeight: "100vh", color: "#241A18", position: "relative", zIndex: 0, textAlign: "left" }}>
      <div aria-hidden="true" style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: 420, maxWidth: "100%", height: "100%", zIndex: -1, overflow: "hidden", pointerEvents: "none" }}>
        {/* Background (design "A" from background-alt-8-designs.html): two
            soft pink glows fading to nothing -- top-right and mid-left --
            in place of the 7 faint droplets, several of which were cut off
            by the screen edge and looked like broken images. A radial
            gradient has no hard edge, so being partly off-screen is fine. */}
        <div style={{ position: "absolute", width: 320, height: 320, right: -120, top: -110, borderRadius: "50%", background: "radial-gradient(circle, rgba(214,120,108,0.22) 0%, rgba(214,120,108,0) 70%)" }} />
        <div style={{ position: "absolute", width: 300, height: 300, left: -140, top: "48%", borderRadius: "50%", background: "radial-gradient(circle, rgba(214,120,108,0.16) 0%, rgba(214,120,108,0) 70%)" }} />
      </div>
      <style>{`
        /* Mitr is now loaded from a <link> in index.html's <head> instead of
           an @import here -- this @import only started fetching once React
           had already mounted and rendered this very style block, which was
           the real cause of the visible "wrong font, then correct font"
           flash reported: the fallback font showed for JS-load-time PLUS
           font-download-time, stacked serially, instead of the two
           happening in parallel from the start of the page load. Removed to
           avoid a redundant duplicate fetch now that index.html handles it
           earlier and in parallel. */
        /* * { box-sizing }, body { margin: 0 }, and the html/body scrollbar-
           hiding rules now live as a plain <style> tag in index.html's
           <head> instead of here -- this block is skipped entirely by the
           "loading" splash phase's early return above, so those resets
           weren't applying for the ~2s that phase is on screen. See
           index.html for the full explanation. .no-scrollbar itself stays
           here since it's only ever applied to elements this component
           renders, so it doesn't have the same early-return gap. */
        /* The app has its own pull-to-refresh; this stops Chrome on Android
           from running its built-in one on top of it. */
        html, body { overscroll-behavior-y: contain; }
        .no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; width: 0; height: 0; }
        .btn-primary { background: #9A3B33; color: #FFF7F5; }
        .btn-primary:active { background: #7E2F28; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-ghost { background: transparent; color: #9A3B33; border: 1px solid #E3C8C3; }
        /* One "still empty" tone across forms (3.1:1 on white): placeholders match the empty date/time
           fields and the unchosen options of the segmented pickers. Profile rows keep their own rule below. */
        input::placeholder, textarea::placeholder { color: #A38D89; opacity: 1; }
        /* Typed text uses the app's body brown (same as chosen date/time), not the browser's pure black. */
        input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea { color: #3A2C29; }
        /* App-like text: nothing is selectable by a long-press / double-tap (no blue selection, no iOS
           copy/look-up callout, no Android tap flash) EXCEPT text fields and the reading content people may
           want to copy (.selectable: knowledge tab + FAQ, privacy policy, generated backup password).
           Controls stay unselectable even inside .selectable. Inputs are re-enabled explicitly because some
           iOS Safari versions otherwise inherit "none" and refuse typing/pasting. */
        html, body { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
        input, textarea, select, [contenteditable="true"] { -webkit-user-select: text; user-select: text; -webkit-touch-callout: default; }
        .selectable { -webkit-user-select: text; user-select: text; -webkit-touch-callout: default; }
        .selectable :is(button, [role="button"], [role="radio"], [role="switch"], [role="tab"], [role="checkbox"]) { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
        /* One line weight everywhere: a focused field keeps its 1px edge and only turns brand red, instead of
           the browser's thick blue focus ring (iOS/Chrome) that looked heavier than every other line. */
        input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):focus, textarea:focus, select:focus { outline: 1px solid #9A3B33; outline-offset: -1px; }
        .btn-ghost:disabled { opacity: 0.6; cursor: not-allowed; }
        button {
          -webkit-appearance: none;
          appearance: none;
          font-family: inherit;
        }
        select {
          font-family: inherit;
        }
        @keyframes ptrSpin { to { transform: rotate(360deg); } }
        /* Profile inline-edit rows: the editing look (tint, darker text,
           hidden placeholder, unit shown on an empty field) is pure CSS via
           :focus-within, so tapping a row paints instantly instead of
           waiting on a React re-render of the whole app. */
        .prow-edit:focus-within { background: #FBEFEC !important; }
        .prow-edit:focus-within input { color: #3A2C29 !important; }
        .prow-edit input::placeholder { color: #80726F; opacity: 1; }
        .prow-edit input { text-overflow: ellipsis; }
        .prow-edit:focus-within input::placeholder { color: transparent; }
        .prow-edit .prow-unit-empty { display: none; }
        .prow-edit:focus-within .prow-unit-empty { display: inline; }
        @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes sheetDown { from { transform: translateY(0); } to { transform: translateY(100%); } }
        /* Centered dialogs (design "2" from form-dialog-motion-7-designs.html):
           the dimmed backdrop fades in while the panel fades in and rises
           14px (0.2s). Every role="dialog" overlay in the app is a backdrop
           div whose first child is the panel, so this applies app-wide;
           the filter sheet opts out (data-own-motion) since it has its own
           slide. The matching exit is done by cloning the dialog as it
           unmounts -- see the dialog-exit effect in AppInner. */
        @keyframes dlgScrimIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes dlgPanelIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @keyframes dlgScrimOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes dlgPanelOut { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(8px); } }
        [role="dialog"][aria-modal="true"]:not([data-own-motion]) { animation: dlgScrimIn 0.2s ease; }
        /* Open: backdrop and panel 0.2s. Close is deliberately quicker --
           panel 0.14s, backdrop 0.16s -- so saving/closing feels snappy, and
           the panel is gone a hair before the backdrop. (Briefly matched the
           filter sheet's timings; reverted per user request.) */
        [role="dialog"][aria-modal="true"]:not([data-own-motion]) > :first-child { animation: dlgPanelIn 0.2s cubic-bezier(0.2, 0.8, 0.2, 1); }
        .dlg-exit-clone { animation: dlgScrimOut 0.16s ease forwards; pointer-events: none !important; }
        .dlg-exit-clone > :first-child { animation: dlgPanelOut 0.14s ease-in forwards; }
        @media (prefers-reduced-motion: reduce) {
          [role="dialog"][aria-modal="true"], [role="dialog"][aria-modal="true"] > :first-child { animation: none !important; }
        }
        /* Every modal backdrop: light blur + a lighter scrim (was a flat 0.45 dim), so what is
           behind (blood group / age / weight chips, other dialogs) is not readable. */
        [role="dialog"][aria-modal="true"]:not([data-own-motion]), .dlg-exit-clone {
          background: rgba(36, 26, 24, 0.3) !important;
          -webkit-backdrop-filter: blur(3px);
          backdrop-filter: blur(3px);
        }
        .hist-card { -webkit-tap-highlight-color: transparent; transition: background 0.12s; }
        /* pressed tint only when the card itself is pressed, not while the ⋮ button / its menu is */
        .hist-card:active:not(:has(.hist-more:active)) { background: #FBF1EE !important; }
        /* the carried-over card already sits on a tinted fill, so the white-card press tint is invisible there -- go darker instead */
        .hist-card.hist-card-carry:active:not(:has(.hist-more:active)) { background: #EBDAD5 !important; border-color: #D9B9B2 !important; }
        .hist-card:focus-visible { outline: 2px solid #9A3B33; outline-offset: 2px; }
        @media (prefers-reduced-transparency: reduce) {
          [role="dialog"][aria-modal="true"]:not([data-own-motion]), .dlg-exit-clone, .filter-scrim { background: rgba(36, 26, 24, 0.45) !important; -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }
        }
        @keyframes scrimOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes fadeSwap {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        /* On a viewport wider than a phone (desktop browser, dev server,
           etc.) the 420px-wide content column sits on a page background
           that's visible on the left and right (there's nowhere else for
           the extra width to go — the app is phone-width by design). It
           used to also float as a card with margin above and below,
           looking like a shrunk phone screenshot pasted onto the page. On
           request, this now stretches to the FULL viewport height instead
           (no top/bottom margin, no rounded top/bottom corners) so it
           reads as a real full-height app column, not a floating card —
           the pink page background only ever shows on the sides now,
           never above or below. The soft blur-only box-shadow (no offset)
           still shows on the visible left/right edges for a bit of depth,
           and naturally falls outside the viewport at the now-flush top
           and bottom, so it doesn't need to be conditioned separately.
           Below this width (actual phones) nothing changes. */
        @media (min-width: 480px) {
          .app-shell {
            margin: 0 auto !important;
            background: #FFFFFF;
            box-shadow: 0 0 40px rgba(122,42,35,0.14), 0 0 0 1px #F0DEDA;
            min-height: 100vh;
          }
        }
        /* Date + time inputs: side by side on one row (per user request --
           this has previously gone back and forth between this and a
           stacked layout more than once; if a future report says these feel
           cramped on a narrow phone, that's the same iPhone 11-width issue
           that triggered the earlier switch to stacked, not a new bug). The
           two children carry minWidth:0 so a long date string can still
           shrink instead of forcing the row wider than its container. */
        .date-time-row {
          display: flex;
          flex-direction: row;
          gap: 10px;
        }
        .date-time-row > * {
          flex: 1;
          /* a label that wraps to two lines on a narrow phone ("…(ครั้งล่าสุด)") must not push its box below
             the neighbour's: keep both fields bottom-aligned */
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }
        /* Both the date and time fields used to be native <input type="date"/
           "time">, with their value text centered via ::-webkit-datetime-edit*
           pseudo-element rules here -- none of which held up on a real
           iPhone (confirmed by direct user testing). Both are now tap-to-
           open dialogs instead: DateCalendarDialog (a themed calendar grid)
           and TimeBottomSheet (a wheel picker) -- see .time-wheel-col /
           .time-wheel-item just below for the latter's styling. */
        /* TimeBottomSheet's scrolling hour/minute columns. scroll-snap-type
           does the physical snapping in the browser itself, so the resting
           position after a flick or drag is always exactly on an item
           boundary -- TimeWheelColumn's onScroll handler only has to read
           that final position back, never fight the browser's own momentum
           scrolling the way a JS-driven "snap" would. */
        .time-wheel-col {
          height: 120px;
          width: 64px;
          overflow-y: scroll;
          scroll-snap-type: y mandatory;
          -webkit-overflow-scrolling: touch;
        }
        .time-wheel-item {
          height: 40px;
          scroll-snap-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          font-weight: 400;
          color: #B39B96;
          font-family: 'Mitr', 'Inter', sans-serif;
          transition: color 0.1s, font-size 0.1s, font-weight 0.1s;
        }
        /* DateCalendarDialog's month-change animation: whichever direction
           the month moved (via </> or a swipe), the incoming grid slides in
           from that side while fading in, giving the swipe gesture a
           visible, physical response instead of an instant flat-cut swap.
           Made deliberately more pronounced (bigger travel, longer hold,
           a real 0->1 fade) than a typical subtle micro-transition, since
           a barely-there effect reads as no effect at all on a fast phone
           screen. */
        @keyframes calendar-slide-in-left {
          from { transform: translateX(48px); opacity: 0; }
          60% { opacity: 1; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes calendar-slide-in-right {
          from { transform: translateX(-48px); opacity: 0; }
          60% { opacity: 1; }
          to { transform: translateX(0); opacity: 1; }
        }
        .calendar-slide-next {
          animation: calendar-slide-in-left 0.32s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .calendar-slide-prev {
          animation: calendar-slide-in-right 0.32s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @media (prefers-reduced-motion: reduce) {
          .calendar-slide-next, .calendar-slide-prev {
            animation: none;
          }
        }
        .time-wheel-item-active {
          font-size: 17px;
          font-weight: 700;
          color: #3A2C29;
        }
      `}</style>

      {phase === "error" && (
        <div className="app-shell" style={{ maxWidth: 420, margin: "0 auto", padding: "70px 24px", textAlign: "center" }}>
          <AlertTriangle size={28} color="#B3261E" />
          <div style={{ fontSize: 15.5, fontWeight: 700, margin: "14px 0 8px" }}>โหลดข้อมูลไม่สำเร็จ</div>
          <p style={{ fontSize: 13, color: "#5C4A46", lineHeight: 1.7, margin: "0 0 22px" }}>
            ข้อมูลของคุณยังปลอดภัยอยู่ในเครื่องนี้
          </p>
          <button onClick={load} className="btn-primary" style={{ padding: "12px 26px", borderRadius: 12, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            ลองใหม่
          </button>
        </div>
      )}

      {phase === "consent" && (
        <div className="app-shell" style={{ maxWidth: 420, margin: "0 auto", padding: "32px 20px 40px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #B24A40 0%, #8A2F28 100%)", boxShadow: "0 6px 14px -4px rgba(122,42,35,0.55)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}>
              <Droplet size={20} color="#FFF7F5" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.25 }}>Blood Journey</div>
              <div style={{ fontSize: 12, color: "#7A6360", lineHeight: 1.25 }}>บันทึกบริจาคโลหิต</div>
            </div>
          </div>

          <h1 style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.4, margin: "0 0 8px" }}>{consentIsUpdate ? "นโยบายความเป็นส่วนตัวมีการปรับปรุง" : "ก่อนเริ่มใช้งาน"}</h1>
          {consentIsUpdate && (
            <p style={{ fontSize: 14, color: "#3A2C29", lineHeight: 1.7, margin: "0 0 12px", background: "#FBEFEC", borderRadius: 12, padding: "10px 14px" }}>
              โปรไฟล์มีช่องใหม่ที่เลือกกรอกได้ ได้แก่ ปีเกิด เพศ ส่วนสูง เลขประจำตัวผู้บริจาค และ Rh จึงขอให้ยืนยันความยินยอมอีกครั้ง ข้อมูลเดิมของคุณยังอยู่ครบ
            </p>
          )}
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
              <li>เก็บเฉพาะสิ่งที่คุณกรอกเอง — วันที่, สถานที่ (ถ้าระบุ), บันทึกช่วยจำ และข้อมูลโปรไฟล์ที่เลือกกรอก (เช่น ปีเกิด เพศ ส่วนสูง น้ำหนัก หมู่โลหิต เลขประจำตัวผู้บริจาค)</li>
              <li>ใช้เพื่อคำนวณจำนวนครั้งและวันครบกำหนดบริจาคครั้งถัดไปเท่านั้น ไม่แชร์ให้บุคคลหรือหน่วยงานอื่น</li>
              <li>เมื่อเปิดผ่าน LINE แอปขอสิทธิ์เพียงยืนยันบริบทการเปิดแอป (openid) และเมื่อคุณเลือกสร้างการ์ดแชร์หรือเพิ่มลงปฏิทิน ข้อมูลเท่าที่จำเป็นจะถูกเข้ารหัสส่งผ่านลิงก์ชั่วคราวเพื่อเปิดในเบราว์เซอร์ภายนอกเท่านั้น</li>
              <li>คุณลบข้อมูลทั้งหมด หรือส่งออกข้อมูลเป็นไฟล์ได้ตลอดเวลาในหน้าตั้งค่า</li>
            </ul>
            <button type="button" onClick={() => setShowPrivacy(true)} style={{ display: "inline-block", marginTop: 4, background: "none", border: "none", padding: 0, fontSize: 12.5, color: "#9A3B33", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" }}>
              อ่านนโยบายความเป็นส่วนตัวฉบับเต็ม
            </button>
          </div>

          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "4px 2px", marginBottom: 20, cursor: "pointer" }}>
            <input type="checkbox" checked={checkedConsent} onChange={(e) => setCheckedConsent(e.target.checked)}
              style={{ marginTop: 3, width: 18, height: 18, accentColor: "#9A3B33" }} />
            <span style={{ fontSize: 13.5, color: "#3A2C29", lineHeight: 1.6 }}>
              ฉันยินยอมให้เก็บข้อมูลการบริจาคเลือดของฉันตามที่อธิบายไว้ข้างต้น
            </span>
          </label>

          {error && <div style={{ margin: "-10px 0 12px" }}><FieldError>{error}</FieldError></div>}

          <button disabled={!checkedConsent || saving} onClick={giveConsent} className="btn-primary"
            style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", fontSize: 15, fontWeight: 600,
              opacity: checkedConsent ? 1 : 0.45, cursor: checkedConsent ? "pointer" : "not-allowed" }}>
            {saving ? "กำลังบันทึก..." : consentIsUpdate ? "ยินยอมและใช้งานต่อ" : "ยินยอมและเริ่มใช้งาน"}
          </button>
        </div>
      )}

      {/* Header — fixed to the top like the bottom tab bar below, instead of
          scrolling away permanently with the page content, so Profile/
          Settings stay reachable without scrolling back to the top.
          Mirrors the bottom nav's own fixed-bar pattern (outer full-width
          flex-center wrapper + inner maxWidth:420 bar) so both bars line up
          edge-to-edge with the app's content column on any viewport width.
          Solid background (not transparent) so scrolled-past content
          doesn't show through underneath it. translateY slides it out of
          view on scroll-down and back on scroll-up (headerVisible, set by
          the scroll-direction effect above) -- the Facebook-app pattern, so
          it doesn't permanently eat screen height like a plain always-fixed
          bar would. It stays position:fixed the whole time (never removed
          from flow) either way. The app-shell content below gets matching
          extra top padding (HEADER_BAR_HEIGHT + env(safe-area-inset-top) +
          the original 24px breathing room) so nothing starts out hidden
          behind it when shown — keep the two paddings in sync if this
          height changes. */}
      {phase === "app" && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 40, transform: headerVisible ? "translateY(0)" : "translateY(-100%)", transition: "transform 0.25s ease" }}>
          {/* minHeight (not height) + border-box: with an explicit height,
              border-box would count the safe-area paddingTop as PART OF that
              fixed height, squeezing the icon row instead of growing the bar
              to make room for a notch. minHeight lets the box grow past 60px
              exactly when the safe-area inset needs the extra room, while
              still guaranteeing 60px (13+34+13, matching the 34px logo)
              when there's no notch to clear. Keep this in sync with the
              app-shell's compensating top padding above if it changes. */}
          <div style={{ width: "100%", maxWidth: 420, background: "#FBF6F5", boxSizing: "border-box", position: "relative", overflow: "hidden", display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 60, padding: "13px 20px", paddingTop: "calc(13px + env(safe-area-inset-top))" }}>
            {/* The header is an opaque fixed bar sitting above the app's
                background layer, so it blocks the top-right glow there. Redraw
                that same glow here (identical size/offset -- both this bar and
                the background layer are the same 420px-max column starting at
                the top of the viewport), clipped by overflow:hidden, so it
                continues seamlessly across the header's bottom edge. (Used to
                redraw two droplets for the same reason, back when the
                background was droplets; those clashed with the glow.) */}
            <div aria-hidden="true" style={{ position: "absolute", width: 320, height: 320, right: -120, top: -110, borderRadius: "50%", pointerEvents: "none", background: "radial-gradient(circle, rgba(214,120,108,0.22) 0%, rgba(214,120,108,0) 70%)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 9, position: "relative" }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg, #B24A40 0%, #8A2F28 100%)", boxShadow: "0 5px 12px -4px rgba(122,42,35,0.55)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}>
                <Droplet size={17} color="#FFF7F5" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.25 }}>Blood Journey</div>
                <div style={{ fontSize: 11.5, color: "#7A6360", lineHeight: 1.25 }}>บันทึกบริจาคโลหิต</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, position: "relative" }}>
              <button onClick={openProfile} aria-label="โปรไฟล์ของฉัน" style={{ background: "none", border: "none", cursor: "pointer", padding: 12, margin: -6 }}>
                <User size={19} color="#9A3B33" />
              </button>
              <button onClick={() => setShowSettings(true)} aria-label="ตั้งค่า" style={{ background: "none", border: "none", cursor: "pointer", padding: 12, margin: -6 }}>
                <Settings size={19} color="#9A3B33" />
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "app" && (
        <div ref={ptrIndRef} role="status" aria-live="polite"
          style={{ position: "fixed", left: "50%", top: "calc(60px + env(safe-area-inset-top))", transform: "translate(-50%, 0)", zIndex: 39, opacity: 0, pointerEvents: "none",
            display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#7A6360", whiteSpace: "nowrap" }}>
          {ptrState === "load" ? (
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ animation: "ptrSpin 0.8s linear infinite" }}>
              <circle cx="12" cy="12" r="9" fill="none" stroke="#9A3B33" strokeWidth="2.6" strokeLinecap="round" pathLength="100" strokeDasharray="70 100" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9A3B33" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
              style={{ transition: "transform 0.18s", transform: ptrState === "ready" ? "rotate(180deg)" : "none" }}>
              <path d="M12 5v14" /><path d="m19 12-7 7-7-7" />
            </svg>
          )}
          <span>{ptrState === "load" ? "กำลังโหลด…" : ptrState === "ready" ? "ปล่อยเพื่อรีเฟรช" : "ดึงลงเพื่อรีเฟรช"}</span>
        </div>
      )}
      {phase === "app" && (
        <div ref={ptrShellRef} className={tab === "knowledge" ? "app-shell selectable" : "app-shell"} style={{ maxWidth: 420, margin: "0 auto", padding: "calc(60px + env(safe-area-inset-top) + 24px) 20px calc(88px + env(safe-area-inset-bottom))" }}>
          {tab === "home" && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                {/* Display-only avatar: photo is changed from the profile, not from here */}
                <div role="img" aria-label="รูปโปรไฟล์" style={{ width: 56, height: 56, borderRadius: "50%", flexShrink: 0, overflow: "hidden", background: "#F3EAE8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {photo ? (
                    <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : nickname ? (
                    <span style={{ fontSize: 22, fontWeight: 700, color: "#9A3B33" }}>{[...nickname.trim()][0].toUpperCase()}</span>
                  ) : (
                    <User size={24} color="#9A3B33" />
                  )}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                  {nickname ? (
                    <div style={{ fontSize: 18, fontWeight: 600, color: "#3A2C29", lineHeight: 1.3, overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {nickname}
                    </div>
                  ) : totalCount === 0 ? (
                    // Only asks "have you donated today?" for someone with genuinely
                    // no history at all -- previously this greeting showed for anyone
                    // without a nickname regardless of donation history, so a returning
                    // donor still mid-wait for their next eligible date (see the
                    // countdown card just below) saw a question that already had an
                    // obvious "no, not yet" answer baked into their own data.
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#3A2C29", lineHeight: 1.4 }}>
                      สวัสดี วันนี้คุณบริจาคโลหิตแล้วหรือยัง?
                    </div>
                  ) : (
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#3A2C29", lineHeight: 1.4 }}>
                      สวัสดี
                    </div>
                  )}
                  </div>
                  </div>
                  {(bloodType || age !== "" || weight !== "") ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                      {bloodType && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, lineHeight: 1, background: "#F3EAE8", color: "#9A3B33", padding: "3px 10px 3px 3px", borderRadius: 20, fontWeight: 600 }}>
                          <span style={{ width: 16, height: 16, borderRadius: "50%", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Droplet size={9} /></span>
                          <span style={{ filter: pillsHidden ? "blur(4px)" : "none", userSelect: pillsHidden ? "none" : "auto", transition: "filter 0.15s" }}>{bloodType === "ไม่ทราบ" ? "ไม่ระบุ" : `${bloodType}${bloodRh ? ` Rh${bloodRh === "+" ? "+" : "−"}` : ""}`}</span>
                        </span>
                      )}
                      {age !== "" && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, lineHeight: 1, background: "#F3EAE8", color: "#9A3B33", padding: "3px 10px 3px 3px", borderRadius: 20, fontWeight: 600 }}>
                          <span style={{ width: 16, height: 16, borderRadius: "50%", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Cake size={9} /></span>
                          <span style={{ filter: pillsHidden ? "blur(4px)" : "none", userSelect: pillsHidden ? "none" : "auto", transition: "filter 0.15s" }}>{age} ปี</span>
                        </span>
                      )}
                      {weight !== "" && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, lineHeight: 1, background: "#F3EAE8", color: "#9A3B33", padding: "3px 10px 3px 3px", borderRadius: 20, fontWeight: 600 }}>
                          <span style={{ width: 16, height: 16, borderRadius: "50%", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Weight size={9} /></span>
                          <span style={{ filter: pillsHidden ? "blur(4px)" : "none", userSelect: pillsHidden ? "none" : "auto", transition: "filter 0.15s" }}>{weight} กก.</span>
                        </span>
                      )}
                    </div>
                  ) : (
                    <div style={{ marginTop: 8 }}>
                      <button onClick={openProfile} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, background: "none", color: "#9A3B33", padding: "5px 12px", borderRadius: 20, fontWeight: 600, border: "1px solid #E3C8C3", cursor: "pointer", fontFamily: "inherit" }}>
                        <span aria-hidden="true" style={{ position: "absolute", inset: "-9px -1px" }} />
                        <Plus size={11} /> เพิ่มข้อมูลโปรไฟล์
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {storageDegraded && (
                // Persistent — deliberately no "เตือนทีหลัง" dismiss, unlike
                // the other banners below, since the risk here is real data
                // loss rather than just a reminder. Stays up for the rest of
                // the session until storage actually starts working again.
                <div style={{ background: "#FDEDED", border: "1px solid #F0C4BE", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 16 }}>
                  <AlertTriangle size={16} color="#B3261E" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "#B3261E" }}>ข้อมูลจะไม่ถูกบันทึกถาวรตอนนี้</div>
                    <div style={{ fontSize: 11.5, color: "#8A5450", marginTop: 3, lineHeight: 1.6 }}>อุปกรณ์นี้บล็อกการบันทึกข้อมูลถาวร (เช่น โหมดส่วนตัว/พื้นที่เก็บข้อมูลเต็ม) รายการที่บันทึกไว้จะหายเมื่อปิดแอป — แนะนำให้ส่งออกไฟล์สำรองก่อนปิด</div>
                  </div>
                </div>
              )}
              {/* Hero summary card moved directly under the (critical-only)
                  storage banner -- the eligibility/backup-reminder banner and
                  the main "บันทึกบริจาคโลหิต" CTA used to sit between this
                  card and the top of the screen, pushing the card and the
                  primary action further down than they deserve given they're
                  the most important things on this tab. */}
              <div style={{ background: "linear-gradient(135deg, #B24A40 0%, #8A2F28 100%)", boxShadow: "0 14px 32px -8px rgba(122,42,35,0.55)", borderRadius: 20, padding: "22px", color: "#FFF7F5", marginBottom: 16, position: "relative", overflow: "hidden" }}>
                {/* Decorative background droplets removed: two sat half outside
                    the card edge (read as broken images) and the last faint one
                    sat behind "อีก N วัน" (removed on user request). */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, position: "relative", zIndex: 1 }}>
                  {totalCount === 0 ? (
                    // Brand-new user -- a giant "0 ครั้ง" read as a score of zero
                    // rather than a starting point. Welcome them instead; the
                    // count takes over this spot from the first record onward.
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>เริ่มต้นการเดินทาง</div>
                      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.3 }}>ยินดีต้อนรับสู่<br />Blood Journey</div>
                    </div>
                  ) : (
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 4 }}>บริจาคโลหิตสะสมทั้งหมด</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 46, fontWeight: 700, lineHeight: 1 }}>{totalCount}<span style={{ fontSize: 18, fontWeight: 500 }}> ครั้ง</span></div>
                        <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: "rgba(255,247,245,0.16)" }}>≈ {estLiters} ลิตร</span>
                      </div>
                    </div>
                  )}
                  <div style={{ position: "relative", width: 84, height: 84, flexShrink: 0 }}>
                    <svg width="52" height="52" viewBox="0 0 24 24" fill="#FFF7F5" style={{ position: "absolute", top: 18, left: 26 }}><path d="M12 2 C12 2 4 12.5 4 17 C4 21 7.6 24 12 24 C16.4 24 20 21 20 17 C20 12.5 12 2 12 2 Z" /></svg>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="rgba(255,247,245,0.75)" style={{ position: "absolute", top: 50, left: 0 }}><path d="M12 2 C12 2 4 12.5 4 17 C4 21 7.6 24 12 24 C16.4 24 20 21 20 17 C20 12.5 12 2 12 2 Z" /></svg>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="rgba(255,247,245,0.55)" style={{ position: "absolute", top: 0, left: 0 }}><path d="M12 2 C12 2 4 12.5 4 17 C4 21 7.6 24 12 24 C16.4 24 20 21 20 17 C20 12.5 12 2 12 2 Z" /></svg>
                  </div>
                </div>

                {hasBothDonationTypes ? (
                  <div style={{ display: "flex", gap: 6, marginTop: 6, position: "relative", zIndex: 2 }}>
                    {/* Selected pill's text/count now tints per donation type (matching
                        the same DONATION_TYPE_TINT used on the history filters and
                        cards below) instead of always reading maroon regardless of
                        which type is active -- so this tab strip carries the same
                        color signal as the rest of the tab. */}
                    {["whole", "component"].map((t) => (
                      <button key={t} onClick={() => { countdownManualRef.current = true; setCountdownTab(t); }}
                        style={{
                          position: "relative", display: "flex", alignItems: "center", gap: 6,
                          padding: "6px 12px", borderRadius: 20, fontSize: 11.5, fontFamily: "inherit", cursor: "pointer", border: "none",
                          background: activeCountdownType === t ? "#FFF7F5" : "rgba(255,247,245,0.18)",
                          color: activeCountdownType === t ? DONATION_TYPE_TINT[t].text : "#FFF7F5",
                          fontWeight: activeCountdownType === t ? 600 : 400,
                          transition: "background 0.35s ease, color 0.35s ease",
                        }}>
                        {/* Invisible 44px-tall tap area; pill keeps its 30px look. */}
                        <span aria-hidden="true" style={{ position: "absolute", inset: "-8px -3px" }} />
                        {t === "component" ? <Droplets size={12} /> : <Droplet size={12} />} {DONATION_TYPE_LABELS[t]}
                        <span style={{
                          fontSize: 11, padding: "1px 6px", borderRadius: 10, fontWeight: 600,
                          background: activeCountdownType === t ? DONATION_TYPE_TINT[t].bg : "rgba(255,247,245,0.22)",
                          color: activeCountdownType === t ? DONATION_TYPE_TINT[t].text : "#FFF7F5",
                          transition: "background 0.35s ease, color 0.35s ease",
                        }}>{t === "component" ? componentTotalCount : wholeTotalCount}</span>
                      </button>
                    ))}
                  </div>
                ) : totalCount > 0 ? (
                  // Only one donation type exists here, so this pill's own count
                  // chip would just repeat the big "N ครั้ง" number shown right
                  // above -- dropped the chip and kept only the type name, which
                  // is the one thing this pill actually adds.
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6, padding: "6px 12px", borderRadius: 20, fontSize: 11.5, fontWeight: 600, background: "#FFF7F5", color: DONATION_TYPE_TINT[activeCountdownType].text, position: "relative", zIndex: 1 }}>
                    {activeCountdownType === "component" ? <Droplets size={12} /> : <Droplet size={12} />} {DONATION_TYPE_LABELS[activeCountdownType]}
                  </div>
                ) : (
                  // Brand-new user with no history yet -- previously this was an
                  // invisible placeholder just to hold the pill's box height, which
                  // left a blank-looking gap in the card. Same box size/position,
                  // now filled with a small useful fact instead of empty space.
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6, padding: "6px 12px", borderRadius: 20, fontSize: 11.5, fontWeight: 600, background: "rgba(255,247,245,0.16)", color: "#FFF7F5", position: "relative", zIndex: 1 }}>
                    <HeartPulse size={12} /> บริจาค 1 ครั้ง ช่วยได้สูงสุด 3 ชีวิต
                  </div>
                )}
                <div style={{ marginTop: 10, paddingTop: 14, borderTop: "1px solid rgba(255,247,245,0.25)", display: "flex", alignItems: "flex-start", gap: 10, position: "relative", zIndex: 1 }}>
                  <span style={{ display: "flex", flexShrink: 0, marginTop: 1 }}>
                    {/* totalCount === 0 (brand-new user, no history at all) must never
                        show the checkmark -- isEligible is true by default when there's
                        no nextEligible date yet, but a checkmark next to "no history"
                        reads as a false confirmation rather than a neutral empty state. */}
                    {remindPaused ? <BellOff size={18} />
                      : totalCount === 0 || (!effectiveLastDateStr && (hasBothDonationTypes || totalCount > 0) && activeTypeTotalCount > 0)
                      ? <Info size={18} />
                      : isEligible ? <CheckCircle2 size={18} /> : <Clock size={18} />}
                  </span>
                  <div key={activeCountdownType} aria-live="polite" style={{ fontSize: 12, lineHeight: 1.5, animation: "fadeSwap 0.4s ease", flex: 1 }}>
                    {remindPaused ? (
                      // Donor paused reminders (settings → การเตือน → พักการเตือนชั่วคราว).
                      <>
                        <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.35 }}>พักการเตือนไว้</div>
                        <div style={{ fontSize: 11.5, color: "rgba(255,247,245,0.85)", marginTop: 1 }}>{remindPauseUntil === "indefinite" ? "จนกว่าคุณจะเปิดเอง" : <>ถึง <span style={{ whiteSpace: "nowrap" }}>{toBuddhistDate(remindPauseUntil)}</span></>}</div>
                        <button onClick={() => { setRemindPauseChoice("6"); setShowRemindPause(true); }}
                          style={{ display: "inline-flex", alignItems: "center", gap: 3, minHeight: 44, margin: "-8px 0 -12px", padding: 0, background: "none", border: "none", color: "#FFF7F5", fontSize: 11.5, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", fontFamily: "inherit" }}>
                          เปิดการเตือน หรือเปลี่ยนระยะเวลา <ChevronRight size={13} />
                        </button>
                      </>
                    ) : effectiveLastDateStr ? (
                      isEligible ? (
                        // Eligible again -- previously the card stopped at this
                        // one line with nothing to do next. Links straight to the
                        // existing "เตรียมตัวก่อนบริจาค" tips on the knowledge tab.
                        // Headline sized/weighted the same as the waiting state's
                        // "อีก N วัน" -- being eligible again is the best news this
                        // card ever shows, and it used to be the quietest line.
                        <>
                          <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.35 }}>บริจาคได้แล้ววันนี้</div>
                          {hasBothDonationTypes && (
                            <div style={{ fontSize: 11.5, color: "rgba(255,247,245,0.85)", marginTop: 1 }}>สำหรับ{DONATION_TYPE_LABELS[activeCountdownType]}</div>
                          )}
                          <button
                            onClick={() => {
                              setTab("knowledge");
                              setTimeout(() => document.getElementById("pre-donation-tips")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
                            }}
                            style={{ display: "inline-flex", alignItems: "center", gap: 3, minHeight: 44, margin: "-8px 0 -12px", padding: 0, background: "none", border: "none", color: "#FFF7F5", fontSize: 11.5, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", fontFamily: "inherit" }}>
                            ดูวิธีเตรียมตัวก่อนบริจาค <ChevronRight size={13} />
                          </button>
                        </>
                      ) : (
                        // "อีก N วัน" is the number a waiting donor actually acts
                        // on -- it used to sit in parentheses at the end of a 12px
                        // sentence (and wrapped so "วัน)" dangled alone on its own
                        // line). Now it leads, with the exact date underneath.
                        <>
                          <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.35 }}>อีก {daysLeft} วัน</div>
                          {/* With two donation types the countdown depends on which tab is
                              selected -- name the type here so the date can't be
                              misread as the other type's. */}
                          <div style={{ fontSize: 11.5, color: "rgba(255,247,245,0.85)", marginTop: 1 }}>บริจาค{hasBothDonationTypes ? DONATION_TYPE_LABELS[activeCountdownType] : ""}ได้อีกครั้ง <span style={{ whiteSpace: "nowrap" }}>{toBuddhistDate(nextEligible)}</span></div>
                        </>
                      )
                    ) : hasBothDonationTypes || totalCount > 0 ? (
                      activeTypeTotalCount > 0
                        ? <>มียอดบริจาคโลหิตสะสมแล้ว กรุณาบันทึกวันที่บริจาคล่าสุด<br />เพื่อคำนวณวันครบกำหนดถัดไป</>
                        : `ยังไม่มีประวัติการบริจาค${DONATION_TYPE_LABELS[activeCountdownType]}ในระบบ`
                    ) : "พอบันทึกครั้งแรก แอปจะนับวันให้ว่าบริจาคครั้งถัดไปได้เมื่อไร"}
                  </div>
                  {/* Disclosure toggle for the "คำนวณจากเกณฑ์...วันต่อครั้ง" note --
                      previously a standalone 3-line paragraph printed under the card
                      on every load; same info now sits one tap away, right next to
                      the countdown text it explains, instead of always taking up
                      space by default. */}
                  {(effectiveLastDateStr || hasBothDonationTypes || totalCount > 0) && (
                    <button onClick={() => setShowCycleInfo(v => !v)} aria-label={showCycleInfo ? "ซ่อนรายละเอียดการคำนวณ" : "ดูรายละเอียดการคำนวณ"} aria-expanded={showCycleInfo}
                      style={{ flexShrink: 0, width: 44, height: 44, margin: "-13px -14px -13px 0", borderRadius: "50%", border: "none", background: "none", color: "rgba(255,247,245,0.7)", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Info size={15} />
                    </button>
                  )}
                </div>
                {/* Visual progress through the current waiting period -- previously
                    only the "อีก N วัน" text conveyed this, with no sense of how far
                    along the wait actually is. Only makes sense once there's an
                    actual last-donation date to count from and the donor isn't
                    already eligible again. */}
                {effectiveLastDateStr && !isEligible && daysLeft > 0 && !remindPaused && (
                  <div key={`${activeCountdownType}-progress`} role="progressbar" aria-label="ความคืบหน้าของช่วงพักฟื้นก่อนบริจาคครั้งถัดไป"
                    aria-valuemin={0} aria-valuemax={activeCycleDays} aria-valuenow={Math.max(0, activeCycleDays - daysLeft)}
                    style={{ marginTop: 10, height: 5, borderRadius: 3, background: "rgba(255,247,245,0.2)", overflow: "hidden", position: "relative", zIndex: 1, animation: "fadeSwap 0.4s ease" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, ((activeCycleDays - daysLeft) / activeCycleDays) * 100))}%`, background: "#FFF7F5", borderRadius: 3, transition: "width 0.35s ease" }} />
                  </div>
                )}
                {showCycleInfo && (effectiveLastDateStr || hasBothDonationTypes || totalCount > 0) && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,247,245,0.18)", fontSize: 11.5, color: "rgba(255,247,245,0.8)", lineHeight: 1.6, position: "relative", zIndex: 1 }}>
                    คำนวณจากเกณฑ์{hasBothDonationTypes ? `${DONATION_TYPE_LABELS[activeCountdownType]} ` : " "}{activeCycleDays} วันต่อครั้ง (ปรับได้ที่ตั้งค่า)<br />
                    เพื่อการเตือนคร่าว ๆ เท่านั้น โปรดยึดตามคำแนะนำของเจ้าหน้าที่ ณ จุดบริจาค
                  </div>
                )}
              </div>

              {/* Row-style CTA (design "3" from a 10-variant exploration) in
                  place of the old full-width solid button -- reads as a
                  menu-style list item that matches the other white/bordered
                  cards on this tab (next-achievement card just below,
                  history rows further down) instead of a heavy standalone
                  bar of color. The icon badge keeps the gradient accent so
                  it still reads as the primary action; the chevron signals
                  "tap to continue" the way the rest of the app's row items
                  do. Moved directly under the hero card (was previously
                  pushed down below the disclaimer paragraph and the
                  calendar-reminder card) since this is the single most
                  important action on the tab. */}
              <button onClick={handleAddButtonClick}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 15px", borderRadius: 14,
                  background: "#FFFFFF", border: "1px solid #EEDEDA", boxShadow: "0 4px 14px rgba(122,42,35,0.06)",
                  marginBottom: 16, cursor: "pointer", fontFamily: "inherit" }}>
                <span style={{ width: 38, height: 38, borderRadius: 11, background: "linear-gradient(135deg, #B24A40 0%, #8A2F28 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center", color: "#FFF7F5", flexShrink: 0 }}>
                  <Plus size={18} />
                </span>
                <span style={{ flex: 1, textAlign: "left", fontSize: 13.5, fontWeight: 600, color: "#3A2C29" }}>บันทึกบริจาคโลหิต</span>
                <ChevronRight size={16} color="#B39B96" style={{ flexShrink: 0 }} />
              </button>

              {showCareCard && (() => {
                const items = [
                  { Icon: GlassWater, text: "ดื่มน้ำมากกว่าปกติ และงดยกของหนักหรือออกกำลังหนักในวันที่บริจาค" },
                ];
                // Iron tablets come with whole-blood donations; apheresis
                // (พลาสมา/เกล็ดเลือด) takes back the red cells.
                if (last.type !== "component") {
                  items.push({ Icon: Pill, text: "กินยาธาตุเหล็กที่ได้รับตามที่เจ้าหน้าที่แนะนำ เลี่ยงกินพร้อมนม ชา กาแฟ น้ำส้มช่วยให้ดูดซึมดีขึ้น" });
                  if (gender === "female") items.push({ Icon: Info, text: "ผู้หญิงเสียธาตุเหล็กทุกเดือนจากประจำเดือน จึงควรกินยาธาตุเหล็กให้ครบ ช่วยให้ครั้งหน้าผ่านการตรวจความเข้มข้นเลือด" });
                }
                return (
                  <div role="region" aria-label="ดูแลตัวเองหลังบริจาค" style={{ position: "relative", background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 16, padding: "14px 15px 8px", marginBottom: 16 }}>
                    <button onClick={() => { setDismissedCareFor(last.id); persistUiMeta({ dismissedCareFor: last.id }); }} aria-label="ปิดคำแนะนำหลังบริจาค"
                      style={{ position: "absolute", top: 4, right: 4, width: 44, height: 44, border: "none", background: "none", cursor: "pointer", color: "#7A6360", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                      <X size={16} />
                    </button>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "#9A3B33" }}>หลังบริจาค · {careDaysSince === 0 ? "วันนี้" : careDaysSince === 1 ? "เมื่อวาน" : "2 วันก่อน"}</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#3A2C29", margin: "2px 0 6px" }}>ดูแลตัวเองหลังบริจาค</div>
                    {items.map(({ Icon, text }) => (
                      <div key={text} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, lineHeight: 1.55, color: "#4A3A37", padding: "6px 0" }}>
                        <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: "50%", background: "#F3EAE8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Icon size={15} color="#9A3B33" />
                        </span>
                        <span style={{ paddingTop: 4 }}>{text}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* New-user shortcuts (design 1 from new-user-home-7-designs.html;
                  briefly tried the design 5 checklist): the two other ways to
                  start besides recording one donation -- entering a carried-over
                  count, or restoring a backup from an old phone -- plus the
                  local-only privacy note. Hidden as soon as there's a record or
                  a carried-over count. */}
              {donations.length === 0 && startingCountNum === 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 16, overflow: "hidden" }}>
                    {[
                      { Icon: Trophy, title: "เคยบริจาคมาก่อน?", sub: "กรอกจำนวนครั้งที่ผ่านมา นับต่อจากนั้นเลย", onClick: chooseHasStartingCount },
                      { Icon: Upload, title: "ย้ายมาจากเครื่องเก่า?", sub: "กู้คืนประวัติจากไฟล์สำรอง", onClick: () => openBackupRestore("import", { fromHome: true }) },
                    ].map(({ Icon, title, sub, onClick }, i) => (
                      <button key={title} onClick={onClick}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", background: "none", border: "none", borderTop: i ? "1px solid #F3E7E4" : "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                        <span style={{ width: 34, height: 34, borderRadius: 10, background: "#F3EAE8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Icon size={17} color="#9A3B33" aria-hidden="true" />
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "#3A2C29" }}>{title}</span>
                          <span style={{ display: "block", fontSize: 11.5, color: "#7A6360", marginTop: 1 }}>{sub}</span>
                        </span>
                        <ChevronRight size={16} color="#B7A5A1" style={{ flexShrink: 0 }} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12, fontSize: 11.5, color: "#7A6360" }}>
                    <Lock size={13} color="#7A6360" aria-hidden="true" /> ข้อมูลเก็บในเครื่องนี้เท่านั้น ไม่ส่งขึ้นเซิร์ฟเวอร์
                  </div>
                </div>
              )}

              {/* Reminder slot (design "3" from home-reminders-8-designs.html):
                  the backup banner, the eligibility warning and the calendar
                  prompt used to stack as up to three separate cards between
                  the CTA and the mission card, pushing the history section
                  entirely below the first screen. They now share one slot,
                  most important first -- backup (real data-loss risk) >
                  eligibility warning > calendar prompt -- as a horizontal
                  swipe carousel (CSS scroll-snap, so it follows the finger
                  natively), auto-advancing every 5s (see reminderLastTouchRef).
                  Slides are full width (the earlier "peek" of the next slide
                  was removed per user feedback); the dots under it show
                  position and can be tapped. Finishing or dismissing
                  (✕) a slide removes it from the queue. */}
              {(() => {
                const queue = [];
                if (needsBackupReminder) queue.push("backup");
                if (ageOutOfRange && !ageWarningDismissed) queue.push("age");
                if (weightBelowMin && !weightWarningDismissed) queue.push("weight");
                if (effectiveLastDateStr && !isEligible && !reminderDismissed && !remindPaused) queue.push("calendar");
                if (queue.length === 0) return null;
                const multi = queue.length > 1;
                const activeIdx = Math.min(reminderIdx, queue.length - 1);
                const closeBtn = (onClick) => (
                  <button onClick={onClick} aria-label="เตือนทีหลัง"
                    style={{ flexShrink: 0, width: 44, height: 44, margin: -11, marginLeft: -4, borderRadius: "50%", border: "none", background: "none", color: "#7A6360", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X size={13} />
                  </button>
                );
                const slide = (kind, idx) => {
                  const isWarn = kind === "backup" || kind === "age" || kind === "weight";
                  return (
                    <div key={kind} aria-label={multi ? `เรื่องที่ ${idx + 1} จาก ${queue.length}` : undefined} role={multi ? "group" : undefined} style={{
                      flex: "0 0 100%", scrollSnapAlign: "start", boxSizing: "border-box",
                      background: isWarn ? "#FDF0E6" : "#FFFFFF", border: `1px solid ${isWarn ? "#F0D9BE" : "#EEDEDA"}`, borderRadius: 12,
                      padding: "10px 12px", display: "flex", alignItems: "center", gap: 6, minHeight: 50,
                    }}>
                      {kind === "backup" && (
                        <>
                          <AlertTriangle size={15} color="#9C5515" style={{ flexShrink: 0 }} />
                          <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: "#7A4A1D" }}>ยังไม่ได้สำรองข้อมูล</span>
                          <button onClick={() => openBackupRestore("export", { fromHome: true })}
                            style={{ position: "relative", flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 9, border: "none", background: "#9A3B33", color: "#FFF7F5", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                            <span aria-hidden="true" style={{ position: "absolute", inset: "-7px -2px" }} />
                            <Download size={13} /> สำรองเลย
                          </button>
                          {closeBtn(snoozeBackupReminder)}
                        </>
                      )}
                      {(kind === "age" || kind === "weight") && (
                        // Age and weight used to share one two-to-three-line
                        // slide (text + "ให้เจ้าหน้าที่...ประเมินสิทธิ์จริง"), which
                        // made every slide in the carousel that tall. Now each is
                        // its own one-line slide with a "ดูเกณฑ์" button to the
                        // criteria (top of the knowledge tab, whose footer
                        // already says the staff make the real call).
                        <>
                          <AlertTriangle size={15} color="#9C5515" style={{ flexShrink: 0 }} />
                          <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: "#7A4A1D" }}>
                            {kind === "age" ? `อายุอยู่นอกเกณฑ์ทั่วไป (${MIN_AGE}–${MAX_AGE} ปี)` : `น้ำหนักต่ำกว่าเกณฑ์ทั่วไป (${MIN_WEIGHT} กก.)`}
                          </span>
                          <button onClick={() => { setTab("knowledge"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                            style={{ position: "relative", flexShrink: 0, padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, fontFamily: "inherit", border: "none", background: "#F7E2D0", color: "#7A4A1D", cursor: "pointer" }}>
                            <span aria-hidden="true" style={{ position: "absolute", inset: "-8px -3px" }} />
                            ดูเกณฑ์
                          </button>
                          {closeBtn(kind === "age" ? dismissAgeWarning : dismissWeightWarning)}
                        </>
                      )}
                      {kind === "calendar" && (
                        <>
                          <Calendar size={14} color="#9A3B33" style={{ flexShrink: 0 }} />
                          <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: "#5C4A46" }}>ให้เตือนเมื่อบริจาคได้อีกครั้งไหม</span>
                          {/* The pill itself stays 28px tall visually; the transparent
                              span extends its tap area to 44px without changing layout. */}
                          <button onClick={handleAddToCalendar}
                            style={{ position: "relative", flexShrink: 0, padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, fontFamily: "inherit", border: "none", background: "#F3EAE8", color: "#9A3B33", cursor: "pointer" }}>
                            <span aria-hidden="true" style={{ position: "absolute", inset: "-8px -4px" }} />
                            เพิ่มลงปฏิทิน
                          </button>
                          {closeBtn(dismissCalendarReminder)}
                        </>
                      )}
                    </div>
                  );
                };
                return (
                  <div style={{ position: "relative", marginBottom: 16 }}>
                    {/* Vertical padding + matching negative margin give the
                        44px tap areas room inside the scroller, which clips
                        anything that overflows it. */}
                    <div ref={reminderScrollerRef} className="no-scrollbar" role="region" aria-label={multi ? `การแจ้งเตือน ${queue.length} เรื่อง ปัดซ้ายขวาเพื่อดูเรื่องอื่น` : "การแจ้งเตือน"}
                      onPointerDown={() => { reminderLastTouchRef.current = Date.now(); }}
                      onTouchStart={() => { reminderLastTouchRef.current = Date.now(); }}
                      onMouseMove={() => { reminderLastTouchRef.current = Date.now(); }}
                      onWheel={() => { reminderLastTouchRef.current = Date.now(); }}
                      onScroll={(e) => {
                        const el = e.currentTarget;
                        const first = el.children[0];
                        if (!first) return;
                        const step = first.getBoundingClientRect().width + 8;
                        const i = Math.max(0, Math.min(el.children.length - 1, Math.round(el.scrollLeft / step)));
                        if (i !== reminderIdx) setReminderIdx(i);
                      }}
                      style={{ display: "flex", gap: 8, overflowX: "auto", overflowY: "hidden", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", overscrollBehaviorX: "contain", padding: "8px 0", margin: "-8px 0" }}>
                      {queue.map((k, i) => slide(k, i))}
                    </div>
                    {/* Shared dots under the carousel (kept out of the slides
                        so they don't squeeze each slide's text onto a second
                        line). Tapping a dot jumps to that slide. */}
                    {multi && (
                      <div style={{ display: "flex", justifyContent: "center", gap: 0, marginTop: 12, marginBottom: 2 }}>
                        {queue.map((k, i) => (
                          <button key={k} aria-label={`ไปเรื่องที่ ${i + 1}`} aria-current={i === activeIdx ? "true" : undefined}
                            onClick={() => { reminderLastTouchRef.current = Date.now(); const el = reminderScrollerRef.current; const c = el?.children[i]; if (el && c) el.scrollTo({ left: c.offsetLeft - el.children[0].offsetLeft, behavior: "smooth" }); }}
                            // Each dot's tap area is a 44px-tall tile, the tiles
                            // touching edge to edge (no dead gaps between dots);
                            // the dots themselves keep their size, just a little
                            // more space between them (was 26x30 / 16x30 taps).
                            style={{ padding: "19px 10px", margin: "-19px 0", border: "none", background: "none", cursor: "pointer", display: "flex" }}>
                            <span style={{ width: i === activeIdx ? 14 : 6, height: 6, borderRadius: 3, background: i === activeIdx ? "#9A3B33" : "#E3C8C3", transition: "width 0.2s ease, background 0.2s ease" }} />
                          </button>
                        ))}
                      </div>
                    )}
                    {/* Calendar picker lives outside the scroller: an overflow-x
                        container also clips vertically, which would cut this
                        popover off below the slide. */}
                    {showCalendarChoice && queue.includes("calendar") && (
                      <>
                        <div onClick={() => setShowCalendarChoice(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                        <div style={{
                          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 41,
                          background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 12,
                          boxShadow: "0 10px 28px rgba(90,50,45,0.16)", padding: 6, minWidth: 190,
                        }}>
                          <div style={{ fontSize: 11.5, color: "#7A6360", padding: "4px 8px 6px" }}>เพิ่มลงปฏิทินแบบไหน?</div>
                          <button onClick={addToCalendarGoogle} style={{
                            width: "100%", textAlign: "left", padding: "8px 8px", borderRadius: 8, border: "none",
                            background: "transparent", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, color: "#3A2A27", cursor: "pointer",
                          }}>Google Calendar</button>
                          <button onClick={addToCalendarIcs} style={{
                            width: "100%", textAlign: "left", padding: "8px 8px", borderRadius: 8, border: "none",
                            background: "transparent", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, color: "#3A2A27", cursor: "pointer",
                          }}>ไฟล์ .ics (Apple Calendar / อื่น ๆ)</button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}

              {/* Hidden for a brand-new user (totalCount === 0): an empty
                  "หยดแรก 0/1" ring was one more "you haven't started yet"
                  message on a screen already saying that with the welcome
                  card and the CTA. Appears from the first record onward. */}
              {stats.nextAchievement && totalCount > 0 ? (
                <button onClick={() => setTab("missions")}
                  style={{ display: "block", width: "100%", textAlign: "left", background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 14, padding: "13px 15px", marginBottom: 26, cursor: "pointer", fontFamily: "inherit" }}>
                  {/* Design "D" from a ring-variant exploration: the old thin
                      progress bar looked identical to the hero card's waiting-
                      period bar despite meaning something different. Now the
                      reward name leads, "อีก N ครั้ง" sits under it, and a ring
                      with the explicit "done/goal" count sits on the right. */}
                  {(() => {
                    const goal = stats.nextAchievement.threshold;
                    const done = Math.min(totalCount, goal);
                    const size = 54, stroke = 5, r = (size - stroke) / 2, circ = 2 * Math.PI * r;
                    const frac = goal > 0 ? done / goal : 0;
                    const label = `${done}/${goal}`;
                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#9A3B33", marginBottom: 7 }}>
                            <Award size={14} style={{ flexShrink: 0 }} /> ภารกิจถัดไป
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#3A2C29", lineHeight: 1.35 }}>{stats.nextAchievement.title}</div>
                          <div style={{ fontSize: 12, color: "#7A6360", marginTop: 2 }}>อีก {goal - totalCount} ครั้ง</div>
                        </div>
                        <div role="progressbar" aria-label={`ความคืบหน้าไปถึง "${stats.nextAchievement.title}" ${done} จาก ${goal} ครั้ง`} aria-valuemin={0} aria-valuemax={goal} aria-valuenow={done}
                          style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
                          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
                            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3EAE8" strokeWidth={stroke} />
                            {frac > 0 && (
                              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#9A3B33" strokeWidth={stroke} strokeLinecap="round"
                                strokeDasharray={`${circ * frac} ${circ}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
                            )}
                          </svg>
                          <div aria-hidden="true" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: label.length > 5 ? 11 : 12.5, fontWeight: 700, color: "#9A3B33", fontVariantNumeric: "tabular-nums" }}>
                            {done}<span style={{ color: "#7A6360", fontWeight: 600 }}>/{goal}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </button>
              ) : totalCount > 0 ? (
                // All achievements unlocked — replace the teaser card with a
                // congratulatory card in the same size/shape as the teaser,
                // instead of leaving this space empty, so it doesn't look
                // like the card silently vanished.
                <button onClick={() => setTab("missions")}
                  style={{ display: "block", width: "100%", textAlign: "left", background: "#FFFBF0", border: "1px solid #E9D9A8", borderRadius: 14, padding: "13px 15px", marginBottom: 26, cursor: "pointer", fontFamily: "inherit" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#8A6B1D", marginBottom: 6 }}>
                    <Award size={14} style={{ flexShrink: 0 }} /> ปลดล็อกภารกิจครบทุกอันแล้ว
                  </div>
                  <div style={{ fontSize: 12.5, color: "#8A6B1D" }}>
                    เก่งมาก! คุณทำสำเร็จครบทุกภารกิจในตอนนี้
                  </div>
                </button>
              ) : null}

              {/* History heading + empty state are hidden entirely for a
                  brand-new user (totalCount === 0): an empty "ประวัติ" section
                  saying "กดปุ่มด้านบนเพื่อเริ่มบันทึก" was the fourth nudge on
                  one screen telling them the same thing as the CTA. */}
              {/* History filter (design "2" from history-filter-8-designs.html):
                  the type chips and the year dropdown that used to sit here
                  are combined behind one "ตัวกรอง" button, whose badge shows
                  how many filters are active. It opens a bottom sheet with
                  type chips and year chips. Taps only change a draft (the
                  header previews the resulting count, or "ไม่มีรายการ" in red
                  when it would be empty); "เสร็จ" applies it, while ✕ /
                  backdrop / Escape discard it. */}
              {totalCount > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#3A2C29" }}>ประวัติบริจาคโลหิต</div>
                {(hasBothDonationTypes || historyYears.length > 1) && (() => {
                  const activeCount = (historyTypeFilter !== "all" ? 1 : 0) + (historyYearFilter !== "all" ? 1 : 0);
                  const on = activeCount > 0;
                  return (
                    <button onClick={() => { clearTimeout(filterCloseTimerRef.current); setFilterSheetClosing(false); setDraftTypeFilter(historyTypeFilter); setDraftYearFilter(historyYearFilter); setShowFilterSheet(true); }} aria-haspopup="dialog"
                      aria-label={on ? `ตัวกรอง (ใช้อยู่ ${activeCount} อย่าง)` : "ตัวกรอง"}
                      style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, lineHeight: 1.35, fontFamily: "inherit", cursor: "pointer",
                        color: on ? "#9A3B33" : "#5C4A46", fontWeight: on ? 600 : 400, background: on ? "#FBF1EF" : "#FFFFFF",
                        border: `1px solid ${on ? "#9A3B33" : "#E3C8C3"}`, borderRadius: 9, padding: "5px 10px" }}>
                      <span aria-hidden="true" style={{ position: "absolute", inset: "-9px -2px" }} />
                      <SlidersHorizontal size={13} /> ตัวกรอง
                      {on && <span style={{ background: "#9A3B33", color: "#FFFFFF", fontSize: 11, fontWeight: 700, borderRadius: 9, padding: "0 6px", lineHeight: "17px" }}>{activeCount}</span>}
                    </button>
                  );
                })()}
              </div>
              )}

              {showFilterSheet && (() => {
                // Count the draft selection would show (records + carry-over
                // when "ทุกปี"), so the header previews the result before
                // "เสร็จ" applies it.
                const draftRecords = donations.filter(d =>
                  (draftTypeFilter === "all" || (d.type || DEFAULT_DONATION_TYPE) === draftTypeFilter)
                  && (draftYearFilter === "all" || String(buddhistYear(d.date)) === draftYearFilter)).length;
                const draftCarry = draftYearFilter !== "all" ? 0
                  : draftTypeFilter === "whole" ? startingCountWholeNum
                  : draftTypeFilter === "component" ? startingCountComponentNum
                  : startingCountNum;
                const shownCount = draftRecords + draftCarry;
                const draftActive = draftTypeFilter !== "all" || draftYearFilter !== "all";
                const chipBase = { position: "relative", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, padding: "7px 14px", borderRadius: 20, whiteSpace: "nowrap", fontFamily: "inherit", cursor: "pointer" };
                const hit = <span aria-hidden="true" style={{ position: "absolute", inset: "-6px -3px" }} />;
                return (
                  <>
                    <div className="filter-scrim" onClick={closeFilterSheet} style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.3)", WebkitBackdropFilter: "blur(3px)", backdropFilter: "blur(3px)", zIndex: 70,
                      animation: filterSheetClosing ? "scrimOut 0.26s ease 0.04s forwards" : "fadeSwap 0.2s ease", pointerEvents: filterSheetClosing ? "none" : "auto" }} />
                    <div role="dialog" aria-modal="true" aria-label="ตัวกรองประวัติ" data-own-motion=""
                      style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 71, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
                      <div style={{ width: "100%", maxWidth: 420, background: "#FBF6F5", borderRadius: "20px 20px 0 0", boxShadow: "0 -10px 30px rgba(36,26,24,0.2)",
                        padding: "10px 20px calc(24px + env(safe-area-inset-bottom))", pointerEvents: filterSheetClosing ? "none" : "auto",
                        animation: filterSheetClosing ? "sheetDown 0.16s cubic-bezier(0.5, 0, 0.9, 0.6) forwards" : "sheetUp 0.22s ease" }}>
                        <div style={{ width: 38, height: 4, borderRadius: 2, background: "#E3C8C3", margin: "0 auto 12px" }} />
                        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "#3A2C29" }}>ตัวกรอง</div>
                          <div aria-live="polite" style={{ fontSize: 12, marginLeft: 8, color: shownCount === 0 ? "#B3261E" : "#7A6360", fontWeight: shownCount === 0 ? 600 : 400 }}>
                            {shownCount === 0 ? "ไม่มีรายการ" : `${shownCount} ครั้ง`}
                          </div>
                          {/* One-tap reset back to ทั้งหมด + ทุกปี; only shown while a
                              filter is actually active. */}
                          {draftActive && (
                            <button onClick={() => { setDraftTypeFilter("all"); setDraftYearFilter("all"); }}
                              style={{ marginLeft: "auto", minHeight: 44, margin: "-11px 4px -11px auto", padding: "0 8px", border: "none", background: "none", color: "#9A3B33", fontSize: 12.5, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", fontFamily: "inherit" }}>
                              ล้างตัวกรอง
                            </button>
                          )}
                          <button onClick={closeFilterSheet} aria-label="ปิด"
                            style={{ marginLeft: "auto", width: 44, height: 44, margin: draftActive ? "-11px -11px -11px 0" : "-11px -11px -11px auto", border: "none", background: "none", color: "#3A2C29", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <X size={20} />
                          </button>
                        </div>
                        {hasBothDonationTypes && (
                          <>
                            <div style={{ fontSize: 12, color: "#7A6360", margin: "0 0 8px" }}>ประเภท</div>
                            <div role="radiogroup" aria-label="ประเภท" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                              {[
                                { key: "all", label: "ทั้งหมด" },
                                { key: "whole", label: DONATION_TYPE_LABELS.whole },
                                { key: "component", label: DONATION_TYPE_LABELS.component },
                              ].map(({ key, label }) => {
                                const tint = key === "all" ? { bg: "#F3EAE8", text: "#9A3B33" } : DONATION_TYPE_TINT[key];
                                const selected = draftTypeFilter === key;
                                return (
                                  <button key={key} role="radio" aria-checked={selected} onClick={() => setDraftTypeFilter(key)}
                                    style={{ ...chipBase, fontWeight: 600, border: "none", color: selected ? "#FFF7F5" : tint.text, background: selected ? tint.text : tint.bg }}>
                                    {hit}
                                    {key === "component" ? <Droplets size={12} /> : key === "whole" ? <Droplet size={12} /> : null}
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                        {historyYears.length > 1 && (
                          <>
                            <div style={{ fontSize: 12, color: "#7A6360", margin: "0 0 8px" }}>ปี</div>
                            <div role="radiogroup" aria-label="ปี" style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 220, overflowY: "auto", padding: 2, margin: -2 }}>
                              {["all", ...historyYears].map((y) => {
                                const selected = draftYearFilter === y;
                                return (
                                  <button key={y} role="radio" aria-checked={selected} onClick={() => setDraftYearFilter(y)}
                                    style={{ ...chipBase, fontWeight: selected ? 600 : 400, border: `1px solid ${selected ? "#3A2C29" : "#E3C8C3"}`,
                                      background: selected ? "#3A2C29" : "#FFFFFF", color: selected ? "#FFF7F5" : "#5C4A46" }}>
                                    {hit}
                                    {y === "all" ? "ทุกปี" : y}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                        {/* "เสร็จ" applies the draft filters, then closes. */}
                        <button onClick={() => { setHistoryTypeFilter(draftTypeFilter); setHistoryYearFilter(draftYearFilter); closeFilterSheet(); }}
                          style={{ width: "100%", marginTop: 20, minHeight: 46, border: "none", borderRadius: 12, background: "#9A3B33", color: "#FFF7F5", fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                          เสร็จ
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Whenever the carried-over starting-count summary card below is
                  about to render for the active filter (displayedStartingCount > 0,
                  year filter "all"), it already explains the "no itemized records
                  yet, but there's a carried-over count" situation on its own -- so
                  this empty-state message steps aside instead of showing a redundant
                  second explanation above it. */}
              {totalCount > 0 && filteredHistory.length === 0 && !(historyYearFilter === "all" && displayedStartingCount > 0) && (
                <div style={{ textAlign: "center", padding: "36px 0", color: "#7A6360", fontSize: 13.5 }}>
                  {(() => {
                    if (donations.length === 0) return "ยังไม่มีรายการ กดปุ่มด้านบนเพื่อเริ่มบันทึก";
                    if (historyTypeFilter !== "all" && historyYearFilter !== "all") return `ไม่มีรายการ${DONATION_TYPE_LABELS[historyTypeFilter]}ในปีที่เลือก`;
                    if (historyTypeFilter !== "all") return `ไม่มีรายการ${DONATION_TYPE_LABELS[historyTypeFilter]}`;
                    return "ไม่มีรายการในปีที่เลือก";
                  })()}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {visibleHistory.map((d, i) => {
                  const y = buddhistYear(d.date);
                  const newYear = showHistoryYearDividers && (i === 0 || buddhistYear(visibleHistory[i - 1].date) !== y);
                  return (
                  <React.Fragment key={d.id}>
                  {newYear && (
                    <div role="heading" aria-level={3} aria-label={`ปี ${y} · ${historyYearCounts[y]} ครั้ง`} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, margin: i === 0 ? "2px 2px 0" : "12px 2px 0" }}>
                      <span style={{ fontSize: 24, fontWeight: 600, color: "#B0807A", letterSpacing: 0.5, lineHeight: 1 }}>{y}</span>
                      <span style={{ color: "#7A6360", fontSize: 12 }}>{historyYearCounts[y]} ครั้ง</span>
                    </div>
                  )}
                  <HistoryRow
                    d={d}
                    orderNumber={donationOrderMap[d.id]}
                    isMenuOpen={openActionMenuId === d.id}
                    onToggleMenu={() => setOpenActionMenuId(openActionMenuId === d.id ? null : d.id)}
                    onView={() => { setOpenActionMenuId(null); setViewDonationId(d.id); }}
                    onEdit={() => { setOpenActionMenuId(null); openEditForm(d); }}
                    onShare={() => { setOpenActionMenuId(null); openRecordShareCard(d); }}
                    onDelete={() => { setOpenActionMenuId(null); requestDeleteDonation(d.id); }}
                  />
                  </React.Fragment>
                  );
                })}
                {displayedStartingCount > 0 && historyYearFilter === "all" && filteredHistory.length <= historyVisibleCount && (
                    <div className="hist-card hist-card-carry" role="button" tabIndex={0} aria-label="ดูรายละเอียดยอดสะสมที่เคยบริจาคมาก่อน"
                      onClick={() => { setOpenActionMenuId(null); setViewStartingCount(true); }}
                      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setOpenActionMenuId(null); setViewStartingCount(true); } }}
                      style={{ background: "#F7F0EE", border: "1px dashed #E3C8C3", borderRadius: 14, padding: "13px 6px 13px 13px", display: "flex", gap: 10, justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: "#FFFFFF", border: "1px solid #E3C8C3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, margin: "0 2px" /* 46px column like the droplet badge, so text lines up */ }}>
                        <div style={{ fontSize: String(displayedStartingCount).length >= 3 ? 12 : 14, fontWeight: 800, color: "#9A3B33", lineHeight: 1.1 }}>+{displayedStartingCount}</div>
                        <div style={{ fontSize: 10, color: "#9A3B33", opacity: 0.75, marginTop: 1 }}>สะสม</div>
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        {/* "ทั้งหมด" with both types carried over shows the combined total plus
                            its per-type breakdown; filtering to one specific type (or having
                            only one type carried over at all) instead shows just that type's
                            own figure, matching displayedStartingCount above -- otherwise
                            switching to, say, "พลาสมา/เกล็ดเลือด" would keep showing the
                            combined "เคยบริจาคมาแล้ว 1000 ครั้ง" heading next to a card that's
                            now only about one type (reported directly by the user). */}
                        {historyTypeFilter === "all" && startingCountWholeNum > 0 && startingCountComponentNum > 0 ? (
                          <div>
                            {/* Same type scale as HistoryRow: 14/600 heading with a 12px icon in a 14px box, 12px rows 5px apart. */}
                            <div style={{ fontSize: 14, fontWeight: 600, color: "#3A2C29", lineHeight: 1.5, display: "flex", alignItems: "center", gap: 7 }}>
                              <span style={HIST_ICON_BOX}><Trophy size={12} color="#9A3B33" /></span><span style={{ minWidth: 0 }}>บริจาคมาแล้ว <span style={{ whiteSpace: "nowrap" }}>{startingCountNum} ครั้ง</span></span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5, fontSize: 12, color: "#7A6360" }}><span style={HIST_ICON_BOX}><Clock size={12} color="#9A3B33" /></span> ก่อนเริ่มใช้แอป</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5, fontSize: 12, color: "#7A6360" }}><span style={HIST_ICON_BOX}><Droplet size={12} color="#9A3B33" /></span><span style={{ minWidth: 0 }}>โลหิตรวม <span style={{ whiteSpace: "nowrap" }}>{startingCountWholeNum} ครั้ง</span></span></div>
                            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5, fontSize: 12, color: "#7A6360" }}><span style={HIST_ICON_BOX}><Droplets size={12} color="#9A3B33" /></span><span style={{ minWidth: 0 }}>พลาสมา/เกล็ดเลือด <span style={{ whiteSpace: "nowrap" }}>{startingCountComponentNum} ครั้ง</span></span></div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: "#3A2C29", lineHeight: 1.5, display: "flex", alignItems: "center", gap: 7 }}>
                              <span style={HIST_ICON_BOX}><Trophy size={12} color="#9A3B33" /></span><span style={{ minWidth: 0 }}>บริจาคมาแล้ว <span style={{ whiteSpace: "nowrap" }}>{displayedStartingCount} ครั้ง</span></span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5, fontSize: 12, color: "#7A6360" }}><span style={HIST_ICON_BOX}><Clock size={12} color="#9A3B33" /></span> ก่อนเริ่มใช้แอป</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5, fontSize: 12, color: "#7A6360" }}>
                              {(historyTypeFilter === "component" || (historyTypeFilter === "all" && startingCountComponentNum > 0))
                                ? <><span style={HIST_ICON_BOX}><Droplets size={12} color="#9A3B33" /></span><span style={{ minWidth: 0 }}>พลาสมา/เกล็ดเลือด <span style={{ whiteSpace: "nowrap" }}>{displayedStartingCount} ครั้ง</span></span></>
                                : <><span style={HIST_ICON_BOX}><Droplet size={12} color="#9A3B33" /></span><span style={{ minWidth: 0 }}>โลหิตรวม <span style={{ whiteSpace: "nowrap" }}>{displayedStartingCount} ครั้ง</span></span></>}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="hist-more" onClick={(e) => e.stopPropagation()} style={{ position: "relative", flexShrink: 0 }}>
                        <button onClick={() => setOpenActionMenuId(openActionMenuId === "startingCount" ? null : "startingCount")} aria-label="ตัวเลือกเพิ่มเติม" style={{ background: "none", border: "none", cursor: "pointer", padding: 13.5, margin: "-10px -3px -10px 0", lineHeight: 0 }}>
                          <MoreVertical size={17} color="#9A3B33" />
                        </button>
                        {openActionMenuId === "startingCount" && (
                          <>
                            <div onClick={() => setOpenActionMenuId(null)} style={{ position: "fixed", inset: 0, zIndex: 55 }} />
                            <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 2, background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 12, boxShadow: "0 4px 14px rgba(36,26,24,0.15)", overflow: "hidden", zIndex: 56, minWidth: 120 }}>
                              <button onClick={() => { setOpenActionMenuId(null); openEditStartingCount(); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#3A2C29", fontFamily: "inherit" }}>
                                <Pencil size={14} color="#9A3B33" /> แก้ไข
                              </button>
                              <button onClick={() => { setOpenActionMenuId(null); requestDeleteStartingCount(); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#B3261E", fontFamily: "inherit", borderTop: "1px solid #F3E7E4" }}>
                                <Trash2 size={14} color="#B3261E" /> ลบ
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
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
              <p style={{ fontSize: 12.5, color: "#7A6360", margin: "0 0 18px" }}>ภาพรวมการบริจาคโลหิตของคุณ</p>

              <div style={{ background: "linear-gradient(135deg, #B24A40 0%, #8A2F28 100%)", boxShadow: "0 14px 32px -8px rgba(122,42,35,0.55)", borderRadius: 16, padding: 16, marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 12, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 8, right: 8, width: 60, height: 60 }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="#FFF7F5" style={{ position: "absolute", top: 12, left: 18, opacity: 0.9 }}><path d="M12 2 C12 2 4 12.5 4 17 C4 21 7.6 24 12 24 C16.4 24 20 21 20 17 C20 12.5 12 2 12 2 Z" /></svg>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(255,247,245,0.55)" style={{ position: "absolute", top: 34, left: 0 }}><path d="M12 2 C12 2 4 12.5 4 17 C4 21 7.6 24 12 24 C16.4 24 20 21 20 17 C20 12.5 12 2 12 2 Z" /></svg>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="rgba(255,247,245,0.4)" style={{ position: "absolute", top: 0, left: 0 }}><path d="M12 2 C12 2 4 12.5 4 17 C4 21 7.6 24 12 24 C16.4 24 20 21 20 17 C20 12.5 12 2 12 2 Z" /></svg>
                </div>
                <span style={{ display: "flex", flexShrink: 0, marginTop: 1, color: "#FFF7F5", position: "relative", zIndex: 1 }}>
                  {!dashboardShownLastDateStr && (hasBothDonationTypes || totalCount > 0) && dashboardShownTotalCount > 0
                    ? <Info size={20} />
                    : dashboardShownIsEligible ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                </span>
                <div style={{ flex: 1, position: "relative", zIndex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#FFF7F5" }}>วันบริจาคโลหิตครั้งถัดไป</div>
                  <div key={dashboardShownType} aria-live="polite" style={{ animation: "fadeSwap 0.4s ease" }}>
                    <div style={{ fontSize: 12.5, color: "#FFF7F5", opacity: 0.9, lineHeight: 1.5 }}>
                      {dashboardShownLastDateStr ? (
                        dashboardShownIsEligible
                          ? "บริจาคได้แล้ววันนี้"
                          : `บริจาคครั้งถัดไปได้ตั้งแต่ ${toBuddhistDate(dashboardShownNextEligible)} (อีก ${dashboardShownDaysLeft} วัน)`
                      ) : hasBothDonationTypes || totalCount > 0 ? (
                        dashboardShownTotalCount > 0
                          ? "กรุณาบันทึกวันที่บริจาคล่าสุดเพื่อคำนวณวันครบกำหนดถัดไป"
                          : `ยังไม่มีประวัติการบริจาค${DONATION_TYPE_LABELS[dashboardShownType]}ในระบบ`
                      ) : "ยังไม่มีประวัติการบริจาค"}
                    </div>
                    {dashboardShownLastDateStr && (
                      <div style={{ height: 6, borderRadius: 3, background: "rgba(255,247,245,0.3)", overflow: "hidden", marginTop: 10 }}>
                        <div style={{
                          width: dashboardShownIsEligible ? "100%" : `${Math.min(100, Math.max(2, Math.round(((dashboardShownCycleDays - dashboardShownDaysLeft) / dashboardShownCycleDays) * 100)))}%`,
                          height: "100%", borderRadius: 3, background: "#FFF7F5", transition: "width 0.5s ease",
                        }} />
                      </div>
                    )}
                  </div>
                  {hasBothDonationTypes && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                      {["whole", "component"].map((t) => (
                        <button key={t} onClick={() => setDashboardRotateType(t)} style={{
                          display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 20, whiteSpace: "nowrap",
                          fontFamily: "inherit", border: "none", cursor: "pointer",
                          color: dashboardShownType === t ? "#9A3B33" : "#FFF7F5",
                          background: dashboardShownType === t ? "#FFF7F5" : "rgba(255,247,245,0.18)",
                          transition: "background 0.35s ease, color 0.35s ease",
                        }}>
                          {t === "component" ? <Droplets size={11} style={{ flexShrink: 0 }} /> : <Droplet size={11} style={{ flexShrink: 0 }} />}
                          {DONATION_TYPE_LABELS[t]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {last && (
                <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 16, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "#3A2C29" }}>บริจาคโลหิตครั้งล่าสุด</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#3A2C29" }}>{toBuddhistDate(last.date)}</div>
                    <div style={{ fontSize: 13, color: "#9A3B33", fontWeight: 700, background: "#F3EAE8", padding: "5px 12px", borderRadius: 20, flexShrink: 0, whiteSpace: "nowrap" }}>
                      ครั้งที่ {donationOrderMap[last.id]}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "#7A6360", marginTop: 2 }}>
                    {last.type === "component" ? <Droplets size={11} color="#9A3B33" style={{ flexShrink: 0 }} /> : <Droplet size={11} color="#9A3B33" style={{ flexShrink: 0 }} />}
                    {DONATION_TYPE_LABELS[last.type === "component" ? "component" : "whole"]}{last.location ? ` • ${last.location}` : ""}
                  </div>
                </div>
              )}

              {/* Every card in this group is full-width (they all used to
                  carry gridColumn: "span 2" back when this was a 2-column
                  grid) — simplified to a plain stacked flex column since the
                  2-column axis is no longer used anywhere here. */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 16, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "#3A2C29" }}>บริจาคโลหิตสะสม</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>
                    {totalCount} <span style={{ fontSize: 12, fontWeight: 500 }}>ครั้ง</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#7A6360", marginTop: 2 }}>ข้อมูล ณ วันที่ {toBuddhistDateTime(dashboardLoadedAt)}</div>
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "nowrap", gap: 8, marginTop: 10, paddingTop: 10, borderTop: "1px solid #F3E7E4", fontSize: 11.5, color: "#5C4A46", overflow: "hidden" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}><Droplet size={12} color="#9A3B33" style={{ flexShrink: 0 }} /> โลหิตรวม <b>{wholeTotalCount}</b> ครั้ง</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}><Droplets size={12} color="#9A3B33" style={{ flexShrink: 0 }} /> พลาสมา/เกล็ดเลือด <b>{componentTotalCount}</b> ครั้ง</span>
                  </div>
                </div>
                <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 16, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "#3A2C29" }}>ปริมาณโลหิตสะสม</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>
                    {(stats.estVolumeMl / 1000).toFixed(stats.estVolumeMl % 1000 === 0 ? 0 : 1)} <span style={{ fontSize: 12, fontWeight: 500 }}>ลิตร (โดยประมาณ)</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#7A6360", marginTop: 2 }}>คำนวณที่ 350 มล./ครั้ง</div>
                  {/* Compared with the donor's own blood volume (design 6 of
                      profile-gender-height-designs.html) once gender, height
                      and weight are in the profile. */}
                  {totalCount > 0 && (() => {
                    const bodyL = estimateBloodVolumeL(gender, height, weight);
                    if (!bodyL) {
                      return (
                        <button onClick={openProfile}
                          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", marginTop: 10, padding: "10px 12px", background: "#FDF6F4", border: "1px dashed #E3C8C3", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                          <span style={{ flex: 1, fontSize: 12, color: "#5C4A46", lineHeight: 1.5 }}>เลือดคุณมีกี่ลิตร? ใส่เพศ ส่วนสูง และน้ำหนักในโปรไฟล์ เพื่อเทียบกับที่ให้ไปทั้งหมด</span>
                          <ChevronRight size={16} color="#9A3B33" aria-hidden="true" style={{ flexShrink: 0 }} />
                        </button>
                      );
                    }
                    const times = stats.estVolumeMl / 1000 / bodyL;
                    const full = Math.floor(times);
                    const frac = times - full;
                    const shown = Math.min(full, 10);
                    const drop = (fill, i) => (
                      <svg key={i} width="20" height="26" viewBox="0 0 24 30" aria-hidden="true" style={{ flexShrink: 0 }}>
                        <defs><clipPath id={`bvdrop-${i}`}><path d="M12 1C9.5 7.5 2 12.5 2 19a10 10 0 0 0 20 0C22 12.5 14.5 7.5 12 1Z" /></clipPath></defs>
                        <path d="M12 1C9.5 7.5 2 12.5 2 19a10 10 0 0 0 20 0C22 12.5 14.5 7.5 12 1Z" fill="#F3EAE8" />
                        <rect x="0" y={30 - 30 * fill} width="24" height={30 * fill} fill="#9A3B33" clipPath={`url(#bvdrop-${i})`} />
                      </svg>
                    );
                    return (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #F3E7E4" }}>
                        <div style={{ fontSize: 12.5, color: "#5C4A46" }}>
                          {times >= 1 ? <>เท่ากับเลือดทั้งตัวคุณ <b style={{ color: "#9A3B33" }}>{times.toFixed(1)} เท่า</b></> : <>เท่ากับ <b style={{ color: "#9A3B33" }}>{Math.round(times * 100)}%</b> ของเลือดทั้งตัวคุณ</>}
                        </div>
                        <div aria-hidden="true" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 8 }}>
                          {Array.from({ length: shown }, (_, i) => drop(1, i))}
                          {full <= 10 && frac > 0.05 && drop(frac, "f")}
                          {full > 10 && <span style={{ fontSize: 11.5, color: "#7A6360" }}>+{full - 10}</span>}
                        </div>
                        <div style={{ fontSize: 11.5, color: "#7A6360", marginTop: 6 }}>เลือดในร่างกายประมาณ {bodyL.toFixed(1)} ลิตร · ครั้งละ 350 มล. ≈ {Math.round(0.35 / bodyL * 100)}% (คำนวณจากเพศ ส่วนสูง น้ำหนัก)</div>
                      </div>
                    );
                  })()}
                  {totalCount > 0 && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #F3E7E4" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#5C4A46" }}>
                        <HeartPulse size={14} color="#9A3B33" style={{ flexShrink: 0 }} />
                        อาจช่วยเหลือผู้ป่วยได้ถึง <b>{wholeTotalCount * 3 + componentTotalCount}</b> คน
                      </div>
                      {hasBothDonationTypes && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "#7A6360", whiteSpace: "nowrap" }}>
                            <Droplet size={10} color="#B39B96" style={{ flexShrink: 0 }} /> โลหิตรวม 1 ครั้ง ≈ 3 คน
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "#7A6360", whiteSpace: "nowrap" }}>
                            <Droplets size={10} color="#B39B96" style={{ flexShrink: 0 }} /> พลาสมา/เกล็ดเลือด 1 ครั้ง ≈ 1 คน
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 16, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "#3A2C29" }}>ระยะห่างเฉลี่ยต่อครั้ง</div>
                  {hasBothDonationTypes ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {/* flexWrap: "wrap" on the row + whiteSpace: "nowrap" on
                          each text chunk lets the row wrap as whole
                          label/value/extra units under narrow width or
                          font-zoom, instead of breaking mid-syllable —
                          Thai script has no spaces to guide default line
                          breaking, which is what fractured a similar row in
                          the busiest-year card next to this one. */}
                      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 5, fontSize: 11.5, color: "#5C4A46" }}>
                        <Droplet size={11} color="#9A3B33" style={{ flexShrink: 0 }} />
                        <span style={{ whiteSpace: "nowrap" }}>โลหิตรวม <b style={{ fontSize: 13, color: "#3A2C29" }}>{stats.avgGapWhole ?? "—"}{stats.avgGapWhole != null ? " วัน" : ""}</b></span>
                        {stats.lastGapWhole != null ? <span style={{ fontSize: 11.5, color: "#7A6360", whiteSpace: "nowrap" }}>(ล่าสุด {stats.lastGapWhole} วัน)</span> : null}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 5, fontSize: 11.5, color: "#5C4A46" }}>
                        <Droplets size={11} color="#9A3B33" style={{ flexShrink: 0 }} />
                        <span style={{ whiteSpace: "nowrap" }}>พลาสมา/เกล็ดเลือด <b style={{ fontSize: 13, color: "#3A2C29" }}>{stats.avgGapComponent ?? "—"}{stats.avgGapComponent != null ? " วัน" : ""}</b></span>
                        {stats.lastGapComponent != null ? <span style={{ fontSize: 11.5, color: "#7A6360", whiteSpace: "nowrap" }}>(ล่าสุด {stats.lastGapComponent} วัน)</span> : null}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.avgGap ?? "—"}{stats.avgGap != null ? <span style={{ fontSize: 12, fontWeight: 500 }}> วัน</span> : ""}</div>
                      {stats.avgGap != null ? <div style={{ fontSize: 11.5, color: "#7A6360", marginTop: 2 }}>เฉลี่ย {(stats.avgGap / 30).toFixed(1)} เดือนต่อครั้ง</div> : null}
                      {stats.lastGap != null ? (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #F3E7E4", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, fontSize: 11.5, color: "#5C4A46" }}>
                          <Clock size={11} color="#9A3B33" style={{ flexShrink: 0 }} />
                          <span style={{ whiteSpace: "nowrap" }}><span style={{ color: "#7A6360", fontWeight: 600 }}>ห่างจากครั้งก่อนหน้า</span> <b style={{ color: "#3A2C29" }}>{stats.lastGap} วัน</b></span>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
                <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 16, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "#3A2C29" }}>ปีที่บริจาคโลหิตมากที่สุด</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.busiestYear ? `ปี ${stats.busiestYear}` : "—"}</div>
                  <div style={{ fontSize: 11.5, color: "#7A6360", marginTop: 2 }}>
                    {stats.busiestYear ? `จำนวน ${stats.busiestCount} ครั้ง` : "ยังไม่มีข้อมูลพอ"}
                  </div>
                  {stats.busiestYear && String(buddhistYear(new Date())) === String(stats.busiestYear) ? (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #F3E7E4", fontSize: 11.5, color: "#9A6B0B", fontWeight: 600, lineHeight: 1.5 }}>
                      🏆 ปีนี้คือปีที่บริจาคมากที่สุด!
                    </div>
                  ) : stats.thisYearCount > 0 ? (
                    // A single flex row here used to split "ปีนี้"/"3"/"ครั้ง"/etc
                    // into separate flex items, each of which wrapped
                    // independently — Thai script has no spaces to guide the
                    // browser's line breaks, so a narrow half-width card
                    // fractured words mid-syllable across jumbled lines.
                    // Two short stacked block lines fit this card width
                    // cleanly instead.
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #F3E7E4" }}>
                      <div style={{ fontSize: 11.5, color: "#5C4A46" }}>
                        <span style={{ color: "#7A6360", fontWeight: 600 }}>ปีนี้</span> <b style={{ color: "#3A2C29" }}>{stats.thisYearCount} ครั้ง</b>
                      </div>
                      <div style={{ fontSize: 11.5, color: "#7A6360", marginTop: 2 }}>
                        ห่างจากสถิติ {stats.busiestCount - stats.thisYearCount} ครั้ง
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {stats.thisYearCount > 0 && (
                <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 16, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "#3A2C29" }}>ความคืบหน้าปีนี้</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 11.5, color: "#7A6360" }}>ปี {buddhistYear(new Date())} บริจาคไปแล้ว</div>
                      <div style={{ fontSize: 19, fontWeight: 700, marginTop: 2 }}>{stats.thisYearCount} ครั้ง</div>
                    </div>
                    {stats.lastYearCount > 0 ? (
                      <div style={{ textAlign: "right" }}>
                        <div style={{
                          display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 700, borderRadius: 20, padding: "4px 10px",
                          color: stats.thisYearCount >= stats.lastYearCount ? "#2E7D32" : "#9C5515",
                          background: stats.thisYearCount >= stats.lastYearCount ? "#E7F3E8" : "#FDF0E6",
                        }}>
                          {stats.thisYearCount >= stats.lastYearCount ? "▲" : "▼"} {stats.thisYearCount >= stats.lastYearCount ? "+" : ""}{stats.thisYearCount - stats.lastYearCount} จากปี {buddhistYear(new Date()) - 1}
                        </div>
                        <div style={{ fontSize: 11.5, color: "#7A6360", marginTop: 5 }}>ปีก่อน: {stats.lastYearCount} ครั้ง</div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: "#B39B96", textAlign: "right", maxWidth: 130, lineHeight: 1.5 }}>ปีก่อนหน้ายังไม่มีข้อมูลให้เทียบ</div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 16, padding: "16px 12px 8px", marginBottom: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, paddingLeft: 4, color: "#3A2C29" }}>สถิติการบริจาคโลหิตรายปี</div>
                {stats.yearData.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 0", color: "#B39B96", fontSize: 13 }}>ยังไม่มีข้อมูลให้แสดงกราฟ</div>
                ) : (
                  <div ref={yearChartScrollRef} className="no-scrollbar" style={{ width: "100%", height: 180, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                    <div style={{ width: stats.yearData.length > YEAR_CHART_VISIBLE_COUNT ? `${Math.round((stats.yearData.length / YEAR_CHART_VISIBLE_COUNT) * 100)}%` : "100%", minWidth: "100%", height: "100%" }}>
                      <React.Suspense fallback={<div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#7A6360" }}>กำลังโหลดกราฟ…</div>}>
                        <YearAreaChart data={stats.yearData} />
                      </React.Suspense>
                    </div>
                  </div>
                )}
                {stats.yearData.length > YEAR_CHART_VISIBLE_COUNT && (
                  <div style={{ textAlign: "center", fontSize: 11.5, color: "#7A6360", marginTop: 2 }}>← เลื่อนดูปีก่อนหน้าได้</div>
                )}
                {startingCountNum > 0 && (
                  <p style={{ fontSize: 11.5, color: "#7A6360", margin: "8px 4px 4px", lineHeight: 1.5 }}>
                    * ไม่รวมยอดสะสมยกมา {startingCountNum} ครั้ง เนื่องจากไม่มีวันที่รายครั้งให้แสดงในกราฟ (แต่รวมอยู่ในจำนวนครั้งสะสมและปริมาณโลหิตด้านบนแล้ว)
                  </p>
                )}
              </div>

              {stats.maxMonthCount > 0 && (
                <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 16, padding: 16, marginBottom: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, color: "#3A2C29" }}>เดือนที่บริจาคโลหิตบ่อยที่สุด</div>
                  {stats.busiestMonthIdx !== null && (
                    <div style={{ fontSize: 11.5, color: "#7A6360", marginBottom: 12 }}>
                      {stats.monthData[stats.busiestMonthIdx].month} ({stats.maxMonthCount} ครั้ง)
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {stats.monthData.map((m, i) => (
                      <div key={m.month} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "#7A6360", width: 28, flexShrink: 0 }}>{m.month}</span>
                        <div style={{ flex: 1, height: 8, borderRadius: 4, background: "#F3EAE8", overflow: "hidden" }}>
                          <div style={{
                            width: m.count > 0 ? `${Math.max(6, Math.round((m.count / stats.maxMonthCount) * 100))}%` : "0%",
                            height: "100%", borderRadius: 4,
                            background: i === stats.busiestMonthIdx ? "#9A3B33" : "#D9A9A2",
                          }} />
                        </div>
                        <span style={{ fontSize: 11, color: "#7A6360", width: 34, flexShrink: 0, textAlign: "right" }}>{m.count} ครั้ง</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(wholeTotalCount + componentTotalCount) > 0 && (
                <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 16, padding: 16, marginBottom: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "#3A2C29" }}>สัดส่วนการบริจาคโลหิตแต่ละประเภท</div>
                  {(() => {
                    const total = wholeTotalCount + componentTotalCount;
                    const wholePct = Math.round((wholeTotalCount / total) * 100);
                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                        <div style={{ position: "relative", width: 96, height: 96, flexShrink: 0 }}>
                          <svg width="96" height="96" viewBox="0 0 36 36" style={{ transform: "rotate(-90deg)" }}>
                            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#F3EAE8" strokeWidth="5" />
                            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#9A3B33" strokeWidth="5" strokeDasharray={`${wholePct} 100`} pathLength="100" strokeLinecap="round" />
                          </svg>
                          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ fontSize: 16, fontWeight: 700, color: "#3A2C29" }}>{total}</div>
                            <div style={{ fontSize: 11, color: "#7A6360" }}>ครั้ง</div>
                          </div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: "#9A3B33", flexShrink: 0 }} /> โลหิตรวม</span>
                            <span style={{ color: "#7A6360" }}>{wholeTotalCount} ครั้ง ({wholePct}%)</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: "#F3EAE8", border: "1px solid #E3C8C3", flexShrink: 0 }} /> พลาสมา/เกล็ดเลือด</span>
                            <span style={{ color: "#7A6360" }}>{componentTotalCount} ครั้ง ({100 - wholePct}%)</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {topLocations.length > 0 && (
                <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 16, padding: 16, marginBottom: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "#3A2C29" }}>สถานที่ที่บริจาคโลหิตบ่อยที่สุด</div>
                  {topLocations.map((loc, i) => (
                    <div key={loc.location} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: i === topLocations.length - 1 ? "none" : "1px solid #F3E7E4" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", background: "#F3EAE8", color: "#9A3B33", fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ fontSize: 12.5, color: "#3A2C29", wordBreak: "break-word" }}>{loc.location}</span>
                      </div>
                      <span style={{ fontSize: 12, color: "#7A6360", flexShrink: 0, marginLeft: 8 }}>{loc.count} ครั้ง</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "missions" && (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: "#3A2C29" }}>ภารกิจนักบริจาค</div>
              <p style={{ fontSize: 12.5, color: "#7A6360", margin: "0 0 16px" }}>สะสมความสำเร็จและเตรียมตัวให้พร้อมทุกครั้งที่บริจาค</p>

              {stats.nextAchievement && (
                <div style={{ background: "linear-gradient(135deg, #B24A40 0%, #8A2F28 100%)", boxShadow: "0 14px 32px -8px rgba(122,42,35,0.55)", borderRadius: 16, padding: "16px 18px", color: "#FFF7F5", marginBottom: 16 }}>
                  {/* Design "2" from missions-card-ring-6-designs.html: same
                      layout as the home tab's mission card (reward name bold,
                      "อีก N ครั้ง" under it, done/goal ring on the right) in
                      white-on-red, with the pace estimate folded into the
                      second line instead of its own row under a progress bar. */}
                  {(() => {
                    const goal = stats.nextAchievement.threshold;
                    const done = Math.min(totalCount, goal);
                    const left = goal - totalCount;
                    const size = 58, stroke = 5, r = (size - stroke) / 2, circ = 2 * Math.PI * r;
                    const frac = goal > 0 ? done / goal : 0;
                    let eta = null;
                    if (stats.avgGap != null) {
                      const months = left * stats.avgGap / 30;
                      eta = months < 1 ? "ไม่ถึงเดือน" : `ประมาณ ${Math.round(months)} เดือน`;
                    }
                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>ภารกิจถัดไป</div>
                          <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.35 }}>{stats.nextAchievement.title}</div>
                          <div style={{ fontSize: 12.5, opacity: 0.85, marginTop: 2 }}>
                            อีก {left} ครั้ง{eta && <> · <span title="คำนวณจากระยะห่างเฉลี่ยระหว่างการบริจาคที่ผ่านมา">{eta}</span></>}
                          </div>
                        </div>
                        <div role="progressbar" aria-label={`ความคืบหน้าไปถึง "${stats.nextAchievement.title}" ${done} จาก ${goal} ครั้ง`} aria-valuemin={0} aria-valuemax={goal} aria-valuenow={done}
                          style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
                          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
                            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,247,245,0.28)" strokeWidth={stroke} />
                            {frac > 0 && (
                              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#FFF7F5" strokeWidth={stroke} strokeLinecap="round"
                                strokeDasharray={`${circ * frac} ${circ}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
                            )}
                          </svg>
                          <div aria-hidden="true" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: `${done}/${goal}`.length > 5 ? 11 : 13.5, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                            {done}<span style={{ opacity: 0.75, fontWeight: 600 }}>/{goal}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
                <button
                  onClick={openShareCard}
                  disabled={totalCount === 0 || sharingCard}
                  className="btn-ghost"
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10, fontSize: 12, whiteSpace: "nowrap", cursor: totalCount === 0 ? "not-allowed" : "pointer" }}>
                  <Share2 size={14} /> {sharingCard ? "กำลังสร้าง..." : "แชร์การให้ที่ยิ่งใหญ่ของคุณ"}
                </button>
              </div>

              <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 16, padding: 14, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#9A3B33" }}>เข็มที่ระลึก</div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: "#9A3B33" }}>
                    ปลดล็อกแล้ว {pinAchievements.filter(a => totalCount >= a.threshold).length}/{pinAchievements.length}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {pinAchievements.map((a) => {
                    const unlocked = totalCount >= a.threshold;
                    const isNext = !unlocked && stats.nextAchievement && a.id === stats.nextAchievement.id;
                    return (
                      <div key={a.id} style={{
                        position: "relative",
                        background: unlocked ? "#FBF6F5" : isNext ? "#FDF0EE" : "#F3EAE8",
                        border: unlocked ? "1px solid #F3E7E4" : isNext ? "1px solid #9A3B33" : "1px solid #EEDEDA",
                        borderRadius: 14, padding: 14, opacity: unlocked ? 1 : isNext ? 0.9 : 0.6,
                        boxShadow: unlocked ? "0 6px 14px -6px rgba(154,59,51,0.3)" : "none",
                      }}>
                        {isNext && (
                          <span style={{ position: "absolute", top: -8, left: 12, fontSize: 11, fontWeight: 700, color: "#FFF7F5", background: "#9A3B33", padding: "2px 8px", borderRadius: 10, whiteSpace: "nowrap" }}>ถัดไป</span>
                        )}
                        <div style={{ height: 40, display: "flex", alignItems: "center", marginBottom: 10 }}>
                          {unlocked ? (
                            <AchievementIcon achievement={a} isMonk={donorType === "monk"} size={26} />
                          ) : (
                            <div style={{ width: 34, height: 34, borderRadius: 9, background: "#D8C6C2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Lock size={15} color="#7A6360" />
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#3A2C29", marginBottom: 3 }}>{a.title}</div>
                        <div style={{ fontSize: 11, color: "#7A6360", lineHeight: 1.5 }}>
                          {unlocked ? a.desc : `อีก ${a.threshold - totalCount} ครั้งจะปลดล็อก`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 16, padding: 14, marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#9A3B33" }}>
                    {donorType === "monk" ? "พัดกาชาด" : "เหรียญกาชาดสมนาคุณ"}
                  </div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: "#9A3B33" }}>
                    ปลดล็อกแล้ว {medalAchievements.filter(a => totalCount >= a.threshold).length}/{medalAchievements.length}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {medalAchievements.map((a) => {
                    const unlocked = totalCount >= a.threshold;
                    const isNext = !unlocked && stats.nextAchievement && a.id === stats.nextAchievement.id;
                    return (
                      <div key={a.id} style={{
                        position: "relative",
                        background: unlocked ? "#FBF6F5" : isNext ? "#FDF0EE" : "#F3EAE8",
                        border: unlocked ? "1px solid #F3E7E4" : isNext ? "1px solid #9A3B33" : "1px solid #EEDEDA",
                        borderRadius: 14, padding: 14, opacity: unlocked ? 1 : isNext ? 0.9 : 0.6,
                        boxShadow: unlocked ? "0 6px 14px -6px rgba(154,59,51,0.3)" : "none",
                      }}>
                        {isNext && (
                          <span style={{ position: "absolute", top: -8, left: 12, fontSize: 11, fontWeight: 700, color: "#FFF7F5", background: "#9A3B33", padding: "2px 8px", borderRadius: 10, whiteSpace: "nowrap" }}>ถัดไป</span>
                        )}
                        <div style={{ height: 40, display: "flex", alignItems: "center", marginBottom: 10 }}>
                          {unlocked ? (
                            <AchievementIcon achievement={a} isMonk={donorType === "monk"} size={26} />
                          ) : (
                            <div style={{ width: 34, height: 34, borderRadius: 9, background: "#D8C6C2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Lock size={15} color="#7A6360" />
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#3A2C29", marginBottom: 3, lineHeight: 1.35 }}>{a.title}</div>
                        <div style={{ fontSize: 11, color: "#7A6360", lineHeight: 1.5 }}>
                          {unlocked ? a.desc : `อีก ${a.threshold - totalCount} ครั้ง`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ height: 1, background: "#EEDEDA", margin: "8px 0 12px" }} />
              <p style={{ fontSize: 11, color: "#B39B96", lineHeight: 1.6, margin: "0 0 8px", textAlign: "left" }}>
                เกณฑ์สำหรับเข็มที่ระลึก และเหรียญกาชาดสมนาคุณ/<span style={{ whiteSpace: "nowrap" }}>พัดกาชาด</span> อ้างอิงข้อมูลจากศูนย์บริการโลหิตแห่งชาติ สภากาชาดไทย โปรดยืนยันสิทธิ์ที่ได้รับจริงกับเจ้าหน้าที่ ณ จุดบริจาค
              </p>

            </>
          )}

          {tab === "knowledge" && (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#3A2C29", marginBottom: 4 }}>ให้ความรู้เรื่องการบริจาคโลหิต</div>
              <p style={{ fontSize: 12.5, color: "#7A6360", margin: "0 0 18px", lineHeight: 1.6 }}>
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
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 0", borderBottom: i < ELIGIBILITY_CRITERIA.length - 1 ? "1px solid #F3E7E4" : "none" }}>
                      <Icon size={16} color="#9A3B33" style={{ marginTop: 1, flexShrink: 0 }} />
                      <div style={{ fontSize: 13, color: "#3A2C29", lineHeight: 1.6 }}>{t.text}</div>
                    </div>
                  );
                })}
              </div>

              <div id="pre-donation-tips" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, scrollMarginTop: "calc(60px + env(safe-area-inset-top) + 16px)" }}>
                <BookOpen size={16} color="#9A3B33" />
                <div style={{ fontSize: 14, fontWeight: 700, color: "#3A2C29" }}>เตรียมตัวก่อนบริจาค</div>
              </div>
              <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 14, padding: "6px 15px", marginBottom: 18 }}>
                {PRE_DONATION_TIPS.map((t, i) => {
                  const Icon = t.icon;
                  return (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 0", borderBottom: i < PRE_DONATION_TIPS.length - 1 ? "1px solid #F3E7E4" : "none" }}>
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
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 0", borderBottom: i < POST_DONATION_TIPS.length - 1 ? "1px solid #F3E7E4" : "none" }}>
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
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 0", borderBottom: i < DONATION_MYTHS.length - 1 ? "1px solid #F3E7E4" : "none" }}>
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
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 0", borderBottom: i < DONATION_BENEFITS.length - 1 ? "1px solid #F3E7E4" : "none" }}>
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

          {tab === "eligibility" && (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#3A2C29", marginBottom: 4 }}>เช็คคุณสมบัติก่อนบริจาคโลหิต</div>
              <p style={{ fontSize: 12.5, color: "#7A6360", margin: "0 0 18px", lineHeight: 1.6 }}>
                เช็คเบื้องต้นจากข้อมูลโปรไฟล์และประวัติที่คุณบันทึกไว้ในแอปเอง — เป็นข้อมูลเบื้องต้นเท่านั้น ไม่ใช่การวินิจฉัยทางการแพทย์และไม่ผูกกับระบบของสภากาชาดไทย
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <ShieldCheck size={16} color="#9A3B33" />
                <div style={{ fontSize: 14, fontWeight: 700, color: "#3A2C29" }}>เช็คอัตโนมัติจากข้อมูลของคุณ</div>
              </div>
              <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 14, padding: "6px 15px", marginBottom: 10 }}>
                <EligibilityCheckRow label="อายุ" status={ageCheck.status} detail={ageCheck.detail} />
                <div style={{ borderTop: "1px solid #F3E7E4" }} />
                <EligibilityCheckRow label="น้ำหนัก" status={weightCheck.status} detail={weightCheck.detail} />
                <div style={{ borderTop: "1px solid #F3E7E4" }} />
                <EligibilityCheckRow label="ระยะห่างจากการบริจาคครั้งก่อน" status={intervalCheck.status} detail={intervalCheck.detail} />
              </div>
              {(ageCheck.status === "unknown" || weightCheck.status === "unknown") && (
                <button onClick={openProfile} style={{ display: "inline-block", marginBottom: 18, background: "none", border: "none", padding: 0, fontSize: 12.5, color: "#9A3B33", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" }}>
                  ไปกรอกข้อมูลโปรไฟล์
                </button>
              )}
              {ageCheck.status !== "unknown" && weightCheck.status !== "unknown" && <div style={{ marginBottom: 8 }} />}

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Info size={16} color="#9A3B33" />
                <div style={{ fontSize: 14, fontWeight: 700, color: "#3A2C29" }}>เกณฑ์อื่น ๆ ที่ต้องประเมินเอง</div>
              </div>
              <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 14, padding: "6px 15px", marginBottom: 18 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 0", borderBottom: "1px solid #F3E7E4" }}>
                  <AlertTriangle size={16} color="#9A3B33" style={{ marginTop: 1, flexShrink: 0 }} />
                  <div style={{ fontSize: 13, color: "#3A2C29", lineHeight: 1.6 }}>ไม่มีไข้หรืออาการป่วยในช่วง 14 วันที่ผ่านมา</div>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 0" }}>
                  <ShieldCheck size={16} color="#9A3B33" style={{ marginTop: 1, flexShrink: 0 }} />
                  <div style={{ fontSize: 13, color: "#3A2C29", lineHeight: 1.6 }}>ไม่มีพฤติกรรมเสี่ยงตามเกณฑ์ของสภากาชาดไทย</div>
                </div>
              </div>

              <p style={{ fontSize: 11, color: "#B39B96", lineHeight: 1.6 }}>
                ผลเช็คนี้เป็นเพียงข้อมูลเบื้องต้นจากสิ่งที่คุณกรอกไว้ในแอปเท่านั้น กรุณายืนยันคุณสมบัติจริงกับเจ้าหน้าที่ ณ จุดบริจาคทุกครั้ง
              </p>
            </>
          )}

          {tab === "faq" && (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#3A2C29", marginBottom: 4 }}>คำถามที่พบบ่อย</div>
              <p style={{ fontSize: 12.5, color: "#7A6360", margin: "0 0 18px", lineHeight: 1.6 }}>
                คำถามที่พบบ่อยเกี่ยวกับการใช้งานแอปนี้
              </p>

              <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 14, padding: "0 15px", marginBottom: 18 }}>
                {APP_FAQ_ITEMS.map((item, i) => {
                  const isOpen = openFaqIndex === i;
                  return (
                    <div key={i} style={{ borderBottom: i < APP_FAQ_ITEMS.length - 1 ? "1px solid #F3E7E4" : "none" }}>
                      <button
                        onClick={() => setOpenFaqIndex(isOpen ? null : i)}
                        aria-expanded={isOpen}
                        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "13px 0", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
                      >
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: "#3A2C29", lineHeight: 1.5 }}>{item.q}</span>
                        <span style={{ fontSize: 16, color: "#9A3B33", flexShrink: 0, lineHeight: 1 }}>{isOpen ? "−" : "+"}</span>
                      </button>
                      {isOpen && (
                        <div style={{ fontSize: 12.5, color: "#5C4A46", lineHeight: 1.7, padding: "0 0 14px" }}>
                          {item.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <p style={{ fontSize: 11, color: "#B39B96", lineHeight: 1.6 }}>
                ไม่พบคำตอบที่ต้องการ? แจ้งผ่านปุ่ม "แจ้งปัญหา" ในริชเมนูของ LINE Official Account ได้เลย
              </p>
            </>
          )}

        </div>
      )}

      {phase === "app" && (
        <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleImportFile} style={{ display: "none" }} aria-label="เลือกไฟล์สำรองข้อมูล" />
      )}

      {phase === "app" && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 40 }}>
          <div style={{ width: "100%", maxWidth: 420, background: "#FFFFFF", borderTop: "1px solid #EEDEDA", display: "flex", padding: "8px 20px calc(8px + env(safe-area-inset-bottom))" }}>
            <button onClick={() => setTab("home")} aria-label="หน้าหลัก" aria-current={tab === "home" ? "page" : undefined} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 0", color: tab === "home" ? "#9A3B33" : "#7A6360" }}>
              <Home size={19} />
              <span style={{ fontSize: 11, fontWeight: 600 }}>หน้าหลัก</span>
            </button>
            <button onClick={() => setTab("dashboard")} aria-label="แดชบอร์ด" aria-current={tab === "dashboard" ? "page" : undefined} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 0", color: tab === "dashboard" ? "#9A3B33" : "#7A6360" }}>
              <BarChart3 size={19} />
              <span style={{ fontSize: 11, fontWeight: 600 }}>แดชบอร์ด</span>
            </button>
            <button onClick={() => setTab("missions")} aria-label={hasNewAchievement ? "ภารกิจ (มีความสำเร็จใหม่)" : "ภารกิจ"} aria-current={tab === "missions" ? "page" : undefined} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 0", color: tab === "missions" ? "#9A3B33" : "#7A6360" }}>
              <div style={{ position: "relative" }}>
                <Trophy size={19} />
                {hasNewAchievement && (
                  <span aria-hidden="true" style={{ position: "absolute", top: -2, right: -3, width: 8, height: 8, borderRadius: "50%", background: "#B3261E", border: "1.5px solid #FFFFFF" }} />
                )}
              </div>
              <span style={{ fontSize: 11, fontWeight: 600 }}>ภารกิจ</span>
            </button>
            <button onClick={() => setTab("knowledge")} aria-label="ให้ความรู้" aria-current={tab === "knowledge" ? "page" : undefined} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 0", color: tab === "knowledge" ? "#9A3B33" : "#7A6360" }}>
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

      {showStorageDegradedModal && (
        // One-time-per-session heads-up the moment storage.isDegraded()
        // first flips true (see checkStorageHealth) — the persistent home-tab
        // banner above stays up after this is dismissed as an ongoing
        // reminder, but this modal makes sure the donor actually sees the
        // warning at least once rather than risking they never scroll past
        // a banner they didn't notice.
        <div role="dialog" aria-modal="true" aria-label="บันทึกข้อมูลถาวรไม่ได้ตอนนี้" style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80, padding: 20 }}>
          <div style={{ position: "relative", background: "#FFFFFF", borderRadius: 16, padding: "20px 18px", maxWidth: 300, textAlign: "center" }}>
            <DialogX onClick={() => setShowStorageDegradedModal(false)} style={{ position: "absolute", top: 14, right: 14 }} />
            <div aria-hidden="true" style={{ width: 48, height: 48, borderRadius: "50%", background: "#FBEAE8", margin: "0 auto 10px", display: "flex", alignItems: "center", justifyContent: "center" }}><AlertTriangle size={24} color="#B3261E" /></div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#3A2C29", marginBottom: 8 }}>บันทึกข้อมูลถาวรไม่ได้ตอนนี้</div>
            <div style={{ fontSize: 13, color: "#7A6360", lineHeight: 1.6, marginBottom: 14 }}>
              อุปกรณ์นี้บล็อกการบันทึกข้อมูล (เช่น โหมดส่วนตัวของเบราว์เซอร์ หรือพื้นที่เก็บข้อมูลเต็ม) ข้อมูลที่บันทึกในเซสชันนี้จะหายไปเมื่อปิดแอป แนะนำให้ส่งออกไฟล์สำรองก่อนปิด
            </div>
            <button onClick={() => setShowStorageDegradedModal(false)} className="btn-primary" style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              เข้าใจแล้ว
            </button>
            <button onClick={() => { setShowStorageDegradedModal(false); openBackupRestore("export"); }} style={{ background: "none", border: "none", color: "#9A3B33", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", marginTop: 10, padding: "4px 8px" }}>
              ส่งออกไฟล์สำรอง
            </button>
          </div>
        </div>
      )}

      {phase === "app" && (
        <>
          <input ref={photoCameraInputRef} type="file" accept="image/*" capture="user" onChange={handlePhotoFileSelected} style={{ display: "none" }} />
          <input ref={photoGalleryInputRef} type="file" accept="image/*" onChange={handlePhotoFileSelected} style={{ display: "none" }} />
        </>
      )}

      {showProfile && (() => {
        const nameParts = nickname.trim().split(/\s+/).filter(Boolean);
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ");
        const donorLabel = (DONOR_TYPES.find(d => d.key === donorType) || {}).label;
        const ph = (t) => <span style={{ color: "#80726F" }}>{t}</span>;
        // Criteria hint on the right of a row: grey = not filled, green =
        // within, orange = outside. Birth year shows the age it works out to.
        const nowBE = thaiYearNow();
        // Live value of a picker row: what is being scrolled, else the saved one.
        const liveNumber = (key) => {
          const cur = pickerPreview && pickerPreview.key === key ? pickerPreview.value : (key === "birthYear" ? birthYear : key === "height" ? height : weight);
          return cur === "" || cur == null ? NaN : Number(cur);
        };
        // Age goes next to the "ปีเกิด" label (not on the right, where every
        // row shows one short status).
        const criteriaHint = (key) => {
          if (key !== "birthYear" && key !== "weight") return null;
          const n = liveNumber(key);
          if (key === "birthYear") {
            const range = `${MIN_AGE}–${MAX_AGE} ปี`;
            if (Number.isNaN(n)) return { text: `อายุ ${range}`, color: "#7A6360" };
            const a = nowBE - n;
            if (birthYearApprox && n === birthYear) return { text: "ปีโดยประมาณ", color: "#9C5515" };
            return a >= MIN_AGE && a <= MAX_AGE ? { text: "อยู่ในเกณฑ์", color: "#2E7D4F" } : { text: "อยู่นอกเกณฑ์", color: "#9C5515" };
          }
          if (Number.isNaN(n)) return { text: `น้ำหนัก ${MIN_WEIGHT} กก. ขึ้นไป`, color: "#7A6360" };
          return n >= MIN_WEIGHT ? { text: "อยู่ในเกณฑ์", color: "#2E7D4F" } : { text: "อยู่นอกเกณฑ์", color: "#9C5515" };
        };
        const placeholders = { first: "ระบุชื่อ", last: "ระบุนามสกุล", birthYear: "ระบุปีเกิด", weight: "ระบุน้ำหนัก", height: "ระบุส่วนสูง", donorId: "ระบุเลข 10 หลักบนบัตรผู้บริจาค" };
        const genderLabel = (GENDERS.find(g => g[0] === gender) || [])[1];
        // Summary: "O Rh+" — one colour, sign on the same baseline as "Rh"; Rh unknown / not chosen shows the group only.
        const rhSign = bloodRh === "+" ? "+" : bloodRh === "-" ? "−" : "";
        const bloodValue = !bloodType && !bloodRh ? ph("ระบุหมู่โลหิต")
          : <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
              {bloodType ? (bloodType === "ไม่ทราบ" ? "ไม่ระบุหมู่" : bloodType) : ph("หมู่?")}
              {rhSign && (
                <span aria-label={bloodRh === "+" ? "Rh บวก" : "Rh ลบ"}>
                  <span aria-hidden="true">Rh{rhSign}</span>
                </span>
              )}
            </span>;
        const groups = [
          { title: "ข้อมูลส่วนตัว", rows: [
            { key: "first", Icon: User, label: "ชื่อ", kind: "text" },
            { key: "last", Icon: Users, label: "นามสกุล", kind: "text" },
            { key: "gender", Icon: PersonStanding, label: "เพศ", kind: "choice", value: genderLabel || ph("ระบุเพศ"),
              options: GENDERS.map(([v, label]) => ({ v, label })), current: gender },
            // Birth year, height and weight: horizontal rulers
            // (profile-number-picker-designs.html, design 4). Each saves
            // once the scroll settles.
            { key: "birthYear", Icon: Cake, label: "ปีเกิด", kind: "picker", unit: "พ.ศ." },
            { key: "weight", Icon: Weight, label: "น้ำหนัก", kind: "picker", unit: "กก." },
            { key: "height", Icon: Ruler, label: "ส่วนสูง", kind: "picker", unit: "ซม." },
          ] },
          { title: "สำหรับการบริจาค", rows: [
            { key: "donorId", Icon: CreditCard, label: "เลขประจำตัวผู้บริจาค", kind: "id" },
            { key: "blood", Icon: Droplet, label: "หมู่โลหิต", kind: "choice", value: bloodValue, blood: true },
            { key: "donorType", Icon: Award, label: "ประเภทผู้บริจาค", kind: "choice", value: donorLabel || ph("ระบุประเภทผู้บริจาค"),
              options: DONOR_TYPES.map(dt => ({ v: dt.key, label: dt.label })), current: donorType },
          ] },
        ];
        const committed = { birthYear, height, weight };
        const pickerShown = (key) => {
          const v = pickerPreview && pickerPreview.key === key ? pickerPreview.value : committed[key];
          if (v === "" || v == null) return ph(placeholders[key]);
          if (key === "birthYear" && Number(v) > 0) {
            const age = nowBE - Number(v);
            return <>{String(v)}<> (อายุ {age} ปี)</></>;
          }
          return String(v);
        };
        const preview = (key) => (v) => { clearTimeout(pickerCloseTimer); setPickerPreview({ key, value: v }); };
        const settle = (key) => (v) => {
          let changed = false;
          if (key === "birthYear") {
            if (v !== birthYear || birthYearApprox) { commitProfile({ birthYear: v, birthYearApprox: false }, key); changed = true; }
          } else if (v !== committed[key]) {
            commitProfile({ [key]: v }, key); changed = true;
          }
          if (changed) pickerDirtyKey = key;
          clearTimeout(pickerCloseTimer);
          pickerCloseTimer = setTimeout(() => {
            setProfileOpenChoice(o => (o === key ? null : o));
            if (pickerDirtyKey === key) { pickerDirtyKey = null; flashSaved(key); }
          }, 1000);
        };
        const pickerPanel = (key) => {
          if (key === "birthYear") {
            return <HorizontalRuler min={nowBE - 100} max={nowBE} step={1} majorEvery={10} midEvery={5} unitBefore="พ.ศ."
              value={birthYear === "" ? nowBE - 30 : birthYear} label="ปีเกิด" onChange={preview(key)} onSettle={settle(key)} />;
          }
          if (key === "height") {
            return <HorizontalRuler min={MIN_HEIGHT} max={MAX_HEIGHT} step={1} majorEvery={10} midEvery={5} unit="ซม." ariaUnit="เซนติเมตร"
              value={height === "" ? 160 : Math.round(Number(height))} label="ส่วนสูง" onChange={preview(key)} onSettle={settle(key)} />;
          }
          return <HorizontalRuler min={30} max={200} step={0.1} decimals={1} majorEvery={10} midEvery={5} unit="กก." ariaUnit="กิโลกรัม"
            value={weight === "" ? 55 : Math.min(200, Math.max(30, Number(weight)))} label="น้ำหนัก" onChange={preview(key)} onSettle={settle(key)} />;
        };
        const copyDonorId = async () => {
          try {
            await navigator.clipboard.writeText(donorId);
            showToast("success", "คัดลอกเลขผู้บริจาคแล้ว");
          } catch (e) {
            showToast("error", "คัดลอกไม่ได้ในแอปนี้ — กดค้างที่ตัวเลขเพื่อคัดลอกเอง");
          }
        };
        // Equal-width chips: each group is a grid of equal columns, so every
        // chip in a row is the same width (padding kept small for Rh labels).
        // Let the chosen option settle for a beat before the panel folds, and only close it
        // if the user hasn't moved on to another row meanwhile.
        // After the panel has folded, show "✓ บันทึกแล้ว" on the row (only when something was actually saved).
        const flashSaved = (key) => {
          setProfileSavedKey(key);
          clearTimeout(profileSavedTimerRef.current);
          profileSavedTimerRef.current = setTimeout(() => setProfileSavedKey(null), 1400);
        };
        const closeRowSoon = (key, changed) => setTimeout(() => {
          setProfileOpenChoice(o => (o === key ? null : o));
          if (changed) flashSaved(key);
        }, 420);
        const closeBloodSoon = (changed) => closeRowSoon("blood", changed);
        const chipGrid = (cols) => ({ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 8 });
        const chip = (on) => ({ minHeight: 40, minWidth: 0, padding: "0 6px", whiteSpace: "nowrap", borderRadius: 20, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          border: `1px solid ${on ? "#9A3B33" : "#E3C8C3"}`, background: on ? "#9A3B33" : "#FFFFFF", color: on ? "#FFF7F5" : "#3A2C29" });
        const trail = (key, icon) => profileSavedKey === key
          ? <span role="status" style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: "#2E7D4F", whiteSpace: "nowrap" }}>✓ บันทึกแล้ว</span>
          : icon;
        return (
          <>
          {/* Profile (design 3 from profile-box-rows-designs.html): the same
              centered box as ตั้งค่า -- title + ✕, small red group labels,
              white row cards with an icon per row -- listing each field; a
              row opens the one-field sheet below. The box itself has no text
              inputs, so the keyboard can never cover it. (A full-screen page
              version, v1.0.104, didn't match the app's other dialogs.) */}
          <div role="dialog" aria-modal="true" aria-label="โปรไฟล์ของฉัน"
            onClick={(e) => { if (e.target === e.currentTarget) closeProfile(); }}
            style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
            <div ref={profileBoxRef} tabIndex={-1} style={{ background: "#FBF6F5", width: "100%", maxWidth: 380, borderRadius: 18, maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden", outline: "none" }}>
              <div style={{ flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 22px 12px" }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>โปรไฟล์ของฉัน</div>
                <button onClick={closeProfile} aria-label="ปิด" style={{ position: "relative", background: "none", border: "none", cursor: "pointer", color: "#3A2C29", padding: 0, display: "flex" }}>
                  <span aria-hidden="true" style={{ position: "absolute", inset: -12 }} />
                  <X size={20} />
                </button>
              </div>
              <div ref={profileScrollRef} className="no-scrollbar" onScroll={(e) => { const sc = e.currentTarget.scrollTop > 2; setProfileScrolled(v => (v === sc ? v : sc)); }}
                style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", padding: "6px 22px 22px", ...(profileScrolled ? { WebkitMaskImage: "linear-gradient(transparent 0, #000 18px)", maskImage: "linear-gradient(transparent 0, #000 18px)" } : null) }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <button onClick={() => setShowPhotoMenu(v => !v)} disabled={photoBusy} aria-label={photo ? "เปลี่ยนรูปโปรไฟล์" : "เพิ่มรูปโปรไฟล์"}
                    style={{ width: 56, height: 56, borderRadius: "50%", border: "none", padding: 0, cursor: photoBusy ? "not-allowed" : "pointer", overflow: "hidden", background: "#F3EAE8", display: "flex", alignItems: "center", justifyContent: "center", opacity: photoBusy ? 0.6 : 1 }}>
                    {photo ? (
                      <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : firstName ? (
                      <span style={{ fontSize: 22, fontWeight: 700, color: "#9A3B33" }}>{[...firstName][0].toUpperCase()}</span>
                    ) : (
                      <User size={22} color="#9A3B33" />
                    )}
                  </button>
                  <div aria-hidden="true" style={{ position: "absolute", bottom: -2, right: -2, width: 20, height: 20, borderRadius: "50%", background: "#9A3B33", border: "2px solid #FBF6F5", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                    <Camera size={10} color="#FFF7F5" />
                  </div>
                  {showPhotoMenu && (
                    <>
                      <div onClick={() => setShowPhotoMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 55 }} />
                      <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 6, background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 12, boxShadow: "0 4px 14px rgba(36,26,24,0.15)", overflow: "hidden", zIndex: 56, minWidth: 190 }}>
                        <button onClick={() => { setShowPhotoMenu(false); photoCameraInputRef.current?.click(); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", minHeight: 44, padding: "0 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13.5, color: "#3A2C29", fontFamily: "inherit", textAlign: "left" }}>
                          <Camera size={15} color="#9A3B33" /> ถ่ายรูปใหม่
                        </button>
                        <button onClick={() => { setShowPhotoMenu(false); photoGalleryInputRef.current?.click(); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", minHeight: 44, padding: "0 14px", background: "none", border: "none", borderTop: "1px solid #F3E7E4", cursor: "pointer", fontSize: 13.5, color: "#3A2C29", fontFamily: "inherit", textAlign: "left" }}>
                          <ImageIcon size={15} color="#9A3B33" /> เลือกจากคลังภาพ
                        </button>
                        {photo && (
                          <button onClick={removePhoto} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", minHeight: 44, padding: "0 14px", background: "none", border: "none", borderTop: "1px solid #F3E7E4", cursor: "pointer", fontSize: 13.5, color: "#B3261E", fontFamily: "inherit", textAlign: "left" }}>
                            <Trash2 size={15} color="#B3261E" /> ลบรูปโปรไฟล์
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: "#3A2C29", lineHeight: 1.3, overflow: "hidden", overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{[firstName, lastName].filter(Boolean).join(" ") || "ยังไม่ได้ใส่ชื่อ"}</div>
                  {photoBusy ? (
                    <div style={{ marginTop: 2, fontSize: 12, color: "#7A6360" }}>กำลังประมวลผลรูป...</div>
                  ) : (bloodType && bloodType !== "ไม่ทราบ") || age !== "" || (weight !== "" && weight != null) ? (
                    /* Summary chips under the name: blood group, age, weight — white icon disc + bold value */
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                      {[
                        bloodType && bloodType !== "ไม่ทราบ" ? { key: "blood", Icon: Droplet, text: `${bloodType}${bloodRh ? ` Rh${bloodRh === "+" ? "+" : "−"}` : ""}` } : null,
                        age !== "" ? { key: "age", Icon: Cake, text: `${age} ปี` } : null,
                        weight !== "" && weight != null ? { key: "weight", Icon: Weight, text: `${weight} กก.` } : null,
                      ].filter(Boolean).map(c => (
                        <span key={c.key} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px 3px 3px", borderRadius: 20, background: "#F3EAE8", color: "#9A3B33", fontSize: 11, fontWeight: 600, lineHeight: 1, whiteSpace: "nowrap" }}>
                          <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: "50%", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <c.Icon size={9} color="#9A3B33" />
                          </span>
                          {c.text}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              {photoError && <div style={{ margin: "-10px 0 16px" }}><FieldError>{photoError}</FieldError></div>}

              {/* Two boxes with red group titles (design 2 of profile-boxes-6.html,
                  grouping ก of profile-donorform-designs.html, plus gender and
                  height from profile-gender-height-designs.html). Values are
                  typed in place (the item tints while focused, via
                  .prow-edit:focus-within); choices expand under the item. */}
              {groups.map(g => (
                <div key={g.title} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#9A3B33", margin: "0 0 6px 2px" }}>{g.title}</div>
                  <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 12, padding: "0 12px" }}>
                {g.rows.map((r, ri, all) => {
                  // The tint while editing sits 4px inside the row on every side:
                  // 4px from the card edge (card padding 12 - margin 8) and 4px
                  // from the row's top/bottom (row padding 4 + item padding 5 =
                  // the old 9px, so row height is unchanged).
                  const itemStyle = { display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "5px 8px", margin: "0 -8px", borderRadius: 9, textAlign: "left", fontFamily: "inherit", background: "transparent", boxSizing: "content-box" };
                  const iconEl = (
                    <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: "50%", background: "#F3EAE8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <r.Icon size={17} color="#9A3B33" />
                    </span>
                  );
                  const labelEl = <span style={{ display: "block", fontSize: 12, color: "#7A6360" }}>{r.label}{r.unit ? ` (${r.unit})` : ""}</span>;
                  const hint = criteriaHint(r.key);
                  // Year / weight: the full criteria text lives in the picker panel (chip, top right).
                  // The collapsed row only flags a problem, in a short form; ✓ and "criteria" hints stay out of the first screen.
                  const isCriteriaRow = r.key === "birthYear" || r.key === "weight";
                  const rowHint = !hint ? null
                    : !isCriteriaRow ? hint
                    : profileOpenChoice === r.key ? null // the panel's chip already says it
                    : hint.color !== "#9C5515" ? null
                    : { ...hint, text: hint.text.startsWith("นอกเกณฑ์") ? "นอกเกณฑ์" : hint.text.startsWith("ต่ำกว่าเกณฑ์") ? "ต่ำกว่าเกณฑ์" : hint.text };
                  const saved = profileSavedKey === r.key && profileOpenChoice !== r.key
                    ? <span role="status" style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: "#2E7D4F", whiteSpace: "nowrap" }}>✓ บันทึกแล้ว</span>
                    : r.kind === "action" ? <ChevronRight size={16} color="#7A6360" aria-hidden="true" style={{ flexShrink: 0 }} />
                    : r.kind === "id" && donorId && profileInline.donorId === donorId ? (
                      <button type="button" onClick={(e) => { e.preventDefault(); copyDonorId(); }} aria-label="คัดลอกเลขประจำตัวผู้บริจาค"
                        style={{ position: "relative", flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, margin: "-3px 0", fontSize: 11.5, fontWeight: 600, color: "#9A3B33", background: "#F3EAE8", border: "none", borderRadius: 8, padding: "4px 8px", cursor: "pointer", fontFamily: "inherit" }}>
                        <span aria-hidden="true" style={{ position: "absolute", inset: "-9px -4px" }} />
                        <Copy size={13} /> คัดลอก
                      </button>
                    )
                    : rowHint && <span style={{ flexShrink: 0, fontSize: 11, color: rowHint.color, whiteSpace: "nowrap" }}>{rowHint.text}</span>;
                  const isOpen = profileOpenChoice === r.key;
                  return (
                    <div key={r.key} data-prow={r.key} style={{ scrollMarginBottom: 12, padding: "4px 0", borderBottom: ri < all.length - 1 ? "1px solid #F3E7E4" : "none" }}>
                      {r.kind === "choice" || r.kind === "action" || r.kind === "picker" ? (
                        <>
                          <button onClick={r.kind === "action" ? r.onClick : () => { setPickerPreview(null); if (pickerDirtyKey && (pickerDirtyKey !== r.key || isOpen)) { clearTimeout(pickerCloseTimer); const dk = pickerDirtyKey; pickerDirtyKey = null; flashSaved(dk); } setProfileOpenChoice(o => (o === r.key ? null : r.key)); }} aria-expanded={r.kind !== "action" ? isOpen : undefined}
                            style={{ ...itemStyle, border: "none", cursor: "pointer", background: isOpen ? "#FBEFEC" : "transparent" }}>
                            {iconEl}
                            <span style={{ flex: 1, minWidth: 0 }}>
                              {labelEl}
                              <span style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 1 }}>
                                <span style={{ flex: 1, fontSize: 15, lineHeight: "22px", minHeight: 22, color: "#3A2C29", fontVariantNumeric: r.kind === "picker" ? "tabular-nums" : undefined }}>{r.kind === "picker" ? pickerShown(r.key) : r.value}</span>
                                {saved}
                              </span>
                            </span>
                          </button>
                          {isOpen && r.blood && (
                            <div style={{ padding: "8px 0 6px 46px" }}>
                              <div id="prof-blood-abo" style={{ fontSize: 11, color: "#7A6360", margin: "2px 0 6px" }}>หมู่</div>
                              <div role="radiogroup" aria-labelledby="prof-blood-abo" style={{ position: "relative", display: "flex", background: "#FFFFFF", border: "1px solid #E3C8C3", borderRadius: 12, padding: 4 }}>
                                {(() => {
                                  const aboOn = ABO_ONLY.includes(bloodType);
                                  if (aboOn) lastPickedRef.current.abo = bloodType;
                                  const shownIdx = ABO_ONLY.indexOf(aboOn ? bloodType : lastPickedRef.current.abo);
                                  return shownIdx >= 0 ? (
                                    <span aria-hidden="true" style={{ position: "absolute", top: 4, bottom: 4, left: `calc(4px + ${shownIdx} * (100% - 8px) / 4)`, width: "calc((100% - 8px) / 4)", borderRadius: 9, background: "#F3E7E4", opacity: aboOn ? 1 : 0, transition: "left .22s, opacity .18s" }} />
                                  ) : null;
                                })()}
                                <SegDividers n={4} sel={ABO_ONLY.indexOf(bloodType)} />
                                {ABO_ONLY.map(bt => {
                                  const on = bloodType === bt;
                                  return (
                                    <button key={bt} role="radio" aria-checked={on} aria-label={`หมู่ ${bt}`}
                                      onClick={() => {
                                        // Tapping the chosen group again takes it back off (nothing selected).
                                        if (on) { commitProfile({ bloodType: "", bloodRh: "" }, "blood"); closeBloodSoon(true); return; } // Rh means little without the group, so it goes too
                                        commitProfile({ bloodType: bt }, "blood");
                                        if (bloodRh) closeBloodSoon(true);
                                        // Rh still missing: bring it into view so the panel doesn't look finished.
                                        else setTimeout(() => { try { document.getElementById("prof-blood-rh-group")?.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {} }, 120);
                                      }}
                                      style={{ position: "relative", zIndex: 1, flex: 1, minWidth: 0, height: 40, border: "none", background: "none", borderRadius: 9, cursor: "pointer", fontFamily: "'Mitr', 'Inter', sans-serif", fontWeight: on ? 600 : 400, fontSize: 18, color: on ? "#8A2F28" : "#A38D89", transition: "color .2s" }}>
                                      {bt}
                                    </button>
                                  );
                                })}
                              </div>
                              <div id="prof-blood-rh" style={{ fontSize: 11, color: bloodType && !bloodRh ? "#9A3B33" : "#7A6360", fontWeight: bloodType && !bloodRh ? 700 : 400, margin: "10px 0 6px" }}>{bloodType && !bloodRh ? "Rh · ระบุต่ออีกนิด" : "Rh"}</div>
                              <div id="prof-blood-rh-group" role="radiogroup" aria-labelledby="prof-blood-rh" style={{ position: "relative", display: "flex", background: "#FFFFFF", border: "1px solid #E3C8C3", borderRadius: 12, padding: 4 }}>
                                {(() => {
                                  if (bloodRh) lastPickedRef.current.rh = bloodRh;
                                  const shownIdx = BLOOD_RH.findIndex(([v]) => v === (bloodRh || lastPickedRef.current.rh));
                                  return shownIdx >= 0 ? (
                                    <span aria-hidden="true" style={{ position: "absolute", top: 4, bottom: 4, left: `calc(4px + ${shownIdx} * (100% - 8px) / 3)`, width: "calc((100% - 8px) / 3)", borderRadius: 9, background: "#F3E7E4", opacity: bloodRh ? 1 : 0, transition: "left .22s, opacity .18s" }} />
                                  ) : null;
                                })()}
                                <SegDividers n={3} sel={BLOOD_RH.findIndex(([v]) => v === bloodRh)} />
                                {BLOOD_RH.map(([v]) => {
                                  const on = bloodRh === v;
                                  return (
                                    <button key={v} role="radio" aria-checked={on}
                                      onClick={() => {
                                        // Tapping the chosen Rh again takes it back off.
                                        if (on) { commitProfile({ bloodRh: "" }, "blood"); closeBloodSoon(true); return; }
                                        commitProfile({ bloodRh: v }, "blood");
                                        if (bloodType) closeBloodSoon(true);
                                      }}
                                      style={{ position: "relative", zIndex: 1, flex: 1, minWidth: 0, height: 40, border: "none", background: "none", borderRadius: 9, cursor: "pointer", fontFamily: "'Mitr', 'Inter', sans-serif", fontWeight: on ? 600 : 400, fontSize: v === "unknown" ? 13.5 : 17, whiteSpace: "nowrap", color: on ? "#8A2F28" : "#A38D89", transition: "color .2s" }}>
                                      {v === "+" ? "Rh+" : v === "-" ? "Rh−" : "ไม่ทราบ"}
                                    </button>
                                  );
                                })}
                              </div>
                              <div style={{ fontSize: 11, color: "#7A6360", marginTop: 8 }}>ดูได้จากบัตรผู้บริจาค (คนไทยส่วนใหญ่ Rh+)</div>
                            </div>
                          )}
                          {isOpen && r.kind === "picker" && (
                            // Rulers use the row's full width so the scale is centred on
                            // screen (easy from either hand).
                            <div style={{ position: "relative", padding: isCriteriaRow ? "34px 0 2px" : "10px 0 2px" }}>
                              {isCriteriaRow && hint && (
                                <span role="status" style={{ position: "absolute", top: 8, right: 0, fontSize: 11.5, fontWeight: 500, padding: "3px 10px", borderRadius: 12, whiteSpace: "nowrap",
                                  color: hint.color, background: hint.color === "#2E7D4F" ? "#E8F4EC" : hint.color === "#9C5515" ? "#FBEFE3" : "#F3EAE8" }}>{hint.text}</span>
                              )}
                              {pickerPanel(r.key)}
                              {(() => {
                                // "ล้างค่า" appears as soon as the scale moves (or a value is already saved). Its slot
                                // (bottom-right under the scale) is always reserved so the layout doesn't jump.
                                const canClear = committed[r.key] !== "" || (pickerPreview && pickerPreview.key === r.key);
                                return (
                                  <div style={{ display: "flex", justifyContent: "flex-end", minHeight: 16 }}>
                                    <button tabIndex={canClear ? 0 : -1} aria-hidden={canClear ? undefined : "true"}
                                      onClick={() => {
                                        clearTimeout(pickerCloseTimer); pickerDirtyKey = null;
                                        setProfileOpenChoice(null); setPickerPreview(null);
                                        if (committed[r.key] !== "") commitProfile(r.key === "birthYear" ? { birthYear: "", birthYearApprox: false } : { [r.key]: "" }, r.key);
                                      }}
                                      style={{ position: "relative", background: "none", border: "none", padding: 0, fontSize: 12, fontWeight: 600, color: "#9A3B33", cursor: "pointer", fontFamily: "inherit", visibility: canClear ? "visible" : "hidden" }}>
                                      <span aria-hidden="true" style={{ position: "absolute", inset: "-12px -8px" }} />
                                      ล้างค่า
                                    </button>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                          {isOpen && r.kind === "choice" && !r.blood && (
                            <div style={{ padding: "10px 0 6px 46px" }}>
                              {(() => {
                                // Same sliding segmented bar as the blood group / Rh pickers.
                                const n = r.options.length;
                                const idx = r.options.findIndex(o => o.v === r.current);
                                if (idx >= 0) lastPickedRef.current[r.key] = idx;
                                const shownIdx = idx >= 0 ? idx : (lastPickedRef.current[r.key] ?? -1);
                                const canClear = r.key === "donorType" || r.key === "gender"; // tapping the chosen option again clears it
                                const longest = Math.max(...r.options.map(o => o.label.length));
                                return (
                                  <div role="radiogroup" aria-label={r.label} style={{ position: "relative", display: "flex", background: "#FFFFFF", border: "1px solid #E3C8C3", borderRadius: 12, padding: 4 }}>
                                    {shownIdx >= 0 && (
                                      <span aria-hidden="true" style={{ position: "absolute", top: 4, bottom: 4, left: `calc(4px + ${shownIdx} * (100% - 8px) / ${n})`, width: `calc((100% - 8px) / ${n})`, borderRadius: 9, background: "#F3E7E4", opacity: idx >= 0 ? 1 : 0, transition: "left .22s, opacity .18s" }} />
                                    )}
                                    <SegDividers n={n} sel={idx} />
                                    {r.options.map(o => {
                                      const on = r.current === o.v;
                                      return (
                                        <button key={o.v} role="radio" aria-checked={on}
                                          onClick={() => {
                                            // Donor type / gender: tapping the chosen option again takes it back off.
                                            if (canClear && o.v === r.current) { commitProfile({ [r.key]: "" }, r.key); closeRowSoon(r.key, true); return; }
                                            if (o.v !== r.current) commitProfile({ [r.key]: o.v }, r.key);
                                            closeRowSoon(r.key, o.v !== r.current);
                                          }}
                                          style={{ position: "relative", zIndex: 1, flex: 1, minWidth: 0, height: 40, border: "none", background: "none", borderRadius: 9, cursor: "pointer", fontFamily: "'Mitr', 'Inter', sans-serif", fontWeight: on ? 600 : 400, fontSize: longest > 8 ? 14 : 16, whiteSpace: "nowrap", color: on ? "#8A2F28" : "#A38D89", transition: "color .2s" }}>
                                          {o.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                              {r.note && (
                                <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 11.5, color: "#7A6360", marginTop: 8, lineHeight: 1.5 }}>
                                  <Info size={13} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} /> {r.note}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <label htmlFor={`profile-${r.key}`} className="prow-edit" style={{ ...itemStyle, cursor: "text" }}>
                          {iconEl}
                          <span style={{ flex: 1, minWidth: 0 }}>
                          {labelEl}
                          <span style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 1 }}>
                            <input id={`profile-${r.key}`}
                              ref={r.key === "first" ? nicknameFirstInputRef : r.key === "last" ? nicknameLastInputRef : undefined}
                              type="text" autoComplete="off" enterKeyHint={r.key === "first" ? "next" : "done"}
                              inputMode={r.key === "birthYear" || r.key === "donorId" ? "numeric" : r.key === "weight" || r.key === "height" ? "decimal" : undefined}
                              placeholder={placeholders[r.key]}
                              value={profileInline[r.key]}
                              onChange={r.kind === "text"
                                ? handleNameFieldChange(r.key, r.key === "first" ? nicknameFirstInputRef : nicknameLastInputRef)
                                : r.kind === "id"
                                  ? (e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 10); setProfileInline(f => ({ ...f, donorId: v })); }
                                  : (e) => { const v = e.target.value.replace(r.key === "birthYear" ? /[^0-9]/g : /[^0-9.]/g, "").slice(0, r.key === "birthYear" ? 4 : 5); setProfileInline(f => ({ ...f, [r.key]: v })); }}
                              onFocus={(e) => {
                                if (profileOpenChoice) setProfileOpenChoice(null);
                                if (profileInlineError[r.key]) setProfileInlineError(er => ({ ...er, [r.key]: undefined }));
                                // Only scroll if the on-screen keyboard ends up covering this
                                // item, the moment it finishes opening (see v1.0.107).
                                const rowEl = e.currentTarget.closest("[data-prow]");
                                const vv = window.visualViewport;
                                if (rowEl && vv) {
                                  const ensure = () => { if (rowEl.getBoundingClientRect().bottom > vv.offsetTop + vv.height - 8) rowEl.scrollIntoView({ block: "nearest" }); };
                                  vv.addEventListener("resize", ensure, { once: true });
                                  setTimeout(() => vv.removeEventListener("resize", ensure), 1000);
                                }
                              }}
                              onBlur={() => commitProfileField(r.key)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  // ชื่อ → Enter moves focus straight to นามสกุล (saving ชื่อ via blur); everything else just finishes.
                                  if (r.key === "first" && nicknameLastInputRef.current) nicknameLastInputRef.current.focus();
                                  else e.currentTarget.blur();
                                }
                                if (e.key === "Escape") {
                                  e.stopPropagation();
                                  const cur = { first: firstName, last: lastName, birthYear, weight, height, donorId }[r.key];
                                  setProfileInline(f => ({ ...f, [r.key]: cur === "" || cur == null ? "" : String(cur) }));
                                  setTimeout(() => e.target.blur(), 0);
                                }
                              }}
                              style={{ flex: 1, minWidth: 0, height: 22, lineHeight: "22px", border: "none", background: "none", outline: "none", padding: 0, fontSize: 15, fontFamily: "inherit", color: "#3A2C29", caretColor: "#9A3B33", letterSpacing: r.kind === "id" ? 0.5 : undefined }} />
                            {saved}
                          </span>
                          </span>
                        </label>
                      )}
                      {profileInlineError[r.key] && (
                        <div style={{ padding: "0 14px 8px 46px" }}><FieldError>{profileInlineError[r.key]}</FieldError></div>
                      )}
                    </div>
                  );
                })}
                    {g.footer}
                  </div>
                </div>
              ))}
<div style={{ display: "flex", alignItems: "center", gap: 12, background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 14, padding: "12px 14px", margin: "10px 0" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#3A2C29" }}>ซ่อนข้อมูลบนหน้าแรก</div>
                  <div style={{ fontSize: 11, color: "#7A6360", lineHeight: 1.5, marginTop: 2 }}>เบลอหมู่โลหิต อายุ น้ำหนัก เมื่อเปิดแอปในที่สาธารณะ</div>
                </div>
                <button type="button" role="switch" aria-checked={blurInfoPills} aria-label="ซ่อนข้อมูลบนหน้าแรก" onClick={toggleBlurInfoPills}
                  style={{ width: 38, height: 21, borderRadius: 20, border: "none", cursor: "pointer", position: "relative", background: blurInfoPills ? "#9A3B33" : "#E3C8C3", flexShrink: 0, padding: 0 }}>
                  <span style={{ width: 15, height: 15, borderRadius: "50%", background: "#FFFFFF", position: "absolute", top: 3, left: blurInfoPills ? 20 : 3, transition: "left 0.15s" }} />
                </button>
              </div>
{(nickname || photo || birthYear !== "" || gender || height !== "" || donorId || bloodRh || weight !== "" || bloodType || donorType) && (
                <div style={{ textAlign: "center", marginTop: 6 }}>
                  <button onClick={() => { setProfileOpenChoice(null); setClearProfileError(""); setShowClearProfile(true); }}
                    style={{ display: "block", width: "100%", background: "#FFFFFF", border: "1px solid #E3B3AE", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 600, color: "#B3261E", padding: "11px 14px", lineHeight: 1.35 }}>
                    ลบข้อมูลโปรไฟล์
                  </button>
                  <div style={{ fontSize: 11.5, color: "#7A6360", lineHeight: 1.7, marginTop: 8, textWrap: "balance" }}>
                    หากต้องการลบข้อมูลทั้งหมด รวมถึงประวัติการบริจาคโลหิต
                    <br />
                    ไปที่{" "}
                    <button onClick={() => { setProfileOpenChoice(null); setShowProfile(false); setShowSettings(true); }}
                      style={{ position: "relative", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, lineHeight: 1.7, color: "#9A3B33", textDecoration: "underline" }}>
                      <span aria-hidden="true" style={{ position: "absolute", inset: "-10px -8px" }} />ตั้งค่า → ลบข้อมูลทั้งหมด
                    </button>
                  </div>
                  <div aria-hidden="true" style={{ width: 40, height: 1, background: "#EEDEDA", margin: "16px auto 0" }} />
                </div>
              )}
<div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", columnGap: 12, rowGap: 2, fontSize: 11.5, color: "#7A6360", marginTop: 6, padding: "10px 0" }}>
                <button type="button" onClick={() => { privacyFromProfileRef.current = true; setProfileOpenChoice(null); setShowProfile(false); setShowPrivacy(true); }}
                  style={{ position: "relative", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", color: "#9A3B33", textDecoration: "underline" }}>
                  <span aria-hidden="true" style={{ position: "absolute", inset: "-12px -6px" }} />อ่านนโยบายความเป็นส่วนตัว
                </button>
              </div>
              </div>
            </div>
          </div>

          </>
        );
      })()}

      {/* Reminder pause (design 4 of profile-gender-height-designs.html):
          pick how long, never why -- a pregnancy or breastfeeding reason
          would be health data, so the app only keeps the end date. */}
      {showRemindPause && (() => {
        const paused = isRemindPaused(remindPauseUntil);
        const until = remindPauseUntilFor(remindPauseChoice);
        const close = () => setShowRemindPause(false);
        const apply = async (val) => {
          await commitProfile({ remindPauseUntil: val }, "pause");
          close();
          showToast("success", val ? "พักการเตือนแล้ว" : "เปิดการเตือนแล้ว");
        };
        const chipStyle = (on) => ({ minHeight: 40, padding: "0 14px", borderRadius: 20, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          border: `1px solid ${on ? "#9A3B33" : "#E3C8C3"}`, background: on ? "#9A3B33" : "#FFFFFF", color: on ? "#FFF7F5" : "#3A2C29" });
        return (
          <div role="dialog" aria-modal="true" aria-label="พักการเตือนชั่วคราว"
            onClick={(e) => { if (e.target === e.currentTarget) close(); }}
            style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }}>
            <div style={{ background: "#FBF6F5", width: "100%", maxWidth: 380, borderRadius: 18, maxHeight: "85vh" , display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, padding: "22px 22px 10px" }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>พักการเตือนชั่วคราว</div>
                <button onClick={close} aria-label="ปิด" style={{ position: "relative", background: "none", border: "none", cursor: "pointer", color: "#3A2C29", padding: 0, display: "flex" }}>
                  <span aria-hidden="true" style={{ position: "absolute", inset: -12 }} />
                  <X size={20} />
                </button>
              </div>
              <FadeScroll style={{ padding: "0 22px 22px" }}>
              <p style={{ fontSize: 13, color: "#5C4A46", lineHeight: 1.6, margin: "0 0 12px" }}>ระหว่างพัก หน้าหลักจะไม่ชวนให้ไปบริจาคหรือเพิ่มนัดลงปฏิทิน ประวัติเดิมยังอยู่ครบ</p>
              {paused && (
                <div role="status" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#3A2C29", background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 12, padding: "10px 12px", marginBottom: 12 }}>
                  <BellOff size={15} color="#9A3B33" aria-hidden="true" style={{ flexShrink: 0 }} />
                  {remindPauseUntil === "indefinite" ? "ตอนนี้พักอยู่ จนกว่าจะเปิดเอง" : `ตอนนี้พักอยู่ถึง ${toBuddhistDate(remindPauseUntil)}`}
                </div>
              )}
              <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 12, padding: "10px 12px" }}>
                <div id="remind-pause-len" style={{ fontSize: 11.5, color: "#7A6360", marginBottom: 6 }}>{paused ? "เปลี่ยนเป็นพักไว้" : "พักไว้"}</div>
                <div role="radiogroup" aria-labelledby="remind-pause-len" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                  {REMIND_PAUSE_OPTIONS.map(([v, label]) => (
                    <button key={v} role="radio" aria-checked={remindPauseChoice === v} onClick={() => setRemindPauseChoice(v)} style={{ ...chipStyle(remindPauseChoice === v), padding: "0 6px", whiteSpace: "nowrap", gridColumn: v === "indefinite" ? "span 3" : undefined }}>{label}</button>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, marginTop: 10, paddingTop: 10, borderTop: "1px solid #F3E7E4" }}>
                  <span style={{ color: "#7A6360" }}>เตือนอีกครั้ง</span>
                  <span style={{ color: "#3A2C29", fontWeight: 600 }}>{until === "indefinite" ? "เมื่อคุณเปิดเอง" : toBuddhistDate(until)}</span>
                </div>
              </div>
              {gender === "female" && (
                <div style={{ display: "flex", gap: 9, background: "#FBEFEC", borderRadius: 12, padding: "11px 12px", marginTop: 12, fontSize: 12.5, lineHeight: 1.6, color: "#5C4A46" }}>
                  <Info size={15} color="#9A3B33" aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }} />
                  <div><b style={{ color: "#3A2C29" }}>สำหรับคุณแม่</b><br />ช่วงตั้งครรภ์และให้นมบุตรต้องงดบริจาค หลังคลอดหรือแท้งบุตรรอ 6 เดือน (เกณฑ์สภากาชาดไทย)</div>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 11.5, color: "#7A6360", marginTop: 12 }}>
                <Lock size={12} color="#7A6360" aria-hidden="true" /> แอปไม่ถามและไม่เก็บเหตุผลที่พัก
              </div>
              <button onClick={() => apply(until)}
                style={{ width: "100%", marginTop: 14, minHeight: 46, borderRadius: 12, border: "none", background: "#9A3B33", color: "#FFF7F5", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                {paused ? "เปลี่ยนระยะเวลาพัก" : "เริ่มพักการเตือน"}
              </button>
              {paused && (
                <button onClick={() => apply("")}
                  style={{ width: "100%", marginTop: 8, minHeight: 46, borderRadius: 12, border: "none", background: "#F3EAE8", color: "#9A3B33", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                  เปิดการเตือนตอนนี้
                </button>
              )}
              </FadeScroll>
            </div>
          </div>
        );
      })()}

      {showForm && (
        <div role="dialog" aria-modal="true" aria-label={editingId ? "แก้ไขข้อมูลการบริจาคโลหิต" : "ระบุข้อมูลการบริจาคโลหิต"} style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "#FBF6F5", width: "100%", maxWidth: 380, borderRadius: 18, padding: "20px 12px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 8px 14px" }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{editingId ? "แก้ไขข้อมูลการบริจาคโลหิต" : "ระบุข้อมูลการบริจาคโลหิต"}</div>
              <button onClick={closeForm} aria-label="ปิด" style={{ background: "none", border: "none", cursor: "pointer", color: "#3A2C29" }}><X size={20} /></button>
            </div>
            {/* White card around the fields (same look as the boxes in the profile / "เคยบริจาคมาแล้ว"
                forms); the action buttons sit below it, outside the card. */}
            <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 14, padding: "16px 14px 4px" }}>
            <div className="date-time-row" style={{ marginBottom: 6 }}>
              <div style={{ minWidth: 0 }}>
                <label style={{ fontSize: 13, color: "#7A6360", display: "block", marginBottom: 6 }}>วันที่บริจาค</label>
                {/* lang="en-US" pins iOS Safari's native date-picker display to the
                    Gregorian calendar. Without it, a device set to Thailand region
                    renders a broken hybrid like "18 Sep BE 2569" (English month +
                    Buddhist year) — this only affects the native picker's own text,
                    not any date we render ourselves (toBuddhistDateTime() etc. are
                    unaffected). See handoff doc decision log for the report. */}
                {/* height (instead of vertical padding) keeps this a fixed 44px
                    regardless of platform. Native date/time controls in iOS's
                    WKWebView (used by LINE's in-app browser) bring their own
                    generous intrinsic content height — vertical padding stacks
                    on TOP of that instead of being absorbed by it, which is why
                    this looked unusually tall specifically when opened via LINE
                    on iPhone. A fixed height + horizontal-only padding lets the
                    native control center itself inside a box we actually control. */}
                {/* boxSizing/maxWidth/minWidth pinned explicitly (not just relying
                    on the global *{box-sizing:border-box} reset) because iOS's
                    native date/time control is a replaced element with its own
                    intrinsic layout — under a narrow container (this modal is only
                    ~340px of usable width) WebKit can render it wider than the
                    width:100% we ask for and let it spill past the field's own
                    rounded border. The clipWrap below hugs ONLY the input (not the
                    label above it) with overflow:hidden + matching borderRadius:
                    wrapping the label too would put the rounded corner up at the
                    label's top edge instead of the input's, leaving the input's own
                    top-right corner as a flat, uncurved clip -- exactly the square-
                    notch look reported. Hugging just the input keeps its rounded
                    box intact and only clips real overflow, invisibly. */}
                {/* Border moved onto THIS wrapper instead of the input itself.
                    Pixel-checked a real device screenshot: the input was still
                    overflowing the wrapper by a couple of pixels, and
                    overflow:hidden was clipping away the input's own 1px right
                    border along with the sliver of overflow -- fill stayed
                    intact but the border vanished on that side only. A border
                    can't be clipped off if it isn't drawn on the element being
                    clipped: this wrapper's own border always sits exactly at
                    its own edge, regardless of how wide the input inside
                    renders or gets cut off. */}
                {/* Border turns red while formError is specifically about this field.
                    A plain .focus() call alone isn't enough to visibly point the user
                    at the date field here: the wrapper's own overflow:hidden (see the
                    comment above) clips off the browser's default focus outline right
                    along with everything else it clips, so without this the field would
                    silently receive focus with no visible sign of it. Cleared back to
                    the neutral border via onChange since date-related errors only ever
                    exist because form.date was empty/invalid/in the future -- picking
                    any valid date resolves all three at once. */}
                <div style={{ overflow: "hidden", borderRadius: 10, background: "#FFFFFF", border: `1px solid ${(dateFieldHasError || sameDateConflict) ? "#B3261E" : "#E3C8C3"}` }}>
                  <DateField ref={formDateFieldRef} value={form.date} maxDate={todayLocalStr()} ariaLabelPrefix="วันที่บริจาค"
                    onChange={(date) => {
                      setForm(f => ({ ...f, date }));
                      // Picking a date resolves every date-related message (empty / same-day
                      // conflict) -- clear it right away so the red edge and alert don't linger after the fix.
                      setFormError(e => ((e === "ระบุวันที่บริจาค" || e === sameDateConflictMessage) ? "" : e));
                    }}
                    height={44} fontSize={14} />
                </div>
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={{ fontSize: 13, color: "#7A6360", display: "block", marginBottom: 6 }}>เวลา <span style={{ color: "#B7A5A1" }}>(ไม่บังคับ)</span></label>
                <div style={{ overflow: "hidden", borderRadius: 10, background: "#FFFFFF", border: "1px solid #E3C8C3" }}>
                  <TimeHourMinuteSelect value={form.time} ariaLabelPrefix="เวลาบริจาค"
                    onChange={(time) => setForm(f => ({ ...f, time }))}
                    height={44} fontSize={14} />
                </div>
              </div>
            </div>
            {sameDateConflict ? (
              <FieldError>{sameDateConflictMessage}</FieldError>
            ) : dateFieldHasError ? (
              <FieldError>{formError}</FieldError>
            ) : closeGapWarning && (
              <div style={{ fontSize: 11.5, color: "#9C5515", lineHeight: 1.6, margin: "8px 0 0" }}>{closeGapWarning}</div>
            )}
            <div style={{ marginTop: 14, marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: "#7A6360", display: "block", marginBottom: 6 }}>ประเภทการบริจาค</label>
              {/* Same segmented control as the profile pickers / backup tabs: white outlined track, pale-pink pill on
                  the chosen type (slides between the two). Nothing is chosen by default; a missing type turns the
                  track's edge red. */}
              <div role="radiogroup" aria-label="ประเภทการบริจาค" aria-required="true" style={{ position: "relative", display: "flex", background: "#FFFFFF", borderRadius: 12, padding: 4, border: `1px solid ${formError === TYPE_REQUIRED_MESSAGE ? "#B3261E" : "#E3C8C3"}` }}>
                {(() => {
                  const idx = ["whole", "component"].indexOf(form.type);
                  if (idx >= 0) lastTypeIdxRef.current = idx;
                  return (
                    <span aria-hidden="true" style={{ position: "absolute", top: 4, bottom: 4, left: `calc(4px + ${idx >= 0 ? idx : lastTypeIdxRef.current} * (100% - 8px) / 2)`, width: "calc((100% - 8px) / 2)", borderRadius: 9, background: "#F3E7E4", opacity: idx >= 0 ? 1 : 0, transition: "left .22s, opacity .18s" }} />
                  );
                })()}
                <SegDividers n={2} sel={["whole", "component"].indexOf(form.type)} />
                {["whole", "component"].map((t) => {
                  const on = form.type === t;
                  return (
                    <button key={t} type="button" role="radio" aria-checked={on} onClick={() => {
                        // Tapping the chosen type again takes it back off (nothing selected), like the profile pickers.
                        if (on) { setForm(f => ({ ...f, type: "" })); return; }
                        setForm(f => ({ ...f, type: t })); setFormError(e => (e === TYPE_REQUIRED_MESSAGE ? "" : e));
                      }}
                      style={{ position: "relative", zIndex: 1, flex: 1, minWidth: 0, height: 40, border: "none", background: "none", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, whiteSpace: "nowrap", fontWeight: on ? 600 : 400, color: on ? "#8A2F28" : "#A38D89", transition: "color .2s" }}>
                      {DONATION_TYPE_LABELS[t]}
                    </button>
                  );
                })}
              </div>
              {formError === TYPE_REQUIRED_MESSAGE && <FieldError>{formError}</FieldError>}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: "#7A6360", display: "block", marginBottom: 6 }}>สถานที่ <span style={{ color: "#B7A5A1" }}>(ไม่บังคับ)</span></label>
              <input type="text" value={form.location} placeholder="เช่น ศูนย์บริการโลหิตแห่งชาติ สภากาชาดไทย" maxLength={MAX_LOCATION_LEN}
                onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
                style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #E3C8C3", fontSize: 14, fontFamily: "inherit" }} />
              <div style={{ fontSize: 11, color: "#B7A5A1", textAlign: "right", marginTop: 4 }}>{form.location.length}/{MAX_LOCATION_LEN}</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: "#7A6360", display: "block", marginBottom: 6 }}>บันทึกช่วยจำ <span style={{ color: "#B7A5A1" }}>(ไม่บังคับ)</span></label>
              <textarea value={form.note} placeholder="การบริจาคโลหิตครั้งนี้เป็นอย่างไรบ้าง ?" maxLength={MAX_NOTE_LEN} rows={3}
                onChange={(e) => setForm(f => ({ ...f, note: e.target.value }))}
                style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #E3C8C3", fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
              <div style={{ fontSize: 11, color: "#B7A5A1", textAlign: "right", marginTop: 4 }}>{form.note.length}/{MAX_NOTE_LEN}</div>
            </div>
            </div>
            {formError && !dateFieldHasError && formError !== TYPE_REQUIRED_MESSAGE && formError !== sameDateConflictMessage && (
              <div role="alert" style={{ display: "flex", gap: 8, background: "#FBEAE8", border: "1px solid #F0C4BE", borderRadius: 12, padding: "10px 12px", margin: "12px 0 0" }}>
                <AlertCircle size={14} color="#B3261E" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 12, color: "#B3261E", lineHeight: 1.55 }}>{formError}</div>
              </div>
            )}
            {formSaveError && <div style={{ marginTop: 4 }}><FieldError>{formSaveError}</FieldError></div>}
            <div style={{ display: "flex", gap: 10, marginTop: formSaveError ? 10 : 14 }}>
              <button onClick={cancelForm} disabled={saving} className="btn-ghost" style={{ flex: 1, padding: "11px 0", borderRadius: 10, fontSize: 14, fontFamily: "inherit", cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={submitDonation} disabled={saving || sameDateConflict || editFormUnchanged} className="btn-primary" style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: (saving || sameDateConflict || editFormUnchanged) ? "not-allowed" : "pointer", opacity: (sameDateConflict || editFormUnchanged) ? 0.55 : 1 }}>
                {saving ? "กำลังบันทึก..." : (editingId ? "บันทึกการแก้ไข" : "บันทึก")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showOnboardingChoice && (
        <div role="dialog" aria-modal="true" aria-label="เริ่มบันทึกการบริจาคเลือด" style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div style={{ background: "#FBF6F5", width: "100%", maxWidth: 380, borderRadius: 18, padding: 22, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>นี่คือการบริจาคโลหิตครั้งใด?</div>
              <button onClick={() => setShowOnboardingChoice(false)} aria-label="ปิด" style={{ background: "none", border: "none", cursor: "pointer", color: "#3A2C29" }}><X size={20} /></button>
            </div>
            <p style={{ fontSize: 13, color: "#7A6360", lineHeight: 1.6, margin: "0 0 16px" }}>
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
          <div style={{ background: "#FBF6F5", width: "100%", maxWidth: 380, maxHeight: "90vh", borderRadius: 18 , display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, padding: "22px 22px 10px" }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>เคยบริจาคเลือดมาแล้วกี่ครั้ง?</div>
              <button onClick={cancelStartingCountQuickEntry} aria-label="ปิด" style={{ background: "none", border: "none", cursor: "pointer", color: "#3A2C29" }}><X size={20} /></button>
            </div>
            <FadeScroll style={{ padding: "0 22px 22px" }}>
            <p style={{ fontSize: 13, color: "#7A6360", lineHeight: 1.6, margin: "0 0 16px" }}>
              เปิดสวิตช์ของประเภทที่เคยบริจาค แล้วกรอกจำนวนครั้งทั้งหมด (รวมครั้งล่าสุด) และวันที่บริจาคล่าสุด
            </p>

            {/* Soft, non-blocking nudge only -- age stays fully optional
                everywhere else in the app (privacy-conscious by design, PDPA
                self-assessment doc), so this never gates or forces anything.
                Without a known age, the count caps above already fall back
                to the full 17-70 eligibility window (still catches obviously
                fabricated numbers) -- this just lets the donor know a real
                age would tighten that check to their own actual situation,
                and leaves the choice entirely to them. */}
            {age === "" && (
              <div style={{ display: "flex", gap: 8, background: "#F3EAE8", border: "1px solid #E9D3CE", borderRadius: 12, padding: "10px 12px", marginBottom: 14 }}>
                <Info size={14} color="#9A3B33" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 11.5, color: "#7A6360", lineHeight: 1.5 }}>
                  ยังไม่ได้กรอกอายุในโปรไฟล์ — หากกรอกไว้ ระบบจะช่วยตรวจสอบว่าจำนวนครั้งที่กรอกสมเหตุสมผลกับช่วงอายุได้แม่นยำขึ้น (ไม่บังคับ)
                </div>
              </div>
            )}

            {[
              { key: "whole", label: "โลหิตรวม", on: quickTypeOnWhole, setOn: setQuickTypeOnWhole, draft: quickStartingCountWholeDraft, setDraft: setQuickStartingCountWholeDraft, form: quickEntryFormWhole, setForm: setQuickEntryFormWhole, countRef: quickCountInputRefWhole, dateRef: quickDateInputRefWhole, max: maxStartingCountWhole },
              { key: "component", label: "พลาสมา/เกล็ดเลือด", on: quickTypeOnComponent, setOn: setQuickTypeOnComponent, draft: quickStartingCountComponentDraft, setDraft: setQuickStartingCountComponentDraft, form: quickEntryFormComponent, setForm: setQuickEntryFormComponent, countRef: quickCountInputRefComponent, dateRef: quickDateInputRefComponent, max: maxStartingCountComponent },
            ].map(({ key, label, on, setOn, draft, setDraft, form: tf, setForm: setTf, countRef, dateRef, max }, idx) => (
              <div key={key} style={{ marginTop: idx === 0 ? 0 : 8, marginBottom: 8 }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "#FFFFFF",
                  border: "1px solid #EEDEDA", borderRadius: on ? "12px 12px 0 0" : 12, borderBottom: on ? "none" : "1px solid #EEDEDA",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: on ? "#3A2C29" : "#7A6360" }}>
                    {key === "component" ? <Droplets size={14} color={on ? "#9A3B33" : "#7A6360"} /> : <Droplet size={14} color={on ? "#9A3B33" : "#7A6360"} />} {label}
                  </div>
                  <button type="button" role="switch" aria-checked={on} aria-label={`เคยบริจาค${label}`} onClick={() => { setOn(v => !v); setQuickStartingCountError(""); }}
                    style={{ width: 38, height: 21, borderRadius: 20, border: "none", cursor: "pointer", position: "relative", background: on ? "#9A3B33" : "#E3C8C3", flexShrink: 0, padding: 0 }}>
                    <span style={{ width: 15, height: 15, borderRadius: "50%", background: "#FFFFFF", position: "absolute", top: 3, left: on ? 20 : 3, transition: "left 0.15s" }} />
                  </button>
                </div>
                {on && (
                  <div style={{ border: "1px solid #EEDEDA", borderTop: "none", borderRadius: "0 0 12px 12px", padding: "12px 14px 14px", background: "#FFFFFF" }}>
                    <label style={{ display: "block", fontSize: 13, color: "#7A6360", marginBottom: 5 }}>จำนวนครั้งที่เคยบริจาคทั้งหมด</label>
                    {/* No autoFocus here: this input mounts the instant the switch above
                        is toggled on, and auto-focusing it would pop the keyboard open
                        immediately without the user tapping anything -- reported directly
                        by the user as unwanted. Let them tap the field themselves. */}
                    <input ref={countRef} type="number" inputMode="numeric" pattern="[0-9]*" min="1" max={max} step="1" value={draft} placeholder="0"
                      onChange={(e) => { setDraft(e.target.value); setQuickStartingCountError(""); }}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${quickStartingCountError && quickErrorField === `${key}-count` ? "#B3261E" : "#E3C8C3"}`, fontSize: 14, fontFamily: "inherit", marginBottom: quickStartingCountError && quickErrorField === `${key}-count` ? 0 : 10 }} />
                    {quickStartingCountError && quickErrorField === `${key}-count` && <div style={{ marginBottom: 10 }}><FieldError>{quickStartingCountError}</FieldError></div>}
                    <div className="date-time-row" style={{ marginBottom: (quickSameDateLive || (quickStartingCountError && quickErrorField === `${key}-date`)) ? 0 : 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <label style={{ display: "block", fontSize: 13, color: "#7A6360", marginBottom: 5 }}>วันที่บริจาค (ครั้งล่าสุด)</label>
                        <div style={{ overflow: "hidden", borderRadius: 10, background: "#FFFFFF", border: `1px solid ${(quickSameDateLive || (quickStartingCountError && quickErrorField === `${key}-date`)) ? "#B3261E" : "#E3C8C3"}` }}>
                          <DateField ref={dateRef} value={tf.date} maxDate={todayLocalStr()} ariaLabelPrefix="วันที่บริจาคครั้งล่าสุด"
                            onChange={(date) => { setTf(f => ({ ...f, date })); setQuickStartingCountError(""); }}
                            height={42} fontSize={14} />
                        </div>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <label style={{ display: "block", fontSize: 13, color: "#7A6360", marginBottom: 5 }}>เวลา <span style={{ color: "#B7A5A1" }}>(ไม่บังคับ)</span></label>
                        <div style={{ overflow: "hidden", borderRadius: 10, background: "#FFFFFF", border: "1px solid #E3C8C3" }}>
                          <TimeHourMinuteSelect value={tf.time} ariaLabelPrefix="เวลาบริจาคครั้งล่าสุด"
                            onChange={(time) => setTf(f => ({ ...f, time }))}
                            height={42} fontSize={14} />
                        </div>
                      </div>
                    </div>
                    {(quickSameDateLive || (quickStartingCountError && quickErrorField === `${key}-date`)) && <div style={{ marginBottom: 10 }}><FieldError>{quickSameDateLive ? "วันที่ของโลหิตรวมกับพลาสมาซ้ำกัน เลือกวันอื่น" : quickStartingCountError}</FieldError></div>}
                    <label style={{ display: "block", fontSize: 13, color: "#7A6360", marginBottom: 5 }}>สถานที่ <span style={{ color: "#B7A5A1" }}>(ไม่บังคับ)</span></label>
                    <input type="text" value={tf.location} placeholder="เช่น ศูนย์บริการโลหิตแห่งชาติ สภากาชาดไทย" maxLength={MAX_LOCATION_LEN}
                      onChange={(e) => setTf(f => ({ ...f, location: e.target.value }))}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #E3C8C3", fontSize: 14, fontFamily: "inherit" }} />
                    <div style={{ fontSize: 11, color: "#B7A5A1", textAlign: "right", marginTop: 4, marginBottom: 10 }}>{tf.location.length}/{MAX_LOCATION_LEN}</div>
                    <label style={{ display: "block", fontSize: 13, color: "#7A6360", marginBottom: 5 }}>บันทึกช่วยจำ <span style={{ color: "#B7A5A1" }}>(ไม่บังคับ)</span></label>
                    <textarea value={tf.note} placeholder="การบริจาคโลหิตครั้งนี้เป็นอย่างไรบ้าง ?" maxLength={MAX_NOTE_LEN} rows={3}
                      onChange={(e) => setTf(f => ({ ...f, note: e.target.value }))}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #E3C8C3", fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
                    <div style={{ fontSize: 11, color: "#B7A5A1", textAlign: "right", marginTop: 4 }}>{tf.note.length}/{MAX_NOTE_LEN}</div>
                  </div>
                )}
              </div>
            ))}

            {quickStartingCountError && !/^(whole|component)-(count|date)$/.test(quickErrorField) && (
              <div style={{ marginBottom: 10 }}><FieldError>{quickStartingCountError}</FieldError></div>
            )}
            {(quickTypeOnWhole || quickTypeOnComponent) && (
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={backFromStartingCountQuickEntry} disabled={saving} className="btn-ghost" style={{ flex: 1, padding: "11px 0", borderRadius: 10, fontSize: 14, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={submitStartingCountQuickEntry} disabled={saving} className="btn-primary" style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
            )}
            </FadeScroll>
          </div>
        </div>
      )}

      {showSettings && (
        <div role="dialog" aria-modal="true" aria-label="ตั้งค่า" onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }} style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div style={{ background: "#FBF6F5", width: "100%", maxWidth: 380, borderRadius: 18, maxHeight: "85vh" , display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, padding: "22px 22px 10px" }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>ตั้งค่า</div>
              <button onClick={() => setShowSettings(false)} aria-label="ปิด" style={{ background: "none", border: "none", cursor: "pointer", color: "#3A2C29" }}><X size={20} /></button>
            </div>
            <FadeScroll style={{ padding: "0 22px 22px" }}>

            <div style={{ fontSize: 11, color: "#9A3B33", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, margin: "0 0 6px" }}>ข้อมูลของฉัน</div>
            <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 12, padding: "0 4px", marginBottom: 18 }}>
              {lastExportCount > 0 && (
                <div style={{ fontSize: 11, color: "#B39B96", padding: "10px 8px 0" }}>ส่งออกล่าสุดตอนมี {lastExportCount} รายการ</div>
              )}
              <button onClick={() => openBackupRestore("export")} disabled={importing} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 8px", background: "none", border: "none", borderBottom: "1px solid #F3E7E4", cursor: "pointer", fontSize: 13.5, color: "#3A2C29", fontFamily: "inherit" }}>
                <Download size={16} color="#9A3B33" /> สำรอง/กู้คืนข้อมูล
              </button>
              <button onClick={() => { setError(""); setShowReset(true); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 8px", background: "none", border: "none", cursor: "pointer", fontSize: 13.5, color: "#B3261E", fontFamily: "inherit" }}>
                <Trash2 size={16} color="#B3261E" /> ลบข้อมูลทั้งหมด
              </button>
            </div>

            <div style={{ fontSize: 11, color: "#9A3B33", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, margin: "0 0 6px" }}>การเตือน</div>
            <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 12, padding: "0 12px 14px", marginBottom: 18 }}>
              <button onClick={() => { setRemindPauseChoice("6"); setShowRemindPause(true); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, minHeight: 52, padding: "6px 0", background: "none", border: "none", borderBottom: "1px solid #F3E7E4", marginBottom: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <BellOff size={16} color="#9A3B33" style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, color: "#3A2C29" }}>พักการเตือนชั่วคราว</span>
                  <span style={{ display: "block", fontSize: 12, color: remindPaused ? "#9C5515" : "#7A6360" }}>
                    {remindPaused ? (remindPauseUntil === "indefinite" ? "พักอยู่ จนกว่าจะเปิดเอง" : `พักถึง ${toBuddhistDate(remindPauseUntil)}`) : "ปิดอยู่"}
                  </span>
                </span>
                <ChevronRight size={16} color="#B7A5A1" style={{ flexShrink: 0 }} />
              </button>
              <label style={{ fontSize: 12.5, color: "#7A6360", display: "block", marginBottom: 6 }}>รอบเตือนบริจาคซ้ำ — โลหิตรวม (วัน)</label>
              <input type="number" inputMode="numeric" pattern="[0-9]*" min={MIN_CYCLE_DAYS} max={MAX_CYCLE_DAYS} step="1" value={cycleDays}
                onChange={(e) => setCycleDays(e.target.value === "" ? "" : Number(e.target.value))}
                onBlur={(e) => updateCycleDays(e.target.value === "" ? DEFAULT_CYCLE_DAYS : e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #E3C8C3", fontSize: 14, fontFamily: "inherit", marginBottom: 4 }} />
              <div style={{ fontSize: 11, color: "#B39B96", marginBottom: 14 }}>ค่าเริ่มต้น {DEFAULT_CYCLE_DAYS} วัน</div>

              <label style={{ fontSize: 12.5, color: "#7A6360", display: "block", marginBottom: 6 }}>รอบเตือนบริจาคซ้ำ — พลาสมา/เกล็ดเลือด (วัน)</label>
              <input type="number" inputMode="numeric" pattern="[0-9]*" min={MIN_CYCLE_DAYS} max={MAX_CYCLE_DAYS} step="1" value={componentCycleDays}
                onChange={(e) => setComponentCycleDays(e.target.value === "" ? "" : Number(e.target.value))}
                onBlur={(e) => updateComponentCycleDays(e.target.value === "" ? DEFAULT_COMPONENT_CYCLE_DAYS : e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #E3C8C3", fontSize: 14, fontFamily: "inherit", marginBottom: 4 }} />
              <div style={{ fontSize: 11, color: "#B39B96", marginBottom: 14 }}>ค่าเริ่มต้น {DEFAULT_COMPONENT_CYCLE_DAYS} วัน — ใช้กับผู้ที่บริจาคพลาสมาหรือเกล็ดเลือด ซึ่งเว้นระยะสั้นกว่าโลหิตรวม</div>

              <label style={{ fontSize: 12.5, color: "#7A6360", display: "block", marginBottom: 6 }}>เตือนสำรองข้อมูลทุก (รายการ)</label>
              <input type="number" inputMode="numeric" pattern="[0-9]*" min={MIN_BACKUP_REMINDER_GAP} max={MAX_BACKUP_REMINDER_GAP} step="1" value={backupReminderGap}
                onChange={(e) => setBackupReminderGap(e.target.value === "" ? "" : Number(e.target.value))}
                onBlur={(e) => updateBackupReminderGap(e.target.value === "" ? DEFAULT_BACKUP_REMINDER_GAP : e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #E3C8C3", fontSize: 14, fontFamily: "inherit", marginBottom: 4 }} />
              <div style={{ fontSize: 11, color: "#B39B96" }}>ค่าเริ่มต้นทุก {DEFAULT_BACKUP_REMINDER_GAP} รายการที่เพิ่ม</div>
            </div>

            <div style={{ fontSize: 11, color: "#9A3B33", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, margin: "0 0 6px" }}>เกี่ยวกับ</div>
            <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 12, padding: "0 4px" }}>
              <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 8px", borderBottom: "1px solid #F3E7E4", fontSize: 13.5, color: "#3A2C29" }}>
                <span>เวอร์ชันแอป</span>
                <span style={{ color: "#7A6360", fontSize: 12 }}>{APP_VERSION}</span>
              </div>
              <button onClick={() => { setShowSettings(false); setShowPrivacy(true); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 8px", background: "none", border: "none", borderBottom: "1px solid #F3E7E4", cursor: "pointer", fontSize: 13.5, color: "#3A2C29", fontFamily: "inherit" }}>
                <Info size={16} color="#9A3B33" /> ความเป็นส่วนตัว
              </button>
              <div title="ช่องทางนี้ยังไม่เปิดให้ใช้งานในตอนนี้" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 8px", fontSize: 13.5, color: "#B7A5A1", cursor: "default" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}><Mail size={16} color="#B7A5A1" /> ส่งความคิดเห็น / แจ้งปัญหา</span>
                <span style={{ fontSize: 11.5, background: "#F3E7E4", color: "#9A8480", padding: "2px 7px", borderRadius: 20 }}>เร็วๆ นี้</span>
              </div>
            </div>
            </FadeScroll>
          </div>
        </div>
      )}

      {showPrivacy && (
        <div role="dialog" aria-modal="true" aria-label="นโยบายความเป็นส่วนตัว" onClick={(e) => { if (e.target === e.currentTarget) { setShowPrivacy(false); if (privacyFromProfileRef.current) { privacyFromProfileRef.current = false; setShowProfile(true); } else setShowSettings(true); } }} style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div className="selectable" style={{ background: "#FBF6F5", width: "100%", maxWidth: 420, maxHeight: "85vh", borderRadius: 18, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 22px 4px", flexShrink: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>นโยบายความเป็นส่วนตัว</div>
              <button onClick={() => { setShowPrivacy(false); if (privacyFromProfileRef.current) { privacyFromProfileRef.current = false; setShowProfile(true); } else setShowSettings(true); }} aria-label="ปิด" style={{ background: "none", border: "none", cursor: "pointer", color: "#3A2C29" }}><X size={20} /></button>
            </div>
            <p style={{ fontSize: 11, color: "#B7A5A1", margin: "0 22px 12px", flexShrink: 0 }}>
              มีผลบังคับใช้: {PRIVACY_POLICY_EFFECTIVE_DATE} · เวอร์ชันแอป {APP_VERSION}
            </p>
            <FadeScroll style={{ padding: "0 22px 22px" }}>
              {PRIVACY_POLICY_SECTIONS.map((sec, i) => (
                <div key={i} style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 14, padding: "12px 14px", marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#3A2C29", margin: "0 0 5px" }}>{sec.heading}</div>
                  {sec.body.map((p, j) => (
                    <p key={j} style={{ fontSize: 12.5, color: "#5C4A46", lineHeight: 1.7, margin: j === 0 ? 0 : "6px 0 0" }}>
                      {p}
                    </p>
                  ))}
                </div>
              ))}
              <p style={{ fontSize: 13, color: "#5C4A46", lineHeight: 1.7, margin: "4px 2px 0" }}>
                ให้ความยินยอมเมื่อ: {new Date().toLocaleDateString("th-TH")}
              </p>
            </FadeScroll>
          </div>
        </div>
      )}

      {showClearProfile && (
        <div role="dialog" aria-modal="true" aria-label="ยืนยันการลบข้อมูลโปรไฟล์"
          onClick={(e) => { if (e.target === e.currentTarget) setShowClearProfile(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: 20 }}>
          <div style={{ background: "#FBF6F5", width: "100%", maxWidth: 360, borderRadius: 18, padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>ลบข้อมูลโปรไฟล์?</div>
              <DialogX onClick={() => setShowClearProfile(false)} />
            </div>
            <p style={{ fontSize: 13, color: "#5C4A46", lineHeight: 1.6, margin: "0 0 12px" }}>ข้อมูลโปรไฟล์ของคุณจะถูกลบ และกู้คืนไม่ได้</p>
            {/* Two stacked white boxes (design D3 of clear-profile-d.html): what goes, then what stays; each list in
                two columns (one on very narrow phones, so no item wraps) with its mark in a soft tinted circle. */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {[
                { key: "gone", title: "ลบออก", mark: "✕", color: "#B3261E", tint: "#FBEAE8", items: ["ชื่อ-นามสกุล", "รูปโปรไฟล์", "ปีเกิด", "เพศ", "ส่วนสูง", "น้ำหนัก", "หมู่โลหิต / Rh", "ประเภทผู้บริจาค", "เลขประจำตัว"] },
                { key: "stay", title: "เก็บไว้", mark: "✓", color: "#2E7D4F", tint: "#EAF4EE", items: ["ประวัติการบริจาค", "สถิติทั้งหมด", "ยอดสะสมที่ยกมา"] }
              ].map(col => (
                <div key={col.key} style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 14, padding: "10px 12px 11px" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: col.color, marginBottom: 6 }}>{col.title}</div>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(128px, 1fr))", columnGap: 10, rowGap: 3, fontSize: 13, lineHeight: 1.55, color: "#3A2C29" }}>
                    {col.items.map(t => (
                      <li key={t} style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: "50%", background: col.tint || "#FBEAE8", color: col.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, lineHeight: 1, flexShrink: 0 }}>{col.mark}</span>
                        <span style={{ minWidth: 0 }}>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            {clearProfileError && <div style={{ margin: "-8px 0 12px" }}><FieldError>{clearProfileError}</FieldError></div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowClearProfile(false)} className="btn-ghost" style={{ flex: 1, padding: "11px 0", borderRadius: 10, fontSize: 14, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={clearProfileData} disabled={saving} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: "#B3261E", color: "#FFF7F5", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>ลบข้อมูล</button>
            </div>
          </div>
        </div>
      )}

      {showReset && (
        <div role="dialog" aria-modal="true" aria-label="ยืนยันการลบข้อมูลทั้งหมด" onClick={(e) => { if (e.target === e.currentTarget) { if (!saving) setShowReset(false); } }} style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div style={{ background: "#FBF6F5", width: "100%", maxWidth: 360, borderRadius: 18, padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>ลบข้อมูลทั้งหมด?</div>
              <DialogX disabled={saving} onClick={() => setShowReset(false)} />
            </div>
            <p style={{ fontSize: 13, color: "#5C4A46", lineHeight: 1.7, margin: "0 0 18px" }}>
              ประวัติการบริจาคทั้งหมด {donations.length} รายการ{startingCountNum > 0 ? ` และยอดสะสมยกมา ${startingCountNum} ครั้ง` : ""} จะถูกลบอย่างถาวรและกู้คืนไม่ได้
            </p>
            {error && <div style={{ margin: "-6px 0 14px" }}><FieldError>{error}</FieldError></div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowReset(false)} disabled={saving} className="btn-ghost" style={{ flex: 1, padding: "11px 0", borderRadius: 10, fontSize: 14, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={resetAll} disabled={saving} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: "#B3261E", color: "#FFF7F5", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                {saving ? "กำลังลบ..." : "ลบข้อมูล"}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewDonationId && (() => {
        const vd = donations.find(x => x.id === viewDonationId);
        if (!vd) return null;
        const vTint = DONATION_TYPE_TINT[vd.type === "component" ? "component" : "whole"];
        const vn = donationOrderMap[vd.id];
        const rowS = { display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid #F3E7E4", alignItems: "flex-start" };
        // Label column: the block of labels is centred on the drop's axis as wide as "ประเภท" (the ghost span
        // sizes it), and every label starts at that block's left edge so all three share one left edge.
        const lbl = (t) => (
          <div style={{ width: 50, flexShrink: 0, display: "flex", justifyContent: "center", fontSize: 12, lineHeight: 1.6, color: "#A38D89" }}>
            <div style={{ position: "relative" }}>
              <span aria-hidden="true" style={{ visibility: "hidden" }}>ประเภท</span>
              <span style={{ position: "absolute", left: 0, top: 0, whiteSpace: "nowrap" }}>{t}</span>
            </div>
          </div>
        );
        const valS = { flex: 1, minWidth: 0, fontSize: 12, color: "#3A2C29", lineHeight: 1.6, wordBreak: "break-word" };
        return (
          <div role="dialog" aria-modal="true" aria-label="รายละเอียดรายการบริจาค" onClick={(e) => { if (e.target === e.currentTarget) setViewDonationId(null); }} style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
            <div style={{ background: "#FFFFFF", width: "100%", maxWidth: 360, borderRadius: 20, padding: "20px 18px 14px", maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 50, height: 60, position: "relative", flexShrink: 0 }}>
                  <svg width="50" height="60" viewBox="0 0 46 56" fill="none" style={{ position: "absolute", inset: 0 }}>
                    <path d="M23 2 C23 2 40 24 40 35 C40 45.5 32.5 54 23 54 C13.5 54 6 45.5 6 35 C6 24 23 2 23 2 Z" fill="#9A3B33" />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, top: 7, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ fontSize: String(vn).length >= 3 ? 13 : 16, fontWeight: 800, color: "#FFF7F5", lineHeight: 1.1 }}>{vn}</div>
                    <div style={{ fontSize: 11, color: "#FFF7F5", opacity: 0.9, marginTop: 1 }}>ครั้งที่</div>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#241A18", lineHeight: 1.5 }}>{toBuddhistDateFull(vd.date)}</div>
                  <div style={{ fontSize: 13, color: vd.time ? "#7A6360" : "#A38D89", marginTop: 1 }}>{vd.time ? `เวลา\u00A0${vd.time}\u00A0น.` : "ไม่ระบุเวลา"}</div>
                </div>
                <DialogX onClick={() => setViewDonationId(null)} style={{ alignSelf: "flex-start" }} />
              </div>
              <div style={{ marginTop: 14, borderTop: "1px solid #F3E7E4" }}>
                <div style={rowS}>{lbl("ประเภท")}<div style={valS}><span style={{ color: vTint.text, fontWeight: 600 }}>{DONATION_TYPE_LABELS[vd.type === "component" ? "component" : "whole"]}</span></div></div>
                <div style={rowS}>{lbl("สถานที่")}<div style={vd.location ? valS : { ...valS, color: "#A38D89" }}>{vd.location || "—"}</div></div>
                <div style={rowS}>{lbl("โน้ต")}<div style={vd.note ? valS : { ...valS, color: "#A38D89" }}>{vd.note || "—"}</div></div>
                {vd.loggedAt && (
                  <ModalMetaLine>
                    {(vd.createdAt && vd.createdAt !== vd.loggedAt) ? "แก้ไขล่าสุดเมื่อ" : "บันทึกเมื่อ"} {toBuddhistDateTimeFull(vd.loggedAt)}
                  </ModalMetaLine>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {viewStartingCount && displayedStartingCount > 0 && (() => {
        // Read-only detail for the carried-over total ("เคยบริจาคมาก่อน"), mirroring the donation
        // detail modal: badge + title on top, one row per carried-over type, and the logged-at line.
        const svRowS = { display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid #F3E7E4", alignItems: "flex-start" };
        const svLbl = (t) => (
          <div style={{ width: 50, flexShrink: 0, display: "flex", justifyContent: "center", fontSize: 12, lineHeight: 1.6, color: "#A38D89" }}>
            <div style={{ position: "relative" }}>
              <span aria-hidden="true" style={{ visibility: "hidden" }}>ประเภท</span>
              <span style={{ position: "absolute", left: 0, top: 0, whiteSpace: "nowrap" }}>{t}</span>
            </div>
          </div>
        );
        const svVal = { flex: 1, minWidth: 0, fontSize: 12, color: "#3A2C29", lineHeight: 1.6 };
        return (
          <div role="dialog" aria-modal="true" aria-label="รายละเอียดยอดสะสมที่เคยบริจาคมาก่อน" onClick={(e) => { if (e.target === e.currentTarget) setViewStartingCount(false); }} style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
            <div style={{ background: "#FFFFFF", width: "100%", maxWidth: 360, borderRadius: 20, padding: "20px 18px 14px", maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 50, height: 50, borderRadius: 14, background: "#FFFFFF", border: "1px solid #E3C8C3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <div style={{ fontSize: String(displayedStartingCount).length >= 3 ? 13 : 16, fontWeight: 800, color: "#9A3B33", lineHeight: 1.1 }}>+{displayedStartingCount}</div>
                  <div style={{ fontSize: 11, color: "#9A3B33", opacity: 0.75, marginTop: 1 }}>สะสม</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#241A18", lineHeight: 1.5 }}>บริจาคมาแล้ว <span style={{ whiteSpace: "nowrap" }}>{displayedStartingCount} ครั้ง</span></div>
                  <div style={{ fontSize: 13, color: "#7A6360", marginTop: 1 }}>ก่อนเริ่มใช้แอป</div>
                </div>
                <DialogX onClick={() => setViewStartingCount(false)} style={{ alignSelf: "flex-start" }} />
              </div>
              <div style={{ marginTop: 14, borderTop: "1px solid #F3E7E4" }}>
                {historyTypeFilter !== "component" && startingCountWholeNum > 0 && <div style={svRowS}>{svLbl("โลหิตรวม")}<div style={svVal}><span style={{ color: "#9A3B33", fontWeight: 600 }}>{startingCountWholeNum}</span> ครั้ง</div></div>}
                {historyTypeFilter !== "whole" && startingCountComponentNum > 0 && <div style={svRowS}>{svLbl("พลาสมา")}<div style={svVal}><span style={{ color: "#9A3B33", fontWeight: 600 }}>{startingCountComponentNum}</span> ครั้ง</div></div>}
                {startingCountUpdatedAt && (
                  <ModalMetaLine>
                    {(startingCountCreatedAt && startingCountCreatedAt !== startingCountUpdatedAt) ? "แก้ไขล่าสุดเมื่อ" : "บันทึกเมื่อ"} {toBuddhistDateTimeFull(startingCountUpdatedAt)}
                  </ModalMetaLine>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {editingStartingCount && (
        <div role="dialog" aria-modal="true" aria-label="แก้ไขจำนวนที่เคยบริจาค" style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "#FBF6F5", width: "100%", maxWidth: 380, borderRadius: 18, padding: "20px 12px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 8px 14px" }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>แก้ไขจำนวนที่เคยบริจาค</div>
              <button onClick={cancelEditStartingCount} aria-label="ปิด" style={{ background: "none", border: "none", cursor: "pointer", color: "#3A2C29" }}><X size={20} /></button>
            </div>
            <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 14, padding: "16px 14px 14px" }}>
              <label style={{ fontSize: 13, color: "#7A6360", display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}><Trophy size={13} /> จำนวนครั้งที่เคยบริจาคมาก่อน (ไม่รวมครั้งล่าสุด)</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {historyTypeFilter !== "component" && <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#7A6360", marginBottom: 6 }}><Droplet size={12} color="#9A3B33" /> โลหิตรวม</div>
                  <input type="number" inputMode="numeric" pattern="[0-9]*" min="0" max={maxStartingCountWhole} step="1" value={startingCountDraftWhole} placeholder="0" aria-label="จำนวนครั้งโลหิตรวม"
                    onChange={(e) => { setStartingCountDraftWhole(e.target.value); setStartingCountEditError(""); }}
                    style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: `1px solid ${startingCountEditError && startingCountEditField === "whole" ? "#B3261E" : "#E3C8C3"}`, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
                  {startingCountEditError && startingCountEditField === "whole" && <FieldError>{startingCountEditError}</FieldError>}
                </div>}
                {historyTypeFilter !== "whole" && <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#7A6360", marginBottom: 6, whiteSpace: "nowrap" }}><Droplets size={12} color="#9A3B33" /> พลาสมา/เกล็ดเลือด</div>
                  <input type="number" inputMode="numeric" pattern="[0-9]*" min="0" max={maxStartingCountComponent} step="1" value={startingCountDraftComponent} placeholder="0" aria-label="จำนวนครั้งพลาสมา/เกล็ดเลือด"
                    onChange={(e) => { setStartingCountDraftComponent(e.target.value); setStartingCountEditError(""); }}
                    style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: `1px solid ${startingCountEditError && startingCountEditField === "component" ? "#B3261E" : "#E3C8C3"}`, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
                  {startingCountEditError && startingCountEditField === "component" && <FieldError>{startingCountEditError}</FieldError>}
                </div>}
              </div>
              {historyTypeFilter !== "all" && (() => {
                const shown = historyTypeFilter === "whole" ? "โลหิตรวม" : "พลาสมา/เกล็ดเลือด";
                const other = historyTypeFilter === "whole" ? "พลาสมา/เกล็ดเลือด" : "โลหิตรวม";
                const otherN = historyTypeFilter === "whole" ? startingCountComponentNum : startingCountWholeNum;
                return (
                  <div style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 11.5, color: "#7A6360", lineHeight: 1.55, marginTop: 12 }}>
                    <SlidersHorizontal size={12} style={{ flexShrink: 0, marginTop: 3 }} />
                    <span>แสดงเฉพาะ{shown}ตามตัวกรอง{otherN > 0 ? ` · ${other} ${otherN} ครั้งไม่เปลี่ยน` : ""}</span>
                  </div>
                );
              })()}
            </div>
            {startingCountEditError && !startingCountEditField && (
              <div role="alert" style={{ display: "flex", gap: 8, background: "#FBEAE8", border: "1px solid #F0C4BE", borderRadius: 12, padding: "10px 12px", margin: "12px 0 0" }}>
                <AlertCircle size={14} color="#B3261E" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 12, color: "#B3261E", lineHeight: 1.55 }}>{startingCountEditError}</div>
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={cancelEditStartingCount} className="btn-ghost" style={{ flex: 1, padding: "11px 0", borderRadius: 10, fontSize: 14, fontFamily: "inherit", cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={saveStartingCountInline} disabled={startingCountEditUnchanged} className="btn-primary" style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: startingCountEditUnchanged ? "not-allowed" : "pointer", opacity: startingCountEditUnchanged ? 0.55 : 1 }}>บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div role="dialog" aria-modal="true" aria-label="ยืนยันการลบรายการ" onClick={(e) => { if (e.target === e.currentTarget) setConfirmDeleteId(null); }} style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div style={{ background: "#FBF6F5", width: "100%", maxWidth: 360, borderRadius: 18, padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {(() => {
                  const target = donations.find(d => d.id === confirmDeleteId);
                  return target ? `ลบรายการบริจาคโลหิตวันที่ ${toBuddhistDate(target.date)} ?` : "ลบรายการนี้ ?";
                })()}
              </div>
              <DialogX onClick={() => setConfirmDeleteId(null)} />
            </div>
            <p style={{ fontSize: 13, color: "#5C4A46", lineHeight: 1.7, margin: "0 0 18px" }}>
              รายการนี้จะถูกลบอย่างถาวร ไม่สามารถกู้คืนได้
            </p>
            {deleteError && <div style={{ margin: "-10px 0 14px" }}><FieldError>{deleteError}</FieldError></div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDeleteId(null)} className="btn-ghost" style={{ flex: 1, padding: "11px 0", borderRadius: 10, fontSize: 14, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={confirmDeleteDonation} disabled={saving} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: "#B3261E", color: "#FFF7F5", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                ลบรายการ
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteStartingCount && (
        <div role="dialog" aria-modal="true" aria-label="ยืนยันการลบยอดสะสมยกมา" onClick={(e) => { if (e.target === e.currentTarget) setConfirmDeleteStartingCount(false); }} style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div style={{ background: "#FBF6F5", width: "100%", maxWidth: 360, borderRadius: 18, padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>ลบยอดสะสมยกมา?</div>
              <DialogX onClick={() => setConfirmDeleteStartingCount(false)} />
            </div>
            <p style={{ fontSize: 13, color: "#5C4A46", lineHeight: 1.7, margin: "0 0 18px" }}>
              จำนวนครั้งที่เคยบริจาคมาก่อนจะถูกล้างเป็น 0 (เหมือนยังไม่เคยกรอกมาก่อน) — กรอกใหม่ได้ทุกเมื่อ ไม่กระทบรายการบริจาคที่บันทึกในแอปโดยตรง
            </p>
            {startCountDeleteError && <div style={{ margin: "-10px 0 14px" }}><FieldError>{startCountDeleteError}</FieldError></div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDeleteStartingCount(false)} className="btn-ghost" style={{ flex: 1, padding: "11px 0", borderRadius: 10, fontSize: 14, cursor: "pointer" }}>ยกเลิก</button>
              <button onClick={confirmDeleteStartingCountNow} disabled={saving} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: "#B3261E", color: "#FFF7F5", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                ลบยอดสะสม
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingImport && (
        <div role="dialog" aria-modal="true" aria-label="ยืนยันการนำเข้าข้อมูล" onClick={(e) => { if (e.target === e.currentTarget) cancelImport(); }} style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div style={{ background: "#FBF6F5", width: "100%", maxWidth: 380, borderRadius: 18, padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>ยืนยันการนำเข้าข้อมูล</div>
              <DialogX onClick={cancelImport} />
            </div>
            <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 12, padding: "2px 12px", margin: "0 0 10px", fontSize: 13, color: "#5C4A46" }}>
              {[
                { label: "ทั้งหมดในไฟล์", n: pendingImport.totalInFile },
                { label: "เพิ่มใหม่", n: pendingImport.incoming.length, bold: true },
                ...(pendingImport.duplicateCount > 0 ? [{ label: "ข้าม (มีอยู่แล้ว)", n: pendingImport.duplicateCount, muted: true }] : []),
                ...(pendingImport.invalidCount > 0 ? [{ label: "ข้าม (วันที่ไม่ถูกต้อง)", n: pendingImport.invalidCount, bad: true }] : []),
              ].map((row, idx, arr) => (
                <div key={row.label} role={row.bad ? "alert" : undefined} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "9px 0", borderBottom: idx < arr.length - 1 ? "1px solid #F3E7E4" : "none", color: row.bad ? "#B3261E" : row.muted ? "#7A6360" : "#5C4A46" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{row.bad && <AlertCircle size={14} aria-hidden="true" style={{ flexShrink: 0 }} />}{row.label}</span>
                  <b style={{ fontWeight: row.bold || row.bad ? 700 : 500 }}>{row.n}</b>
                </div>
              ))}
            </div>
            {pendingImport.incoming.length === 0 && Object.keys(pendingImport.profileFieldsToFill || {}).length === 0 && (
              <p style={{ fontSize: 12.5, color: "#B39B96", lineHeight: 1.7, margin: "0 0 8px" }}>
                {pendingImport.invalidCount > 0 && pendingImport.duplicateCount === 0
                  ? "ไม่มีรายการใหม่ให้เพิ่ม — ทุกรายการมีข้อมูลไม่ถูกต้อง"
                  : "ไม่มีรายการใหม่ให้เพิ่ม — ข้อมูลนี้มีอยู่ในเครื่องแล้วทั้งหมด"}
              </p>
            )}
            {Object.keys(pendingImport.profileFieldsToFill || {}).length > 0 && (
              <p style={{ fontSize: 13, color: "#5C4A46", lineHeight: 1.8, margin: "0 0 8px" }}>
                จะเติมข้อมูลโปรไฟล์ที่ยังว่างอยู่ให้ด้วย: {Object.keys(pendingImport.profileFieldsToFill).map(k => ({ nickname: "ชื่อ-นามสกุล", birthYear: "ปีเกิด", gender: "เพศ", height: "ส่วนสูง", donorId: "เลขผู้บริจาค", bloodRh: "Rh", remindPauseUntil: "การพักการเตือน", weight: "น้ำหนัก", bloodType: "หมู่โลหิต", donorType: "ประเภทผู้บริจาค" }[k])).filter(Boolean).join(", ")}
                <br /><span style={{ fontSize: 11.5, color: "#B39B96" }}>(ช่องที่คุณกรอกไว้แล้วจะไม่ถูกเขียนทับ)</span>
              </p>
            )}
            {importConfirmError && <FieldError>{importConfirmError}</FieldError>}
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button onClick={cancelImport} disabled={importSaving} className="btn-ghost" style={{ flex: 1, padding: "11px 0", borderRadius: 10, fontSize: 14, cursor: "pointer" }}>ยกเลิก</button>
              <button
                onClick={confirmImport}
                disabled={importSaving || (pendingImport.incoming.length === 0 && Object.keys(pendingImport.profileFieldsToFill || {}).length === 0)}
                className="btn-primary"
                style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                {importSaving ? "กำลังนำเข้า..." : "นำเข้า"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBackupRestore && showPlainWarn && (
        <div role="alertdialog" aria-modal="true" aria-label="ส่งออกแบบไม่เข้ารหัส" style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 24 }}>
          <div style={{ background: "#FFFFFF", width: "100%", maxWidth: 380, borderRadius: 18, padding: "20px 18px 16px", boxShadow: "0 8px 30px rgba(58,44,41,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700, color: "#3A2C29", marginBottom: 8 }}>
              <AlertTriangle size={19} color="#B3261E" aria-hidden="true" style={{ flexShrink: 0 }} /> <span style={{ flex: 1 }}>ส่งออกแบบไม่เข้ารหัส?</span>
              <DialogX onClick={() => { setShowPlainWarn(false); setPlainWarnAck(false); }} />
            </div>
            <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "#5C4A46", margin: "0 0 12px" }}>ใครได้ไฟล์ไปก็เห็นข้อมูลทั้งหมด เช่น หมู่เลือด เลขผู้บริจาค ประวัติบริจาค ถ้าส่งผ่านแชทหรือเก็บในไดรฟ์ ควรเข้ารหัสไว้</p>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, lineHeight: 1.5, color: "#3A2C29", marginBottom: 14, cursor: "pointer" }}>
              <input type="checkbox" checked={plainWarnAck} onChange={(e) => setPlainWarnAck(e.target.checked)} style={{ width: 20, height: 20, marginTop: 1, accentColor: "#9A3B33", flexShrink: 0 }} />
              <span>เข้าใจแล้ว และจะเก็บไฟล์ไว้เอง</span>
            </label>
            <button type="button" onClick={() => { setShowPlainWarn(false); setPlainWarnAck(false); }} className="btn-primary"
              style={{ width: "100%", padding: "13px 0", borderRadius: 14, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 8 }}>
              กลับไปใช้รหัสผ่าน
            </button>
            <button type="button" onClick={goPlainExport} disabled={!plainWarnAck}
              style={{ width: "100%", padding: "12px 0", borderRadius: 14, border: "1px solid #E3C8C3", background: "#FFFFFF", color: "#9A3B33", fontSize: 14, fontFamily: "inherit", cursor: plainWarnAck ? "pointer" : "not-allowed", opacity: plainWarnAck ? 1 : 0.45 }}>
              ส่งออกแบบไม่เข้ารหัส
            </button>
          </div>
        </div>
      )}

      {showBackupRestore && (
        <div role="dialog" aria-modal="true" aria-label="สำรอง/กู้คืนข้อมูล" style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div style={{ background: "#FBF6F5", width: "100%", maxWidth: 420, borderRadius: 18, maxHeight: "92vh" , display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, padding: "22px 22px 10px" }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>สำรอง/กู้คืนข้อมูล</div>
              <button onClick={closeBackupRestore} aria-label="ปิด" style={{ background: "none", border: "none", cursor: "pointer", color: "#3A2C29" }}><X size={20} /></button>
            </div>
            <FadeScroll scrollRef={backupDialogRef} style={{ padding: "0 22px 22px" }}>

            <div style={{ display: "flex", background: "#FFFFFF", border: "1px solid #E3C8C3", borderRadius: 12, padding: 4, marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => switchBackupRestoreTab("export")}
                style={{
                  flex: 1, border: "none", padding: "10px 0", borderRadius: 9, fontFamily: "inherit", cursor: "pointer",
                  background: backupRestoreTab === "export" ? "#F3E7E4" : "transparent",
                  color: backupRestoreTab === "export" ? "#8A2F28" : "#A38D89",
                  fontSize: 13.5, fontWeight: backupRestoreTab === "export" ? 600 : 400,
                  boxShadow: "none",
                }}>
                สำรองข้อมูล
              </button>
              <button
                type="button"
                onClick={() => switchBackupRestoreTab("import")}
                style={{
                  flex: 1, border: "none", padding: "10px 0", borderRadius: 9, fontFamily: "inherit", cursor: "pointer",
                  background: backupRestoreTab === "import" ? "#F3E7E4" : "transparent",
                  color: backupRestoreTab === "import" ? "#8A2F28" : "#A38D89",
                  fontSize: 13.5, fontWeight: backupRestoreTab === "import" ? 600 : 400,
                  boxShadow: "none",
                }}>
                กู้คืนข้อมูล
              </button>
            </div>

            {/* Both tab panels are always mounted, stacked in the same CSS
                grid cell (an exact equal-height "crossfade tabs" technique).
                The inactive panel keeps visibility:hidden (not display:none),
                so it still occupies layout space and the grid row sizes to
                whichever panel is taller — the dialog's height stays exactly
                the same no matter which tab is active, with no hand-tuned
                min-height number to keep in sync as the content changes. */}
            <div style={{ display: "grid" }}>
              <div style={{
                gridArea: "1 / 1",
                visibility: backupRestoreTab === "export" ? "visible" : "hidden",
                pointerEvents: backupRestoreTab === "export" ? "auto" : "none",
                // The password fields make this tab much taller; don't make the
                // import tab as tall while it's hidden.
                display: backupRestoreTab !== "export" && exportProtect ? "none" : undefined,
              }} aria-hidden={backupRestoreTab !== "export"}>
                <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 14, padding: "12px 14px", marginBottom: 14 }}>
                  <p style={{ margin: "0 0 4px", fontSize: 12, color: "#7A6360" }}>จำนวนรายการบริจาคที่บันทึกไว้</p>
                  <p style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "#3A2C29" }}>{donations.length} รายการ</p>
                </div>
                <p style={{ fontSize: 12.5, color: "#7A6360", lineHeight: 1.7, margin: "0 0 12px" }}>
                  กด "ดาวน์โหลดไฟล์" เพื่อบันทึกหรือแชร์เป็นไฟล์ หรือถ้าใช้ไม่ได้ ให้กด "คัดลอกข้อความ" แล้วนำไปวางเก็บไว้ในไฟล์ข้อความ/โน้ตของคุณแทนได้เลย
                  <br /><span style={{ fontSize: 11, color: "#B39B96" }}>(ไฟล์นี้ไม่รวมรูปโปรไฟล์ — หลังนำเข้าจะต้องอัปโหลดรูปใหม่ ส่วนรอบบริจาค/ระยะแจ้งเตือนที่ตั้งไว้จะรวมอยู่ในไฟล์นี้ด้วย)</span>
                </p>
                {exportProtect && (
                  <div role="note" style={{ display: "flex", gap: 10, background: "#EAF4EE", borderRadius: 12, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.55, color: "#2C4A38", marginBottom: 12 }}>
                    <ShieldCheck size={17} color="#2E7D4F" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div><b style={{ color: "#1F3A2B" }}>ไฟล์สำรองเข้ารหัสทุกครั้ง</b><br />ข้อมูลสุขภาพของคุณจะอ่านไม่ได้ ถ้าไม่มีรหัสผ่าน</div>
                  </div>
                )}
                {!exportProtect && (
                  <div role="note" style={{ display: "flex", gap: 10, background: "#FFF3DC", border: "1px solid #F2D9A4", borderRadius: 12, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.55, color: "#6B4A00", marginBottom: 12 }}>
                    <AlertTriangle size={17} color="#B7791F" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div><b style={{ color: "#3A2C29" }}>ไฟล์ไม่ได้เข้ารหัส</b><br />ข้อมูลเปิดอ่านได้ทันที เก็บให้ปลอดภัย อย่าส่งต่อ</div>
                  </div>
                )}

                {exportProtect && exportGenPw && exportStep === 1 && (
                  <>
                    <div style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 14, padding: "12px 14px", marginBottom: 12 }}>
                      <div style={{ fontSize: 11.5, color: "#7A6360", marginBottom: 6 }}>รหัสผ่านที่แอปสร้างให้</div>
                      <div className="selectable" style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 16, fontWeight: 600, lineHeight: 1.6, color: "#3A2C29", background: "#FDF6F4", borderRadius: 10, padding: "10px 12px", textAlign: "center", wordBreak: "break-word", userSelect: "all" }}>{exportGenPw}</div>
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button type="button" tabIndex={exportTabIdx} onClick={copyGeneratedPassword}
                          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", borderRadius: 10, border: "none", background: "#F3EAE8", color: "#9A3B33", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                          <Copy size={15} /> คัดลอก
                        </button>
                        <button type="button" tabIndex={exportTabIdx} onClick={generateExportPassword}
                          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", borderRadius: 10, border: "none", background: "#F3EAE8", color: "#9A3B33", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                          <Dices size={15} /> สุ่มใหม่
                        </button>
                      </div>
                    </div>
                    <div style={{ margin: "-4px 0 12px" }}><BackupMsg msg={exportMsg} at="pw" /></div>
                    <div role="note" style={{ display: "flex", gap: 9, background: "#FDECEA", borderRadius: 12, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.55, color: "#7A2A24", marginBottom: 12 }}>
                      <AlertTriangle size={16} color="#B3261E" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                      <div><b style={{ color: "#3A2C29" }}>ลืมรหัส = เปิดไฟล์ไม่ได้</b><br />แอปไม่เก็บรหัสนี้ไว้ที่ไหน ผู้พัฒนาก็กู้ให้ไม่ได้ จดหรือคัดลอกเก็บไว้ก่อนไปต่อ</div>
                    </div>
                    <button type="button" tabIndex={exportTabIdx} onClick={() => setExportStep(2)} className="btn-primary"
                      style={{ width: "100%", padding: "14px 0", borderRadius: 14, border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 6 }}>
                      ต่อไป: ยืนยันรหัส
                    </button>
                    <button type="button" tabIndex={exportTabIdx} onClick={useOwnExportPassword}
                      style={{ display: "block", margin: "8px auto 0", background: "none", border: "none", color: "#7A6360", fontSize: 12.5, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                      ตั้งรหัสผ่านเอง
                    </button>
                  </>
                )}

                {exportProtect && exportGenPw && exportStep === 2 && (
                  <div style={{ marginBottom: 12 }}>
                    <label htmlFor="export-confirm-pw" style={{ display: "block", fontSize: 11.5, color: "#7A6360", marginBottom: 4 }}>พิมพ์รหัสที่คัดลอกหรือจดไว้อีกครั้ง</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#FFFFFF", border: `1px solid ${exportTypedOk ? "#2E7D4F" : "#E3C8C3"}`, borderRadius: 12, padding: "0 12px", minHeight: 46 }}>
                      <input id="export-confirm-pw" type="text" value={exportConfirmPw} tabIndex={exportTabIdx}
                        onChange={(e) => setExportConfirmPw(e.target.value)}
                        autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="เช่น word-word-word-word-word"
                        style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "none", fontSize: 14, fontFamily: "inherit", color: "#3A2C29" }} />
                      {exportTypedOk && <Check size={17} color="#2E7D4F" aria-label="รหัสตรงกัน" />}
                    </div>
                    <div aria-live="polite" style={{ fontSize: 11.5, margin: "6px 2px 0", color: exportTypedOk ? "#2E7D4F" : "#7A6360" }}>
                      {exportTypedOk ? "ตรงกันแล้ว" : "พิมพ์ให้ตรงกับรหัสที่แอปสร้างให้ เพื่อให้แน่ใจว่าจดถูก"}
                    </div>
                    <button type="button" tabIndex={exportTabIdx} onClick={() => setExportStep(1)}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "11px 0", borderRadius: 12, border: "none", background: "#F3EAE8", color: "#9A3B33", fontWeight: 600, fontSize: 13.5, fontFamily: "inherit", cursor: "pointer", marginTop: 12 }}>
                      <Eye size={16} /> ดูรหัสอีกครั้ง
                    </button>
                  </div>
                )}

                {exportProtect && !exportGenPw && (
                  <div style={{ marginBottom: 4 }}>
                    <label htmlFor="export-pw" style={{ display: "block", fontSize: 11.5, color: "#7A6360", marginBottom: 4 }}>รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#FFFFFF", border: "1px solid #E3C8C3", borderRadius: 12, padding: "0 4px 0 12px", minHeight: 46 }}>
                      <input id="export-pw" type={exportShowPw ? "text" : "password"} value={exportPw} tabIndex={exportTabIdx}
                        onChange={(e) => setExportPw(e.target.value)}
                        autoComplete="new-password" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="ตั้งรหัสผ่าน"
                        style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "none", fontSize: 15, fontFamily: "inherit", color: "#3A2C29" }} />
                      <button type="button" tabIndex={exportTabIdx} onClick={() => setExportShowPw(v => !v)} aria-label={exportShowPw ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} aria-pressed={exportShowPw}
                        style={{ width: 40, height: 40, border: "none", background: "none", cursor: "pointer", color: "#7A6360", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                        {exportShowPw ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {exportPw.length > 0 && (
                      <div aria-live="polite">
                        <div aria-hidden="true" style={{ display: "flex", gap: 4, margin: "8px 0 3px" }}>
                          {[1, 2, 3].map(n => (
                            <span key={n} style={{ flex: 1, height: 5, borderRadius: 3, background: exportStrength.level >= n ? (exportStrength.level === 3 ? "#2E7D4F" : "#D9A03A") : "#EEDEDA" }} />
                          ))}
                        </div>
                        {exportStrength.label && <div style={{ fontSize: 11.5, color: exportStrength.level === 3 ? "#2E7D4F" : "#9C5515" }}>{exportStrength.label}</div>}
                      </div>
                    )}
                    <label htmlFor="export-pw2" style={{ display: "block", fontSize: 11.5, color: "#7A6360", margin: "10px 0 4px" }}>ยืนยันรหัสผ่าน</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#FFFFFF", border: `1px solid ${exportPw2 && exportPw2 === exportPw && exportStrength.ok ? "#2E7D4F" : (exportPw2.length > 0 && exportPw2 !== exportPw) ? "#B3261E" : "#E3C8C3"}`, borderRadius: 12, padding: "0 12px", minHeight: 46 }}>
                      <input id="export-pw2" type={exportShowPw ? "text" : "password"} value={exportPw2} tabIndex={exportTabIdx}
                        onChange={(e) => setExportPw2(e.target.value)}
                        autoComplete="new-password" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="พิมพ์รหัสผ่านอีกครั้ง"
                        style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "none", fontSize: 15, fontFamily: "inherit", color: "#3A2C29" }} />
                      {exportPw2 && exportPw2 === exportPw && exportStrength.ok && <Check size={17} color="#2E7D4F" aria-label="รหัสผ่านตรงกัน" />}
                    </div>
                    {exportPw2.length > 0 && exportPw2 !== exportPw && <FieldError>รหัสผ่านไม่ตรงกัน</FieldError>}
                    <div role="note" style={{ display: "flex", gap: 9, background: "#FDECEA", borderRadius: 12, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.55, color: "#7A2A24", margin: "12px 0" }}>
                      <AlertTriangle size={16} color="#B3261E" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                      <div><b style={{ color: "#3A2C29" }}>ลืมรหัส = เปิดไฟล์ไม่ได้</b><br />แอปไม่เก็บรหัสผ่านนี้ไว้ที่ไหน ผู้พัฒนาก็กู้ให้ไม่ได้</div>
                    </div>
                  </div>
                )}

                {!(exportProtect && exportGenPw && exportStep === 1) && (
                  <>
                    <textarea
                      ref={exportTextareaRef}
                      readOnly
                      tabIndex={exportTabIdx}
                      value={exportOutText}
                      placeholder={exportProtect ? (exportEncrypting ? "กำลังเข้ารหัส…" : "ข้อความเข้ารหัสจะแสดงที่นี่เมื่อรหัสผ่านครบ") : ""}
                      onFocus={(e) => e.target.select()}
                      aria-label={exportProtect ? "ข้อมูลสำรองที่เข้ารหัสแล้ว สำหรับคัดลอก" : "ข้อมูลสำรองแบบ JSON สำหรับคัดลอก — เลือกไว้ให้อัตโนมัติแล้ว กด Ctrl/Cmd+C เพื่อคัดลอกได้เลย"}
                      style={{ width: "100%", height: exportProtect ? 76 : 100, borderRadius: 10, border: "1px solid #E3C8C3", padding: 10, fontSize: 11, fontFamily: "monospace", color: "#3A2C29", background: "#FFFFFF", marginBottom: 14, resize: "vertical" }}
                    />
                    <BackupMsg msg={exportMsg} at="pre" />
                    <button onClick={downloadExportFile} disabled={!exportReady} tabIndex={exportTabIdx} className="btn-primary" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "14px 0", borderRadius: 14, border: "none", fontSize: 14, fontWeight: 600, cursor: exportReady ? "pointer" : "not-allowed", opacity: exportReady ? 1 : 0.4, marginBottom: 10 }}>
                      <Download size={17} /> {exportProtect && exportEncrypting ? "กำลังเข้ารหัส…" : exportProtect ? "ดาวน์โหลดไฟล์" : "ดาวน์โหลดไฟล์ (ไม่เข้ารหัส)"}
                    </button>
                    <BackupMsg msg={exportMsg} at="mid" />
                    <button onClick={copyExportText} disabled={!exportReady} tabIndex={exportTabIdx} className="btn-ghost" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "13px 0", borderRadius: 14, fontSize: 14, cursor: exportReady ? "pointer" : "not-allowed", opacity: exportReady ? 1 : 0.5 }}>
                      <StickyNote size={16} /> คัดลอกข้อความ
                    </button>
                    <BackupMsg msg={exportMsg} at="post" />
                  </>
                )}

                {exportProtect && !exportGenPw && (
                  <button type="button" tabIndex={exportTabIdx} onClick={generateExportPassword}
                    style={{ display: "block", margin: "12px auto 0", background: "none", border: "none", color: "#7A6360", fontSize: 12.5, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                    ให้แอปสร้างรหัสให้แทน
                  </button>
                )}
                {exportProtect && exportGenPw && exportStep === 1 && (
                  <button type="button" tabIndex={exportTabIdx} onClick={() => { setPlainWarnAck(false); setShowPlainWarn(true); }}
                    style={{ display: "block", margin: "10px auto 0", background: "none", border: "none", color: "#A89692", fontSize: 11.5, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                    ส่งออกแบบไม่เข้ารหัส
                  </button>
                )}
                {!exportProtect && canEncryptBackup() && (
                  <button type="button" tabIndex={exportTabIdx} onClick={backToEncryptedExport}
                    style={{ display: "block", margin: "12px auto 0", background: "none", border: "none", color: "#9A3B33", fontSize: 12.5, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                    กลับไปเข้ารหัส (แนะนำ)
                  </button>
                )}
              </div>

              <div style={{
                gridArea: "1 / 1",
                visibility: backupRestoreTab === "import" ? "visible" : "hidden",
                pointerEvents: backupRestoreTab === "import" ? "auto" : "none",
                display: "flex",
                flexDirection: "column",
              }} aria-hidden={backupRestoreTab !== "import"}>
                {importLock ? (
                  // The chosen file / pasted text is password-protected
                  // (designs 5 and 6 of backup-encrypt-designs.html).
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 11, background: importBroken ? "#FFF6F5" : "#FFFFFF", border: `1px solid ${importBroken ? "#F0C4BE" : "#EEDEDA"}`, borderRadius: 14, padding: "11px 13px", marginBottom: 12 }}>
                      <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: "50%", background: importBroken ? "#FBEAE8" : "#F3EAE8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{importBroken ? <AlertTriangle size={17} color="#B3261E" /> : <Lock size={17} color="#9A3B33" />}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: "#3A2C29", wordBreak: "break-all" }}>{importLock.name || "ข้อความที่วางไว้"}</div>
                        <div style={{ fontSize: 11.5, color: importBroken ? "#B3261E" : "#7A6360" }}>{importBroken ? "เปิดไฟล์นี้ไม่ได้" : "ไฟล์นี้เข้ารหัสอยู่"}</div>
                      </div>
                    </div>
                    {importBroken ? (
                      <div style={{ margin: "0 2px 10px" }}><FieldError>{IMPORT_UNSUPPORTED_MESSAGE}</FieldError></div>
                    ) : (
                    <>
                    <label htmlFor="import-pw" style={{ fontSize: 11.5, color: "#7A6360", marginBottom: 4 }}>รหัสผ่านของไฟล์</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: importLockError ? "#FFF6F5" : "#FFFFFF", border: `1px solid ${importLockError ? "#B3261E" : "#E3C8C3"}`, borderRadius: 12, padding: "0 4px 0 12px", minHeight: 46 }}>
                      <input id="import-pw" type={importLockShow ? "text" : "password"} value={importLockPw} tabIndex={importTabIdx}
                        onChange={(e) => { setImportLockPw(e.target.value); if (importLockError) setImportLockError(""); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); unlockImport(); } }}
                        autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                        aria-invalid={!!importLockError} aria-describedby={importLockError ? "import-pw-err" : undefined}
                        style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "none", fontSize: 15, fontFamily: "inherit", color: "#3A2C29" }} />
                      <button type="button" tabIndex={importTabIdx} onClick={() => setImportLockShow(v => !v)} aria-label={importLockShow ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} aria-pressed={importLockShow}
                        style={{ width: 40, height: 40, border: "none", background: "none", cursor: "pointer", color: "#7A6360", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                        {importLockShow ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {importLockError && <div id="import-pw-err" style={{ margin: "0 2px 4px" }}><FieldError>{importLockError}</FieldError></div>}
                    <button onClick={unlockImport} disabled={!importLockPw || importLockBusy} tabIndex={importTabIdx} className="btn-primary"
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "14px 0", borderRadius: 14, border: "none", fontSize: 14, fontWeight: 600, cursor: (!importLockPw || importLockBusy) ? "not-allowed" : "pointer", opacity: (!importLockPw || importLockBusy) ? 0.5 : 1, margin: "14px 0 10px" }}>
                      <Unlock size={17} /> {importLockBusy ? "กำลังปลดล็อก…" : "ปลดล็อกและนำเข้า"}
                    </button>
                    <p style={{ fontSize: 11.5, color: "#7A6360", textAlign: "center", lineHeight: 1.6, margin: "0 0 8px" }}>
                      {importLockError ? "ลืมรหัส? ไฟล์นี้จะเปิดไม่ได้ ถ้ามีไฟล์สำรองอื่นให้ลองเลือกไฟล์อื่นแทน" : "ถอดรหัสในเครื่องนี้ ไม่ส่งรหัสหรือข้อมูลไปที่ไหน"}
                    </p>
                    </>
                    )}
                    <button type="button" onClick={() => { setImportLock(null); setImportLockPw(""); setImportLockError(""); }} tabIndex={importTabIdx}
                      className={importBroken ? "btn-ghost" : undefined}
                      style={importBroken ? { width: "100%", padding: "12px 0", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" } : { alignSelf: "center", background: "none", border: "none", color: "#9A3B33", fontSize: 12.5, fontWeight: 600, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", padding: 6 }}>
                      เลือกไฟล์อื่น
                    </button>
                  </>
                ) : (
                <>
                <button onClick={triggerImport} disabled={importing} tabIndex={backupRestoreTab === "import" ? 0 : -1} className="btn-primary" style={{ width: "100%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "14px 0", borderRadius: 14, border: "none", fontSize: 14, fontWeight: 600, cursor: importing ? "not-allowed" : "pointer", opacity: importing ? 0.6 : 1, marginBottom: 14 }}>
                  <Upload size={17} /> {importing ? "กำลังอ่านไฟล์..." : "เลือกไฟล์"}
                </button>
                {importMsg && importMsg.at === "file" && <div style={{ flexShrink: 0, margin: "-2px 0 8px" }}><BackupMsg msg={importMsg} at="file" /></div>}
                <p style={{ flexShrink: 0, fontSize: 12.5, color: "#7A6360", lineHeight: 1.7, margin: "0 0 10px" }}>
                  หรือวางข้อความที่คัดลอกไว้จากปุ่ม "คัดลอกข้อความ" ของแอปนี้ที่นี่ แล้วกด "นำเข้า"
                </p>
                {/* flex:1 lets this textarea grow to fill whatever vertical
                    space is left over after the equal-height grid trick
                    above sizes this tab to match the (taller) export tab —
                    otherwise that leftover space would just be empty gap
                    below the "นำเข้าจากข้อความ" button. */}
                <textarea
                  value={pasteImportText}
                  onChange={(e) => { setPasteImportText(e.target.value); if (pasteImportError) setPasteImportError(""); setImportMsg(null); }}
                  tabIndex={backupRestoreTab === "import" ? 0 : -1}
                  placeholder='{"nickname": "...", "donations": [...] }'
                  aria-label="วางข้อความ JSON สำรองที่คัดลอกไว้"
                  style={{ width: "100%", flex: 1, minHeight: 100, borderRadius: 10, border: `1px solid ${pasteImportError ? "#B3261E" : "#E3C8C3"}`, padding: 10, fontSize: 11, fontFamily: "monospace", color: "#3A2C29", background: pasteImportError ? "#FFF6F5" : "#FFFFFF", marginBottom: 4, resize: "vertical", boxSizing: "border-box" }}
                />
                {pasteImportError && <div style={{ flexShrink: 0, margin: "0 2px 6px" }}><FieldError>{pasteImportError}</FieldError></div>}
                {importMsg && importMsg.at === "paste" && <div style={{ flexShrink: 0, margin: "0 0 8px" }}><BackupMsg msg={importMsg} at="paste" /></div>}
                <div style={{ flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <button
                    type="button"
                    onClick={pasteFromClipboard}
                    tabIndex={backupRestoreTab === "import" ? 0 : -1}
                    style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: "2px 0", margin: 0, color: "#9A3B33", fontSize: 12, fontWeight: 600, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                    <StickyNote size={13} /> วางจากคลิปบอร์ด
                  </button>
                  {pasteImportText.length > 0 && (
                    <button
                      type="button"
                      onClick={() => { setPasteImportText(""); setPasteImportError(""); setImportMsg(null); }}
                      tabIndex={backupRestoreTab === "import" ? 0 : -1}
                      style={{ background: "none", border: "none", padding: "2px 0", margin: 0, color: "#9A3B33", fontSize: 12, fontWeight: 600, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                      ล้างข้อความ
                    </button>
                  )}
                </div>
                <button onClick={confirmPasteImport} disabled={importing || !pasteImportText.trim()} tabIndex={backupRestoreTab === "import" ? 0 : -1} className="btn-ghost" style={{ width: "100%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "13px 0", borderRadius: 14, fontSize: 14, cursor: (importing || !pasteImportText.trim()) ? "not-allowed" : "pointer", opacity: (importing || !pasteImportText.trim()) ? 0.5 : 1 }}>
                  {importing ? "กำลังตรวจสอบ..." : "นำเข้าจากข้อความ"}
                </button>
                </>
                )}
              </div>
            </div>
            </FadeScroll>
          </div>
        </div>
      )}

      {showShareCard && (
        <div role="dialog" aria-modal="true" aria-label={shareRecordData ? "แชร์รายการบริจาคนี้" : "แชร์ความสำเร็จ"} onClick={(e) => { if (e.target === e.currentTarget) closeShareCard(); }} style={{ position: "fixed", inset: 0, background: "rgba(36,26,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div style={{ background: "#FBF6F5", width: "100%", maxWidth: 380, borderRadius: 18, maxHeight: "90vh" , display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, padding: "20px 20px 10px" }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{shareRecordData ? "แชร์รายการบริจาคนี้" : "แชร์การให้ที่ยิ่งใหญ่ของคุณ"}</div>
              <button onClick={closeShareCard} aria-label="ปิด" style={{ background: "none", border: "none", cursor: "pointer", color: "#3A2C29" }}><X size={20} /></button>
            </div>
            <FadeScroll style={{ padding: "0 20px 20px" }}>
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
            <p style={{ fontSize: 11.5, color: "#7A6360", margin: "0 0 12px" }}>
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
                  alt={shareRecordData ? "ภาพรายการบริจาคโลหิตของคุณจาก Blood Journey พร้อมวันที่และลำดับครั้งที่บริจาค" : "ภาพความสำเร็จการบริจาคเลือดของคุณจาก Blood Journey พร้อมจำนวนครั้งสะสมและตราความสำเร็จล่าสุด"}
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
              <button onClick={downloadShareCard} disabled={sharingCard || !shareCardDataUrl} className={canShareFiles ? "btn-ghost" : "btn-primary"} style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px 0", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer",
                ...(canShareFiles ? {} : { border: "none" }),
              }}>
                <Download size={16} /> ดาวน์โหลด
              </button>
            </div>
            {isLineInAppBrowser && (
              <button onClick={openShareCardInExternalBrowser} disabled={!shareCardDataUrl} className="btn-ghost" style={{
                marginTop: 10, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                padding: "11px 0", borderRadius: 12,
                fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}>
                บันทึกไม่ได้ในนี้? เปิดในเบราว์เซอร์ภายนอก
              </button>
            )}
            </FadeScroll>
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
        <div style={{ minHeight: 400, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#FBF6F5", padding: 28, textAlign: "center", fontFamily: "'Mitr', 'Inter', sans-serif" }}>
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

// Word list for the generated backup passphrase ("สร้างรหัสให้"): the 2,048-word
// BIP-39 English list (public domain), kept as one string so it costs little to
// ship. The 5-word passphrase drawn from it is ~55 bits, and PBKDF2 slows
// every guess further.
const BACKUP_WORDLIST = "abandon ability able about above absent absorb abstract absurd abuse access accident account accuse achieve acid acoustic acquire across act action actor actress actual adapt add addict address adjust admit adult advance advice aerobic affair afford afraid again age agent agree ahead aim air airport aisle alarm album alcohol alert alien all alley allow almost alone alpha already also alter always amateur amazing among amount amused analyst anchor ancient anger angle angry animal ankle announce annual another answer antenna antique anxiety any apart apology appear apple approve april arch arctic area arena argue arm armed armor army around arrange arrest arrive arrow art artefact artist artwork ask aspect assault asset assist assume asthma athlete atom attack attend attitude attract auction audit august aunt author auto autumn average avocado avoid awake aware away awesome awful awkward axis baby bachelor bacon badge bag balance balcony ball bamboo banana banner bar barely bargain barrel base basic basket battle beach bean beauty because become beef before begin behave behind believe below belt bench benefit best betray better between beyond bicycle bid bike bind biology bird birth bitter black blade blame blanket blast bleak bless blind blood blossom blouse blue blur blush board boat body boil bomb bone bonus book boost border boring borrow boss bottom bounce box boy bracket brain brand brass brave bread breeze brick bridge brief bright bring brisk broccoli broken bronze broom brother brown brush bubble buddy budget buffalo build bulb bulk bullet bundle bunker burden burger burst bus business busy butter buyer buzz cabbage cabin cable cactus cage cake call calm camera camp can canal cancel candy cannon canoe canvas canyon capable capital captain car carbon card cargo carpet carry cart case cash casino castle casual cat catalog catch category cattle caught cause caution cave ceiling celery cement census century cereal certain chair chalk champion change chaos chapter charge chase chat cheap check cheese chef cherry chest chicken chief child chimney choice choose chronic chuckle chunk churn cigar cinnamon circle citizen city civil claim clap clarify claw clay clean clerk clever click client cliff climb clinic clip clock clog close cloth cloud clown club clump cluster clutch coach coast coconut code coffee coil coin collect color column combine come comfort comic common company concert conduct confirm congress connect consider control convince cook cool copper copy coral core corn correct cost cotton couch country couple course cousin cover coyote crack cradle craft cram crane crash crater crawl crazy cream credit creek crew cricket crime crisp critic crop cross crouch crowd crucial cruel cruise crumble crunch crush cry crystal cube culture cup cupboard curious current curtain curve cushion custom cute cycle dad damage damp dance danger daring dash daughter dawn day deal debate debris decade december decide decline decorate decrease deer defense define defy degree delay deliver demand demise denial dentist deny depart depend deposit depth deputy derive describe desert design desk despair destroy detail detect develop device devote diagram dial diamond diary dice diesel diet differ digital dignity dilemma dinner dinosaur direct dirt disagree discover disease dish dismiss disorder display distance divert divide divorce dizzy doctor document dog doll dolphin domain donate donkey donor door dose double dove draft dragon drama drastic draw dream dress drift drill drink drip drive drop drum dry duck dumb dune during dust dutch duty dwarf dynamic eager eagle early earn earth easily east easy echo ecology economy edge edit educate effort egg eight either elbow elder electric elegant element elephant elevator elite else embark embody embrace emerge emotion employ empower empty enable enact end endless endorse enemy energy enforce engage engine enhance enjoy enlist enough enrich enroll ensure enter entire entry envelope episode equal equip era erase erode erosion error erupt escape essay essence estate eternal ethics evidence evil evoke evolve exact example excess exchange excite exclude excuse execute exercise exhaust exhibit exile exist exit exotic expand expect expire explain expose express extend extra eye eyebrow fabric face faculty fade faint faith fall false fame family famous fan fancy fantasy farm fashion fat fatal father fatigue fault favorite feature february federal fee feed feel female fence festival fetch fever few fiber fiction field figure file film filter final find fine finger finish fire firm first fiscal fish fit fitness fix flag flame flash flat flavor flee flight flip float flock floor flower fluid flush fly foam focus fog foil fold follow food foot force forest forget fork fortune forum forward fossil foster found fox fragile frame frequent fresh friend fringe frog front frost frown frozen fruit fuel fun funny furnace fury future gadget gain galaxy gallery game gap garage garbage garden garlic garment gas gasp gate gather gauge gaze general genius genre gentle genuine gesture ghost giant gift giggle ginger giraffe girl give glad glance glare glass glide glimpse globe gloom glory glove glow glue goat goddess gold good goose gorilla gospel gossip govern gown grab grace grain grant grape grass gravity great green grid grief grit grocery group grow grunt guard guess guide guilt guitar gun gym habit hair half hammer hamster hand happy harbor hard harsh harvest hat have hawk hazard head health heart heavy hedgehog height hello helmet help hen hero hidden high hill hint hip hire history hobby hockey hold hole holiday hollow home honey hood hope horn horror horse hospital host hotel hour hover hub huge human humble humor hundred hungry hunt hurdle hurry hurt husband hybrid ice icon idea identify idle ignore ill illegal illness image imitate immense immune impact impose improve impulse inch include income increase index indicate indoor industry infant inflict inform inhale inherit initial inject injury inmate inner innocent input inquiry insane insect inside inspire install intact interest into invest invite involve iron island isolate issue item ivory jacket jaguar jar jazz jealous jeans jelly jewel job join joke journey joy judge juice jump jungle junior junk just kangaroo keen keep ketchup key kick kid kidney kind kingdom kiss kit kitchen kite kitten kiwi knee knife knock know lab label labor ladder lady lake lamp language laptop large later latin laugh laundry lava law lawn lawsuit layer lazy leader leaf learn leave lecture left leg legal legend leisure lemon lend length lens leopard lesson letter level liar liberty library license life lift light like limb limit link lion liquid list little live lizard load loan lobster local lock logic lonely long loop lottery loud lounge love loyal lucky luggage lumber lunar lunch luxury lyrics machine mad magic magnet maid mail main major make mammal man manage mandate mango mansion manual maple marble march margin marine market marriage mask mass master match material math matrix matter maximum maze meadow mean measure meat mechanic medal media melody melt member memory mention menu mercy merge merit merry mesh message metal method middle midnight milk million mimic mind minimum minor minute miracle mirror misery miss mistake mix mixed mixture mobile model modify mom moment monitor monkey monster month moon moral more morning mosquito mother motion motor mountain mouse move movie much muffin mule multiply muscle museum mushroom music must mutual myself mystery myth naive name napkin narrow nasty nation nature near neck need negative neglect neither nephew nerve nest net network neutral never news next nice night noble noise nominee noodle normal north nose notable note nothing notice novel now nuclear number nurse nut oak obey object oblige obscure observe obtain obvious occur ocean october odor off offer office often oil okay old olive olympic omit once one onion online only open opera opinion oppose option orange orbit orchard order ordinary organ orient original orphan ostrich other outdoor outer output outside oval oven over own owner oxygen oyster ozone pact paddle page pair palace palm panda panel panic panther paper parade parent park parrot party pass patch path patient patrol pattern pause pave payment peace peanut pear peasant pelican pen penalty pencil people pepper perfect permit person pet phone photo phrase physical piano picnic picture piece pig pigeon pill pilot pink pioneer pipe pistol pitch pizza place planet plastic plate play please pledge pluck plug plunge poem poet point polar pole police pond pony pool popular portion position possible post potato pottery poverty powder power practice praise predict prefer prepare present pretty prevent price pride primary print priority prison private prize problem process produce profit program project promote proof property prosper protect proud provide public pudding pull pulp pulse pumpkin punch pupil puppy purchase purity purpose purse push put puzzle pyramid quality quantum quarter question quick quit quiz quote rabbit raccoon race rack radar radio rail rain raise rally ramp ranch random range rapid rare rate rather raven raw razor ready real reason rebel rebuild recall receive recipe record recycle reduce reflect reform refuse region regret regular reject relax release relief rely remain remember remind remove render renew rent reopen repair repeat replace report require rescue resemble resist resource response result retire retreat return reunion reveal review reward rhythm rib ribbon rice rich ride ridge rifle right rigid ring riot ripple risk ritual rival river road roast robot robust rocket romance roof rookie room rose rotate rough round route royal rubber rude rug rule run runway rural sad saddle sadness safe sail salad salmon salon salt salute same sample sand satisfy satoshi sauce sausage save say scale scan scare scatter scene scheme school science scissors scorpion scout scrap screen script scrub sea search season seat second secret section security seed seek segment select sell seminar senior sense sentence series service session settle setup seven shadow shaft shallow share shed shell sheriff shield shift shine ship shiver shock shoe shoot shop short shoulder shove shrimp shrug shuffle shy sibling sick side siege sight sign silent silk silly silver similar simple since sing siren sister situate six size skate sketch ski skill skin skirt skull slab slam sleep slender slice slide slight slim slogan slot slow slush small smart smile smoke smooth snack snake snap sniff snow soap soccer social sock soda soft solar soldier solid solution solve someone song soon sorry sort soul sound soup source south space spare spatial spawn speak special speed spell spend sphere spice spider spike spin spirit split spoil sponsor spoon sport spot spray spread spring spy square squeeze squirrel stable stadium staff stage stairs stamp stand start state stay steak steel stem step stereo stick still sting stock stomach stone stool story stove strategy street strike strong struggle student stuff stumble style subject submit subway success such sudden suffer sugar suggest suit summer sun sunny sunset super supply supreme sure surface surge surprise surround survey suspect sustain swallow swamp swap swarm swear sweet swift swim swing switch sword symbol symptom syrup system table tackle tag tail talent talk tank tape target task taste tattoo taxi teach team tell ten tenant tennis tent term test text thank that theme then theory there they thing this thought three thrive throw thumb thunder ticket tide tiger tilt timber time tiny tip tired tissue title toast tobacco today toddler toe together toilet token tomato tomorrow tone tongue tonight tool tooth top topic topple torch tornado tortoise toss total tourist toward tower town toy track trade traffic tragic train transfer trap trash travel tray treat tree trend trial tribe trick trigger trim trip trophy trouble truck true truly trumpet trust truth try tube tuition tumble tuna tunnel turkey turn turtle twelve twenty twice twin twist two type typical ugly umbrella unable unaware uncle uncover under undo unfair unfold unhappy uniform unique unit universe unknown unlock until unusual unveil update upgrade uphold upon upper upset urban urge usage use used useful useless usual utility vacant vacuum vague valid valley valve van vanish vapor various vast vault vehicle velvet vendor venture venue verb verify version very vessel veteran viable vibrant vicious victory video view village vintage violin virtual virus visa visit visual vital vivid vocal voice void volcano volume vote voyage wage wagon wait walk wall walnut want warfare warm warrior wash wasp waste water wave way wealth weapon wear weasel weather web wedding weekend weird welcome west wet whale what wheat wheel when where whip whisper wide width wife wild will win window wine wing wink winner winter wire wisdom wise wish witness wolf woman wonder wood wool word work world worry worth wrap wreck wrestle wrist write wrong yard year yellow you young youth zebra zero zone zoo";
