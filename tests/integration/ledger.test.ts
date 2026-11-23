import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, db } from "@/db";
import { jobs, subscriptions, user } from "@/db/schema";
import { adminAdjust, getBalances, grantPack, refundJob, reserveAndCreateJob, revokePack, type JobDraft } from "@/lib/quota/ledger";
import { createUser, resetDb } from "../helpers/db";

const draft = (chars: number, over: Partial<JobDraft> = {}): JobDraft => ({
  text: "x".repeat(chars), chars, voice: "af_heart", speed: 1, formats: ["mp3"], flagReason: null, ipHash: null, ...over,
});
const DAY = 86_400_000;

beforeEach(resetDb);
afterAll(closeDb);

describe("ledger", () => {
  it("concurrent submits charge once", async () => {
    const u = await createUser();
    const [a, b] = await Promise.all([reserveAndCreateJob(u.id, draft(1000)), reserveAndCreateJob(u.id, draft(1000))]);
    const oks = [a, b].filter((r) => r.ok);
    expect(oks).toHaveLength(1);
    expect([a, b].find((r) => !r.ok)).toEqual({ ok: false, code: "job_active" });
    const bal = await getBalances(db(), u.id);
    expect(bal.freeRemaining).toBe(2000);
    expect(bal.activeJobs).toBe(1);
  });

  it("refund restores the balance exactly once", async () => {
    const u = await createUser();
    const r = await reserveAndCreateJob(u.id, draft(1200));
    if (!r.ok) throw new Error("expected ok");
    await refundJob(db(), r.job.id);
    await refundJob(db(), r.job.id);
    await db().update(jobs).set({ status: "failed" }).where(eq(jobs.id, r.job.id));
    const bal = await getBalances(db(), u.id);
    expect(bal.freeRemaining).toBe(3000);
    expect(bal.usedLast24h).toBe(0);
    expect(bal.activeJobs).toBe(0);
  });

  it("free usage older than 7 days no longer counts", async () => {
    const u = await createUser();
    const old = new Date(Date.now() - 8 * DAY);
    const r = await reserveAndCreateJob(u.id, draft(1500), { now: old });
    expect(r.ok).toBe(true);
    await db().update(jobs).set({ status: "done" });
    expect((await getBalances(db(), u.id)).freeRemaining).toBe(3000);
  });

  it("subscription usage from a previous period does not count", async () => {
    const u = await createUser();
    const now = Date.now();
    await db().insert(subscriptions).values({
      userId: u.id, paddleSubscriptionId: "sub_1", plan: "creator", status: "active",
      periodStart: new Date(now - 40 * DAY), periodEnd: new Date(now - 10 * DAY), lastEventAt: new Date(now - 40 * DAY),
    });
    const r = await reserveAndCreateJob(u.id, draft(5000, { formats: ["wav"] }), { now: new Date(now - 20 * DAY) });
    expect(r.ok).toBe(true);
    await db().update(jobs).set({ status: "done" });
    await db().update(subscriptions).set({ periodStart: new Date(now - 10 * DAY), periodEnd: new Date(now + 20 * DAY) });
    const bal = await getBalances(db(), u.id);
    expect(bal.subscriptionPlan).toBe("creator");
    expect(bal.subscriptionRemaining).toBe(100_000);
  });

  it("pack grants are idempotent per paddle reference and revocable", async () => {
    const u = await createUser();
    expect(await grantPack(db(), u.id, "txn_1", 50_000)).toBe(true);
    expect(await grantPack(db(), u.id, "txn_1", 50_000)).toBe(false);
    expect((await getBalances(db(), u.id)).packRemaining).toBe(50_000);
    expect(await revokePack(db(), u.id, "txn_1", 50_000)).toBe(50_000);
    expect((await getBalances(db(), u.id)).packRemaining).toBe(0);
  });

  it("banned users cannot submit", async () => {
    const u = await createUser({ banned: true });
    expect(await reserveAndCreateJob(u.id, draft(10))).toEqual({ ok: false, code: "banned" });
  });

  it("flagged scripts are held, still charged, and block a second job", async () => {
    const u = await createUser();
    const r = await reserveAndCreateJob(u.id, draft(100, { flagReason: "scam" }));
    expect(r.ok && r.job.status).toBe("held");
    expect(await reserveAndCreateJob(u.id, draft(100))).toEqual({ ok: false, code: "job_active" });
  });

  it("global daily spend guard returns busy", async () => {
    const u = await createUser();
    expect(await reserveAndCreateJob(u.id, draft(1000), { globalDailyLimit: 500 })).toEqual({ ok: false, code: "busy" });
  });

  it("admin adjust grants and revokes never-expiring credits", async () => {
    const u = await createUser();
    await adminAdjust(db(), u.id, 7000, "promo");
    await adminAdjust(db(), u.id, -10_000, "oops");
    expect((await getBalances(db(), u.id)).packRemaining).toBe(0);
  });

  it("comp plan works like a subscription for the calendar month", async () => {
    const u = await createUser();
    await db().update(user).set({ compPlan: "pro", compUntil: new Date(Date.now() + 5 * DAY) }).where(eq(user.id, u.id));
    const bal = await getBalances(db(), u.id);
    expect(bal.subscriptionPlan).toBe("pro");
    expect(bal.subscriptionRemaining).toBe(300_000);
  });
});
