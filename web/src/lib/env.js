import { Capacitor } from "@capacitor/core";

// @line/liff and recharts are loaded on demand (their own chunks) instead of
// being bundled into the main file -- together they were a large part of a
// ~980KB main bundle, slow to open in LINE on mobile data. liff is only ever
// used inside LINE (main.jsx loads and inits it there before render, so by
// the time anyone taps, this import resolves instantly); recharts is only
// the dashboard's yearly chart.
export const openInExternalBrowser = (url) =>
  import("@line/liff").then(({ default: liff }) => liff.openWindow({ url, external: true }));

// True only when running inside the packaged iOS/Android app shell (Capacitor
// WebView), never inside the LINE LIFF web build — used to route persistence
// through the native Preferences API (real OS-level storage, no LINE/WebView
// storage-eviction risk) instead of localStorage, and later to gate native
// save/share/calendar features that don't exist in the LIFF web build.
export const isNativeApp = (() => {
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
export const isLineInAppBrowser = !isNativeApp && typeof navigator !== "undefined" && (navigator.userAgent.includes("Line/") || navigator.userAgent.includes("LIFF/"));
