import React, { useEffect, useRef, useState } from "react";
import { buildIcsForReminder } from "./App.jsx";

// Standalone landing page for the "ไฟล์ .ics" calendar option — opened via
// liff.openWindow({external: true}) from the main app, the same escape used
// for the share-card image download. LINE's in-app browser blocks blob/file
// downloads outright, but this page only ever runs in a real external
// browser (Safari/Chrome), where a plain .ics download works normally and
// the OS hands it to whatever calendar app the user actually uses — unlike
// the Google Calendar link option, which only helps someone signed into a
// Google account.
//
// No encryption/signing here unlike the share-card's `d` token: a calendar
// link only carries a date and a title, and there's nothing to forge that
// would benefit anyone — worst case is a wrong date on an event the user
// adds to their own calendar, so the params are passed in the clear.
export default function CalendarIcsPage() {
  const [status, setStatus] = useState("generating"); // generating | ready | error
  const autoTriggeredRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dateStr = params.get("date") || "";
    const title = params.get("title") || "แจ้งเตือนวันบริจาคโลหิต";
    if (!dateStr) {
      setStatus("error");
      return;
    }
    try {
      const ics = buildIcsForReminder(dateStr, title);
      const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
      const blobUrl = URL.createObjectURL(blob);
      if (!autoTriggeredRef.current) {
        autoTriggeredRef.current = true;
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = "blood-donation-reminder.ics";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setStatus("ready");
    } catch (e) {
      setStatus("error");
    }
  }, []);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: "#FBF6F5", color: "#241A18", padding: 24, textAlign: "center",
      fontFamily: "'Mitr','Inter',sans-serif",
    }}>
      <div style={{ maxWidth: 360 }}>
        {status === "generating" && (
          <p style={{ fontSize: 14, color: "#6B5854" }}>กำลังสร้างไฟล์ปฏิทิน...</p>
        )}
        {status === "ready" && (
          <>
            <h1 style={{ fontSize: 18, margin: "0 0 10px" }}>ดาวน์โหลดไฟล์ปฏิทินแล้ว</h1>
            <p style={{ fontSize: 13.5, color: "#6B5854", lineHeight: 1.6 }}>
              เปิดไฟล์ที่ดาวน์โหลด (blood-donation-reminder.ics) เพื่อเพิ่มลงปฏิทินของคุณ — ใช้ได้กับ Apple Calendar, Google Calendar, Outlook และแอปปฏิทินอื่น ๆ
            </p>
          </>
        )}
        {status === "error" && (
          <>
            <h1 style={{ fontSize: 18, margin: "0 0 10px" }}>สร้างไฟล์ปฏิทินไม่สำเร็จ</h1>
            <p style={{ fontSize: 14, color: "#6B5854", lineHeight: 1.6 }}>
              ลิงก์นี้อาจไม่สมบูรณ์ — กลับไปที่แอปแล้วลองอีกครั้ง
            </p>
          </>
        )}
      </div>
    </div>
  );
}
