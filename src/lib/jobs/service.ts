import "server-only";
import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { jobs, type Job, type User } from "@/db/schema";
import { screenScript } from "@/lib/abuse/content";
import { clientIp, hashIp } from "@/lib/abuse/ip";
import { env } from "@/lib/env";
import { track } from "@/lib/events";
import { HttpError } from "@/lib/http";
import { FORMATS, MAX_RAW_INPUT, MAX_SPEED, MIN_SPEED, VOICES, voiceById, type Format } from "@/lib/plans";
import { countChars } from "@/lib/quota/count";
import { refundJob, reserveAndCreateJob } from "@/lib/quota/ledger";
import { SUBMIT_ERROR_MESSAGES, type SubmitErrorCode } from "@/lib/quota/rules";
import { rateLimit } from "@/lib/ratelimit";
import { CONTENT_TYPES, jobFileKey, storage } from "@/lib/storage";
import { ttsBackend, webhookUrl, type StatusResult } from "@/lib/tts";
import type { JobStatus, PublicJob } from "@/lib/client-types";
import { actualJobCost, budgetActive, budgetAllows, recordJobCost } from "./budget";

export const RECONCILE_AFTER_MS = 2 * 60 * 1000;
export const STALE_AFTER_MS = 15 * 60 * 1000;

export const CreateJobSchema = z.object({
  text: z.string().max(MAX_RAW_INPUT, "Script is too long."),
  voice: z.enum(VOICES.map((v) => v.id) as [string, ...string[]]),
  speed: z.number().min(MIN_SPEED).max(MAX_SPEED).default(1),
  formats: z
    .array(z.enum(FORMATS as [Format, ...Format[]]))
    .min(1)
    .max(3)
    .transform((f) => Array.from(new Set(f))),
});

const ERROR_STATUS: Record<SubmitErrorCode | "busy" | "not_found", number> = {
  banned: 403,
  empty: 400,
  too_long: 400,
  format_not_allowed: 403,
  job_active: 409,
  daily_cap: 429,
  insufficient: 402,
  busy: 503,
  not_found: 401,
};

export type { PublicJob } from "@/lib/client-types";

export function toPublicJob(j: Job, now = new Date()): PublicJob {
  return {
    id: j.id,
    status: j.status as JobStatus,
    voice: j.voice,
    voiceName: voiceById(j.voice)?.name ?? j.voice,
    speed: j.speed,
    chars: j.chars,
    formats: j.formats as Format[],
    preview: j.text.slice(0, 140),
    durationSec: j.durationSec,
    error: j.error,
    createdAt: j.createdAt.toISOString(),
    finishedAt: j.finishedAt?.toISOString() ?? null,
    expiresAt: j.expiresAt.toISOString(),
    expired: j.expiresAt <= now,
  };
}

export async function createJob(u: User, body: unknown, headers: Headers): Promise<Job> {
  const parsed = CreateJobSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, "invalid", parsed.error.issues[0]?.message ?? "Invalid request.");
  const { text, voice, speed, formats } = parsed.data;

  const ip = clientIp(headers);
  const [byUser, byIp] = await Promise.all([rateLimit(`jobs:user:${u.id}`, 10, 60), rateLimit(`jobs:ip:${ip}`, 30, 60)]);
  if (!byUser.ok || !byIp.ok) throw new HttpError(429, "rate_limited", "Too many requests. Please wait a minute.");

  const trimmed = text.trim();
  const chars = countChars(trimmed);
  if (!(await budgetAllows(chars))) {
    throw new HttpError(503, "busy", "Voice generation is paused for now. Please try again later.");
  }
  const screening = screenScript(trimmed);
  const r = await reserveAndCreateJob(
    u.id,
    { text: trimmed, chars, voice, speed, formats, flagReason: screening.flagged ? screening.reason : null, ipHash: hashIp(ip) },
    { globalDailyLimit: env().GLOBAL_DAILY_CHAR_LIMIT },
  );
  if (!r.ok) {
    const msg =
      r.code === "busy"
        ? "We're at capacity right now. Please try again in a little while."
        : r.code === "not_found"
          ? "Please sign in again."
          : SUBMIT_ERROR_MESSAGES[r.code];
    throw new HttpError(ERROR_STATUS[r.code], r.code, msg);
  }
  await track(u.id, "job_created", { chars, voice, tier: r.job.tier, held: r.job.status === "held" });
  await pumpQueue();
  const [fresh] = await db().select().from(jobs).where(eq(jobs.id, r.job.id));
  return fresh ?? r.job;
}

async function failAndRefund(jobId: string, message: string): Promise<boolean> {
  return db().transaction(async (tx) => {
    const res = await tx
      .update(jobs)
      .set({ status: "failed", error: message, finishedAt: new Date() })
      .where(and(eq(jobs.id, jobId), inArray(jobs.status, ["queued", "processing", "held"])))
      .returning({ id: jobs.id, userId: jobs.userId });
    if (!res.length) return false;
    await refundJob(tx, jobId);
    return true;
  });
}

async function dispatch(job: Job): Promise<void> {
  if (!(await budgetAllows(job.chars, true))) {
    await failAndRefund(job.id, "Voice generation is paused for now. Your characters were refunded.");
    return;
  }
  try {
    const st = storage();
    const formats = job.formats as Format[];
    const uploads: Partial<Record<Format, string>> = {};
    for (const f of formats) uploads[f] = await st.putUrl(jobFileKey(job.userId, job.id, f), CONTENT_TYPES[f]);
    const { id } = await ttsBackend().submit(
      { job_id: job.id, text: job.text, voice: job.voice, speed: job.speed, formats, uploads },
      webhookUrl(job.id),
    );
    await db().update(jobs).set({ runpodId: id }).where(eq(jobs.id, job.id));
  } catch (e) {
    console.error("[jobs] dispatch failed", job.id, e);
    await failAndRefund(job.id, "We couldn't start this voice-over. Your characters were refunded — please try again.");
  }
}

/**
 * Dispatch queued jobs. Priority (paid) jobs always go; free jobs go only while
 * fewer than FREE_MAX_INFLIGHT jobs are processing. Safe to call concurrently:
 * each job is claimed with a conditional update.
 */
export async function pumpQueue(): Promise<number> {
  const queued = await db()
    .select()
    .from(jobs)
    .where(eq(jobs.status, "queued"))
    .orderBy(desc(jobs.priority), asc(jobs.createdAt))
    .limit(25);
  let dispatched = 0;
  for (const job of queued) {
    if (!job.priority) {
      const [p] = await db().select({ n: sql<number>`count(*)::int` }).from(jobs).where(eq(jobs.status, "processing"));
      if (Number(p?.n ?? 0) >= env().FREE_MAX_INFLIGHT) continue;
    }
    const claimed = await db()
      .update(jobs)
      .set({ status: "processing", dispatchedAt: new Date() })
      .where(and(eq(jobs.id, job.id), eq(jobs.status, "queued")))
      .returning();
    if (!claimed[0]) continue;
    await dispatch(claimed[0]);
    dispatched++;
  }
  return dispatched;
}

/** Apply a terminal backend result. Idempotent: only a processing job changes. */
export async function finalizeJob(jobId: string, result: StatusResult): Promise<void> {
  const terminal = ["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"].includes(result.status);
  if (terminal && budgetActive()) {
    // Count GPU time once, whatever the outcome (failed runs are billed too).
    const [j] = await db().select({ chars: jobs.chars, cost: jobs.gpuCostMicros, status: jobs.status }).from(jobs).where(eq(jobs.id, jobId));
    if (j && j.cost == null && j.status === "processing") {
      const c = actualJobCost(result.executionTime, result.delayTime, j.chars);
      await recordJobCost(jobId, c.gpuMs, c.micros);
    }
  }
  if (result.status === "COMPLETED") {
    const out = result.output;
    const [job] = await db().select().from(jobs).where(eq(jobs.id, jobId));
    if (!job || job.status !== "processing") return;
    const formats = job.formats as Format[];
    const valid =
      out && out.job_id === jobId && typeof out.duration_sec === "number" && formats.every((f) => (out.files?.[f]?.bytes ?? 0) > 0);
    if (!valid) {
      await failAndRefund(jobId, "The voice-over came back incomplete. Your characters were refunded.");
      await track(job.userId, "job_failed", { reason: "invalid_output" });
    } else {
      const res = await db()
        .update(jobs)
        .set({ status: "done", durationSec: out.duration_sec, files: out.files as Record<string, { bytes: number }>, finishedAt: new Date(), error: null })
        .where(and(eq(jobs.id, jobId), eq(jobs.status, "processing")))
        .returning({ id: jobs.id });
      if (res.length) await track(job.userId, "job_done", { duration: out.duration_sec, chars: job.chars });
    }
  } else if (result.status === "FAILED" || result.status === "CANCELLED" || result.status === "TIMED_OUT") {
    const msg = result.error?.includes("no speakable text")
      ? "We couldn't find any speakable words in this script. Your characters were refunded."
      : "Something went wrong while generating. Your characters were refunded — please try again.";
    if (await failAndRefund(jobId, msg)) {
      const [job] = await db().select({ userId: jobs.userId }).from(jobs).where(eq(jobs.id, jobId));
      if (job) await track(job.userId, "job_failed", { reason: result.status, error: result.error?.slice(0, 200) });
    }
  } else {
    return;
  }
  await pumpQueue();
}

/** Self-healing for missed webhooks; called when the client polls a job. */
export async function reconcileJob(job: Job, now = new Date()): Promise<Job> {
  if (job.status === "queued") {
    await pumpQueue();
  } else if (job.status === "processing" && job.dispatchedAt) {
    const age = now.getTime() - job.dispatchedAt.getTime();
    if (age > RECONCILE_AFTER_MS && job.runpodId) {
      try {
        const st = await ttsBackend().status(job.runpodId);
        await finalizeJob(job.id, st);
      } catch (e) {
        console.error("[jobs] status check failed", job.id, e);
      }
    }
    if (age > STALE_AFTER_MS) {
      if (budgetActive() && job.gpuCostMicros == null) {
        const c = actualJobCost(STALE_AFTER_MS, 0, job.chars);
        await recordJobCost(job.id, c.gpuMs, c.micros);
      }
      await failAndRefund(job.id, "This voice-over took too long and was cancelled. Your characters were refunded.");
    }
  }
  const [fresh] = await db().select().from(jobs).where(eq(jobs.id, job.id));
  return fresh ?? job;
}

/** Sweep for stale jobs across all users (called opportunistically, e.g. from admin views). */
export async function sweepStaleJobs(now = new Date()): Promise<number> {
  const stale = await db()
    .select()
    .from(jobs)
    .where(and(eq(jobs.status, "processing"), lt(jobs.dispatchedAt, new Date(now.getTime() - RECONCILE_AFTER_MS))))
    .limit(50);
  for (const j of stale) await reconcileJob(j, now);
  await pumpQueue();
  return stale.length;
}

export async function getOwnJob(userId: string, jobId: string): Promise<Job> {
  if (!z.uuid().safeParse(jobId).success) throw new HttpError(404, "not_found", "Not found.");
  const [job] = await db().select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)));
  if (!job) throw new HttpError(404, "not_found", "Not found.");
  return job;
}

export async function listJobs(userId: string, limit = 30): Promise<Job[]> {
  return db().select().from(jobs).where(eq(jobs.userId, userId)).orderBy(desc(jobs.createdAt)).limit(limit);
}

export async function fileUrl(job: Job, format: string, download: boolean): Promise<string> {
  const f = format as Format;
  if (!FORMATS.includes(f) || !(job.formats as Format[]).includes(f)) throw new HttpError(404, "not_found", "Not found.");
  if (job.status !== "done" || !job.files?.[f]) throw new HttpError(404, "not_ready", "This file is not ready.");
  if (job.expiresAt <= new Date()) throw new HttpError(410, "expired", "This file has expired (files are kept for 30 days).");
  const name = `voiceoverdrop-${job.id.slice(0, 8)}.${f}`;
  return storage().getUrl(jobFileKey(job.userId, job.id, f), { filename: name, contentType: CONTENT_TYPES[f], download });
}

/* ---- admin moderation ---- */

export async function approveHeld(jobId: string): Promise<boolean> {
  const res = await db()
    .update(jobs)
    .set({ status: "queued", flagReason: sql`${jobs.flagReason} || ' (approved)'` })
    .where(and(eq(jobs.id, jobId), eq(jobs.status, "held")))
    .returning({ id: jobs.id });
  if (res.length) await pumpQueue();
  return res.length > 0;
}

export async function rejectHeld(jobId: string): Promise<boolean> {
  return db().transaction(async (tx) => {
    const res = await tx
      .update(jobs)
      .set({ status: "rejected", error: "This script was not approved under our Acceptable Use Policy. Characters refunded.", finishedAt: new Date() })
      .where(and(eq(jobs.id, jobId), eq(jobs.status, "held")))
      .returning({ id: jobs.id });
    if (!res.length) return false;
    await refundJob(tx, jobId);
    return true;
  });
}
