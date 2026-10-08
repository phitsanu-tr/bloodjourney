// Donor type affects only the wording of the tier-3/2/1 awards — medals for
// general donors, ceremonial fans (พัดกาชาด) for Buddhist monks — per the
// Thai Red Cross National Blood Centre's official criteria:
// หลักเกณฑ์การมอบเข็มที่ระลึกและเหรียญกาชาดสมนาคุณ
// https://thaibloodcentre.redcross.or.th/credit-milestones-for-donor/
export const DONOR_TYPES = [
  { key: "general", label: "บุคคลทั่วไป" },
  { key: "monk", label: "พระภิกษุสงฆ์" },
];

export const DEFAULT_DONOR_TYPE = "general";

export const PIN_MILESTONES = [1, 7, 16, 24, 36, 48, 60, 72, 84, 96, 108];

export const MEDAL_TIERS = [
  { threshold: 50, tier: 3 },
  { threshold: 75, tier: 2 },
  { threshold: 100, tier: 1 },
];

// Builds the full milestone list (เข็มที่ระลึก + เหรียญ/พัดกาชาด) for the
// given donor type, sorted ascending by donation count. Visuals for each are
// rendered separately by <AchievementIcon> (DOM) and drawAchievementBadge()
// (canvas share card) based on `kind`/`tier`, styled after the real Thai Red
// Cross pin/medal/fan designs.
export function buildAchievements(donorType) {
  const isMonk = donorType === "monk";
  const pins = PIN_MILESTONES.map((n) => ({
    id: `pin-${n}`,
    threshold: n,
    kind: "pin",
    title: n === 1 ? "หยดแรก" : `เข็มที่ระลึก ครั้งที่ ${n}`,
    desc: n === 1 ? "บริจาคโลหิตครั้งแรกของคุณ" : `บริจาคโลหิตครบ ${n} ครั้ง`,
  }));
  const medals = MEDAL_TIERS.map(({ threshold, tier }) => ({
    id: `medal-${tier}`,
    threshold,
    kind: "medal",
    tier,
    title: isMonk ? `พัดกาชาด ชั้นที่ ${tier}` : `เหรียญกาชาดสมนาคุณ ชั้นที่ ${tier}`,
    desc: `บริจาคโลหิตครบ ${threshold} ครั้ง`,
  }));
  return [...pins, ...medals].sort((a, b) => a.threshold - b.threshold);
}

// Regenerates an achievement's title/desc from its {kind, tier, isMonk,
// threshold} — the exact same formula buildAchievements() uses above. Lets
// the external-browser download page reconstruct the Thai title/desc text
// itself instead of carrying it as plaintext in the URL (see
// openShareCardInExternalBrowser).
export function deriveAchievementText({ kind, tier, isMonk, threshold }) {
  const n = Number(threshold) || 0;
  if (kind === "medal") {
    return {
      title: isMonk ? `พัดกาชาด ชั้นที่ ${tier}` : `เหรียญกาชาดสมนาคุณ ชั้นที่ ${tier}`,
      desc: `บริจาคโลหิตครบ ${n} ครั้ง`,
    };
  }
  return {
    title: n === 1 ? "หยดแรก" : `เข็มที่ระลึก ครั้งที่ ${n}`,
    desc: n === 1 ? "บริจาคโลหิตครั้งแรกของคุณ" : `บริจาคโลหิตครบ ${n} ครั้ง`,
  };
}
