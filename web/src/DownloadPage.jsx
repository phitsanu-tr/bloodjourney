import React, { useEffect, useRef, useState } from "react";
import {
  buildShareCardDataUrl,
  buildRecordShareCardDataUrl,
  CARD_SIZES,
  DEFAULT_CARD_SIZE,
  DONATION_TYPE_LABELS,
  deriveAchievementText,
  toBuddhistDate,
  decodeUrlText,
  verifyShareParams,
} from "./App.jsx";

// Standalone "download landing page" — opened via liff.openWindow({external:
// true}) from inside the main app's share-card modal, specifically to escape
// LINE's in-app browser (which blocks essentially every client-side
// save/share mechanism). A real external browser tab has none of those
// restrictions, so this page just redraws the same share card from the URL
// params it was given (the two browser contexts don't share localStorage,
// so the image itself can't be handed off directly — only small params can)
// and immediately offers it for download/share/long-press-save, all of
// which work normally here.
function readParams() {
  const params = new URLSearchParams(window.location.search);
  const sizeKey = params.get("size") || DEFAULT_CARD_SIZE;
  const size = CARD_SIZES[sizeKey] || CARD_SIZES[DEFAULT_CARD_SIZE];
  const kind = params.get("kind");
  if (kind === "record") {
    // typeLabel/dateStr aren't carried in the URL as Thai text — they're
    // re-derived here from the raw `type` enum and `date`, the same way the
    // main app computes them (see openShareCardInExternalBrowser).
    const type = params.get("type") === "component" ? "component" : "whole";
    return {
      kind,
      size,
      data: {
        order: params.get("order") || "",
        dateStr: toBuddhistDate(params.get("date") || ""),
        timeStr: params.get("timeStr") || "",
        typeLabel: DONATION_TYPE_LABELS[type],
        location: decodeUrlText(params.get("location")),
        bloodType: params.get("bloodType") || "",
        nickname: decodeUrlText(params.get("nickname")),
        width: size.w,
        height: size.h,
      },
    };
  }
  if (kind === "achievement") {
    // title/desc are re-derived here from kind+tier+isMonk+threshold, the
    // same formula the main app uses to build them in the first place (see
    // deriveAchievementText / buildAchievements) — not carried as Thai text.
    const achievementBase = {
      kind: params.get("akind") || "",
      tier: params.get("tier") ? Number(params.get("tier")) : undefined,
      isMonk: params.get("isMonk") === "1",
      threshold: params.get("threshold") ? Number(params.get("threshold")) : undefined,
    };
    return {
      kind,
      size,
      data: {
        totalCount: Number(params.get("totalCount") || 0),
        estVolumeMl: Number(params.get("estVolumeMl") || 0),
        achievement: { ...achievementBase, ...deriveAchievementText(achievementBase) },
        bloodType: params.get("bloodType") || "",
        nickname: decodeUrlText(params.get("nickname")),
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
  const autoTriggeredRef = useRef(false);
  const parsed = useRef(readParams()).current;

  useEffect(() => {
    if (!parsed) {
      setStatus("error");
      return;
    }
    let cancelled = false;
    // Only render a card built from a link this app's own share flow
    // actually signed (see signShareParams/verifyShareParams) — otherwise
    // anyone could hand-craft this URL with fabricated numbers.
    verifyShareParams(new URLSearchParams(window.location.search)).then((ok) => {
      if (cancelled) return;
      if (!ok) {
        setStatus("invalid");
        return;
      }
      const build = parsed.kind === "record" ? buildRecordShareCardDataUrl : buildShareCardDataUrl;
      build(parsed.data)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerDownload = () => {
    if (!dataUrl) return;
    const filePrefix = parsed?.kind === "record" ? "bloodjourney-donation" : "bloodjourney-achievement";
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
