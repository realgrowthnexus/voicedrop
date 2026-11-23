import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { closeDb, db } from "@/db";
import { jobs, subscriptions } from "@/db/schema";
import { HttpError } from "@/lib/http";
import { approveHeld, createJob, fileUrl, finalizeJob, getOwnJob, pumpQueue, reconcileJob, rejectHeld } from "@/lib/jobs/service";
import { getBalances } from "@/lib/quota/ledger";
import { setTtsBackendForTests, webhookSig, type JobInput, type StatusResult, type TtsBackend } from "@/lib/tts";
import { POST as runpodWebhook } from "@/app/api/webhooks/runpod/route";
import { createUser, resetDb } from "../helpers/db";

class FakeBackend implements TtsBackend {
  submitted: { input: JobInput; webhook: string }[] = [];
  statuses = new Map<string, StatusResult>();
  fail = false;
  async submit(input: JobInput, webhook: string) {
    if (this.fail) throw new Error("boom");
    this.submitted.push({ input, webhook });
    return { id: `rp-${this.submitted.length}` };
  }
  async status(id: string) {
    return this.statuses.get(id) ?? { id, status: "IN_PROGRESS" as const };
  }
}

let fake: FakeBackend;
const H = new Headers({ "x-forwarded-for": "203.0.113.5" });
const body = (over: Record<string, unknown> = {}) => ({ text: "Hello there, this is a test script.", voice: "af_heart", speed: 1, formats: ["mp3"], ...over });
const DAY = 86_400_000;

async function paidUser() {
  const u = await createUser();
  await db().insert(subscriptions).values({
    userId: u.id, paddleSubscriptionId: `sub_${u.id}`, plan: "creator", status: "active",
    periodStart: new Date(Date.now() - DAY), periodEnd: new Date(Date.now() + 29 * DAY), lastEventAt: new Date(),
  });
  return u;
}

const httpStatus = async (p: Promise<unknown>) => {
  try {
    await p;
    return 200;
  } catch (e) {
    return e instanceof HttpError ? e.status : 500;
  }
};

function completed(jobId: string, runpodId: string, formats = ["mp3"]): StatusResult {
  return {
    id: runpodId,
    status: "COMPLETED",
    output: { job_id: jobId, duration_sec: 2.5, chars: 35, words: 7, files: Object.fromEntries(formats.map((f) => [f, { bytes: 1000 }])) },
  };
}

beforeEach(async () => {
  await resetDb();
  fake = new FakeBackend();
  setTtsBackendForTests(fake);
});
afterEach(() => setTtsBackendForTests(null));
afterAll(closeDb);

describe("jobs service", () => {
  it("creates and dispatches a job with presigned upload URLs for allowed formats only", async () => {
    const u = await createUser();
    const job = await createJob(u, body(), H);
    expect(job.status).toBe("processing");
    expect(fake.submitted).toHaveLength(1);
    const { input, webhook } = fake.submitted[0];
    expect(input).toMatchObject({ job_id: job.id, voice: "af_heart", formats: ["mp3"] });
    expect(Object.keys(input.uploads)).toEqual(["mp3"]);
    expect(input.uploads.mp3).toContain(`/api/dev-storage/jobs/${u.id}/${job.id}.mp3`);
    expect(webhook).toContain(`job=${job.id}`);
    expect((await getBalances(db(), u.id)).freeRemaining).toBe(3000 - job.chars);
  });

  it("validates input", async () => {
    const u = await createUser();
    expect(await httpStatus(createJob(u, body({ voice: "evil" }), H))).toBe(400);
    expect(await httpStatus(createJob(u, body({ speed: 3 }), H))).toBe(400);
    expect(await httpStatus(createJob(u, body({ text: "   " }), H))).toBe(400);
    expect(await httpStatus(createJob(u, body({ formats: ["wav"] }), H))).toBe(403);
    expect(await httpStatus(createJob(u, body({ text: "a".repeat(1501) }), H))).toBe(400);
  });

  it("webhook: bad signature is rejected, COMPLETED marks done", async () => {
    const u = await createUser();
    const job = await createJob(u, body(), H);
    const url = (sig: string) => `http://localhost:3000/api/webhooks/runpod?job=${job.id}&sig=${sig}`;
    const payload = JSON.stringify(completed(job.id, "rp-1"));
    const bad = await runpodWebhook(new NextRequest(url("00".repeat(32)), { method: "POST", body: payload }));
    expect(bad.status).toBe(401);
    const good = await runpodWebhook(new NextRequest(url(webhookSig(job.id)), { method: "POST", body: payload }));
    expect(good.status).toBe(200);
    const done = await getOwnJob(u.id, job.id);
    expect(done.status).toBe("done");
    expect(done.durationSec).toBe(2.5);
    expect(await fileUrl(done, "mp3", true)).toContain("dl=1");
    expect(await httpStatus(fileUrl(done, "wav", true))).toBe(404);
  });

  it("FAILED result refunds the characters", async () => {
    const u = await createUser();
    const job = await createJob(u, body(), H);
    await finalizeJob(job.id, { id: "rp-1", status: "FAILED", error: "boom" });
    expect((await getOwnJob(u.id, job.id)).status).toBe("failed");
    expect((await getBalances(db(), u.id)).freeRemaining).toBe(3000);
    await finalizeJob(job.id, { id: "rp-1", status: "FAILED", error: "boom" });
    expect((await getBalances(db(), u.id)).freeRemaining).toBe(3000);
  });

  it("incomplete output is treated as a failure", async () => {
    const u = await paidUser();
    const job = await createJob(u, body({ formats: ["mp3", "srt"] }), H);
    await finalizeJob(job.id, completed(job.id, "rp-1", ["mp3"]));
    expect((await getOwnJob(u.id, job.id)).status).toBe("failed");
  });

  it("stale processing job is failed and refunded", async () => {
    const u = await createUser();
    const job = await createJob(u, body(), H);
    await db().update(jobs).set({ dispatchedAt: new Date(Date.now() - 16 * 60_000) }).where(eq(jobs.id, job.id));
    const fresh = await reconcileJob(await getOwnJob(u.id, job.id));
    expect(fresh.status).toBe("failed");
    expect((await getBalances(db(), u.id)).freeRemaining).toBe(3000);
  });

  it("reconcile picks up a completed job when the webhook was missed", async () => {
    const u = await createUser();
    const job = await createJob(u, body(), H);
    await db().update(jobs).set({ dispatchedAt: new Date(Date.now() - 3 * 60_000) }).where(eq(jobs.id, job.id));
    fake.statuses.set("rp-1", completed(job.id, "rp-1"));
    expect((await reconcileJob(await getOwnJob(u.id, job.id))).status).toBe("done");
  });

  it("free job waits while the queue is busy; paid job is dispatched", async () => {
    const others = await Promise.all([createUser(), createUser()]);
    for (const o of others) await createJob(o, body(), H); // 2 processing (FREE_MAX_INFLIGHT=2)
    const free = await createUser();
    const fj = await createJob(free, body(), H);
    expect(fj.status).toBe("queued");
    const paid = await paidUser();
    const pj = await createJob(paid, body({ formats: ["mp3", "wav", "srt"] }), H);
    expect(pj.status).toBe("processing");
    // one slot frees up -> free job goes
    const first = await db().select().from(jobs).where(eq(jobs.userId, others[0].id));
    await finalizeJob(first[0].id, completed(first[0].id, first[0].runpodId!));
    await finalizeJob(pj.id, completed(pj.id, pj.runpodId!, ["mp3", "wav", "srt"]));
    expect((await getOwnJob(free.id, fj.id)).status).toBe("processing");
  });

  it("dispatch failure refunds", async () => {
    fake.fail = true;
    const u = await createUser();
    const job = await createJob(u, body(), H);
    expect(job.status).toBe("failed");
    expect((await getBalances(db(), u.id)).freeRemaining).toBe(3000);
  });

  it("other user's job is 404", async () => {
    const a = await createUser();
    const b = await createUser();
    const job = await createJob(a, body(), H);
    expect(await httpStatus(getOwnJob(b.id, job.id))).toBe(404);
    expect(await httpStatus(getOwnJob(b.id, "not-a-uuid"))).toBe(404);
  });

  it("flagged script is held, then approve dispatches / reject refunds", async () => {
    const u = await createUser();
    const job = await createJob(u, body({ text: "Hello, this is your bank. Please verify your account now." }), H);
    expect(job.status).toBe("held");
    expect(fake.submitted).toHaveLength(0);
    expect(await approveHeld(job.id)).toBe(true);
    expect((await getOwnJob(u.id, job.id)).status).toBe("processing");

    const u2 = await createUser();
    const j2 = await createJob(u2, body({ text: "Pay with gift cards today or you will be arrested." }), H);
    expect(await rejectHeld(j2.id)).toBe(true);
    expect((await getOwnJob(u2.id, j2.id)).status).toBe("rejected");
    expect((await getBalances(db(), u2.id)).freeRemaining).toBe(3000);
  });

  it("rate limits per user", async () => {
    const u = await paidUser();
    let last = 0;
    for (let i = 0; i < 11; i++) {
      last = await httpStatus(createJob(u, body(), H));
      await db().update(jobs).set({ status: "done" });
    }
    expect(last).toBe(429);
    expect(await pumpQueue()).toBe(0);
  });
});
