"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ACTIVE, api, countChars, type Format, type Me, type PublicJob } from "@/lib/client-types";
import { VoicePreviewList } from "./VoicePreviewList";
import { JobResult } from "./JobResult";

const n = (x: number) => x.toLocaleString("en-US");
const DRAFT_KEY = "vod:draft";

const STATUS_COPY: Record<string, string> = {
  held: "Your script is waiting for a quick safety review. This usually takes a few hours.",
  queued: "In the queue. It will start in a moment.",
  processing: "Generating your voice-over…",
};

export function Studio() {
  const [me, setMe] = useState<Me | null>(null);
  const [text, setText] = useState("");
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
    void refreshMe();
    try {
      const d = localStorage.getItem(DRAFT_KEY);
      if (d) setText(d);
    } catch {}
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
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <form onSubmit={generate} className="min-w-0" aria-describedby="studio-help">
        <div className="flex items-end justify-between gap-4">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Studio</h1>
          <BalancePill me={me} />
        </div>

        <div className="mt-6 overflow-hidden rounded-[20px] border border-rule bg-surface focus-within:border-ink">
          <label htmlFor="script" className="flex items-center justify-between border-b border-rule px-5 py-3 text-sm text-graphite">
            <span className="font-semibold text-ink">Your script</span>
            <span className="script-text tabular-nums" aria-live="polite">
              <span className={over ? "font-bold text-danger" : ""}>{n(chars)}</span> / {n(max)}
            </span>
          </label>
          <textarea
            id="script"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            maxLength={20000}
            placeholder="Paste or type your script here. Leave a blank line between paragraphs for a longer pause."
            className="script-text block min-h-[18rem] w-full resize-y bg-transparent px-5 py-4 text-[1.05rem] leading-[1.7] text-ink outline-none placeholder:text-graphite"
          />
          <div className="h-1 bg-rule" aria-hidden>
            <div className={`h-1 ${over ? "bg-danger" : "bg-marker"}`} style={{ width: `${meter}%` }} />
          </div>
        </div>
        <p id="studio-help" className="mt-2 text-sm text-graphite">
          About 1,000 characters make a minute of audio. Numbers, prices and times are read naturally.
        </p>
        {over ? (
          <p role="alert" className="mt-2 text-danger">
            This script is {n(chars - max)} characters over your {n(max)}-character limit per voice-over. Split it into parts
            {me?.tier === "free" ? (
              <>
                {" "}or <Link href="/pricing" className="font-semibold underline underline-offset-4">upgrade</Link>
              </>
            ) : null}
            .
          </p>
        ) : short && me ? (
          <p role="alert" className="mt-2 text-danger">
            You have {n(available)} characters available right now.{" "}
            <Link href="/billing" className="font-semibold underline underline-offset-4">Get more characters</Link>
          </p>
        ) : null}

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="speed" className="font-semibold">
              Speed <span className="script-text font-normal text-graphite">{speed.toFixed(2)}×</span>
            </label>
            <input
              id="speed"
              type="range"
              min={0.8}
              max={1.2}
              step={0.05}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="mt-3 w-full accent-[var(--ink)]"
            />
            <div className="flex justify-between text-sm text-graphite">
              <span>Slower</span>
              <span>Faster</span>
            </div>
          </div>
          <fieldset>
            <legend className="font-semibold">Files</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["mp3", "wav", "srt"] as Format[]).map((f) => {
                const locked = !allowed.includes(f);
                return (
                  <label
                    key={f}
                    className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus ${
                      locked ? "cursor-not-allowed border-rule text-graphite" : "cursor-pointer border-ink"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--ink)]"
                      checked={formats.includes(f) && !locked}
                      disabled={locked || f === "mp3"}
                      onChange={() => toggleFormat(f)}
                    />
                    {f.toUpperCase()}
                    {f === "srt" ? " subtitles" : ""}
                  </label>
                );
              })}
            </div>
            {allowed.length < 3 ? (
              <p className="mt-2 text-sm text-graphite">
                WAV and SRT come with paid plans and credit packs. <Link href="/pricing" className="underline underline-offset-4">See plans</Link>
              </p>
            ) : null}
          </fieldset>
        </div>

        <div className="mt-8 lg:hidden">
          <h2 className="mb-3 font-semibold">Voice</h2>
          <VoicePreviewList selected={voice} onSelect={setVoice} name="voice-mobile" compact />
        </div>

        <div className="sticky bottom-0 z-10 -mx-4 mt-8 border-t border-rule bg-paper/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <button
            type="submit"
            disabled={!canSubmit}
            className="h-14 w-full rounded-full bg-ink text-lg font-semibold text-paper hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:px-10"
          >
            {submitting ? "Starting…" : busy ? "Voice-over in progress…" : `Generate voice-over${chars ? ` · ${n(chars)} characters` : ""}`}
          </button>
        </div>

        {error ? (
          <p role="alert" className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3">
            {error}
          </p>
        ) : null}

        <section aria-live="polite" className="mt-8">
          {job && ACTIVE.includes(job.status) ? (
            <div className="rounded-[20px] border border-rule bg-surface p-5">
              <div className="flex items-center gap-3">
                <span aria-hidden className="relative flex size-3">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-marker opacity-75 motion-reduce:hidden" />
                  <span className="relative inline-flex size-3 rounded-full bg-marker" />
                </span>
                <p className="font-semibold">{STATUS_COPY[job.status]}</p>
              </div>
              <p className="mt-1 text-sm text-graphite">
                {job.voiceName} · {n(job.chars)} characters{job.status !== "held" ? ` · ${elapsed}s` : ""}. You can leave this page; it'll be in your history.
              </p>
            </div>
          ) : job ? (
            <JobResult job={job} />
          ) : null}
        </section>
      </form>

      <aside className="hidden lg:block" aria-label="Voice">
        <h2 className="mb-3 mt-2 font-semibold lg:mt-[3.4rem]">Voice</h2>
        <VoicePreviewList selected={voice} onSelect={setVoice} name="voice" compact />
      </aside>
    </div>
  );
}

function BalancePill({ me }: { me: Me | null }) {
  if (!me) return <span className="h-9 w-40 animate-pulse rounded-full bg-rule motion-reduce:animate-none" aria-hidden />;
  const b = me.balances;
  const label =
    me.tier === "free"
      ? `${n(b.freeRemaining)} free characters left this week`
      : me.tier === "pack"
        ? `${n(b.packRemaining + b.freeRemaining)} characters left`
        : `${n(b.subscriptionRemaining + b.packRemaining)} characters left`;
  return (
    <Link href="/billing" className="rounded-full border border-rule bg-surface px-4 py-2 text-sm font-semibold hover:border-ink">
      {label}
    </Link>
  );
}
