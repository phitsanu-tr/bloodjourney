export const THAI_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

// Profile stores the birth year (พ.ศ.) instead of an age, so the age keeps
// itself up to date. Age is "this year minus birth year" — may be one more
// than the donor's exact age before their birthday, which is fine for a
// 17-70 check.
export const thaiYearNow = () => new Date().getFullYear() + 543;

export function toBuddhistDate(d) {
  const date = parseLocalDate(d);
  return `${date.getDate()} ${THAI_MONTHS[date.getMonth()]} ${date.getFullYear() + 543}`;
}

export function toBuddhistDateTimeFull(d) {
  const date = parseLocalDate(d);
  if (Number.isNaN(date.getTime())) return "";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${date.getDate()} ${THAI_MONTHS_FULL[date.getMonth()]} ${date.getFullYear() + 543} เวลา\u00A0${hh}:${mm}\u00A0น.`;
}

export function toBuddhistDateFull(d) {
  const date = parseLocalDate(d);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getDate()} ${THAI_MONTHS_FULL[date.getMonth()]} ${date.getFullYear() + 543}`;
}

export function toBuddhistDateTime(d) {
  const date = parseLocalDate(d);
  if (Number.isNaN(date.getTime())) return "";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  // Non-breaking spaces inside the time part, so a narrow line wraps BEFORE "เวลา" instead of
  // leaving a lone "น." (or the clock) on its own line.
  return `${toBuddhistDate(date)} เวลา\u00A0${hh}:${mm}\u00A0น.`;
}

// Whole calendar days from a to b. Works on copies: it used to call setHours on the dates passed in, which silently
// changed the caller's Date objects (harmless only while every caller handed in a fresh one).
export function daysBetween(a, b) {
  const from = new Date(parseLocalDate(a)), to = new Date(parseLocalDate(b)); // copies; "YYYY-MM-DD" strings read as local dates
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);
  return Math.round((to - from) / 86400000);
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
  const date = parseLocalDate(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayLocalStr() {
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
export function parseLocalDate(d) {
  if (d instanceof Date) return d;
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) return new Date(`${d}T00:00:00`);
  return new Date(d);
}

// Relative "บันทึกเมื่อ..." wording for recent timestamps (loggedAt /
// startingCountUpdatedAt) — matches the common X/Twitter-style convention:
// relative wording (minutes/hours) within the first 24 hours, then straight
// to the full Buddhist date+time after that — no special "เมื่อวานนี้" step.
// Note: this doesn't re-render on a timer by itself, so "เมื่อสักครู่" etc.
// only updates when something else causes the component to re-render —
// acceptable for this lightweight metadata line.
export function formatLoggedAt(iso) {
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
export function joinLoggedLabel(label, iso) {
  const rel = formatLoggedAt(iso);
  if (!rel) return label;
  return rel === "สักครู่" ? `${label}สักครู่` : `${label} ${rel}`;
}

export function buddhistYear(dateStr) {
  return parseLocalDate(dateStr).getFullYear() + 543;
}

export function startOfToday() {
  const d = new Date();
  d.setHours(0,0,0,0);
  return d;
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
export const THAI_MONTHS_FULL = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
