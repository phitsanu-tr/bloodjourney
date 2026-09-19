import React, { useEffect, useRef, useState } from "react";
import { decryptExportHandoff } from "./App.jsx";

// Last-resort landing page for the export-backup download, opened via
// liff.openWindow({external: true}) only when navigator.share isn't
// available inside LINE's in-app browser (see downloadExportFile in
// App.jsx). A real external browser tab has none of LINE's download
// restrictions, so a plain blob download just works here.
//
// The JSON text rides along encrypted+time-boxed in the `d` token (see
// encryptExportHandoff/decryptExportHandoff) rather than in the clear,
// since — unlike the share-card's public fields or a calendar date — this
// is the user's full personal backup (profile + every donation record).
// It's still just a short-lived handoff between two browser contexts on
// the user's own device, not a security boundary against anyone else.
export default function ExportBackupPage() {
  const [status, setStatus] = useState("generating"); // generating | ready | error
  const [jsonText, setJsonText] = useState("");
  const autoTriggeredRef = useRef(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const token = new URLSearchParams(window.location.search).get("d");
    if (!token) {
      setStatus("error");
      return;
    }
    decryptExportHandoff(token).then((text) => {
      if (cancelled) return;
      if (!text) {
        setStatus("error"); // wrong/tampered token, or expired
        return;
      }
      setJsonText(text);
      setStatus("ready");
      if (!autoTriggeredRef.current) {
        autoTriggeredRef.current = true;
        try {
          const blob = new Blob([text], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `donation-backup-${new Date().toISOString().slice(0, 10)}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 2000);
        } catch (e) {}
      }
    });
    return () => { cancelled = true; };
  }, []);

  const triggerDownload = () => {
    if (!jsonText) return;
    const blob = new Blob([jsonText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `donation-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 2000);
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
    } catch (e) {
      const el = textareaRef.current;
      if (el) { el.focus(); el.select(); document.execCommand && document.execCommand("copy"); }
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: "#FBF6F5", color: "#241A18", padding: 24, textAlign: "center",
      fontFamily: "'Mitr','Inter',sans-serif",
    }}>
      <div style={{ maxWidth: 420, width: "100%" }}>
        {status === "generating" && (
          <p style={{ fontSize: 14, color: "#6B5854" }}>กำลังเตรียมไฟล์...</p>
        )}
        {status === "error" && (
          <>
            <h1 style={{ fontSize: 18, margin: "0 0 10px" }}>ลิงก์นี้ใช้ไม่ได้แล้ว</h1>
            <p style={{ fontSize: 14, color: "#6B5854", lineHeight: 1.6 }}>
              ลิงก์อาจหมดอายุ (ใช้ได้ภายในไม่กี่นาที) หรือไม่ได้มาจากแอป Blood Journey โดยตรง — กลับไปที่แอปแล้วกดปุ่มส่งออกข้อมูลใหม่อีกครั้ง
            </p>
          </>
        )}
        {status === "ready" && (
          <>
            <h1 style={{ fontSize: 18, margin: "0 0 10px" }}>ไฟล์ข้อมูลสำรองของคุณ</h1>
            <p style={{ fontSize: 13.5, color: "#6B5854", lineHeight: 1.6, margin: "0 0 16px" }}>
              เริ่มดาวน์โหลดให้อัตโนมัติแล้ว — ถ้าไม่ขึ้น ลองกดปุ่มด้านล่าง หรือคัดลอกข้อความไปเก็บไว้ในไฟล์ข้อความ/โน้ตของคุณแทน
            </p>
            <textarea
              ref={textareaRef}
              readOnly
              value={jsonText}
              onFocus={(e) => e.target.select()}
              style={{ width: "100%", height: 140, borderRadius: 10, border: "1px solid #E3C8C3", padding: 10, fontSize: 11, fontFamily: "monospace", color: "#3A2C29", background: "#FFFFFF", marginBottom: 14, resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={copyText} style={{
                flex: 1, padding: "12px 0", borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: 600,
                background: "#FFFFFF", color: "#8A2F28", border: "1.5px solid #8A2F28",
              }}>คัดลอกข้อความ</button>
              <button onClick={triggerDownload} style={{
                flex: 1, padding: "12px 0", borderRadius: 12, border: "none", background: "#8A2F28", color: "#FFF7F5",
                fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}>ดาวน์โหลด</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
