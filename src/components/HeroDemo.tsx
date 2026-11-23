"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Word = { w: string; s: number; e: number };
type Demo = { duration: number; words: Word[] };

const DEMO_VOICES = [
  { id: "blend_michael_fenrir", name: "Atlas", note: "deep US male" },
  { id: "af_heart", name: "Heart", note: "warm US female" },
  { id: "bm_george", name: "George", note: "British male" },
  { id: "bf_emma", name: "Emma", note: "British female" },
];

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

/** The script reads itself: words get highlighted exactly as the voice speaks them. */
export function HeroDemo({ fallbackText }: { fallbackText: string }) {
  const [voice, setVoice] = useState(DEMO_VOICES[0].id);
  const [demo, setDemo] = useState<Demo | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const audio = useRef<HTMLAudioElement>(null);
  const raf = useRef<number>(0);

  useEffect(() => {
    let alive = true;
    fetch(`/samples/demo-${voice}.json`)
      .then((r) => r.json())
      .then((d: Demo) => alive && setDemo(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [voice]);

  const tick = useCallback(() => {
    if (audio.current) setTime(audio.current.currentTime);
    raf.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  function toggle() {
    const a = audio.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  }

  function pick(id: string) {
    const a = audio.current;
    const wasPlaying = a && !a.paused;
    a?.pause();
    setTime(0);
    setVoice(id);
    if (wasPlaying) setTimeout(() => void audio.current?.play(), 50);
  }

  const words = demo?.words;
  const spoken = words ? words.filter((w) => w.s <= time + 0.02).length : 0;
  const duration = demo?.duration ?? 0;
  const current = DEMO_VOICES.find((v) => v.id === voice)!;

  return (
    <div className="relative rounded-[22px] border border-rule bg-surface shadow-[0_1px_0_var(--rule),0_24px_48px_-28px_rgba(23,26,51,0.35)]">
      <div className="flex items-center justify-between border-b border-rule px-5 py-3 text-sm text-graphite sm:px-7">
        <span className="script-text">ocean-short.txt</span>
        <span className="script-text tabular-nums" aria-live="off">
          {fmt(time)} / {fmt(duration)}
        </span>
      </div>

      <p className="script-text px-5 py-6 text-[1.2rem] leading-[1.75] sm:px-7 sm:py-8 sm:text-[1.45rem]" aria-label="Demo script">
        {words
          ? words.map((w, i) => (
              <span key={i} className={i < spoken ? "marker transition-colors duration-150" : "text-graphite"}>
                {w.w}
                {i < words.length - 1 ? " " : ""}
              </span>
            ))
          : fallbackText}
      </p>

      <div className="flex flex-col gap-4 border-t border-rule px-5 py-4 sm:flex-row sm:items-center sm:px-7">
        <button
          type="button"
          onClick={toggle}
          aria-pressed={playing}
          className="inline-flex h-12 items-center gap-3 self-start rounded-full bg-ink pl-4 pr-5 font-semibold text-paper hover:opacity-90"
        >
          {playing ? (
            <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="5" height="16" rx="1" /><rect x="14" y="4" width="5" height="16" rx="1" /></svg>
          ) : (
            <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z" /></svg>
          )}
          {playing ? "Pause" : `Play ${current.name}`}
        </button>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Choose a demo voice</legend>
          {DEMO_VOICES.map((v) => (
            <label
              key={v.id}
              className={`cursor-pointer rounded-full border px-3.5 py-2 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus ${
                voice === v.id ? "border-ink bg-ink text-paper" : "border-rule text-graphite hover:border-graphite hover:text-ink"
              }`}
            >
              <input type="radio" name="demo-voice" value={v.id} checked={voice === v.id} onChange={() => pick(v.id)} className="sr-only" />
              <span className="font-semibold">{v.name}</span> <span className={voice === v.id ? "opacity-80" : ""}>· {v.note}</span>
            </label>
          ))}
        </fieldset>
      </div>

      <audio
        ref={audio}
        src={`/samples/demo-${voice}.mp3`}
        preload="metadata"
        onPlay={() => {
          setPlaying(true);
          cancelAnimationFrame(raf.current);
          raf.current = requestAnimationFrame(tick);
        }}
        onPause={() => {
          setPlaying(false);
          cancelAnimationFrame(raf.current);
        }}
        onEnded={() => {
          setPlaying(false);
          cancelAnimationFrame(raf.current);
          setTime(duration);
        }}
      />
    </div>
  );
}
