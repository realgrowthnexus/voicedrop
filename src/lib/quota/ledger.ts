import "server-only";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { db, type Executor, type Tx } from "@/db";
import { creditLedger, jobs, subscriptions, user, type Job } from "@/db/schema";
import { FILE_RETENTION_DAYS, FREE_WEEKLY_CHARS, PLAN_ALLOWANCE, TIERS, type Format, type PaidPlan } from "@/lib/plans";
import { checkSubmit, type Balances, type SubmitErrorCode } from "./rules";

const DAY = 24 * 60 * 60 * 1000;
/** postgres.js cannot bind JS Dates inside raw sql fragments; send ISO strings. */
const at = (d: Date) => sql`${d.toISOString()}::timestamptz`;
export const ACTIVE_JOB_STATUSES = ["held", "queued", "processing"] as const;
const ACTIVE_SUB_STATUSES = ["active", "trialing", "past_due"];

export type PlanPeriod = { plan: PaidPlan; start: Date; end: Date; source: "paddle" | "comp" };

/** The paid plan currently in force for a user (Paddle subscription first, then admin comp). */
export async function getActivePlan(ex: Executor, userId: string, now: Date): Promise<PlanPeriod | null> {
  const subs = await ex
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), inArray(subscriptions.status, ACTIVE_SUB_STATUSES)));
  const live = subs
    .filter((s) => s.periodStart && s.periodEnd && s.periodEnd > now && s.periodStart <= now)
    .sort((a, b) => PLAN_ALLOWANCE[b.plan as PaidPlan] - PLAN_ALLOWANCE[a.plan as PaidPlan]);
  if (live[0]) return { plan: live[0].plan as PaidPlan, start: live[0].periodStart!, end: live[0].periodEnd!, source: "paddle" };

  const [u] = await ex.select({ compPlan: user.compPlan, compUntil: user.compUntil }).from(user).where(eq(user.id, userId));
  if (u?.compPlan && u.compUntil && u.compUntil > now && (u.compPlan === "creator" || u.compPlan === "pro")) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return { plan: u.compPlan, start, end, source: "comp" };
  }
  return null;
}

export async function getBalances(ex: Executor, userId: string, now: Date = new Date()): Promise<Balances & { period: PlanPeriod | null }> {
  const period = await getActivePlan(ex, userId, now);
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const dayAgo = new Date(now.getTime() - DAY);

  const [row] = await ex
    .select({
      free: sql<number>`coalesce(sum(case when ${creditLedger.bucket} = 'free' and ${creditLedger.effectiveAt} > ${at(weekAgo)} then ${creditLedger.delta} end), 0)::int`,
      pack: sql<number>`coalesce(sum(case when ${creditLedger.bucket} = 'pack' then ${creditLedger.delta} end), 0)::int`,
      sub: period
        ? sql<number>`coalesce(sum(case when ${creditLedger.bucket} = 'subscription' and ${creditLedger.effectiveAt} >= ${at(period.start)} and ${creditLedger.effectiveAt} < ${at(period.end)} then ${creditLedger.delta} end), 0)::int`
        : sql<number>`0`,
      day: sql<number>`coalesce(sum(case when ${creditLedger.reason} in ('job_charge','job_refund') and ${creditLedger.effectiveAt} > ${at(dayAgo)} then ${creditLedger.delta} end), 0)::int`,
    })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId));

  const [active] = await ex
    .select({ n: sql<number>`count(*)::int` })
    .from(jobs)
    .where(and(eq(jobs.userId, userId), inArray(jobs.status, [...ACTIVE_JOB_STATUSES])));

  return {
    freeRemaining: Math.max(0, FREE_WEEKLY_CHARS + Number(row?.free ?? 0)),
    subscriptionRemaining: period ? Math.max(0, PLAN_ALLOWANCE[period.plan] + Number(row?.sub ?? 0)) : 0,
    packRemaining: Math.max(0, Number(row?.pack ?? 0)),
    usedLast24h: Math.max(0, -Number(row?.day ?? 0)),
    activeJobs: Number(active?.n ?? 0),
    subscriptionPlan: period?.plan ?? null,
    period,
  };
}

export type JobDraft = {
  text: string;
  chars: number;
  voice: string;
  speed: number;
  formats: Format[];
  flagReason: string | null;
  ipHash: string | null;
};

export type ReserveResult = { ok: true; job: Job } | { ok: false; code: SubmitErrorCode | "busy" | "not_found" };

/**
 * Atomically: lock the user row, check every limit, create the job and write
 * the negative ledger rows. Concurrent submits for one user serialise on the lock.
 */
export async function reserveAndCreateJob(
  userId: string,
  draft: JobDraft,
  opts: { now?: Date; globalDailyLimit?: number } = {},
): Promise<ReserveResult> {
  const now = opts.now ?? new Date();
  return db().transaction(async (tx) => {
    const locked = await tx.execute<{ id: string; banned: boolean }>(
      sql`select id, banned from "user" where id = ${userId} for update`,
    );
    const u = locked[0];
    if (!u) return { ok: false, code: "not_found" } as const;

    const balances = await getBalances(tx, userId, now);
    const decision = checkSubmit({ chars: draft.chars, formats: draft.formats, banned: u.banned }, balances);
    if (!decision.ok) return decision;

    if (opts.globalDailyLimit && opts.globalDailyLimit > 0) {
      const [g] = await tx
        .select({ used: sql<number>`coalesce(-sum(${creditLedger.delta}), 0)::int` })
        .from(creditLedger)
        .where(
          and(
            inArray(creditLedger.reason, ["job_charge", "job_refund"]),
            gt(creditLedger.effectiveAt, new Date(now.getTime() - DAY)),
          ),
        );
      if (Number(g?.used ?? 0) + draft.chars > opts.globalDailyLimit) return { ok: false, code: "busy" } as const;
    }

    const [job] = await tx
      .insert(jobs)
      .values({
        userId,
        status: draft.flagReason ? "held" : "queued",
        text: draft.text,
        voice: draft.voice,
        speed: draft.speed,
        formats: draft.formats,
        chars: draft.chars,
        tier: decision.tier,
        priority: TIERS[decision.tier].priority,
        flagReason: draft.flagReason,
        ipHash: draft.ipHash,
        createdAt: now,
        expiresAt: new Date(now.getTime() + FILE_RETENTION_DAYS * DAY),
      })
      .returning();

    await tx.insert(creditLedger).values(
      decision.charges.map((c) => ({
        userId,
        bucket: c.bucket,
        delta: -c.amount,
        reason: "job_charge",
        jobId: job.id,
        effectiveAt: now,
      })),
    );
    return { ok: true, job } as const;
  });
}

/** Give back every charge of a job. Idempotent thanks to the unique (job, reason, bucket) index. */
export async function refundJob(tx: Tx | Executor, jobId: string): Promise<void> {
  const charges = await tx
    .select()
    .from(creditLedger)
    .where(and(eq(creditLedger.jobId, jobId), eq(creditLedger.reason, "job_charge")));
  if (!charges.length) return;
  await tx
    .insert(creditLedger)
    .values(
      charges.map((c) => ({
        userId: c.userId,
        bucket: c.bucket,
        delta: -c.delta,
        reason: "job_refund",
        jobId,
        effectiveAt: c.effectiveAt, // nets out inside the same windows as the charge
      })),
    )
    .onConflictDoNothing();
}

/** Credit a purchased pack. Idempotent per Paddle reference. Returns true if newly granted. */
export async function grantPack(ex: Executor, userId: string, paddleRef: string, chars: number): Promise<boolean> {
  const res = await ex
    .insert(creditLedger)
    .values({ userId, bucket: "pack", delta: chars, reason: "pack_purchase", paddleRef })
    .onConflictDoNothing()
    .returning({ id: creditLedger.id });
  return res.length > 0;
}

/** Remove up to `chars` unused pack credits (refunds). Returns how much was revoked. */
export async function revokePack(ex: Executor, userId: string, paddleRef: string, chars: number): Promise<number> {
  const { packRemaining } = await getBalances(ex, userId);
  const amount = Math.min(packRemaining, chars);
  if (amount <= 0) return 0;
  const res = await ex
    .insert(creditLedger)
    .values({ userId, bucket: "pack", delta: -amount, reason: "pack_refund", paddleRef })
    .onConflictDoNothing()
    .returning({ id: creditLedger.id });
  return res.length ? amount : 0;
}

/** Admin grant (+) or revoke (−) of never-expiring credits. */
export async function adminAdjust(ex: Executor, userId: string, delta: number, note: string): Promise<void> {
  if (!Number.isInteger(delta) || delta === 0) throw new Error("delta must be a non-zero integer");
  if (delta < 0) {
    const { packRemaining } = await getBalances(ex, userId);
    delta = -Math.min(packRemaining, -delta);
    if (delta === 0) return;
  }
  await ex.insert(creditLedger).values({
    userId,
    bucket: "pack",
    delta,
    reason: delta > 0 ? "admin_grant" : "admin_revoke",
    note: note.slice(0, 200),
  });
}
