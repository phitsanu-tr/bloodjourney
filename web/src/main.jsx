import React from "react";
import ReactDOM from "react-dom/client";
import liff from "@line/liff";
import { Capacitor } from "@capacitor/core";
import App from "./App.jsx";

// The packaged iOS/Android app (Capacitor) is a completely separate
// distribution from the LINE LIFF web build — it isn't opened through LINE
// at all, so liff.init() (which only makes sense inside LINE's own WebView)
// is skipped entirely here. Never true for the web build, only for the
// native app shell.
const isNativeApp = (() => {
  try {
    return Capacitor.isNativePlatform();
  } catch (e) {
    return false;
  }
})();

// Snapshot the raw query string *before* liff.init() runs. LINE wraps any
// deep-link params from a rich-menu URL (e.g. ?tab=dashboard) into a
// `liff.state` param, and liff.init() may rewrite or clear the address bar
// while sorting that out — capturing it now, up front, means App.jsx can
// recover the original deep link (see initialTabFromUrl in the main app
// file) no matter what liff.init() does to window.location afterwards.
window.__bjInitialSearch = window.location.search;

// The LIFF ID identifies this app to LINE (not a secret — safe to ship in
// client code, same as any public app/client ID). Registered under the
// "BloodJourney" LINE Login channel, LIFF tab.
const LIFF_ID = "2011648974-jwXvKsIg";

// The web build is now dual-purpose: opened inside LINE (via the LIFF URL)
// *or* opened directly in a regular browser and installed as a PWA (Add to
// Home Screen) — both are legitimate, so the app always renders. liff.init()
// is still attempted opportunistically (harmless if it fails outside LINE)
// so LINE-specific behavior keeps working for LINE users; a failure just
// means "not opened via LINE", which is now a normal, supported case rather
// than something to block.
async function bootstrap() {
  if (!isNativeApp) {
    try {
      await liff.init({ liffId: LIFF_ID });
    } catch (err) {
      // Expected whenever this is opened outside LINE (direct browser visit,
      // PWA launch from the home screen, etc.) — not an error case anymore.
    }
  }

  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  // Service worker registration — native app has no notion of one (it's not
  // loaded over HTTP from our own origin), and it only matters in a
  // production build (Vite's dev server doesn't play well with SW caching).
  if (!isNativeApp && "serviceWorker" in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}

bootstrap();
