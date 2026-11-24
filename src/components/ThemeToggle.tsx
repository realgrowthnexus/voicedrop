"use client";
import { useSyncExternalStore } from "react";

type Mode = "dark" | "light";
const EVENT = "vod-theme";

function read(): Mode {
  try {
    return localStorage.getItem("theme") === "dark" ? "dark" : "light";
  } catch {
    return "light";
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

/** Light is the default; dark is an opt-in remembered per browser. */
export function ThemeToggle() {
  const mode = useSyncExternalStore(subscribe, read, () => "light" as Mode);
  function toggle() {
    const next: Mode = mode === "dark" ? "light" : "dark";
    const apply = () => {
      try {
        if (next === "dark") {
          localStorage.setItem("theme", "dark");
          document.documentElement.dataset.theme = "dark";
        } else {
          localStorage.removeItem("theme");
          delete document.documentElement.dataset.theme;
        }
      } catch {}
      window.dispatchEvent(new Event(EVENT));
    };
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (doc.startViewTransition && !reduce) doc.startViewTransition(apply);
    else apply();
  }
  const label = mode === "dark" ? "Switch to light theme" : "Switch to dark theme";
  return (
    <button type="button" onClick={toggle} aria-label={label} title={label} className="btn btn-ghost btn-icon btn-sm text-mute hover:text-ink">
      {mode === "dark" ? (
        <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      )}
    </button>
  );
}
