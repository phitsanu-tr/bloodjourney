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
export const BACKUP_FORMAT_VERSION = 3;

export const BACKUP_KDF_ITERATIONS = 600000;

export const backupAad = (v) => new TextEncoder().encode(`BloodJourney|backup|${v}`);

export const canCompressBackup = () => typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined" && typeof Response !== "undefined";

export async function pipeBackupBytes(u8, stream) {
  return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(stream)).arrayBuffer());
}

export const backupCryptoError = (code) => Object.assign(new Error(code), { code });

export const canEncryptBackup = () => typeof crypto !== "undefined" && !!crypto.subtle && typeof crypto.getRandomValues === "function";

export const bytesToB64 = (u8) => {
  let out = "";
  for (let i = 0; i < u8.length; i += 0x8000) out += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(out);
};

export const b64ToBytes = (b64) => {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
};

export async function deriveBackupKey(password, salt, iterations, usage) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(password).normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, [usage]);
}

export async function encryptBackupText(plainText, password) {
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
export function readEncryptedBackup(text) {
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
export async function decryptBackupText(header, password) {
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

// Random password for the "สร้างรหัสให้" button: 16 characters from lower/upper case letters, digits and a few symbols,
// minus the look-alikes (0 O 1 l I) because the donor has to copy or type it back by hand. Symbols are the ones on a phone's
// first symbol page, none that a text field or chat app treats specially (no quotes, backslash, spaces, <>). ~96 bits.
// Each character is drawn by rejection sampling (unbiased), and a draw missing any of the four kinds is thrown away so the
// result always satisfies "password must have a lower, upper, digit and symbol" rules; that costs well under a bit.
export const BACKUP_PW_KINDS = [
  "abcdefghijkmnopqrstuvwxyz",
  "ABCDEFGHJKLMNPQRSTUVWXYZ",
  "23456789",
  "!@#$%&*+=?",
];
export function generateBackupPassword(length = 16) {
  const all = BACKUP_PW_KINDS.join("");
  const limit = 256 - (256 % all.length);
  for (;;) {
    let out = "";
    while (out.length < length) {
      for (const n of crypto.getRandomValues(new Uint8Array(length * 2))) {
        if (n < limit && out.length < length) out += all[n % all.length];
      }
    }
    if (BACKUP_PW_KINDS.every((kind) => [...out].some((c) => kind.includes(c)))) return out;
  }
}

// level 0 = not accepted, 1 = อ่อน, 2 = พอใช้, 3 = แข็งแรง
export function backupPasswordStrength(pw) {
  if (pw.length < 8) return { level: 0, ok: false, label: "" };
  const COMMON = ["12345678", "123456789", "1234567890", "password", "password1", "qwertyui", "qwerty123", "11111111", "00000000", "abcdefgh", "iloveyou"];
  if (new Set(pw).size < 4 || COMMON.includes(pw.toLowerCase())) return { level: 0, ok: false, label: "เดาง่ายเกินไป ลองเปลี่ยนหรือกดสร้างรหัสให้" };
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(pw)).length;
  const score = (pw.length >= 12 ? 1 : 0) + (pw.length >= 16 ? 1 : 0) + (classes >= 2 ? 1 : 0) + (classes >= 3 ? 1 : 0);
  if (score <= 1) return { level: 1, ok: true, label: "อ่อน · ยิ่งยาวยิ่งดี" };
  if (score <= 3) return { level: 2, ok: true, label: "พอใช้" };
  return { level: 3, ok: true, label: "แข็งแรง" };
}

