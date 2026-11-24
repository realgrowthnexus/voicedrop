"use client";
import { useEffect, useRef, useState } from "react";
import type { PublicJob } from "@/lib/client-types";

const LABEL: Record<string, string> = { mp3: "Download MP3", wav: "Download WAV", srt: "Download SRT subtitles" };

const fmt = (s: number | null | undefined) =>
  s == null || !Number.isFinite(s) ? "0:00" : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function Player({ src, label, lazy = false, duration = 0, small = false }: { src: string; label: string; lazy?: boolean; duration?: number; small?: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [d, setD] = useState(duration);
  useEffect(() => {
    if (!playing) return;
    let id = 0;
    const loop = () => {
      if (audio.current) setT(audio.current.currentTime);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [playing]);
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => (audio.current?.paused ? void audio.current.play() : audio.current?.pause())}
        aria-label={playing ? `Pause ${label}` : `Play ${label}`}
        className={`btn btn-icon shrink-0 ${small ? "btn-secondary btn-sm w-10" : "btn-primary"}`}
      >
        {playing ? (
          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="5" height="16" rx="1.5" /><rect x="14" y="4" width="5" height="16" rx="1.5" /></svg>
        ) : (
          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z" /></svg>
        )}
      </button>
      <input
        type="range"
        min={0}
        max={d || 1}
        step={0.01}
        value={t}
        aria-label={`Seek ${label}`}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (audio.current) audio.current.currentTime = v;
          setT(v);
        }}
        className="range min-w-0 flex-1"
        style={{ ["--p" as string]: `${d ? (t / d) * 100 : 0}%` }}
      />
      <span className="script-text shrink-0 whitespace-nowrap text-right text-sm tabular-nums text-mute">
        {fmt(t)} / {fmt(d)}
      </span>
      <audio
        ref={audio}
        controls
        className="hidden"
        preload={lazy ? "none" : "metadata"}
        src={src}
        onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setD(e.currentTarget.duration)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setT(d);
        }}
      />
    </div>
  );
}

export function JobResult({ job, compact = false }: { job: PublicJob; compact?: boolean }) {
  if (job.status === "failed" || job.status === "rejected") {
    return (
      <div role="alert" className="rounded-[18px] border border-danger/40 bg-danger/10 p-5">
        <p className="font-semibold">{job.status === "rejected" ? "Not approved" : "Voice-over failed"}</p>
        <p className="mt-1 text-mute">{job.error ?? "Your characters were refunded. Please try again."}</p>
      </div>
    );
  }
  if (job.status !== "done") return null;
  if (job.expired) {
    return <p className="text-mute">These files expired after 30 days and were deleted.</p>;
  }
  const body = (
    <>
      <Player src={`/api/jobs/${job.id}/file/mp3?inline=1`} label={`${job.voiceName} voice-over`} lazy={compact} small={compact} duration={job.durationSec ?? 0} />
      <div className={`flex flex-wrap gap-2 ${compact ? "mt-3" : "mt-5"}`}>
        {job.formats.map((f, i) => (
          <a key={f} href={`/api/jobs/${job.id}/file/${f}`} className={`btn btn-sm ${i === 0 && !compact ? "btn-primary" : "btn-secondary"}`}>
            <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M5 20h14" /></svg>
            {LABEL[f]}
          </a>
        ))}
      </div>
    </>
  );
  if (compact) return <div className="mt-3">{body}</div>;
  return (
    <div className="fade-in relative overflow-hidden rounded-[22px] border border-lamp/50 bg-surface p-6">
      <span aria-hidden className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-lamp to-transparent" />
      <p className="mb-5 flex items-center gap-2 font-semibold">
        <span aria-hidden className="grid size-6 place-items-center rounded-full bg-lamp text-lamp-ink">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
        Done: {fmt(job.durationSec)} of audio with {job.voiceName}
      </p>
      {body}
      <p className="mt-4 text-sm text-mute">Files are kept for 30 days.</p>
    </div>
  );
}
