"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ACTIVE, api, countChars, type Format, type Me, type PublicJob } from "@/lib/client-types";
import { VoicePreviewList } from "./VoicePreviewList";
import { JobResult } from "./JobResult";
import { Skeleton } from "./Skeleton";
import { VoiceLine } from "./VoiceLine";

const n = (x: number) => x.toLocaleString("en-US");
const DRAFT_KEY = "vod:draft";

const STATUS_COPY: Record<string, string> = {
  held: "Your script is waiting for a quick safety review. This usually takes a few hours.",
  queued: "In the queue. It will start in a moment.",
  processing: "Generating your voice-over…",
};

export function Studio() {
  const [me, setMe] = useState<Me | null>(null);
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem(DRAFT_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [voice, setVoice] = useState("blend_michael_fenrir");
  const [speed, setSpeed] = useState(1);
  const [formats, setFormats] = useState<Format[]>(["mp3"]);
  const [job, setJob] = useState<PublicJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const poll = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshMe = useCallback(async () => {
    try {
      setMe(await api<Me>("/api/me"));
    } catch {}
  }, []);

  const watch = useCallback(
    (id: string, started = Date.now()) => {
      const step = async () => {
        try {
          const { job: j } = await api<{ job: PublicJob }>(`/api/jobs/${id}`);
          setJob(j);
          setElapsed(Math.round((Date.now() - started) / 1000));
          if (ACTIVE.includes(j.status)) {
            const age = Date.now() - started;
            poll.current = setTimeout(step, j.status === "held" ? 15000 : age < 30000 ? 1500 : 4000);
          } else {
            void refreshMe();
          }
        } catch {
          poll.current = setTimeout(step, 5000);
        }
      };
      void step();
    },
    [refreshMe],
  );

  useEffect(() => {
    api<Me>("/api/me")
      .then(setMe)
      .catch(() => {});
    // Resume an in-flight job after a reload.
    api<{ jobs: PublicJob[] }>("/api/jobs")
      .then(({ jobs }) => {
        const active = jobs.find((j) => ACTIVE.includes(j.status));
        if (active) {
          setJob(active);
          watch(active.id, new Date(active.createdAt).getTime());
        }
      })
      .catch(() => {});
    return () => {
      if (poll.current) clearTimeout(poll.current);
    };
  }, [refreshMe, watch]);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, text);
    } catch {}
  }, [text]);

  const chars = countChars(text);
  const max = me?.limits.maxPerRequest ?? 1500;
  const allowed = me?.limits.formats ?? ["mp3"];
  const available = me?.availableNow ?? 0;
  const over = chars > max;
  const short = !over && chars > available;
  const busy = !!job && ACTIVE.includes(job.status);
  const canSubmit = chars > 0 && !over && !short && !busy && !submitting && formats.length > 0;

  function toggleFormat(f: Format) {
    setFormats((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));
  }

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const { job: j } = await api<{ job: PublicJob }>("/api/jobs", {
        method: "POST",
        body: JSON.stringify({ text, voice, speed, formats: formats.filter((f) => allowed.includes(f)) }),
      });
      setJob(j);
      setElapsed(0);
      void refreshMe();
      if (ACTIVE.includes(j.status)) watch(j.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const meter = Math.min(100, (chars / Math.max(1, max)) * 100);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_23rem]">
      <form onSubmit={generate} className="min-w-0" aria-describedby="studio-help">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="title text-[clamp(2.4rem,5vw,3.4rem)]">Studio</h1>
          <BalancePill me={me} />
        </div>

        <div className="group mt-8 overflow-hidden rounded-[20px] border border-line bg-surface transition-[border-color,box-shadow] duration-300 focus-within:border-lamp/70 focus-within:shadow-[0_0_0_4px_var(--lamp-soft)]">
          <label htmlFor="script" className="flex items-center justify-between border-b border-line px-5 py-3 text-sm text-mute">
            <span className="font-medium text-ink">Your script</span>
            <span className="script-text tabular-nums" aria-live="polite">
              <span className={over ? "font-bold text-danger" : "text-ink"}>{n(chars)}</span> / {n(max)}
            </span>
          </label>
          <textarea
            id="script"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            maxLength={20000}
            placeholder="Paste or type your script here. Leave a blank line between paragraphs for a longer pause."
            className="script-text block min-h-[18rem] w-full resize-y bg-transparent px-5 py-4 text-[1.05rem] leading-[1.75] text-ink outline-none placeholder:text-mute/80"
          />
          <div className="h-[3px] bg-line" aria-hidden>
            <div
              className={`h-[3px] transition-[width,background-color] duration-500 ease-[var(--ease-out)] ${over ? "bg-danger" : "bg-lamp"}`}
              style={{ width: `${meter}%` }}
            />
          </div>
        </div>
        <p id="studio-help" className="mt-2 text-sm text-mute">
          About 1,000 characters make a minute of audio. Numbers, prices and times are read naturally.
        </p>
        {over ? (
          <p role="alert" className="mt-2 text-danger">
            This script is {n(chars - max)} characters over your {n(max)}-character limit per voice-over. Split it into parts
            {me?.tier === "free" ? (
              <>
                {" "}or <Link href="/pricing" className="link-underline font-semibold">upgrade</Link>
              </>
            ) : null}
            .
          </p>
        ) : short && me ? (
          <p role="alert" className="mt-2 text-danger">
            You have {n(available)} characters available right now.{" "}
            <Link href="/billing" className="link-underline font-semibold">Get more characters</Link>
          </p>
        ) : null}

        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <div>
            <label htmlFor="speed" className="flex items-baseline justify-between text-sm font-medium">
              Speed <span className="script-text text-mute">{speed.toFixed(2)}×</span>
            </label>
            <input
              id="speed"
              type="range"
              min={0.8}
              max={1.2}
              step={0.05}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="range mt-2 w-full"
              style={{ ["--p" as string]: `${((speed - 0.8) / 0.4) * 100}%` }}
            />
            <div className="flex justify-between text-xs text-mute">
              <span>Slower</span>
              <span>Faster</span>
            </div>
          </div>
          <fieldset>
            <legend className="text-sm font-medium">Files</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["mp3", "wav", "srt"] as Format[]).map((f) => {
                const locked = !allowed.includes(f);
                const on = formats.includes(f) && !locked;
                return (
                  <label
                    key={f}
                    className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-colors duration-300 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)] ${
                      locked ? "cursor-not-allowed border-line text-mute" : on ? "cursor-pointer border-lamp/70 bg-lamp/10" : "cursor-pointer border-line-strong hover:border-ink"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--lamp)]"
                      checked={on}
                      disabled={locked || f === "mp3"}
                      onChange={() => toggleFormat(f)}
                    />
                    {f.toUpperCase()}
                    {f === "srt" ? " subtitles" : ""}
                    {locked ? (
                      <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                    ) : null}
                  </label>
                );
              })}
            </div>
            {allowed.length < 3 ? (
              <p className="mt-2 text-sm text-mute">
                WAV and SRT come with paid plans and credit packs. <Link href="/pricing" className="link-underline text-ink">See plans</Link>
              </p>
            ) : null}
          </fieldset>
        </div>

        <div className="mt-10 lg:hidden">
          <h2 className="mb-3 text-sm font-medium">Voice</h2>
          <VoicePreviewList selected={voice} onSelect={setVoice} name="voice-mobile" compact />
        </div>

        <div className="sticky bottom-0 z-10 -mx-5 mt-10 border-t border-line bg-bg/85 px-5 py-4 backdrop-blur-xl sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <button type="submit" disabled={!canSubmit} className="btn btn-primary btn-lg w-full sm:w-auto">
            {submitting || busy ? (
              <span className="eq is-live" aria-hidden>
                <i />
                <i />
                <i />
                <i />
              </span>
            ) : null}
            {submitting ? "Starting…" : busy ? "Voice-over in progress…" : `Generate voice-over${chars ? ` (${n(chars)} characters)` : ""}`}
          </button>
        </div>

        {error ? (
          <p role="alert" className="fade-in mt-5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3">
            {error}
          </p>
        ) : null}

        <section aria-live="polite" className="mt-8">
          {job && ACTIVE.includes(job.status) ? (
            <div
              className="fade-in relative overflow-hidden rounded-[22px] border border-white/10 bg-stage p-6 text-stage-ink"
              style={{ ["--ink" as string]: "var(--stage-ink)", ["--mute" as string]: "var(--stage-mute)" }}
            >
              <div className="h-20">
                <VoiceLine analyser={null} idleAmp={job.status === "processing" ? 0.35 : 0.14} />
              </div>
              <p className="mt-2 font-semibold">{STATUS_COPY[job.status]}</p>
              <p className="mt-1 text-sm text-stage-mute">
                {job.voiceName}, {n(job.chars)} characters{job.status !== "held" ? `, ${elapsed}s` : ""}. You can leave this page; it&apos;ll be in your
                history.
              </p>
            </div>
          ) : job ? (
            <JobResult job={job} />
          ) : null}
        </section>
      </form>

      <aside className="hidden lg:block" aria-label="Voice">
        <h2 className="mb-3 mt-3 text-sm font-medium lg:mt-[4.6rem]">Voice</h2>
        <VoicePreviewList selected={voice} onSelect={setVoice} name="voice" compact />
      </aside>
    </div>
  );
}

function BalancePill({ me }: { me: Me | null }) {
  if (!me) return <Skeleton className="h-10 w-56 rounded-full" label="Loading your balance" />;
  const b = me.balances;
  const label =
    me.tier === "free"
      ? `${n(b.freeRemaining)} free characters left this week`
      : me.tier === "pack"
        ? `${n(b.packRemaining + b.freeRemaining)} characters left`
        : `${n(b.subscriptionRemaining + b.packRemaining)} characters left`;
  return (
    <Link href="/billing" className="btn btn-secondary btn-sm fade-in">
      <span aria-hidden className="size-1.5 rounded-full bg-lamp" />
      {label}
    </Link>
  );
}
