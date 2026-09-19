# วิธี Build แอป iOS / Android จริงจากโปรเจกต์ Blood Journey

โปรเจกต์ Capacitor ถูกตั้งค่าไว้ครบแล้วที่ `web/android/` และ `web/ios/` (โฟลเดอร์ "Blood Journey" ในเครื่องคุณ) แต่ **แซนด์บ็อกซ์คลาวด์ของ Claude build ให้ไม่ได้**: เครือข่ายที่นี่ถูกจำกัดด้วย allowlist ไม่ครอบคลุม `services.gradle.org` หรือเซิร์ฟเวอร์ Android SDK ของ Google เลย (ลองแล้วโดนบล็อคด้วย 403) และไม่มี Xcode อยู่แล้ว ดังนั้นขั้นตอนนี้ต้องทำบนเครื่องของคุณเอง

## Android (ทำได้บน Mac/Windows/Linux)

1. ติดตั้ง [Android Studio](https://developer.android.com/studio) (ตัวติดตั้งจะดาวน์โหลด Android SDK + Gradle ให้อัตโนมัติ)
2. ทุกครั้งที่แก้ `blood-donation-tracker.jsx` แล้วอยากอัปเดตแอป native ให้รันในโฟลเดอร์ `web/`:
   ```bash
   npm run build
   npx cap sync android
   ```
3. เปิดโปรเจกต์ Android ด้วยคำสั่ง (จะเปิด Android Studio ให้อัตโนมัติถ้าติดตั้งไว้แล้ว):
   ```bash
   npx cap open android
   ```
4. ใน Android Studio กด Run (▶) เพื่อรันบนอีมูเลเตอร์หรือมือถือจริงที่เสียบ USB (เปิด USB debugging ในมือถือก่อน)
5. เมื่อพร้อมปล่อยจริง: Build > Generate Signed Bundle/APK ในเมนู Android Studio — ต้องสร้าง keystore สำหรับเซ็นแอป (เก็บไฟล์นี้ให้ดี ห้ามหาย ไม่งั้นอัปเดตแอปเดิมบน Play Store ไม่ได้อีก)
6. สมัคร [Google Play Console](https://play.google.com/console) (ค่าธรรมเนียมครั้งเดียว $25) แล้วอัปโหลด `.aab` ที่ได้

## iOS (ต้องใช้ Mac เท่านั้น)

1. ติดตั้ง Xcode จาก Mac App Store
2. เหมือนขั้น Android: `npm run build && npx cap sync ios`
3. เปิดโปรเจกต์:
   ```bash
   npx cap open ios
   ```
4. ใน Xcode: เลือก Team ของคุณใน Signing & Capabilities (ต้องมี Apple ID ผูกไว้ก่อน — ทดสอบบนเครื่องตัวเองฟรีได้โดยไม่ต้องเสียเงิน)
5. กด Run เพื่อรันบน Simulator หรือ iPhone จริงที่เสียบสาย
6. เมื่อพร้อมปล่อยจริงบน App Store: ต้องสมัคร [Apple Developer Program]($99/ปี) ก่อน แล้วใช้ Xcode > Product > Archive เพื่อสร้างไฟล์ส่งขึ้น App Store Connect

## หมายเหตุสำคัญ

- โค้ดแอปทั้งหมด (`blood-donation-tracker.jsx`) ใช้ร่วมกันระหว่างเวอร์ชันเว็บ LINE LIFF และแอป native — ไม่ต้องแก้โค้ดแยกสองที่
- ฟีเจอร์บันทึกรูป/เพิ่มปฏิทินในแอป native จะใช้ native share sheet ของ OS จริง (ผ่าน `@capacitor/filesystem` + `@capacitor/share`) ซึ่งไม่ติดข้อจำกัดของ LINE in-app browser ที่เจอปัญหามาตลอดทั้งเซสชัน
- Bundle ID ที่ตั้งไว้: `com.bloodjourney.app` (เปลี่ยนได้ใน `capacitor.config.ts` ถ้าต้องการ แต่ต้องเปลี่ยนพร้อมกันทั้ง Android/iOS project ด้วย — ปกติควรตั้งให้ตรงกันตั้งแต่ต้นและไม่เปลี่ยนอีกหลัง publish)
