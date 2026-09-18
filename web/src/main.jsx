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

// Shown instead of the app when this page is opened outside of the LINE
// app (e.g. someone pasted the raw Vercel URL into Chrome/Safari directly).
// This is a soft, client-side check only — paired with the Edge Middleware
// in middleware.js, which blocks most non-LINE requests even earlier, at
// the server. Neither is real security (both can be worked around by
// someone determined enough), which is fine here: the app has no
// sensitive server-side data, everything is stored locally on-device.
// The point is just to steer normal users back to opening it properly.
function renderLineOnlyNotice() {
  document.getElementById("root").innerHTML = `
    <div style="min-height:100vh; display:flex; align-items:center; justify-content:center;
      font-family:'Noto Sans Thai','Inter',sans-serif; background:#FBF6F5; color:#241A18; padding:24px; text-align:center;">
      <div style="max-width:420px;">
        <div style="width:72px; height:72px; border-radius:20px; background:linear-gradient(135deg,#B24A40 0%,#8A2F28 100%);
          display:flex; align-items:center; justify-content:center; margin:0 auto 20px;">
          <svg width="34" height="41" viewBox="0 0 24 24" fill="#FFF7F5"><path d="M12 2 C12 2 4 12.5 4 17 C4 21 7.6 24 12 24 C16.4 24 20 21 20 17 C20 12.5 12 2 12 2 Z"/></svg>
        </div>
        <h1 style="font-size:20px; margin:0 0 10px;">เปิดผ่านแอป LINE เท่านั้น</h1>
        <p style="font-size:15px; color:#6B5854; line-height:1.6; margin:0 0 22px;">
          BloodJourney ใช้งานได้เฉพาะเมื่อเปิดผ่านแอป LINE กรุณากดลิงก์จากริชเมนูหรือแชทของ LINE อีกครั้ง
        </p>
        <a href="https://liff.line.me/${LIFF_ID}" style="display:inline-block; background:#8A2F28; color:#FFF7F5;
          text-decoration:none; font-weight:700; padding:14px 28px; border-radius:100px; font-size:15px;">เปิดใน LINE</a>
      </div>
    </div>`;
}

async function bootstrap() {
  let initOk = false;
  try {
    await liff.init({ liffId: LIFF_ID });
    initOk = true;
  } catch (err) {
    // liff.init() throwing usually means this isn't running inside LINE
    // at all (or LINE's SDK couldn't reach its own servers). Either way,
    // treat it the same as "not in LINE" below rather than silently
    // rendering the app.
    console.warn("LIFF init failed:", err);
  }

  if (!initOk || !liff.isInClient()) {
    renderLineOnlyNotice();
    return;
  }

  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap();
