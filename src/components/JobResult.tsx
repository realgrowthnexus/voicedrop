"use client";
import type { PublicJob } from "@/lib/client-types";

const LABEL: Record<string, string> = { mp3: "Download MP3", wav: "Download WAV", srt: "Download SRT subtitles" };

const fmtDur = (s: number | null) => (s == null ? "" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);

export function JobResult({ job, compact = false }: { job: PublicJob; compact?: boolean }) {
  if (job.status === "failed" || job.status === "rejected") {
    return (
      <div role="alert" className="rounded-[20px] border border-danger/40 bg-danger/10 p-5">
        <p className="font-semibold">{job.status === "rejected" ? "Not approved" : "Voice-over failed"}</p>
        <p className="mt-1 text-graphite">{job.error ?? "Your characters were refunded. Please try again."}</p>
      </div>
    );
  }
  if (job.status !== "done") return null;
  if (job.expired) {
    return <p className="text-graphite">These files expired after 30 days and were deleted.</p>;
  }
  return (
    <div className={compact ? "" : "rounded-[20px] border border-ink bg-surface p-5"}>
      {!compact ? (
        <p className="font-semibold">
          Done: {fmtDur(job.durationSec)} of audio with {job.voiceName}
        </p>
      ) : null}
      <audio controls preload="none" className="mt-3 w-full" src={`/api/jobs/${job.id}/file/mp3?inline=1`}>
        Your browser can&apos;t play audio here. Use the download button instead.
      </audio>
      <div className="mt-4 flex flex-wrap gap-2">
        {job.formats.map((f, i) => (
          <a
            key={f}
            href={`/api/jobs/${job.id}/file/${f}`}
            className={`inline-flex h-11 items-center rounded-full px-5 text-[0.95rem] font-semibold ${
              i === 0 ? "bg-ink text-paper hover:opacity-90" : "border border-ink hover:bg-ink hover:text-paper"
            }`}
          >
            {LABEL[f]}
          </a>
        ))}
      </div>
      {!compact ? <p className="mt-3 text-sm text-graphite">Files are kept for 30 days.</p> : null}
    </div>
  );
}
