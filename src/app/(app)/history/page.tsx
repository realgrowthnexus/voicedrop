import type { Metadata } from "next";
import Link from "next/link";
import { JobResult } from "@/components/JobResult";
import { listJobs, toPublicJob } from "@/lib/jobs/service";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "History" };

const STATUS: Record<string, string> = {
  held: "Waiting for review",
  queued: "Queued",
  processing: "Generating",
  done: "Ready",
  failed: "Failed, refunded",
  rejected: "Not approved, refunded",
};

export default async function HistoryPage() {
  const u = await requireUser();
  const jobs = (await listJobs(u.id, 50)).map((j) => toPublicJob(j));
  return (
    <div>
      <h1 className="title text-[clamp(2.4rem,5vw,3.4rem)]">History</h1>
      <p className="mt-2 text-mute">Your last 50 voice-overs. Files are kept for 30 days.</p>
      {jobs.length === 0 ? (
        <div className="mt-10 rounded-[20px] border border-dashed border-line-strong p-8 text-center">
          <p className="text-lg font-semibold">No voice-overs yet</p>
          <p className="mt-1 text-mute">Paste a script in the studio to make your first one.</p>
          <Link href="/dashboard" className="mt-5 btn btn-primary">
            Open the studio
          </Link>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-line overflow-hidden rounded-[20px] border border-line bg-surface">
          {jobs.map((j) => (
            <li key={j.id} className="p-5 transition-colors duration-300 hover:bg-surface-2 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">
                  {j.voiceName}, {j.chars.toLocaleString("en-US")} characters
                </p>
                <p className="text-sm text-mute">
                  <time dateTime={j.createdAt}>{new Date(j.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC</time>
                  <span
                    className={`ml-3 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      j.status === "failed" || j.status === "rejected"
                        ? "border-danger/40 text-danger"
                        : j.status === "done"
                          ? "border-ok/40 text-ok"
                          : "border-lamp/50 text-ink"
                    }`}
                  >
                    {STATUS[j.status]}
                  </span>
                </p>
              </div>
              <p className="script-text mt-2 line-clamp-2 text-mute">{j.preview}</p>
              {j.status === "done" ? (
                <div className="mt-2">
                  <JobResult job={j} compact />
                </div>
              ) : j.status === "failed" || j.status === "rejected" ? (
                <p className="mt-2 text-sm text-mute">{j.error}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
