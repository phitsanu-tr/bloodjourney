import React, { useRef, useState, useMemo } from "react";
import { useEffectOn } from "../lib/hooks.js";
import { DialogX } from "./ui.jsx";
import { Clock, Calendar } from "lucide-react";
import { parseLocalDate, THAI_MONTHS_FULL, THAI_MONTHS, dateToLocalStr, toBuddhistDate } from "../lib/dates.js";

// Replaces the native <input type="time"> in the record/edit donation forms.
// That native control turned out to be unstyleable in a way that couldn't be
// fixed from CSS alone: Safari on a real iPhone ignores text-align on it and
// keeps an invisible AM/PM sub-field in its internal layout even on a
// 24-hour-region device that never displays one, so the visible digits kept
// drifting off-center no matter which ::-webkit-datetime-edit-* pseudo-
// element trick was tried (confirmed by direct user testing on-device,
// since this sandbox has no real iOS Safari to check against). A first fix
// (two plain <select> elements) solved the centering, but the user then
// asked for a fuller redesign: a tap opens a dialog (centered on screen,
// matching the app's other modals) with a scrolling hour/minute wheel picker
// and an explicit "ยืนยัน" (confirm) step, so nothing is set until the user
// deliberately confirms it. Stores/returns the same "HH:MM" string the rest
// of the app already uses (donation.time / form.time / tf.time), so no
// other code had to change.
export const WHEEL_ITEM_HEIGHT = 40;

export const WHEEL_VISIBLE_ROWS = 3;

export const WHEEL_HEIGHT = WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ROWS;

// One scrolling column (hours, or minutes). Scroll-snap does the physical
// snapping; the onScroll handler just figures out, after scrolling settles,
// which item ended up centered and reports its index upward. initialIndex is
// only consulted on mount -- the column intentionally does not re-scroll
// itself if its index prop changes later, so the parent remounts it (via a
// `key`) whenever the sheet is freshly opened instead of fighting an
// in-progress scroll.
export function TimeWheelColumn({ items, initialIndex, onSettle, ariaLabel }) {
  const scrollRef = useRef(null);
  const settleTimer = useRef(null);
  // centerIndex drives which item is styled bold/dark (vs. the dimmed rest) --
  // updated on every scroll frame, cheap since there are at most 60 items and
  // only one of them ever needs the "active" class at a time. Separate from
  // onSettle below, which only fires once scrolling has actually stopped and
  // is what reports the value upward / snaps the scroll position exactly.
  const [centerIndex, setCenterIndex] = useState(initialIndex);

  useEffectOn(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = initialIndex * WHEEL_ITEM_HEIGHT;
    }
    return () => { if (settleTimer.current) clearTimeout(settleTimer.current); };
  }, []);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (el) {
      const live = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / WHEEL_ITEM_HEIGHT)));
      setCenterIndex(live);
    }
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      if (!el) return;
      const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / WHEEL_ITEM_HEIGHT)));
      el.scrollTop = i * WHEEL_ITEM_HEIGHT; // snap exactly, in case of rubber-band overscroll
      onSettle(i);
    }, 110);
  };

  return (
    <div ref={scrollRef} onScroll={handleScroll} aria-label={ariaLabel} className="no-scrollbar time-wheel-col">
      <div style={{ height: WHEEL_ITEM_HEIGHT }} aria-hidden="true" />
      {items.map((label, i) => (
        <div key={label} className={i === centerIndex ? "time-wheel-item time-wheel-item-active" : "time-wheel-item"}>{label}</div>
      ))}
      <div style={{ height: WHEEL_ITEM_HEIGHT }} aria-hidden="true" />
    </div>
  );
}

// The picker dialog itself: two wheels + confirm/cancel/clear. Nothing here
// touches the parent's value until "ยืนยัน" is pressed (or "ล้างเวลา" for an
// explicit clear) -- scrolling the wheels only updates this component's own
// state, so backing out via "ยกเลิก" or tapping the backdrop leaves the
// donation form's saved time completely untouched.
export function TimeBottomSheet({ value, onConfirm, onClose, ariaLabelPrefix }) {
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")), []);
  // The very first time this field is opened for a record (no time saved
  // yet), default the wheels to the current time instead of 00:00 -- once a
  // real value exists, that's what the wheels start at, same as before.
  const [vh, vm] = value
    ? value.split(":")
    : [String(new Date().getHours()).padStart(2, "0"), String(new Date().getMinutes()).padStart(2, "0")];
  const initialHIndex = Math.max(0, hours.indexOf(vh));
  const initialMIndex = Math.max(0, minutes.indexOf(vm));
  const [selH, setSelH] = useState(initialHIndex);
  const [selM, setSelM] = useState(initialMIndex);
  // Separate from selH/selM: this is what the wheels actually mount at (via
  // the key below), so "ตอนนี้" can re-scroll them to the current time
  // without touching the parent's saved value -- that still only happens
  // when "ยืนยัน" is pressed.
  const [wheelH, setWheelH] = useState(initialHIndex);
  const [wheelM, setWheelM] = useState(initialMIndex);
  // Bumped on every "ตอนนี้" tap and folded into the wheels' key below. Just
  // setWheelH/setWheelM isn't enough on its own: if the wheels were opened
  // (or last snapped to "now") within the same minute the user later taps
  // "ตอนนี้" again, the freshly computed hi/mi come out identical to the
  // current wheelH/wheelM, React sees no state change, the key stays the
  // same, and the wheel never remounts -- so a wheel the user had manually
  // scrolled elsewhere just stays put instead of snapping back to now
  // (reported directly by the user). This nonce guarantees the key changes
  // on every tap regardless of whether the index itself changed.
  const [nowNonce, setNowNonce] = useState(0);

  const fillNow = () => {
    const now = new Date();
    const hi = Math.max(0, hours.indexOf(String(now.getHours()).padStart(2, "0")));
    const mi = Math.max(0, minutes.indexOf(String(now.getMinutes()).padStart(2, "0")));
    setWheelH(hi);
    setWheelM(mi);
    setSelH(hi);
    setSelM(mi);
    setNowNonce((n) => n + 1);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={`ระบุ${ariaLabelPrefix}`}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: "100%", maxWidth: 340, background: "#FFFFFF", borderRadius: 18, padding: 20, boxShadow: "0 12px 30px rgba(122,42,35,0.22)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#3A2C29" }}>ระบุ{ariaLabelPrefix}</div>
          <DialogX onClick={onClose} />
        </div>
        {/* No ชั่วโมง/นาที column labels above the wheel: tried tightening the
            gap with a negative margin + clip, but real momentum scrolling
            can still overshoot past the clipped sliver and re-expose a
            digit peeking into the label text. Simpler and more reliable to
            leave the labels out; the hour:minute layout with the colon
            between the two columns already reads clearly on its own. */}
        {/* width: "fit-content" + margin auto -- without it this div (a
            block-level flex container) stretches to the full width of the
            dialog card, and the highlight overlay below (left:0/right:0,
            positioned relative to THIS div) stretched with it: the two
            horizontal lines ran edge-to-edge of the card, well past the
            actual hour:minute digits (reported directly by the user from a
            screenshot). Shrinking this wrapper to just its content width
            makes the overlay hug the two wheel columns instead. */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "fit-content", margin: "0 auto" }}>
          <TimeWheelColumn key={`h-${wheelH}-${nowNonce}`} items={hours} initialIndex={wheelH}
            ariaLabel={`${ariaLabelPrefix} ชั่วโมง`} onSettle={setSelH} />
          <span style={{ fontSize: 18, fontWeight: 700, color: "#3A2C29", fontFamily: "'Mitr', 'Inter', sans-serif" }}>:</span>
          <TimeWheelColumn key={`m-${wheelM}-${nowNonce}`} items={minutes} initialIndex={wheelM}
            ariaLabel={`${ariaLabelPrefix} นาที`} onSettle={setSelM} />
          <div style={{ position: "absolute", top: WHEEL_ITEM_HEIGHT, left: 0, right: 0, height: WHEEL_ITEM_HEIGHT, borderTop: "1px solid #E3C8C3", borderBottom: "1px solid #E3C8C3", pointerEvents: "none" }} aria-hidden="true" />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 8 }}>
          {value && (
            <button type="button" onClick={() => onConfirm("")}
              style={{ padding: "0 14px", height: 26, borderRadius: 999, border: "1px solid #E3C8C3", background: "none", color: "#7A6360", fontSize: 11, fontWeight: 600, fontFamily: "'Mitr', 'Inter', sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}>
              ไม่ระบุเวลา
            </button>
          )}
          <button type="button" onClick={fillNow}
            style={{ padding: "0 14px", height: 26, borderRadius: 999, border: "1px solid #9A3B33", background: "none", color: "#9A3B33", fontSize: 11, fontWeight: 600, fontFamily: "'Mitr', 'Inter', sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}>
            ตอนนี้
          </button>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button type="button" onClick={onClose}
            style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "1px solid #E3C8C3", background: "#FFFFFF", color: "#5C4A46", fontSize: 14, fontWeight: 600, fontFamily: "'Mitr', 'Inter', sans-serif", cursor: "pointer" }}>
            ยกเลิก
          </button>
          <button type="button" onClick={() => onConfirm(`${hours[selH]}:${minutes[selM]}`)}
            style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: "#9A3B33", color: "#FFF7F5", fontSize: 14, fontWeight: 600, fontFamily: "'Mitr', 'Inter', sans-serif", cursor: "pointer" }}>
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  );
}

// The field as it sits in the form: a button showing the current value (or a
// placeholder), which opens the TimeBottomSheet above on tap. `sheetKey`
// forces a fresh TimeBottomSheet (and fresh wheel scroll positions) every
// time it's reopened, rather than reusing one left over from a previous open.
export function TimeHourMinuteSelect({ value, onChange, ariaLabelPrefix, height = 44, fontSize = 14 }) {
  const [open, setOpen] = useState(false);
  const [sheetKey, setSheetKey] = useState(0);
  return (
    <>
      <button type="button" onClick={() => { setSheetKey((k) => k + 1); setOpen(true); }}
        aria-label={`${ariaLabelPrefix}${value ? `: ${value}` : ": ยังไม่ระบุ"}`}
        style={{ width: "100%", height, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "'Mitr', 'Inter', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize, fontWeight: value ? 600 : 400, color: value ? "#3A2C29" : "#80726F", textAlign: "center" }}>
        {!value && <Clock size={14} color="#9A8582" />}
        {value ? `${value} น.` : "ระบุเวลา"}
      </button>
      {open && (
        <TimeBottomSheet key={sheetKey} value={value} ariaLabelPrefix={ariaLabelPrefix}
          onConfirm={(next) => { onChange(next); setOpen(false); }}
          onClose={() => setOpen(false)} />
      )}
    </>
  );
}

export const THAI_WEEKDAYS_SHORT = ["จ.","อ.","พ.","พฤ.","ศ.","ส.","อา."]; // Monday-first, matching Thai calendar convention

// How far back the year list in the header dropdown reaches. A donor's
// history can plausibly go back decades (first donation as a young adult,
// logged years later), and the month-by-month </> nav alone would take
// dozens of taps to get there -- this lets a 10-20-year-old date be reached
// in two taps (open year list, tap the year) instead.
export const DATE_PICKER_YEARS_BACK = 100;

export function DateCalendarDialog({ value, maxDate, onConfirm, onClose, ariaLabelPrefix }) {
  const selected = value ? parseLocalDate(value) : null;
  const initial = selected || (maxDate ? parseLocalDate(maxDate) : new Date());
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  // Year selection is two levels deep: pick a decade first, then a year
  // within it, so jumping back 10-20 years is a couple of taps through
  // short lists rather than one long scroll through ~100 individual years.
  const [yearMode, setYearMode] = useState("calendar"); // "calendar" | "decade" | "year"
  const [selectedDecadeStart, setSelectedDecadeStart] = useState(null);
  const pickingYear = yearMode !== "calendar";
  // Swipe left/right on the calendar grid to move a month, same as the
  // </> buttons. The grid visually tracks the finger in real time (via a
  // ref + direct style writes, not state -- a drag can fire touchmove dozens
  // of times a second, far more often than we want a React re-render), and
  // only turns into an actual month change once the finger lifts.
  const gridRef = useRef(null);
  const dragRef = useRef({ startX: 0, startY: 0, dragging: false, horizontal: false });
  // Direction of the most recent month change (1 = moved forward, -1 = moved
  // back), purely to pick which slide-in animation class to play next render.
  const [slideDir, setSlideDir] = useState(0);
  // Tapping a day only stages it here (highlighted, like the time picker's
  // wheels) -- nothing reaches the parent until "ยืนยัน" is pressed, so
  // backing out via "ยกเลิก" or the backdrop leaves the saved date untouched.
  // Defaults to `initial` (the saved date if there is one, otherwise
  // today/maxDate) so a field with nothing saved yet still opens with
  // today already staged, ready to confirm in one tap -- same idea as the
  // time picker defaulting its wheels to the current time.
  const [pendingDate, setPendingDate] = useState(initial);

  const max = maxDate ? parseLocalDate(maxDate) : null;
  const today = new Date();

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // JS: 0=Sun..6=Sat -> 0=Mon..6=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  // Always pad out to exactly 6 rows (42 cells): a month can need 4, 5, or 6
  // calendar rows depending on where it starts, and without this the whole
  // dialog visibly grows/shrinks a row's height when navigating between
  // months. Rather than leaving that padding as a dead blank row, it's
  // filled with the next month's leading days (muted, non-interactive) --
  // the common "overflow days" pattern most calendar UIs use.
  const cells = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, overflow: false })),
  ];
  let nextDay = 1;
  while (cells.length < 42) cells.push({ day: nextDay++, overflow: true });

  const isFuture = (d) => !!max && new Date(viewYear, viewMonth, d) > max;
  const isSelected = (d) => !!pendingDate && viewYear === pendingDate.getFullYear() && viewMonth === pendingDate.getMonth() && d === pendingDate.getDate();
  const isToday = (d) => viewYear === today.getFullYear() && viewMonth === today.getMonth() && d === today.getDate();
  const canGoNext = !max || viewYear < max.getFullYear() || (viewYear === max.getFullYear() && viewMonth < max.getMonth());
  // "ยืนยัน" should only ever commit a date the user can actually see
  // highlighted on screen right now -- not a value staged earlier (by the
  // initial auto-stage-today, or an explicit tap) that's since scrolled out
  // of view because the user browsed to a different month/year/decade
  // picker. Without this, browsing away from the staged month left the
  // button enabled and ready to silently confirm a date nothing on screen
  // pointed at (reported directly by the user, who found it confusing).
  const pendingVisible = yearMode === "calendar" && !!pendingDate && viewYear === pendingDate.getFullYear() && viewMonth === pendingDate.getMonth();

  const goPrev = () => { setSlideDir(-1); if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); } else setViewMonth((m) => m - 1); };
  const goNext = () => { if (!canGoNext) return; setSlideDir(1); if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); } else setViewMonth((m) => m + 1); };
  const pick = (d) => { if (!isFuture(d)) setPendingDate(new Date(viewYear, viewMonth, d)); };

  const DRAG_MAX = 90; // px the grid will visually follow the finger before resisting further
  const SWIPE_COMMIT_PX = 16; // same threshold the old tap-only swipe used

  const handleGridTouchStart = (e) => {
    const t = e.touches[0];
    dragRef.current = { startX: t.clientX, startY: t.clientY, dragging: true, horizontal: false };
  };
  const handleGridTouchMove = (e) => {
    const state = dragRef.current;
    if (!state.dragging) return;
    const t = e.touches[0];
    const dx = t.clientX - state.startX;
    const dy = t.clientY - state.startY;
    if (!state.horizontal) {
      // Decide once, past a small deadzone, whether this is a deliberate
      // horizontal swipe or a vertical scroll/stray tap -- don't drag the
      // grid sideways in response to what's actually a vertical gesture.
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      state.horizontal = Math.abs(dx) > Math.abs(dy) * 1.5;
      if (!state.horizontal) { state.dragging = false; return; }
    }
    // Rubber-band resistance when dragging toward a month that's out of
    // range (past maxDate), so the finger still gets some feedback instead
    // of the grid feeling stuck in place.
    let px = dx;
    if (dx < 0 && !canGoNext) px = dx / 3;
    px = Math.max(-DRAG_MAX, Math.min(DRAG_MAX, px));
    if (gridRef.current) {
      gridRef.current.style.transition = "none";
      gridRef.current.style.transform = `translateX(${px}px)`;
    }
  };
  const handleGridTouchEnd = (e) => {
    const state = dragRef.current;
    state.dragging = false;
    if (!state.horizontal) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - state.startX;
    const el = gridRef.current;
    const commit = Math.abs(dx) > SWIPE_COMMIT_PX && ((dx < 0 && canGoNext) || dx > 0);
    if (!el) {
      if (commit) { if (dx < 0) goNext(); else goPrev(); }
      return;
    }
    el.style.transition = "transform 0.16s ease-in";
    if (commit) {
      // Flick the current grid the rest of the way off-screen in the same
      // direction the finger was already moving it, then swap the month --
      // the incoming grid's own slide-in animation picks up from there.
      el.style.transform = `translateX(${dx < 0 ? -140 : 140}px)`;
      window.setTimeout(() => { if (dx < 0) goNext(); else goPrev(); }, 150);
    } else {
      // Not a deliberate enough swipe -- spring the grid back to rest
      // instead of changing the month.
      el.style.transform = "translateX(0px)";
    }
  };

  const maxYear = max ? max.getFullYear() : today.getFullYear();
  const years = useMemo(() => Array.from({ length: DATE_PICKER_YEARS_BACK + 1 }, (_, i) => maxYear - i), [maxYear]);
  // Decade groups are computed on the Buddhist-Era year (what's actually
  // displayed), not the raw Gregorian one -- otherwise a Gregorian-aligned
  // decade like 2020-2029 shows up as the odd-looking "2563-2572" instead
  // of the round "2560-2569" a Thai user expects. selectedDecadeStart is
  // therefore stored as a BE year throughout.
  const decades = useMemo(() => {
    const starts = new Set(years.map((y) => Math.floor((y + 543) / 10) * 10));
    return Array.from(starts).sort((a, b) => b - a);
  }, [years]);
  const pickYear = (y) => {
    setViewYear(y);
    // If jumping to the max year would leave viewMonth past max's own month
    // (e.g. currently viewing December but max is only up to June this
    // year), pull the month back in-bounds too -- same clamp goNext already
    // enforces one month at a time, just applied in one jump here.
    if (max && y === max.getFullYear() && viewMonth > max.getMonth()) setViewMonth(max.getMonth());
    // Back to the month grid (for the newly picked year), not straight to
    // the calendar -- picking a year is almost always in service of then
    // picking a month too.
    setYearMode("month");
  };
  const isMonthFuture = (m) => !!max && viewYear === max.getFullYear() && m > max.getMonth();
  const pickMonth = (m) => { if (!isMonthFuture(m)) { setViewMonth(m); setYearMode("calendar"); } };
  // Tapping the header now opens the month grid directly, for the year
  // already being viewed -- jumping to a different month within the same
  // year is by far the more common case, so it shouldn't require detouring
  // through a decade/year picker first. Jumping further back in time is
  // still there, just one (or two) levels deeper: see openYearListPicker.
  const openYearPicker = () => {
    setYearMode(yearMode === "calendar" ? "month" : "calendar");
  };
  // Reached by tapping the year number shown inside the month grid. Same
  // idea as the month-first change above: jumps straight to the list of
  // years in the CURRENT decade (2560-2569 for example), since picking a
  // year close to the one already showing is the common case -- jumping to
  // a different decade entirely is one tap further still, via "เลือกช่วงปีอื่น"
  // inside that year list.
  const openYearListPicker = () => {
    setSelectedDecadeStart(Math.floor((viewYear + 543) / 10) * 10);
    setYearMode("year");
  };
  const pickDecade = (start) => { setSelectedDecadeStart(start); setYearMode("year"); };
  const backToDecades = () => setYearMode("decade");
  const backToYear = () => setYearMode("year");

  const todayPillStyle = { padding: 0, height: 26, borderRadius: 999, border: "1px solid #9A3B33", background: "none", color: "#9A3B33", fontSize: 11, fontWeight: 600, fontFamily: "'Mitr', 'Inter', sans-serif", cursor: "pointer", whiteSpace: "nowrap" };
  const todayBtn = (extra) => (<button type="button" onClick={fillToday} style={{ ...todayPillStyle, ...extra }}>วันนี้</button>);
  const fillToday = () => {
    // Respects the max-date constraint (normally "today" itself, but a
    // caller could in principle pass an earlier max) rather than always
    // jumping to the real calendar today regardless of that limit. Only
    // navigates to and stages today's date (highlighted, like tapping a
    // day) -- nothing is saved until "ยืนยัน" is pressed, same as the time
    // picker's "ตอนนี้".
    const target = max && today > max ? max : today;
    setViewYear(target.getFullYear());
    setViewMonth(target.getMonth());
    setYearMode("calendar");
    setPendingDate(target);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={`ระบุ${ariaLabelPrefix}`}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(36,26,24,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: "100%", maxWidth: 340, background: "#FFFFFF", borderRadius: 18, padding: 20, boxShadow: "0 12px 30px rgba(122,42,35,0.22)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#3A2C29" }}>ระบุ{ariaLabelPrefix}</div>
          <DialogX onClick={onClose} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <button type="button" onClick={goPrev} aria-label="เดือนก่อนหน้า" disabled={pickingYear}
            style={{ position: "relative", width: 32, height: 32, borderRadius: 8, border: "1px solid #E3C8C3", background: "#FFFFFF", color: pickingYear ? "#D9C7C3" : "#9A3B33", fontSize: 16, lineHeight: 1, cursor: pickingYear ? "default" : "pointer" }}>
            <span aria-hidden="true" style={{ position: "absolute", inset: -8 }} />‹
          </button>
          <button type="button" onClick={openYearPicker} aria-expanded={pickingYear}
            style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", fontSize: 14, fontWeight: 600, color: "#3A2C29", fontFamily: "'Mitr', 'Inter', sans-serif", cursor: "pointer", padding: "4px 8px", position: "relative" }}>
            <span aria-hidden="true" style={{ position: "absolute", inset: "-8px 0" }} />
            {yearMode === "calendar"
              ? `${THAI_MONTHS_FULL[viewMonth]} ${viewYear + 543}`
              : yearMode === "decade"
              ? "เลือกช่วงปี"
              : yearMode === "year"
              ? `${selectedDecadeStart}-${Math.min(selectedDecadeStart + 9, maxYear + 543)}`
              : "เลือกเดือน"}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: pickingYear ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <button type="button" onClick={goNext} aria-label="เดือนถัดไป" disabled={!canGoNext || pickingYear}
            style={{ position: "relative", width: 32, height: 32, borderRadius: 8, border: "1px solid #E3C8C3", background: "#FFFFFF", color: (canGoNext && !pickingYear) ? "#9A3B33" : "#D9C7C3", fontSize: 16, lineHeight: 1, cursor: (canGoNext && !pickingYear) ? "pointer" : "default" }}>
            <span aria-hidden="true" style={{ position: "absolute", inset: -8 }} />›
          </button>
        </div>
        {yearMode === "decade" ? (
          <>
            {/* The decade list is now reached FROM the year list (via its
                own "ย้อนกลับ", one level below), so backing out of it
                returns to that year list, not the month grid. */}
            <button type="button" onClick={backToYear}
              style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#9A3B33", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "2px 0", marginBottom: 8, fontFamily: "'Mitr', 'Inter', sans-serif" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              ย้อนกลับ
            </button>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, maxHeight: 232, overflowY: "auto" }} className="no-scrollbar">
            {decades.map((start) => {
              const isCurrentDecade = Math.floor((viewYear + 543) / 10) * 10 === start;
              return (
                <button key={start} type="button" onClick={() => pickDecade(start)}
                  style={{
                    padding: "12px 0", borderRadius: 10, border: "none",
                    background: isCurrentDecade ? "#9A3B33" : "#FBEAE7",
                    color: isCurrentDecade ? "#FFF7F5" : "#3A2C29",
                    fontWeight: isCurrentDecade ? 700 : 500,
                    fontSize: 14, cursor: "pointer", fontFamily: "'Mitr', 'Inter', sans-serif",
                  }}>
                  {start}-{Math.min(start + 9, maxYear + 543)}
                </button>
              );
            })}
          </div>
          {/* Outside the scrolling list so it is always visible, not buried at the end of it. */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>{todayBtn({ padding: "0 14px" })}</div>
          </>
        ) : yearMode === "year" ? (
          <>
            {/* This isn't really "back" -- it's a jump one level up to the
                full decade list, so it gets its own wording rather than
                reusing the "ย้อนกลับ" of the decade view (which really is a
                back-navigation, to the year list it came from). */}
            <button type="button" onClick={backToDecades}
              style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#9A3B33", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "2px 0", marginBottom: 8, fontFamily: "'Mitr', 'Inter', sans-serif" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              เลือกช่วงปีอื่น
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, maxHeight: 200, overflowY: "auto" }} className="no-scrollbar">
              {years.filter((y) => Math.floor((y + 543) / 10) * 10 === selectedDecadeStart).map((y) => (
                <button key={y} type="button" onClick={() => pickYear(y)}
                  style={{
                    padding: "9px 0", borderRadius: 8, border: "none",
                    background: y === viewYear ? "#9A3B33" : "transparent",
                    color: y === viewYear ? "#FFF7F5" : "#3A2C29",
                    fontWeight: y === viewYear ? 700 : 400,
                    fontSize: 12, cursor: "pointer", fontFamily: "'Mitr', 'Inter', sans-serif",
                  }}>
                  {y + 543}
                </button>
              ))}
              {(() => { const n = years.filter((y) => Math.floor((y + 543) / 10) * 10 === selectedDecadeStart).length; const blanks = (4 - ((n + 1) % 4)) % 4;
                return (<>{Array.from({ length: blanks }, (_, b) => <div key={`yb${b}`} aria-hidden="true" />)}<div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>{todayBtn({ width: "100%" })}</div></>); })()}
            </div>
          </>
        ) : yearMode === "month" ? (
          <>
            {/* The year is a separate, deliberately tappable control here --
                jumping between months within this same year is the common
                case (just tap a month below), while changing the year at
                all is the deeper, less common action this button leads to. */}
            <button type="button" onClick={openYearListPicker}
              style={{ display: "flex", alignItems: "center", gap: 4, background: "#FBEAE7", border: "none", borderRadius: 999, color: "#9A3B33", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "5px 12px", marginBottom: 10, fontFamily: "'Mitr', 'Inter', sans-serif" }}>
              ปี {viewYear + 543}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              {THAI_MONTHS_FULL.map((label, m) => {
                const future = isMonthFuture(m);
                const isCurrentMonth = m === viewMonth;
                return (
                  <button key={label} type="button" onClick={() => pickMonth(m)} disabled={future}
                    style={{
                      padding: "10px 0", borderRadius: 8, border: "none",
                      background: isCurrentMonth ? "#9A3B33" : "transparent",
                      color: future ? "#D9C7C3" : isCurrentMonth ? "#FFF7F5" : "#3A2C29",
                      fontWeight: isCurrentMonth ? 700 : 400,
                      fontSize: 12, cursor: future ? "default" : "pointer", fontFamily: "'Mitr', 'Inter', sans-serif",
                    }}>
                    {THAI_MONTHS[m]}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>{todayBtn({ padding: "0 14px" })}</div>
          </>
        ) : (
          // The weekday header (จ. อ. พ. ...) never changes between months,
          // so it stays put -- only the day-number grid underneath slides or
          // drags. Touch handlers sit on this outer wrapper (not the grid
          // itself) so a swipe started anywhere in the calendar area, header
          // row included, still moves the month.
          <div style={{ touchAction: "pan-y" }} onTouchStart={handleGridTouchStart} onTouchMove={handleGridTouchMove} onTouchEnd={handleGridTouchEnd}>
            {/* Weekend (ส./อา.) is called out in maroon, both in this header
                and in the day numbers below, and the whole header row sits
                on a light rounded card so it reads as a distinct "table
                head" instead of blending into the day grid underneath. */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 0, background: "#FBF6F5", borderRadius: 10, padding: "6px 0", marginBottom: 8 }}>
              {THAI_WEEKDAYS_SHORT.map((w, i) => {
                const isWeekend = i === 5 || i === 6;
                return (
                  <div key={w} style={{ textAlign: "center", fontSize: 12, color: isWeekend ? "#9A3B33" : "#7A6360", fontWeight: isWeekend ? 700 : 600, padding: "4px 0", fontFamily: "'Mitr', 'Inter', sans-serif" }}>{w}</div>
                );
              })}
            </div>
            {/* overflow: hidden here clips the sliding/dragging grid to the
                card's own width -- without it, a drag or the flick-out/
                slide-in animation visibly pokes the day numbers out past
                the dialog's rounded edges into the dimmed backdrop. */}
            <div style={{ overflow: "hidden" }}>
            <div
              key={`${viewYear}-${viewMonth}`}
              ref={gridRef}
              className={slideDir === 1 ? "calendar-slide-next" : slideDir === -1 ? "calendar-slide-prev" : undefined}
              style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 0 }}
            >
              {cells.map((cell, i) => {
                // Every cell is a 44px-tall row slot with no gap between them (v1.0.420: the tap area is the whole
                // slot, the visible circle inside is 38px). A leading blank needs the same height as a real day
                // button, otherwise a row made entirely of blanks collapses to near zero instead of matching the others.
                const cellBox = { height: 44 };
                if (cell === null) return <div key={`e${i}`} style={cellBox} aria-hidden="true" />;
                const { day: d, overflow } = cell;
                // Trailing padding is filled with the next month's leading
                // days instead, muted and non-interactive -- purely to keep
                // the grid visually filled, not a real navigation shortcut.
                if (overflow && i === cells.length - 1) {
                  return <div key="today-cell" style={{ ...cellBox, display: "flex", alignItems: "center", justifyContent: "center" }}>{todayBtn({ width: "100%" })}</div>;
                }
                if (overflow) {
                  return (
                    <div key={`n${i}`} aria-hidden="true"
                      style={{ ...cellBox, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#EADEDB", fontFamily: "'Mitr', 'Inter', sans-serif" }}>
                      {d}
                    </div>
                  );
                }
                const isWeekend = i % 7 === 5 || i % 7 === 6;
                return (
                  <button key={d} type="button" onClick={() => pick(d)} disabled={isFuture(d)}
                    style={{
                      height: 44, border: "none", padding: 0, background: "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: isFuture(d) ? "#D9C7C3" : isSelected(d) ? "#FFF7F5" : isToday(d) ? "#9A3B33" : isWeekend ? "#9A3B33" : "#3A2C29",
                      fontWeight: isSelected(d) || isToday(d) ? 700 : 400,
                      fontSize: 14, cursor: isFuture(d) ? "default" : "pointer",
                      fontFamily: "'Mitr', 'Inter', sans-serif",
                    }}>
                    <span style={{ width: "min(38px, 100%)", aspectRatio: "1", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: isSelected(d) ? "#9A3B33" : "transparent" }}>{d}</span>
                  </button>
                );
              })}
            </div>
          </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="button" onClick={onClose}
            style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "1px solid #E3C8C3", background: "#FFFFFF", color: "#5C4A46", fontSize: 14, fontWeight: 600, fontFamily: "'Mitr', 'Inter', sans-serif", cursor: "pointer" }}>
            ยกเลิก
          </button>
          <button type="button" disabled={!pendingVisible} onClick={() => onConfirm(dateToLocalStr(pendingDate))}
            style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: pendingVisible ? "#9A3B33" : "#E3C8C3", color: "#FFF7F5", fontSize: 14, fontWeight: 600, fontFamily: "'Mitr', 'Inter', sans-serif", cursor: pendingVisible ? "pointer" : "default" }}>
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  );
}

export const DateField = React.forwardRef(function DateField({ value, onChange, maxDate, ariaLabelPrefix, height = 44, fontSize = 14 }, ref) {
  const [open, setOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  return (
    <>
      <button ref={ref} type="button" onClick={() => { setDialogKey((k) => k + 1); setOpen(true); }}
        aria-label={`${ariaLabelPrefix}${value ? `: ${toBuddhistDate(value)}` : ""}`}
        style={{ width: "100%", height, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "'Mitr', 'Inter', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize, fontWeight: value ? 600 : 400, color: value ? "#3A2C29" : "#80726F", textAlign: "center" }}>
        {!value && <Calendar size={14} color="#9A8582" />}
        {value ? toBuddhistDate(value) : "ระบุวันที่"}
      </button>
      {open && (
        <DateCalendarDialog key={dialogKey} value={value} maxDate={maxDate} ariaLabelPrefix={ariaLabelPrefix}
          onConfirm={(next) => { onChange(next); setOpen(false); }}
          onClose={() => setOpen(false)} />
      )}
    </>
  );
});
