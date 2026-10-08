import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

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
export function buildGoogleCalendarUrl(date, title, details) {
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

export function downloadIcsFile(icsContent, filename) {
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
export async function nativeSaveAndShare({ base64Data, filename, mimeType, dialogTitle }) {
  await Filesystem.writeFile({ path: filename, data: base64Data, directory: Directory.Cache });
  const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
  await Share.share({ url: uri, dialogTitle });
}

export function dataUrlToBase64(dataUrl) {
  const idx = dataUrl.indexOf(",");
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
}

export function icsContentToBase64(icsContent) {
  // btoa only handles Latin1 — the .ics body here is escaped ASCII (Thai
  // text is only ever inside SUMMARY/DESCRIPTION, already UTF-8 bytes), so
  // encode via TextEncoder first to survive any non-ASCII bytes safely.
  const bytes = new TextEncoder().encode(icsContent);
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}
