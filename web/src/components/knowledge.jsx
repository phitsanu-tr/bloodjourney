import React, { useState, useCallback } from "react";
import { DONATION_TYPES, DONATION_TYPE_LABELS } from "../lib/donations.js";
import { ChevronDown, ShieldCheck, Clock, CheckCircle2, BookOpen, List, HeartPulse, Info, Sparkles, MapPin, Phone, ExternalLink } from "lucide-react";
import { useEffectOn } from "../lib/hooks.js";
import { KNOWLEDGE_CRITERIA, TRC_SITE, KNOWLEDGE_BEFORE, KNOWLEDGE_STEPS, KNOWLEDGE_AFTER, KNOWLEDGE_MYTHS, KNOWLEDGE_BENEFITS } from "../lib/content.js";
import { SR_ONLY } from "./ui.jsx";

export const KN_CARD = { background: "#FFFFFF", border: "1px solid #EEDEDA", borderTop: "none", borderRadius: "0 0 14px 14px", padding: "6px 15px" };

export function KnRows({ items }) {
  return items.map((t, i) => {
    const Icon = t.icon;
    return (
      <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 0", borderBottom: i < items.length - 1 ? "1px solid #F3E7E4" : "none" }}>
        <Icon size={16} color="#9A3B33" style={{ marginTop: 3, flexShrink: 0 }} aria-hidden="true" />
        <div style={{ fontSize: 14, color: "#3A2C29", lineHeight: 1.6 }}>{t.text}</div>
      </div>
    );
  });
}

// Keeps each space-separated phrase whole ("ชิคุนกุนยา" was split mid-word at 390px).
export const keepPhrases = (text) => text.split(" ").map((w, i) => <React.Fragment key={i}>{i > 0 && " "}<span style={{ whiteSpace: "nowrap" }}>{w}</span></React.Fragment>);

// The four donation types as a pressed-button group (4 across, or 2 x 2 when narrow).
export function DonationTypeChips({ value, onChange, label = "ประเภทการบริจาค" }) {
  // One segmented control (4 across, or 2 x 2 when narrow) instead of four loose pills.
  return (
    <div style={{ containerType: "inline-size" }}>
      <style>{`.kn-seg { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; } @container (min-width: 340px) { .kn-seg { grid-template-columns: repeat(4, 1fr); } }`}</style>
      <div role="group" aria-label={label} className="kn-seg" style={{ background: "#F3EAE8", borderRadius: 14, padding: 4 }}>
        {DONATION_TYPES.map((t) => (
          <button key={t} type="button" onClick={() => onChange(t)} aria-pressed={value === t} style={{
            position: "relative", minHeight: 36, borderRadius: 10, border: "none", fontFamily: "inherit", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer", padding: "0 4px",
            background: value === t ? "#9A3B33" : "transparent", color: value === t ? "#FFF7F5" : "#6E5854",
            boxShadow: value === t ? "0 2px 6px -2px rgba(122,42,35,0.5)" : "none",
          }}>
            {/* Invisible 44px-tall tap area; the control keeps its look. */}
            <span aria-hidden="true" style={{ position: "absolute", inset: "-4px -2px" }} />
            {DONATION_TYPE_LABELS[t]}
          </button>
        ))}
      </div>
    </div>
  );
}

// One folding section: the h3 holds the toggle button; only the donor criteria start open.
export function KnSection({ id, icon: Icon, title, open, onToggle, children }) {
  return (
    <section id={id === "before" ? "pre-donation-tips" : undefined} style={{ marginBottom: 10, scrollMarginTop: "calc(60px + env(safe-area-inset-top) + 16px)" }}>
      <h3 style={{ margin: 0 }}>
        <button type="button" aria-expanded={open} onClick={() => onToggle(id)}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", minHeight: 48, padding: "0 14px", background: "#FFFFFF", border: "1px solid #EEDEDA", borderRadius: open ? "14px 14px 0 0" : 14, fontFamily: "inherit", fontSize: 14, fontWeight: 700, color: "#3A2C29", textAlign: "left", cursor: "pointer" }}>
          <Icon size={16} color="#9A3B33" aria-hidden="true" style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{title}</span>
          <ChevronDown size={18} color="#9A8582" aria-hidden="true" style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
        </button>
      </h3>
      {open && <div style={KN_CARD}>{children}</div>}
    </section>
  );
}

export function KnowledgePage({ initialType, jumpToBefore, onJumpDone, onCheckEligibility }) {
  const [type, setType] = useState(DONATION_TYPES.includes(initialType) ? initialType : "whole");
  const [open, setOpen] = useState(() => ({ criteria: true, before: !!jumpToBefore }));
  const toggle = useCallback((id) => setOpen((o) => ({ ...o, [id]: !o[id] })), []);
  // Arriving from the home card's "ดูวิธีเตรียมตัวก่อนบริจาค": open that section and scroll to it.
  useEffectOn(() => {
    if (!jumpToBefore) return undefined;
    setOpen((o) => ({ ...o, before: true }));
    const t = setTimeout(() => { document.getElementById("pre-donation-tips")?.scrollIntoView({ behavior: "smooth", block: "start" }); onJumpDone(); }, 80);
    return () => clearTimeout(t);
  }, [jumpToBefore]);
  const crit = KNOWLEDGE_CRITERIA[type];
  const sec = (id) => ({ id, open: !!open[id], onToggle: toggle });
  return (
    <>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "#3A2C29", margin: "0 0 4px" }}>ให้ความรู้เรื่องการบริจาคโลหิต</h2>
      <p style={{ fontSize: 12, color: "#7A6360", margin: "0 0 18px", lineHeight: 1.6 }}>สรุปจากข้อมูลของศูนย์บริการโลหิตแห่งชาติ สภากาชาดไทย</p>

      <KnSection {...sec("criteria")} icon={ShieldCheck} title="เกณฑ์ผู้บริจาค">
        <div style={{ margin: "8px 0 4px" }}><DonationTypeChips value={type} onChange={setType} /></div>
        {crit.summary && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "11px 0", borderBottom: "1px solid #F3E7E4", fontSize: 14, fontWeight: 600, color: "#9A3B33" }}>
            <Clock size={16} aria-hidden="true" style={{ flexShrink: 0 }} />{crit.summary}
          </div>
        )}
        <KnRows items={crit.items} />
        {crit.waits && (
          <div style={{ borderTop: "1px solid #F3E7E4", padding: "11px 0 6px" }}>
            <h4 style={{ fontSize: 12, fontWeight: 600, color: "#7A6360", margin: "0 0 6px" }}>ต้องเว้นระยะก่อนบริจาค</h4>
            <dl style={{ margin: 0 }}>
              {crit.waits.map(([what, wait]) => (
                <div key={what} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "5px 0" }}>
                  <dt style={{ fontSize: 14, color: "#3A2C29", lineHeight: 1.5, minWidth: 0 }}>{keepPhrases(what)}</dt>
                  <dd style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#9A3B33", whiteSpace: "nowrap" }}>{wait}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        <div style={{ borderTop: "1px solid #F3E7E4", padding: "10px 0 8px", fontSize: 12, color: "#7A6360", lineHeight: 1.6 }}>
          {type === "whole"
            ? <>เกณฑ์เต็มมี 32 ข้อ ดูครบได้ที่ <a href={TRC_SITE} target="_blank" rel="noopener noreferrer" style={{ color: "#9A3B33", fontWeight: 600, whiteSpace: "nowrap" }}>เว็บศูนย์บริการโลหิตฯ</a></>
            : <>นัดหมายบริจาค โทร. <a href="tel:022639600" style={{ color: "#9A3B33", fontWeight: 600, whiteSpace: "nowrap" }}>0 2263 9600</a> ต่อ 1143, 1144</>}
        </div>
        <div style={{ borderTop: "1px solid #F3E7E4", padding: "8px 0 10px" }}>
          <button type="button" onClick={() => onCheckEligibility(type)} className="btn-ghost"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", minHeight: 44, borderRadius: 12, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
            <CheckCircle2 size={16} aria-hidden="true" /> เช็คคุณสมบัติของฉัน ({DONATION_TYPE_LABELS[type]})
          </button>
        </div>
      </KnSection>

      <KnSection {...sec("before")} icon={BookOpen} title="เตรียมตัวก่อนบริจาค"><KnRows items={KNOWLEDGE_BEFORE} /></KnSection>

      <KnSection {...sec("steps")} icon={List} title="ขั้นตอนที่จุดรับบริจาค">
        <ol style={{ margin: 0, padding: "4px 0", listStyle: "none" }}>
          {KNOWLEDGE_STEPS.map((step, i) => (
            <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0" }}>
              <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 11, background: "#FDF0EE", color: "#9A3B33", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
              <span style={{ fontSize: 14, color: "#3A2C29", lineHeight: 1.6 }}><span style={SR_ONLY}>ขั้นตอนที่ {i + 1}: </span>{step}</span>
            </li>
          ))}
        </ol>
      </KnSection>

      <KnSection {...sec("after")} icon={HeartPulse} title="ดูแลตัวเองหลังบริจาค"><KnRows items={KNOWLEDGE_AFTER} /></KnSection>

      <KnSection {...sec("myths")} icon={Info} title="ความเข้าใจผิดที่พบบ่อย">
        {KNOWLEDGE_MYTHS.map(([myth, fact], i) => (
          <div key={i} style={{ padding: "11px 0", borderBottom: i < KNOWLEDGE_MYTHS.length - 1 ? "1px solid #F3E7E4" : "none" }}>
            <div style={{ fontSize: 12, color: "#7A6360", lineHeight: 1.6 }}><span style={{ fontWeight: 600 }}>เข้าใจผิด:</span> {myth}</div>
            <div style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 14, color: "#3A2C29", lineHeight: 1.6, marginTop: 2 }}>
              <CheckCircle2 size={16} color="#2B7530" aria-hidden="true" style={{ marginTop: 3, flexShrink: 0 }} />
              <span><span style={SR_ONLY}>ความจริง: </span>{fact}</span>
            </div>
          </div>
        ))}
      </KnSection>

      <KnSection {...sec("benefits")} icon={Sparkles} title="ประโยชน์ของการบริจาค"><KnRows items={KNOWLEDGE_BENEFITS} /></KnSection>

      <KnSection {...sec("contact")} icon={MapPin} title="ติดต่อศูนย์บริการโลหิตแห่งชาติ">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "10px 0" }}>
          <a href="tel:1666" className="btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44, padding: "0 14px", borderRadius: 12, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
            <Phone size={16} aria-hidden="true" /> โทร 1666
          </a>
          <a href={TRC_SITE} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44, padding: "0 14px", borderRadius: 12, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
            <ExternalLink size={16} aria-hidden="true" /> เว็บไซต์ / หาจุดรับบริจาค
          </a>
        </div>
      </KnSection>

      <p style={{ fontSize: 11, color: "#7A6360", lineHeight: 1.6, marginTop: 8 }}>
        ข้อมูลทั่วไปเพื่อความรู้เบื้องต้นเท่านั้น ไม่ใช่คำแนะนำทางการแพทย์เฉพาะบุคคล เกณฑ์อาจเปลี่ยนแปลงได้ หากมีข้อสงสัยให้สอบถามเจ้าหน้าที่ ณ จุดบริจาคโดยตรง
      </p>
    </>
  );
}
