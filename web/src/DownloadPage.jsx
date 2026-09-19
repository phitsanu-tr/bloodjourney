import React, { useEffect, useRef, useState } from "react";
import {
  buildShareCardDataUrl,
  buildRecordShareCardDataUrl,
  CARD_SIZES,
  DEFAULT_CARD_SIZE,
  DONATION_TYPE_LABELS,
  deriveAchievementText,
  toBuddhistDate,
  decodeShareToken,
} from "./App.jsx";

// Standalone "download landing page" — opened via liff.openWindow({external:
// true}) from inside the main app's share-card modal, specifically to escape
// LINE's in-app browser (which blocks essentially every client-side
// save/share mechanism). A real external browser tab has none of those
// restrictions, so this page just redraws the same share card from a single
// encrypted `d` token in the URL (the two browser contexts don't share
// localStorage, so the image itself can't be handed off directly — only a
// small payload can) and immediately offers it for download/share/
// long-press-save, all of which work normally here.
//
// Everything the card needs (kind, size, numbers, nickname, etc.) lives
// packed into the encrypted token as a compact byte layout — decodeShareToken()
// hands back the decoded field object once it's verified the token decrypts
// cleanly and isn't expired (see the byte-layout comment above
// encodeSharePayload in App.jsx). This just reshapes that object into what
// buildShareCardDataUrl / buildRecordShareCardDataUrl expect, re-deriving
// the Thai achievement text and estVolumeMl (always totalCount*350) rather
// than carrying them separately.
function sizeFromIdx(idx) {
  const key = Object.keys(CARD_SIZES)[idx];
  return CARD_SIZES[key] || CARD_SIZES[DEFAULT_CARD_SIZE];
}

function buildParsedFromPayload(payload) {
  if (!payload) return null;
  const size = sizeFromIdx(payload.sizeIdx);
  if (payload.kind === "r") {
    return {
      kind: "record",
      size,
      data: {
        order: payload.order ?? "",
        dateStr: toBuddhistDate(payload.dateObj),
        timeStr: payload.timeStr || "",
        typeLabel: DONATION_TYPE_LABELS[payload.type === "c" ? "component" : "whole"],
        location: payload.location || "",
        bloodType: payload.bloodType || "",
        nickname: payload.nickname || "",
        width: size.w,
        height: size.h,
      },
    };
  }
  if (payload.kind === "a") {
    const achievementBase = {
      kind: payload.akind === "m" ? "medal" : "pin",
      tier: payload.tier || undefined,
      isMonk: !!payload.isMonk,
      threshold: payload.threshold || undefined,
    };
    const totalCount = Number(payload.totalCount || 0);
    return {
      kind: "achievement",
      size,
      data: {
        totalCount,
        estVolumeMl: totalCount * 350,
        achievement: { ...achievementBase, ...deriveAchievementText(achievementBase) },
        bloodType: payload.bloodType || "",
        nickname: payload.nickname || "",
        width: size.w,
        height: size.h,
      },
    };
  }
  return null;
}

export default function DownloadPage() {
  const [dataUrl, setDataUrl] = useState("");
  const [status, setStatus] = useState("generating"); // generating | ready | error | invalid
  const [parsed, setParsed] = useState(null);
  const autoTriggeredRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const token = new URLSearchParams(window.location.search).get("d");
    if (!token) {
      setStatus("invalid");
      return;
    }
    decodeShareToken(token).then((payload) => {
      if (cancelled) return;
      if (!payload) {
        setStatus("invalid"); // wrong/tampered token, or expired
        return;
      }
      const built = buildParsedFromPayload(payload);
      if (!built) {
        setStatus("error");
        return;
      }
      setParsed(built);
      const build = built.kind === "record" ? buildRecordShareCardDataUrl : buildShareCardDataUrl;
      build(built.data)
        .then((url) => {
          if (cancelled) return;
          setDataUrl(url);
          setStatus("ready");
        })
        .catch(() => {
          if (!cancelled) setStatus("error");
        });
    });
    return () => { cancelled = true; };
  }, []);

  const triggerDownload = () => {
    if (!dataUrl || !parsed) return;
    const filePrefix = parsed.kind === "record" ? "bloodjourney-donation" : "bloodjourney-achievement";
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${filePrefix}-${parsed.size.key}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Auto-trigger the download the moment the image is ready — this is the
  // whole point of this page, the manual button below is just a fallback in
  // case the browser blocked the automatic click (some browsers require a
  // direct user gesture, which the page load itself isn't).
  useEffect(() => {
    if (status === "ready" && !autoTriggeredRef.current) {
      autoTriggeredRef.current = true;
      triggerDownload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const canShareFiles = (() => {
    try {
      if (typeof navigator === "undefined" || !navigator.share || !navigator.canShare) return false;
      const testFile = new File([""], "test.png", { type: "image/png" });
      return navigator.canShare({ files: [testFile] });
    } catch {
      return false;
    }
  })();

  const shareImage = async () => {
    if (!dataUrl) return;
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], "bloodjourney.png", { type: "image/png" });
      await navigator.share({ files: [file], title: "Blood Journey" });
    } catch (e) {}
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: "#FBF6F5", color: "#241A18", padding: 24, textAlign: "center",
      fontFamily: "'Mitr','Inter',sans-serif",
    }}>
      {status === "error" && (
        <div style={{ maxWidth: 360 }}>
          <h1 style={{ fontSize: 18, margin: "0 0 10px" }}>สร้างภาพไม่สำเร็จ</h1>
          <p style={{ fontSize: 14, color: "#6B5854", lineHeight: 1.6 }}>
            ลิงก์นี้อาจไม่สมบูรณ์ — กลับไปที่แอปแล้วลองกดใหม่อีกครั้ง
          </p>
        </div>
      )}
      {status === "invalid" && (
        <div style={{ maxWidth: 360 }}>
          <h1 style={{ fontSize: 18, margin: "0 0 10px" }}>ลิงก์นี้ใช้ไม่ได้แล้ว</h1>
          <p style={{ fontSize: 14, color: "#6B5854", lineHeight: 1.6 }}>
            ลิงก์อาจหมดอายุหรือไม่ได้มาจากแอป Blood Journey โดยตรง — กลับไปที่แอปแล้วกดปุ่มแชร์ใหม่อีกครั้ง
          </p>
        </div>
      )}
      {status === "generating" && (
        <p style={{ fontSize: 14, color: "#6B5854" }}>กำลังสร้างภาพ...</p>
      )}
      {status === "ready" && dataUrl && (
        <div style={{ maxWidth: 420, width: "100%" }}>
          <img src={dataUrl} alt="Blood Journey" style={{ width: "100%", borderRadius: 16, boxShadow: "0 14px 30px rgba(154,59,51,0.14)", marginBottom: 18 }} />
          <p style={{ fontSize: 13.5, color: "#6B5854", lineHeight: 1.6, margin: "0 0 16px" }}>
            เริ่มดาวน์โหลดให้อัตโนมัติแล้ว — ถ้าไม่ขึ้น ลองกดปุ่มด้านล่าง หรือกดค้างที่รูปด้านบนแล้วเลือก "บันทึกรูปภาพ"
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            {canShareFiles && (
              <button onClick={shareImage} style={{
                flex: 1, padding: "12px 0", borderRadius: 12, border: "none", background: "#8A2F28", color: "#FFF7F5",
                fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}>แชร์</button>
            )}
            <button onClick={triggerDownload} style={{
              flex: 1, padding: "12px 0", borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: 600,
              ...(canShareFiles
                ? { background: "#FFFFFF", color: "#8A2F28", border: "1.5px solid #8A2F28" }
                : { border: "none", background: "#8A2F28", color: "#FFF7F5" }),
            }}>ดาวน์โหลด</button>
          </div>
        </div>
      )}
    </div>
  );
}
