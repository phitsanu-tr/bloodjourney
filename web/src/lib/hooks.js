import { useEffect, useRef } from "react";

// Escape closes an open ⋮ menu and puts focus back on its button.
export function useMenuEscape(isOpen, close, buttonRef) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); buttonRef.current?.focus(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, close, buttonRef]);
}

// True when a ⋮ menu of `rows` items wouldn't fit between its button and the fixed bottom
// tab bar (or the screen edge), so it should open upward instead of under the bar.
export function menuOpensUp(btn, rows) {
  if (!btn) return false;
  const navBtn = document.querySelector('button[aria-label="หน้าหลัก"]');
  const limit = navBtn ? navBtn.getBoundingClientRect().top : window.innerHeight;
  return limit - btn.getBoundingClientRect().bottom < rows * 44 + 8;
}

// Lets a rich-menu button (or any external link) deep-link straight into a
// specific tab via ?tab=dashboard etc., instead of always landing on หน้าหลัก.
//
// This is NOT as simple as reading window.location.search: when LINE opens
// a liff.line.me URL that has extra query params, it doesn't forward them
// as-is — it wraps the whole original query (and path) into a single
// `liff.state` param on the endpoint URL, e.g. requesting
// `.../?tab=dashboard` actually arrives here as
// `...?liff.state=%2F%3Ftab%3Ddashboard`. liff.init() does not reliably
// unwrap that back into a plain `?tab=dashboard` on window.location before
// we read it, so we have to unwrap `liff.state` ourselves. main.jsx
// snapshots the raw query string into window.__bjInitialSearch *before*
// calling liff.init() (in case init() rewrites/clears the address bar) —
// read once, lazily, from AppInner's useState initializer so this runs on
// first render rather than at module-eval time.
export const VALID_TABS = ["home", "dashboard", "missions", "knowledge", "eligibility", "faq"];

export function initialTabFromUrl() {
  try {
    const raw = typeof window.__bjInitialSearch === "string" ? window.__bjInitialSearch : window.location.search;
    let params = new URLSearchParams(raw);
    const liffState = params.get("liff.state");
    if (liffState) {
      const decoded = decodeURIComponent(liffState);
      const qIndex = decoded.indexOf("?");
      if (qIndex !== -1) params = new URLSearchParams(decoded.slice(qIndex + 1));
    }
    const t = params.get("tab");
    return VALID_TABS.includes(t) ? t : "home";
  } catch (e) {
    return "home";
  }
}

// A useEffect that runs only when the values in `deps` change, while its body reads whatever the latest render holds
// (the react-hooks lint rule would want every value the body touches listed in `deps`, which would re-run these effects
// far too often: they are "on open", "on filter change" style effects keyed by a few values or string keys).
// Same behaviour as a plain useEffect with those deps: the body and the cleanup it returns come from the render that
// triggered the run. This is the one place the lint exception lives; do not copy it for effects that should follow all
// their inputs.
export function useEffectOn(effect, deps) {
  const ref = useRef(effect);
  ref.current = effect;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => ref.current(), deps);
}

export let _pageLayerSeq = 0;

// One browser-history entry for a full-screen page layer. The phone's back button pops the newest entry: only the
// layer whose entry was popped closes (every layer hears the popstate, so each checks whether its own marker is
// still the current entry).
export function usePageHistoryLayer(open, onClose) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open || typeof window === "undefined" || !window.history?.pushState) return undefined;
    const marker = `bj-page-${Date.now()}-${++_pageLayerSeq}`;
    try { window.history.pushState({ ...(window.history.state || {}), bjPage: marker }, ""); } catch (e) { return undefined; }
    let popped = false;
    const onPop = () => {
      if (window.history.state?.bjPage === marker) return;
      popped = true;
      closeRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (!popped && window.history.state?.bjPage === marker) window.history.back();
    };
  }, [open]);
}
