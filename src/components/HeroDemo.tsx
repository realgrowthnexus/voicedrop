"use client";
import { useEffect, useRef, useState } from "react";
import { VoiceLine, attachAnalyser } from "./VoiceLine";

type Word = { w: string; s: number; e: number };
type Demo = { duration: number; words: Word[] };

const DEMO_VOICES = [
  { id: "blend_michael_fenrir", name: "Atlas", note: "Deep US narrator" },
  { id: "af_heart", name: "Heart", note: "Warm US voice" },
  { id: "bm_george", name: "George", note: "British storyteller" },
  { id: "bf_emma", name: "Emma", note: "Polished British voice" },
];

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

/** The stage: a script that reads itself while the voice line follows the real audio. */
export function HeroDemo({ fallbackText }: { fallbackText: string }) {
  const [voice, setVoice] = useState(DEMO_VOICES[0].id);
  const [demo, setDemo] = useState<Demo | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const audio = useRef<HTMLAudioElement>(null);

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

  useEffect(() => {
    if (!playing) return;
    let id = 0;
    const loop = () => {
      if (audio.current) setTime(audio.current.currentTime);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [playing]);

  function toggle() {
    const a = audio.current;
    if (!a) return;
    if (a.paused) {
      setAnalyser(attachAnalyser(a));
      void a.play();
    } else a.pause();
  }

  function pick(id: string) {
    const a = audio.current;
    const wasPlaying = a && !a.paused;
    a?.pause();
    setTime(0);
    setVoice(id);
    if (wasPlaying) setTimeout(() => void audio.current?.play(), 60);
  }

  const words = demo?.words;
  const spoken = words ? words.filter((w) => w.s <= time + 0.02).length : 0;
  const duration = demo?.duration ?? 0;
  const current = DEMO_VOICES.find((v) => v.id === voice)!;
  const progress = duration ? Math.min(1, time / duration) : 0;

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-stage text-stage-ink">

      <div className="relative h-28 px-4 sm:h-36 sm:px-8">
        <VoiceLine analyser={playing ? analyser : null} />
      </div>

      <p
        className="script-text relative px-5 pb-8 text-[1.12rem] leading-[1.8] sm:px-10 sm:text-[1.4rem]"
        aria-label="Demo script"
      >
        {words
          ? words.map((w, i) => (
              <span key={i} className={i < spoken ? "spoken" : "unspoken"}>
                {w.w}
                {i < words.length - 1 ? " " : ""}
              </span>
            ))
          : <span className="text-stage-mute">{fallbackText}</span>}
      </p>

      <div className="relative border-t border-white/10 px-5 py-4 sm:px-8">
        <div className="absolute inset-x-0 top-0 h-px bg-white/5" aria-hidden>
          <div className="h-px bg-lamp transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={toggle}
            aria-pressed={playing}
            aria-label={playing ? "Pause" : `Play ${current.name}`}
            className="btn btn-primary btn-lg self-start pl-2"
          >
            <span className="grid size-10 place-items-center rounded-full bg-lamp-ink/10">
              {playing ? (
                <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="5" height="16" rx="1.5" /><rect x="14" y="4" width="5" height="16" rx="1.5" /></svg>
              ) : (
                <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z" /></svg>
              )}
            </span>
            {playing ? "Pause" : `Play ${current.name}`}
          </button>
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Choose a demo voice</legend>
            {DEMO_VOICES.map((v) => (
              <label
                key={v.id}
                className={`cursor-pointer rounded-full border px-3.5 py-2 text-sm transition-colors duration-300 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)] ${
                  voice === v.id ? "border-lamp/70 bg-lamp/10 text-stage-ink" : "border-white/12 text-stage-mute hover:border-white/30 hover:text-stage-ink"
                }`}
              >
                <input type="radio" name="demo-voice" value={v.id} checked={voice === v.id} onChange={() => pick(v.id)} className="sr-only" />
                <span className="font-semibold">{v.name}</span> <span className="hidden sm:inline">{v.note}</span>
              </label>
            ))}
          </fieldset>
          <span className="script-text ml-auto hidden text-sm tabular-nums text-stage-mute sm:block" aria-hidden>
            {fmt(time)} / {fmt(duration)}
          </span>
        </div>
      </div>

      <audio
        ref={audio}
        src={`/samples/demo-${voice}.mp3`}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setTime(duration);
        }}
      />
    </div>
  );
}
