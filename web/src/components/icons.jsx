import { Droplets, Droplet, CheckCircle2, AlertTriangle, Info } from "lucide-react";

// Custom badge icons styled after the real Thai Red Cross designs: a
// heart-shaped enamel pin with a gold cross-topped crown for เข็มที่ระลึก, a
// ribboned circular medallion (gold/silver/bronze by tier) for เหรียญกาชาด
// สมนาคุณ, and a ceremonial hand fan on a stand for พัดกาชาด (monks). Drawn
// as inline SVG rather than referencing any real photo/artwork directly.
export function PinIcon({ size = 22 }) {
  return (
    <svg width={size} height={Math.round(size * 1.15)} viewBox="0 0 32 37" fill="none" aria-hidden="true">
      <path d="M16 2 L19 8 L26 8 L20 12 L22 18 L16 14 L10 18 L12 12 L6 8 L13 8 Z" fill="#E8C349" stroke="#A9821E" strokeWidth="0.6" />
      <rect x="14.3" y="3.5" width="3.4" height="6.5" fill="#B3261E" />
      <path d="M16 14 C16 14 6 20.5 6 27 C6 31.7 10.7 35 16 35 C21.3 35 26 31.7 26 27 C26 20.5 16 14 16 14 Z" fill="#B3261E" stroke="#A9821E" strokeWidth="1" />
      <ellipse cx="16" cy="24.5" rx="7" ry="8" fill="#FFF7F0" />
      <path d="M16 19.5 C16 19.5 12 24.5 12 27 C12 28.9 13.8 30.5 16 30.5 C18.2 30.5 20 28.9 20 27 C20 24.5 16 19.5 16 19.5 Z" fill="#B3261E" />
    </svg>
  );
}

export function MedalIcon({ tier = 1, size = 24 }) {
  const RING_COLORS = { 1: "#D4AF37", 2: "#B7BCC4", 3: "#B08D57" };
  const ring = RING_COLORS[tier] || RING_COLORS[1];
  return (
    <svg width={size} height={Math.round(size * 1.2)} viewBox="0 0 28 34" fill="none" aria-hidden="true">
      <rect x="10" y="0" width="8" height="13" fill="#F5F1EA" stroke="#D8C9A8" strokeWidth="0.5" />
      <circle cx="14" cy="23" r="9.5" fill={ring} stroke="#7a6320" strokeWidth="0.8" />
      <circle cx="14" cy="23" r="6.6" fill="#FFF7F0" />
      <path d="M11 23 h2.2v-2.2h1.6v2.2h2.2v1.6h-2.2v2.2h-1.6v-2.2h-2.2z" fill="#B3261E" />
    </svg>
  );
}

// One icon per donation type: lucide droplet (whole) / droplets (plasma) plus two
// small custom marks for platelets (scattered dots) and red cells (biconcave disc).
export function TypeIcon({ type, size = 12, color, style }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color || "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", style: { flexShrink: 0, ...style }, "aria-hidden": "true" };
  if (type === "platelet") return (<svg {...common}><circle cx="8" cy="9" r="2.6" /><circle cx="16" cy="8" r="1.8" /><circle cx="14" cy="16" r="3" /><circle cx="6.5" cy="16.5" r="1.4" /></svg>);
  if (type === "rbc") return (<svg {...common}><circle cx="12" cy="12" r="8.5" /><ellipse cx="12" cy="12" rx="3.6" ry="2.2" /></svg>);
  if (type === "plasma") return <Droplets size={size} color={color} style={style} />;
  return <Droplet size={size} color={color} style={style} />;
}

export function FanIcon({ size = 24 }) {
  return (
    <svg width={size} height={Math.round(size * 1.4)} viewBox="0 0 24 34" fill="none" aria-hidden="true">
      <ellipse cx="12" cy="9" rx="9" ry="8" fill="#F5F1EA" stroke="#C9A227" strokeWidth="1" />
      <path d="M8.6 9 h2.4v-2.4h1.6v2.4h2.4v1.6h-2.4v2.4h-1.6v-2.4h-2.4z" fill="#B3261E" />
      <rect x="11" y="17" width="2" height="11" fill="#7a5230" />
      <rect x="6" y="28" width="12" height="3" rx="1" fill="#8a5a35" />
    </svg>
  );
}

export function AchievementIcon({ achievement, isMonk, size = 22 }) {
  if (achievement.kind === "pin") return <PinIcon size={size} />;
  if (isMonk) return <FanIcon size={size} />;
  return <MedalIcon tier={achievement.tier} size={size} />;
}

// One row of the auto-checked criteria list on the "เช็คคุณสมบัติก่อนบริจาค"
// page — pass (green check) / fail (red x) / unknown (gray, missing profile
// data) share the same layout, so this is just the status → color/icon map.
export function EligibilityCheckRow({ label, status, detail }) {
  const cfg = status === "pass"
    ? { Icon: CheckCircle2, color: "#3A7D5C" }
    : status === "fail"
      ? { Icon: AlertTriangle, color: "#B3261E" }
      : { Icon: Info, color: "#7A6360" };
  const { Icon, color } = cfg;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 0" }}>
      <Icon size={17} color={color} style={{ marginTop: 1, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#3A2C29", marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 12, color: "#7A6360", lineHeight: 1.5 }}>{detail}</div>
      </div>
    </div>
  );
}
