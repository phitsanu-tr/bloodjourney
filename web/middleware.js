// Vercel Edge Middleware — runs before any page is served.
//
// Blocks requests that don't look like they came from inside the LINE app
// (LINE's in-app browser always sends a User-Agent containing "Line/").
// This is a deterrent, not real security: a User-Agent header can be
// spoofed by anyone determined enough, and the app has no sensitive
// server-side data anyway (everything is stored locally on-device). Its
// purpose is simply to stop normal users from stumbling onto the raw
// Vercel URL outside of LINE and seeing a confusing half-working app —
// paired with the client-side liff.isInClient() check in main.jsx, which
// covers the case where a request DOES have a LINE-like User-Agent but
// liff.init() still reports it isn't really running inside LINE.
//
// Static assets (JS/CSS/images/etc.) are always allowed through — only
// document navigations are checked — so the blocked page itself can still
// load its own scripts and styles.

export const config = {
  matcher: "/((?!_next|assets|.*\\.[\\w]+$).*)",
};

const BLOCKED_HTML = `<!doctype html>
<html lang="th">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>BloodJourney</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    font-family: 'Noto Sans Thai','Inter',sans-serif; background:#FBF6F5; color:#241A18; padding:24px; text-align:center; }
  .card { max-width:420px; }
  .icon { width:72px; height:72px; border-radius:20px; background:linear-gradient(135deg,#B24A40 0%,#8A2F28 100%);
    display:flex; align-items:center; justify-content:center; margin:0 auto 20px; }
  h1 { font-size:20px; margin:0 0 10px; }
  p { font-size:15px; color:#6B5854; line-height:1.6; margin:0 0 22px; }
  a.btn { display:inline-block; background:#8A2F28; color:#FFF7F5; text-decoration:none; font-weight:700;
    padding:14px 28px; border-radius:100px; font-size:15px; }
</style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg width="34" height="41" viewBox="0 0 24 24" fill="#FFF7F5"><path d="M12 2 C12 2 4 12.5 4 17 C4 21 7.6 24 12 24 C16.4 24 20 21 20 17 C20 12.5 12 2 12 2 Z"/></svg>
    </div>
    <h1>เปิดผ่านแอป LINE เท่านั้น</h1>
    <p>BloodJourney ใช้งานได้เฉพาะเมื่อเปิดผ่านแอป LINE เพื่อความถูกต้องของข้อมูลและการเชื่อมต่อ กรุณากดลิงก์จากริชเมนูหรือแชทของ LINE อีกครั้ง</p>
    <a class="btn" href="https://liff.line.me/2011648974-jwXvKsIg">เปิดใน LINE</a>
  </div>
</body>
</html>`;

export default function middleware(request) {
  const ua = request.headers.get("user-agent") || "";
  const isLine = ua.includes("Line/") || ua.includes("LIFF/");

  if (isLine) {
    return; // let it through to the app
  }

  return new Response(BLOCKED_HTML, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
