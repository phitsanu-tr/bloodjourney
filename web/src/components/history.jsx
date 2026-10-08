import React, { useRef, useState, useCallback } from "react";
import { normalizeDonationType, DONATION_TYPE_TINT, DONATION_TYPE_LABELS } from "../lib/donations.js";
import { useMenuEscape, menuOpensUp } from "../lib/hooks.js";
import { toBuddhistDateFull } from "../lib/dates.js";
import { Calendar, MapPin, StickyNote, MoreVertical, Pencil, Share2, Trash2 } from "lucide-react";
import { TypeIcon } from "./icons.jsx";

export const HIST_ICON_BOX = { width: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };

// ⋮ menu rows: 44px tall like every other tap target in the app (were ~38px).
export const HIST_MENU_ITEM = { width: "100%", minHeight: 44, display: "flex", alignItems: "center", gap: 8, padding: "0 14px", background: "none", border: "none", cursor: "pointer", fontSize: 14, fontFamily: "inherit" };

export const HistoryRow = React.memo(function HistoryRow({ d, orderNumber, isMenuOpen, onToggleMenu, onView, onEdit, onShare, onDelete }) {
  // Used for the type pill only -- the order-number droplet badge below is
  // deliberately kept a single consistent color regardless of type (per
  // explicit user feedback), rather than tinting it per donation type.
  const dType = normalizeDonationType(d.type);
  const tint = DONATION_TYPE_TINT[dType];
  const moreRef = useRef(null);
  const [menuUp, setMenuUp] = useState(false);
  // Handlers come in stable (they take the record), so React.memo can skip unchanged rows.
  const toggle = useCallback(() => onToggleMenu(d.id), [onToggleMenu, d.id]);
  const view = useCallback(() => onView(d.id), [onView, d.id]);
  useMenuEscape(isMenuOpen, toggle, moreRef);
  // Screen readers hear what the card is (order, date, type, place) instead of
  // the same generic label on every card. The ⋮ button sits beside the
  // focusable area, not inside it (design 4A).
  const spoken = [`ครั้งที่ ${orderNumber}`, toBuddhistDateFull(d.date), d.time ? `เวลา ${d.time} น.` : "", DONATION_TYPE_LABELS[dType], d.location || ""].filter(Boolean).join(", ");
  return (
    <div className="hist-card" onClick={view} style={{ background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 14, padding: "10px 6px 10px 13px", display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
      <div role="button" tabIndex={0} aria-label={`${spoken} ดูรายละเอียด`} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); view(); } }} style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0, flex: 1, borderRadius: 10 }}>
      <div style={{ width: 46, height: 56, position: "relative", flexShrink: 0 }}>
        <svg width="46" height="56" viewBox="0 0 46 56" fill="none" aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
          <path d="M23 2 C23 2 40 24 40 35 C40 45.5 32.5 54 23 54 C13.5 54 6 45.5 6 35 C6 24 23 2 23 2 Z" fill="#9A3B33" />
        </svg>
        <div style={{ position: "absolute", inset: 0, top: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: String(orderNumber).length >= 3 ? 12 : 14, fontWeight: 800, color: "#FFF7F5", lineHeight: 1.1 }}>{orderNumber}</div>
          <div style={{ fontSize: 11, fontWeight: 500, color: "#FFF7F5", marginTop: 1 }}>ครั้งที่</div>
        </div>
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#3A2C29", lineHeight: 1.5, display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: 7 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}><span style={{ ...HIST_ICON_BOX, alignSelf: "center" }}><Calendar size={12} color="#9A3B33" /></span>{toBuddhistDateFull(d.date)}</span>
          {d.time && <span style={{ fontSize: 12, fontWeight: 400, color: "#7A6360", whiteSpace: "nowrap" }}>{`เวลา\u00A0${d.time}\u00A0น.`}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5 }}>
          <span style={HIST_ICON_BOX}><TypeIcon type={dType} size={12} color="#7A6360" /></span>
          <span style={{ display: "inline-flex", alignItems: "center", fontSize: 12, color: tint.text, fontWeight: 600 }}>{DONATION_TYPE_LABELS[dType]}</span>
        </div>
        {/* Location / note rows only when filled in -- empty ones used to print a lone "—" and made every card ~40px taller. */}
        {d.location && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 12, color: "#7A6360", marginTop: 5 }}>
            <span style={{ ...HIST_ICON_BOX, marginTop: 2 }}><MapPin size={12} /></span> <span style={{ minWidth: 0, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.location}</span>
          </div>
        )}
        {d.note && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 12, color: "#7A6360", marginTop: 5 }}>
            <span style={{ ...HIST_ICON_BOX, marginTop: 2 }}><StickyNote size={12} /></span> <span style={{ minWidth: 0, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.note}</span>
          </div>
        )}
      </div>
      </div>
      <div className="hist-more" onClick={(e) => e.stopPropagation()} style={{ position: "relative", flexShrink: 0 }}>
        <button ref={moreRef} onClick={() => { if (!isMenuOpen) setMenuUp(menuOpensUp(moreRef.current, 3)); toggle(); }} aria-label={`ตัวเลือกเพิ่มเติม สำหรับครั้งที่ ${orderNumber}`} aria-haspopup="menu" aria-expanded={isMenuOpen} style={{ background: "none", border: "none", cursor: "pointer", padding: 13.5, margin: "-10px -3px -10px 0", lineHeight: 0 }}>
          <MoreVertical size={17} color="#9A3B33" />
        </button>
        {isMenuOpen && (
          <>
            <div onClick={toggle} style={{ position: "fixed", inset: 0, zIndex: 55 }} />
            <div role="menu" style={{ position: "absolute", ...(menuUp ? { bottom: "100%", marginBottom: 2 } : { top: "100%", marginTop: 2 }), right: 0, background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: 12, boxShadow: "0 4px 14px rgba(36,26,24,0.15)", overflow: "hidden", zIndex: 56, minWidth: 120 }}>
              <button role="menuitem" onClick={() => onEdit(d)} style={{ ...HIST_MENU_ITEM, color: "#3A2C29" }}>
                <Pencil size={14} color="#9A3B33" /> แก้ไข
              </button>
              <button role="menuitem" onClick={() => onShare(d)} style={{ ...HIST_MENU_ITEM, color: "#3A2C29", borderTop: "1px solid #F3E7E4" }}>
                <Share2 size={14} color="#9A3B33" /> แชร์
              </button>
              <button role="menuitem" onClick={() => onDelete(d.id)} style={{ ...HIST_MENU_ITEM, color: "#B3261E", borderTop: "1px solid #F3E7E4" }}>
                <Trash2 size={14} color="#B3261E" /> ลบ
              </button>
                          </div>
          </>
        )}
      </div>
    </div>
  );
});
