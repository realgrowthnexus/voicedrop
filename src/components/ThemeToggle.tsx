"use client";
import { useSyncExternalStore } from "react";

type Mode = "system" | "light" | "dark";
const NEXT: Record<Mode, Mode> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<Mode, string> = { system: "Theme: system", light: "Theme: light", dark: "Theme: dark" };
const EVENT = "vod-theme";

function read(): Mode {
  try {
    const t = localStorage.getItem("theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function ThemeToggle() {
  const mode = useSyncExternalStore(subscribe, read, () => "system" as Mode);
  function cycle() {
    const m = NEXT[mode];
    try {
      if (m === "system") {
        localStorage.removeItem("theme");
        delete document.documentElement.dataset.theme;
      } else {
        localStorage.setItem("theme", m);
        document.documentElement.dataset.theme = m;
      }
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  }
  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`${LABEL[mode]}. Switch theme`}
      title={LABEL[mode]}
      className="inline-flex size-10 items-center justify-center rounded-full text-graphite hover:bg-rule/60 hover:text-ink"
    >
      {mode === "dark" ? (
        <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
      ) : mode === "light" ? (
        <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      ) : (
        <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
      )}
    </button>
  );
}
