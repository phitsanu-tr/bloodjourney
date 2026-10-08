# BloodJourney — ชุดทดสอบ end-to-end (Playwright)

ทดสอบเส้นทางที่ถ้าพังจะกระทบข้อมูลผู้ใช้โดยตรง: ยินยอม, บันทึก/แก้/ลบรายการ, ยอดสะสมยกมา,
สำรอง/กู้คืน (ทั้งแบบเข้ารหัสและไม่เข้ารหัส), ข้อความ error ของการนำเข้า/รูปโปรไฟล์,
ลบโปรไฟล์/ลบข้อมูลทั้งหมด และการไม่ล้นจอที่ความกว้าง 390 และ 320

## รันครั้งแรก
```
cd web/tests
npm install
npx playwright install chromium   # ครั้งเดียว (ถ้ายังไม่มี Chromium ในเครื่อง)
```

## รัน
```
cd web/tests
npm test
```
สคริปต์จะ build แอป (`npm run build` ใน `web/`) แล้วเปิด `vite preview` ที่พอร์ต 4173 ให้เอง
ถ้ามี server เปิดอยู่แล้วที่พอร์ตนี้ จะใช้ตัวเดิม (อย่าลืม build ใหม่หลังแก้โค้ด)
รันเฉพาะไฟล์: `npx playwright test backup`  ·  เฉพาะเคส: `npx playwright test -g "delete"`

## ขอบเขตและข้อจำกัด
- รันบน Chromium จำลองมือถือ ไม่แทนการทดสอบบน iPhone/Android จริงใน LINE
- ไม่ครอบคลุมกรณีเขียนข้อมูลล้มเหลว (ใน storage ปกติจำลองไม่ได้เพราะ storage ของแอปไม่ throw)
  และไม่ครอบคลุม LIFF / backend แจ้งเตือนผ่าน LINE / หน้าแชร์การ์ด / ปฏิทิน
- ข้อความที่ตรวจเป็นข้อความจริงในแอป ถ้าเปลี่ยนคำ ต้องแก้เคสที่ตรวจคำนั้นตาม
- ไม่แตะ `web/package.json`: ชุดทดสอบมี `package.json` ของตัวเองในโฟลเดอร์นี้

## Unit tests, lint, parallel/WebKit runs (v1.0.423)
- `npm run unit` -- fast `node --test` checks of the app's exported helpers (dates, litres, share links); see `unit/_load.mjs`.
- `npm run lint` -- react-hooks rules only; `npm run lint -- --no-inline-config` shows what the `eslint-disable` comments hide.
- `BJ_WORKERS=4 npx playwright test` runs in parallel; `BJ_WEBKIT=1 npx playwright test` adds WebKit (install it first: `npx playwright install webkit`).
- A file filter such as `npx playwright test home` is matched against the whole path (`/home/...` matches everything): use `home.spec`.
