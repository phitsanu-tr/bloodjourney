import React from "react";
import ReactDOM from "react-dom/client";
import liff from "@line/liff";
import App from "./App.jsx";

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

async function bootstrap() {
  try {
    await liff.init({ liffId: LIFF_ID });
  } catch (err) {
    // Not fatal: this lets the app keep working when opened directly in a
    // normal browser (e.g. testing on desktop, or the Vercel preview URL
    // outside of LINE) where LIFF context simply isn't available. The app
    // never depends on any LINE identity data — scope is openid-only and
    // unused — so rendering without a successful LIFF init is safe.
    console.warn("LIFF init failed, continuing without LINE context:", err);
  }

  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap();
