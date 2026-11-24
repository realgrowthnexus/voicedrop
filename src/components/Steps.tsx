"use client";
import { useEffect, useRef, useState } from "react";

const STEPS = [
  { title: "Paste your script", body: "Drop in the text for your short, explainer or long video. Up to 10,000 characters at a time on paid plans." },
  { title: "Pick a voice", body: "Twelve natural English voices, American and British. Preview each one and set the speed." },
  { title: "Download", body: "An MP3 in seconds. Paid plans also get studio WAV and SRT subtitles timed to every word." },
];

/** A real sequence, so it's numbered; the connecting line is drawn as you scroll. */
export function Steps() {
  const ref = useRef<HTMLOListElement>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let id = 0;
    const on = () => {
      cancelAnimationFrame(id);
      id = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        setP(Math.max(0, Math.min(1, (vh * 0.85 - r.top) / (r.height + vh * 0.35))));
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      cancelAnimationFrame(id);
    };
  }, []);
  return (
    <ol ref={ref} className="relative grid gap-10 md:grid-cols-3 md:gap-8">
      <span aria-hidden className="absolute left-5 top-5 hidden h-px w-[calc(100%-2.5rem)] bg-line md:block">
        <span className="block h-px origin-left bg-lamp" style={{ transform: `scaleX(${p})` }} />
      </span>
      <span aria-hidden className="absolute left-5 top-5 h-[calc(100%-2.5rem)] w-px bg-line md:hidden">
        <span className="block w-px origin-top bg-lamp" style={{ height: `${p * 100}%` }} />
      </span>
      {STEPS.map((s, i) => {
        const on = p > i / STEPS.length + 0.05;
        return (
          <li key={s.title} className="relative flex gap-5 md:block">
            <span
              aria-hidden
              className={`relative z-10 grid size-10 shrink-0 place-items-center rounded-full border text-sm font-semibold transition-all duration-700 ease-[var(--ease-out)] ${
                on ? "border-lamp bg-lamp text-lamp-ink" : "border-line-strong bg-bg text-mute"
              }`}
            >
              {i + 1}
            </span>
            <div className="md:mt-6">
              <h3 className="text-xl font-semibold tracking-[-0.02em]">{s.title}</h3>
              <p className="mt-2 max-w-[38ch] text-mute">{s.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
