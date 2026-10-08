import { isNativeApp } from "./env.js";
import { Preferences } from "@capacitor/preferences";

// Storage adapter: prefers the Claude artifact `window.storage` bridge when it
// works, but transparently falls back to localStorage (and finally an
// in-memory object) whenever that bridge is missing OR throws for any reason
// (quota, network, running outside an artifact preview, etc). This keeps the
// app usable everywhere it might be opened, and mirrors the real localStorage
// implementation this app will use once it's a standalone LIFF page.
export const memoryStore = {};

export const LS_PREFIX = "bloodjourney:";

// Set once a write ever falls all the way through to memoryStore (quota
// exceeded, private/incognito mode blocking storage, etc) — i.e. genuinely
// NOT persisted, unlike the native-bridge/localStorage tiers above it.
// Deliberately never reset back to false within a session: even if a later
// write happens to succeed, whatever fell through earlier this session is
// still only in memory and still at risk, so telling the user "you're fine
// now" would be misleading. AppInner polls storage.degraded to show a
// one-time warning modal plus a persistent home-tab banner.
export let storageDegradedFlag = false;

export const storage = {
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
