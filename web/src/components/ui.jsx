import { useState, useRef, useEffect } from "react";
import { AlertTriangle, AlertCircle, X } from "lucide-react";

// Keeps "ครั้งที่ 60" / "ชั้นที่ 3" together so a narrow card never leaves the number alone on a line.
export function keepTail(title) {
  const m = /^(.*) ((?:ครั้งที่|ชั้นที่) \d+)$/.exec(title);
  return m ? <>{m[1]} <span style={{ whiteSpace: "nowrap" }}>{m[2]}</span></> : title;
}

// Text read by screen readers but not shown on screen.
export const SR_ONLY = { position: "absolute", width: 1, height: 1, margin: -1, padding: 0, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 };

// Horizontal ruler (design 4 of profile-number-picker-designs.html): the
// value reads big above, the scale slides left/right under a fixed red line.
// Used for height (1 cm ticks) and weight (0.1 kg ticks). Horizontal so it
// works the same for left- and right-handed use.
export const RULER_TICK = 8;

// Scroll area under a fixed modal header. Once scrolled, the top 18px fades out
// so content melts into the header instead of being cut off (no divider line).
export function FadeScroll({ children, style, scrollRef }) {
  const [scrolled, setScrolled] = useState(false);
  const fade = "linear-gradient(transparent 0, #000 18px)";
  return (
    <div ref={scrollRef} className="no-scrollbar"
      onScroll={(e) => { const v = e.currentTarget.scrollTop > 2; setScrolled(p => (p === v ? p : v)); }}
      style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", ...(scrolled ? { WebkitMaskImage: fade, maskImage: fade } : null), ...style }}>
      {children}
    </div>
  );
}

// Close "✕" for dialogs that had none (confirm dialogs, storage warning): same icon and
// colour as the profile/settings ✕, with a roomier tap area.
// Field-level error: sits right under the field it is about (icon + red 12px text, no box). The bottom box in the
// donation form is kept only for errors that are not about one field (e.g. a failed save).
// Amber note for a browser/page limitation (not a failure): what to do instead.
export function FieldNote({ children }) {
  return (
    <div role="note" style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FFF3DC", border: "1px solid #F2D9A4", borderRadius: 12, padding: "9px 12px", margin: "8px 0 0", fontSize: 12, lineHeight: 1.55, color: "#6B4A00" }}>
      <AlertTriangle size={13} color="#B7791F" aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }} />
      <span>{children}</span>
    </div>
  );
}

// Renders exportMsg / importMsg ({ kind: "err" | "note", text, at }) when it belongs to the given slot.
export function BackupMsg({ msg, at }) {
  if (!msg || msg.at !== at) return null;
  return msg.kind === "note" ? <FieldNote>{msg.text}</FieldNote> : <FieldError>{msg.text}</FieldError>;
}

export function FieldError({ children }) {
  return (
    <div role="alert" style={{ display: "flex", gap: 6, alignItems: "flex-start", margin: "8px 0 0", fontSize: 12, lineHeight: 1.5, color: "#B3261E" }}>
      <AlertCircle size={13} color="#B3261E" style={{ flexShrink: 0, marginTop: 3 }} />
      <span>{children}</span>
    </div>
  );
}

export function DialogX({ onClick, disabled, style }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label="ปิด"
      style={{ position: "relative", background: "none", border: "none", padding: 0, cursor: disabled ? "not-allowed" : "pointer", color: "#3A2C29", display: "flex", flexShrink: 0, opacity: disabled ? 0.4 : 1, ...style }}>
      <span aria-hidden="true" style={{ position: "absolute", inset: -12 }} />
      <X size={20} />
    </button>
  );
}

export function HorizontalRuler({ min, max, step = 1, decimals = 0, majorEvery, midEvery, value, unit, unitBefore, caption, onChange, onSettle, label, ariaUnit }) {
  const ref = useRef(null);
  const count = Math.round((max - min) / step) + 1;
  const valAt = (i) => Math.round((min + i * step) * 10 ** decimals) / 10 ** decimals;
  const idxOf = (v) => Math.max(0, Math.min(count - 1, Math.round((v - min) / step)));
  const idxRef = useRef(idxOf(value));
  const settleTimer = useRef(null);
  const userScrolled = useRef(false);
  const [idx, setIdx] = useState(idxRef.current);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    el.scrollLeft = idxRef.current * RULER_TICK;
    // A mouse wheel / trackpad scrolling vertically moves the scale too.
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); el.scrollLeft += e.deltaY; }
      userScrolled.current = true;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => { el.removeEventListener("wheel", onWheel); clearTimeout(settleTimer.current); };
  }, []);
  const pick = (i) => {
    i = Math.max(0, Math.min(count - 1, i));
    idxRef.current = i; setIdx(i);
    ref.current?.scrollTo({ left: i * RULER_TICK, behavior: "smooth" });
    onChange?.(valAt(i));
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => onSettle?.(valAt(i)), 250);
  };
  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const i = Math.max(0, Math.min(count - 1, Math.round(el.scrollLeft / RULER_TICK)));
    if (i !== idxRef.current) { idxRef.current = i; setIdx(i); onChange?.(valAt(i)); }
    if (!userScrolled.current) return;
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => onSettle?.(valAt(idxRef.current)), 180);
  };
  const markUser = () => { userScrolled.current = true; };
  // Whole numbers drop the ".0" (50 rather than 50.0).
  const shown = String(Number(valAt(idx).toFixed(decimals)));
  return (
    <div>
      <div aria-hidden="true" style={{ textAlign: "center", fontVariantNumeric: "tabular-nums", marginBottom: 2 }}>
        {/* Thai puts พ.ศ. before the year ("พ.ศ. 2546"), units after (162 ซม.). */}
        {unitBefore && <span style={{ fontSize: 14, color: "#7A6360", marginRight: 5 }}>{unitBefore}</span>}
        <span style={{ fontSize: 24, fontWeight: 700, color: "#9A3B33" }}>{shown}</span>
        {unit && <span style={{ fontSize: 14, color: "#7A6360", marginLeft: 4 }}>{unit}</span>}
        {caption && <span style={{ fontSize: 12, color: "#7A6360", marginLeft: 6 }}>· {caption(valAt(idx))}</span>}
      </div>
      <div style={{ position: "relative", height: 58 }}>
        <div aria-hidden="true" style={{ position: "absolute", left: "50%", top: 2, width: 3, height: 40, marginLeft: -1.5, borderRadius: 2, background: "#9A3B33", zIndex: 1, pointerEvents: "none" }} />
        <div ref={ref} className="no-scrollbar" onScroll={onScroll} onTouchStart={markUser} onPointerDown={markUser}
          role="spinbutton" tabIndex={0} aria-label={label} aria-valuenow={valAt(idx)} aria-valuetext={`${unitBefore ? unitBefore + " " : ""}${shown}${unit ? " " + (ariaUnit || unit) : ""}${caption ? " " + caption(valAt(idx)) : ""}`}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); markUser(); pick(idxRef.current + 1); }
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); markUser(); pick(idxRef.current - 1); }
          }}
          style={{ height: "100%", overflowX: "scroll", overflowY: "hidden", scrollSnapType: "x mandatory", overscrollBehavior: "contain", outline: "none", display: "flex",
            WebkitMaskImage: "linear-gradient(to right, transparent, #000 22%, #000 78%, transparent)", maskImage: "linear-gradient(to right, transparent, #000 22%, #000 78%, transparent)" }}>
          <div style={{ flex: `0 0 calc(50% - ${RULER_TICK / 2}px)` }} />
          {Array.from({ length: count }, (_, i) => {
            // Ticks keyed to the value itself (not the index), so labels land
            // on round numbers like 2540 or 160 whatever the range starts at.
            const k = Math.round(valAt(i) / step);
            const major = k % majorEvery === 0;
            const mid = !major && midEvery && k % midEvery === 0;
            return (
              <div key={i} style={{ position: "relative", flex: `0 0 ${RULER_TICK}px`, height: "100%", scrollSnapAlign: "center" }}>
                <span style={{ position: "absolute", left: RULER_TICK / 2 - 0.5, top: 6, width: 1, height: major ? 28 : mid ? 20 : 12, background: major ? "#9A8582" : "#D9C3BE" }} />
                {major && <span style={{ position: "absolute", left: RULER_TICK / 2, top: 40, transform: "translateX(-50%)", fontSize: 11, color: "#7A6360", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{Math.round(valAt(i))}</span>}
              </div>
            );
          })}
          <div style={{ flex: `0 0 calc(50% - ${RULER_TICK / 2}px)` }} />
        </div>
      </div>
    </div>
  );
}

// Extracted + React.memo'd so that with a long donation history (500-1000+
// records) paged in via "โหลดเพิ่ม", an unrelated state change elsewhere in
// AppInner (a toast, a timer tick, opening a different modal) doesn't force
// every already-rendered row to re-render — only the row(s) whose own props
// actually changed do. isMenuOpen is passed as a plain boolean (not the
// whole openActionMenuId string) precisely so that opening the menu on ONE
// row doesn't also cause every other row's memo comparison to fail.
// Fixed 14px icon column for the meta lines of a history row, so every line's text starts at the
// same x (icons of 13-14px are centred in it) instead of drifting with each icon's own width.
// One-line "saved / last edited" note under the detail modal's table. The row labels above are one
// block centred in a 50px column (as wide as the word "ประเภท"), so this line starts at that block's
// left edge: we measure a hidden "ประเภท" at the label font size (12px) and indent by (50 - width) / 2.
// "บันทึกเมื่อ / แก้ไขล่าสุดเมื่อ" line at the foot of the detail dialogs, starting at the rows' left edge.
export function ModalMetaLine({ children }) {
  return <div style={{ padding: "10px 0 2px", fontSize: 12, color: "#7A6360", lineHeight: 1.6 }}>{children}</div>;
}

// Faint dividers between the options of a segmented picker (white outlined track + pale-pink sliding pill).
// Shown only while nothing is chosen, so the empty control still reads as N separate choices; once an option
// is picked they all fade out (a leftover lone divider read as a grouping, e.g. "A B AB | O").
export function SegDividers({ n, sel }) {
  return Array.from({ length: n - 1 }, (_, i) => {
    const k = i + 1; // divider between option k-1 and option k
    return (
      <span key={k} aria-hidden="true" style={{ position: "absolute", top: 10, bottom: 10, left: `calc(4px + ${k} * (100% - 8px) / ${n})`, width: 1, marginLeft: -0.5, background: "#E6D3CF", opacity: sel >= 0 ? 0 : 1, transition: "opacity .18s", pointerEvents: "none" }} />
    );
  });
}
