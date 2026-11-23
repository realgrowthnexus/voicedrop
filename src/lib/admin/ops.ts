import "server-only";
import { and, desc, eq, gt, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { adminActions, appEvents, creditLedger, jobs, session, subscriptions, transactions, user, type User } from "@/db/schema";
import { approveHeld, rejectHeld, sweepStaleJobs } from "@/lib/jobs/service";
import { adminAdjust } from "@/lib/quota/ledger";

const DAY = 86_400_000;

async function log(admin: User, action: string, targetUserId: string | null, details: Record<string, unknown>) {
  await db().insert(adminActions).values({ adminId: admin.id, targetUserId, action, details });
}

export async function banUser(admin: User, userId: string, reason: string) {
  if (userId === admin.id) throw new Error("You can't ban yourself.");
  await db().transaction(async (tx) => {
    await tx.update(user).set({ banned: true, banReason: reason.slice(0, 300) || "Policy violation" }).where(eq(user.id, userId));
    await tx.delete(session).where(eq(session.userId, userId)); // sign out everywhere
    // Cancel queued/held work and refund via the normal path below.
  });
  const pending = await db().select({ id: jobs.id }).from(jobs).where(and(eq(jobs.userId, userId), eq(jobs.status, "held")));
  for (const j of pending) await rejectHeld(j.id);
  await log(admin, "ban", userId, { reason });
}

export async function unbanUser(admin: User, userId: string) {
  await db().update(user).set({ banned: false, banReason: null }).where(eq(user.id, userId));
  await log(admin, "unban", userId, {});
}

export async function adjustCredits(admin: User, userId: string, delta: number, note: string) {
  await adminAdjust(db(), userId, delta, note);
  await log(admin, delta > 0 ? "grant_credits" : "revoke_credits", userId, { delta, note });
}

export async function setCompPlan(admin: User, userId: string, plan: "creator" | "pro" | null, days: number) {
  await db()
    .update(user)
    .set({ compPlan: plan, compUntil: plan ? new Date(Date.now() + days * DAY) : null })
    .where(eq(user.id, userId));
  await log(admin, "comp_plan", userId, { plan, days });
}

export async function moderate(admin: User, jobId: string, decision: "approve" | "reject") {
  const [j] = await db().select({ userId: jobs.userId }).from(jobs).where(eq(jobs.id, jobId));
  const ok = decision === "approve" ? await approveHeld(jobId) : await rejectHeld(jobId);
  if (ok) await log(admin, `flag_${decision}`, j?.userId ?? null, { jobId });
  return ok;
}

export async function searchUsers(q: string, limit = 50) {
  const term = q.trim();
  const where = term ? or(ilike(user.email, `%${term.replace(/[%_]/g, "")}%`), eq(user.id, term)) : undefined;
  return db().select().from(user).where(where).orderBy(desc(user.createdAt)).limit(limit);
}

export async function userDetail(userId: string) {
  const [u] = await db().select().from(user).where(eq(user.id, userId));
  if (!u) return null;
  const [subs, recentJobs, ledger, txns, actions] = await Promise.all([
    db().select().from(subscriptions).where(eq(subscriptions.userId, userId)).orderBy(desc(subscriptions.updatedAt)),
    db().select().from(jobs).where(eq(jobs.userId, userId)).orderBy(desc(jobs.createdAt)).limit(20),
    db().select().from(creditLedger).where(eq(creditLedger.userId, userId)).orderBy(desc(creditLedger.createdAt)).limit(30),
    db().select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.createdAt)).limit(20),
    db().select().from(adminActions).where(eq(adminActions.targetUserId, userId)).orderBy(desc(adminActions.createdAt)).limit(20),
  ]);
  return { user: u, subs, recentJobs, ledger, txns, actions };
}

export async function listJobsAdmin(status: string | null, limit = 100) {
  const where = status ? eq(jobs.status, status) : undefined;
  return db()
    .select({ job: jobs, email: user.email })
    .from(jobs)
    .innerJoin(user, eq(user.id, jobs.userId))
    .where(where)
    .orderBy(desc(jobs.createdAt))
    .limit(limit);
}

export type Stats = Awaited<ReturnType<typeof getStats>>;

export async function getStats(now = new Date()) {
  await sweepStaleJobs(now); // keep the queue healthy whenever the admin looks
  const d1 = new Date(now.getTime() - DAY);
  const d7 = new Date(now.getTime() - 7 * DAY);
  const d30 = new Date(now.getTime() - 30 * DAY);
  const count = sql<number>`count(*)::int`;

  const [[users], [users7], jobs24, [chars24], [chars30], [rev30], queue, [paying], funnel] = await Promise.all([
    db().select({ n: count }).from(user),
    db().select({ n: count }).from(user).where(gt(user.createdAt, d7)),
    db().select({ status: jobs.status, n: count }).from(jobs).where(gt(jobs.createdAt, d1)).groupBy(jobs.status),
    db().select({ n: sql<number>`coalesce(sum(${jobs.chars}),0)::int` }).from(jobs).where(and(gt(jobs.createdAt, d1), eq(jobs.status, "done"))),
    db().select({ n: sql<number>`coalesce(sum(${jobs.chars}),0)::int` }).from(jobs).where(and(gt(jobs.createdAt, d30), eq(jobs.status, "done"))),
    db()
      .select({ cents: sql<number>`coalesce(sum(${transactions.amountCents}),0)::int`, n: count })
      .from(transactions)
      .where(and(gt(transactions.createdAt, d30), eq(transactions.status, "completed"))),
    db().select({ status: jobs.status, n: count }).from(jobs).where(inArray(jobs.status, ["held", "queued", "processing"])).groupBy(jobs.status),
    db()
      .select({ n: sql<number>`count(distinct ${subscriptions.userId})::int` })
      .from(subscriptions)
      .where(and(inArray(subscriptions.status, ["active", "trialing", "past_due"]), gt(subscriptions.periodEnd, now))),
    db()
      .select({ name: appEvents.name, n: sql<number>`count(distinct ${appEvents.userId})::int` })
      .from(appEvents)
      .where(and(gt(appEvents.createdAt, d30), inArray(appEvents.name, ["signup", "job_done", "checkout_opened", "purchase"])))
      .groupBy(appEvents.name),
  ]);
  const by = (rows: { status?: string; name?: string; n: number }[], k: string) => rows.find((r) => (r.status ?? r.name) === k)?.n ?? 0;
  return {
    users: users.n,
    usersLast7d: users7.n,
    jobs24h: { done: by(jobs24, "done"), failed: by(jobs24, "failed"), total: jobs24.reduce((a, r) => a + r.n, 0) },
    chars24h: chars24.n,
    chars30d: chars30.n,
    revenue30dCents: rev30.cents,
    purchases30d: rev30.n,
    payingUsers: paying.n,
    queue: { held: by(queue, "held"), queued: by(queue, "queued"), processing: by(queue, "processing") },
    funnel30d: {
      signedUp: by(funnel, "signup"),
      madeAudio: by(funnel, "job_done"),
      openedCheckout: by(funnel, "checkout_opened"),
      paid: by(funnel, "purchase"),
    },
  };
}
