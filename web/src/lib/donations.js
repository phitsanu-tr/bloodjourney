import { todayLocalStr, dateToLocalStr, parseLocalDate } from "./dates.js";

export const MIN_CYCLE_DAYS = 7;

export const MAX_CYCLE_DAYS = 365;

export const MIN_AGE = 17;

export const MAX_AGE = 70;

export const MIN_WEIGHT = 45; // matches KNOWLEDGE_CRITERIA.whole text and the locked criteria in the handoff doc (was inconsistently 50 here)

// Official Thai Red Cross donation intervals per type (independent of
// cycleDays/componentCycleDays elsewhere, which are just the user's own
// adjustable REMINDER cadence, not a redefinition of the actual medical
// rule) -- used below to size the "เคยบริจาคมาแล้วกี่ครั้ง" (carried-over
// starting count) ceiling per donor, so a donor can't accidentally type in
// a number no real person in their situation could actually reach.
//   - โลหิตรวม (whole blood): every 90 days.
//   - พลาสมา/เกล็ดเลือด (plasma/platelet apheresis): every 14 days
//     ("สามารถบริจาคได้ทุก 14 วัน" -- thaibloodcentre.redcross.or.th).
export const WHOLE_BLOOD_INTERVAL_DAYS = 90;

export const COMPONENT_INTERVAL_DAYS = 14;

// Official minimum gap per type, only used to size the carried-over-count ceiling.
export const TYPE_INTERVAL_DAYS = { whole: WHOLE_BLOOD_INTERVAL_DAYS, plasma: COMPONENT_INTERVAL_DAYS, platelet: 30, rbc: 120 };

// Multiplier applied on top of the exact theoretical max (see
// maxStartingCountWhole/Component below) so the cap isn't a razor's edge
// against a perfectly-timed donor -- accounts for things like an early
// first-time donation right at MIN_AGE, or a slightly generous personal
// age estimate, without opening the door to obviously fabricated totals.
export const STARTING_COUNT_CAP_MARGIN = 1.2;

export const BLOOD_TYPES = ["A", "B", "AB", "O", "ไม่ทราบ"];

export const ABO_ONLY = ["A", "B", "AB", "O"]; // what the profile picker offers ("ไม่ทราบ" stays valid for old data/imports)

export const BLOOD_RH = [["+", "บวก (+)"], ["-", "ลบ (−)"], ["unknown", "ไม่ทราบ"]];

export const GENDERS = [["male", "ชาย"], ["female", "หญิง"], ["none", "ไม่ระบุ"]];

export const MIN_HEIGHT = 100;

export const MAX_HEIGHT = 230;

// Estimated total blood volume in litres (Nadler 1962). Needs height (cm),
// weight (kg) and gender; "none" (ไม่ระบุ) uses the midpoint of the two
// formulas. Returns null when anything is missing.
export function estimateBloodVolumeL(gender, heightCm, weightKg) {
  const h = Number(heightCm) / 100, w = Number(weightKg);
  if (!gender || !h || !w) return null;
  const male = 0.3669 * h ** 3 + 0.03219 * w + 0.6041;
  const female = 0.3561 * h ** 3 + 0.03308 * w + 0.1833;
  return gender === "male" ? male : gender === "female" ? female : (male + female) / 2;
}

// Reminder pause: "" (off), "indefinite", or a YYYY-MM-DD date the pause
// runs through. A date in the past simply means it's no longer paused.
export const isRemindPaused = (until) => until === "indefinite" || (!!until && until >= todayLocalStr());

export const REMIND_PAUSE_OPTIONS = [["3", "3 เดือน"], ["6", "6 เดือน"], ["12", "1 ปี"], ["indefinite", "จนกว่าจะเปิดเอง"]];

export function remindPauseUntilFor(choice) {
  if (choice === "indefinite") return "indefinite";
  const d = new Date();
  d.setMonth(d.getMonth() + Number(choice));
  return dateToLocalStr(d);
}

// Thai consonants/vowels/tone marks (U+0E01–U+0E3A, U+0E40–U+0E4E) — this
// deliberately excludes the Thai digits (U+0E50–U+0E59) and punctuation
// (Fongman/Angkhankhu/Khomut) that sit in the same Unicode block, since the
// name fields should only accept letters, not numerals of either script.
export const THAI_LETTERS = "\\u0E01-\\u0E3A\\u0E40-\\u0E4E";

export const NAME_DISALLOWED_CHARS_RE = new RegExp(`[^A-Za-z${THAI_LETTERS}\\s]`, "gu");

// Strips digits (Arabic or Thai), symbols, punctuation, and emoji from a
// name field as the user types, leaving only Thai/English letters and
// spaces — used for the profile's ชื่อ/นามสกุล inputs.
// English words typed entirely in lower case ("john smith") get a capital first
// letter on save ("John Smith"); words that already contain a capital (McDonald,
// DeWitt, JOHN) and Thai words are left exactly as typed.
export function capitalizeLowerWords(value) {
  return value.split(/(\s+)/).map(w => (/^[a-z]+$/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join("");
}

export function sanitizeNameInput(value) {
  return value.replace(NAME_DISALLOWED_CHARS_RE, "");
}

export const HISTORY_PAGE_SIZE = 10;

export const YEAR_CHART_VISIBLE_COUNT = 5;

export const MAX_LOCATION_LEN = 60;

export const MAX_NOTE_LEN = 120;

export const DEFAULT_BACKUP_REMINDER_GAP = 3;

export const MIN_BACKUP_REMINDER_GAP = 1;

export const MAX_BACKUP_REMINDER_GAP = 50;

// Four donation types (Thai Red Cross National Blood Centre): whole blood plus
// three apheresis ("เฉพาะส่วน") kinds. Each has its own re-donation interval --
// plasma every 14 days, platelets monthly, red cells every 4 months (the last
// two converted to 30 / 120 days) -- used as the DEFAULT reminder cycle, which
// the donor can still change in settings.
export const DONATION_TYPES = ["whole", "plasma", "platelet", "rbc"];

export const DEFAULT_CYCLE_BY_TYPE = { whole: 90, plasma: 14, platelet: 30, rbc: 120 };

// Old saves/backups only knew "whole" and "component" (plasma/platelet lumped
// together on a 14-day rule). "component" is read as plasma -- the 14-day rule
// was always plasma's -- and anything unknown falls back to whole.
export const normalizeDonationType = (t) => (DONATION_TYPES.includes(t) ? t : t === "component" ? "plasma" : "whole");

export const TYPE_STARTING_KEY = { whole: "startingCountWhole", plasma: "startingCountPlasma", platelet: "startingCountPlatelet", rbc: "startingCountRbc" };

export const emptyByType = (v) => Object.fromEntries(DONATION_TYPES.map((t) => [t, typeof v === "function" ? v(t) : v]));

// Reads the per-type carried-over counts out of a saved profile. The pre-4-type
// "startingCountComponent" field was plasma/platelet combined; it becomes plasma.
export const startingCountsFromProfile = (p) => {
  const n = (v) => (typeof v === "number" && v > 0 ? String(v) : "");
  return {
    whole: n(typeof p.startingCountWhole === "number" ? p.startingCountWhole : p.startingCount),
    plasma: n(typeof p.startingCountPlasma === "number" ? p.startingCountPlasma : p.startingCountComponent),
    platelet: n(p.startingCountPlatelet),
    rbc: n(p.startingCountRbc),
  };
};

// True when an import would change anything the confirm dialog shows.
export const importHasSomething = (pi) => !!pi && (pi.incoming.length > 0 || Object.keys(pi.profileFieldsToFill || {}).length > 0
  || !!pi.startingToImport || Object.keys(pi.cycleFill || {}).length > 0);

export const startingCountFields = (counts) => Object.fromEntries(DONATION_TYPES.map((t) => [TYPE_STARTING_KEY[t], Number(counts[t]) || 0]));

export const DEFAULT_DONATION_TYPE = "whole";

export const TYPE_REQUIRED_MESSAGE = "ระบุประเภทการบริจาค";

export const IMPORT_UNSUPPORTED_MESSAGE = "รูปแบบไม่รองรับ หรือไฟล์เสียหาย";

export const DONATION_TYPE_LABELS = { whole: "โลหิตรวม", plasma: "พลาสมา", platelet: "เกล็ดเลือด", rbc: "เม็ดเลือดแดง" };

// Rough volume that leaves the donor per donation, for the "≈ X ลิตร" figures
// only: a whole-blood bag, the collected plasma, a platelet bag (platelets in
// plasma), two red-cell units. Display estimates, not measured amounts.
export const DONATION_TYPE_ML = { whole: 350, plasma: 500, platelet: 250, rbc: 400 };

export function estimateVolumeMl(countByType) {
  return DONATION_TYPES.reduce((sum, t) => sum + (Number(countByType?.[t]) || 0) * DONATION_TYPE_ML[t], 0);
}

export function formatLiters(ml) {
  return String(Math.round((Number(ml) || 0) / 100) / 10);
}

// "เฉพาะส่วน" is the umbrella name for the three apheresis types.
export const COMPONENT_GROUP_LABEL = "เฉพาะส่วน";

export const COMPONENT_TYPES = ["plasma", "platelet", "rbc"];

// Where each default reminder cycle comes from (shown under the setting).
export const TYPE_CYCLE_NOTE = { whole: "", plasma: "บริจาคได้ทุก 14 วัน", platelet: "บริจาคได้เดือนละครั้ง", rbc: "บริจาคได้ทุก 4 เดือน" };

// Background/text tint per donation type, used only on the history list's
// type pill so the two types can be told apart at a glance without
// re-coloring every type pill/icon elsewhere in the app (which stays the
// existing single red-tint scheme).
export const DONATION_TYPE_TINT = {
  whole: { bg: "#F3EAE8", text: "#9A3B33" },
  plasma: { bg: "#EFE3F0", text: "#6B3E78" },
  platelet: { bg: "#FBEFD9", text: "#8A5A12" },
  rbc: { bg: "#E1ECF3", text: "#2D5F7C" },
};

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// The day a donor may give again: the last donation's calendar date plus the cycle, counted in calendar days (setDate),
// not in 24-hour blocks, and with the stored "YYYY-MM-DD" read as a local date -- so the countdown is the same in
// every timezone and across daylight-saving changes. Returns a Date at local midnight.
export function nextEligibleFrom(lastDate, cycleDays) {
  const d = new Date(parseLocalDate(lastDate));
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + Number(cycleDays));
  return d;
}
