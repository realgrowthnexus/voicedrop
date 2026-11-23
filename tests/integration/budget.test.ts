import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, db } from "@/db";
import { jobs } from "@/db/schema";
import { resetEnvCache } from "@/lib/env";
import { HttpError } from "@/lib/http";
import { budgetState } from "@/lib/jobs/budget";
import { createJob, finalizeJob } from "@/lib/jobs/service";
import { getBalances } from "@/lib/quota/ledger";
import { setTtsBackendForTests, type JobInput } from "@/lib/tts";
import { createUser, resetDb } from "../helpers/db";

const saved = { ...process.env };
function runpodEnv(over: Record<string, string>) {
  Object.assign(process.env, { TTS_BACKEND: "runpod", RUNPOD_API_KEY: "test", RUNPOD_ENDPOINT_ID: "ep", GPU_PRICE_PER_SEC: "0.0005", GPU_IDLE_TIMEOUT_SEC: "5", ...over });
  resetEnvCache();
}
const body = { text: "Hello there, this is a short budget test.", voice: "af_heart", formats: ["mp3"] };
let submitted: JobInput[] = [];

beforeEach(async () => {
  await resetDb();
  submitted = [];
  setTtsBackendForTests({ submit: async (i) => (submitted.push(i), { id: `rp-${submitted.length}` }), status: async (id) => ({ id, status: "IN_PROGRESS" }) });
});
afterEach(() => {
  setTtsBackendForTests(null);
  process.env = { ...saved };
  resetEnvCache();
});
afterAll(closeDb);

describe("GPU budget guard", () => {
  it("records the billed GPU time and cost of a finished job", async () => {
    runpodEnv({ GPU_BUDGET_USD: "25" });
    const u = await createUser();
    const j = await createJob(u, body, new Headers());
    await finalizeJob(j.id, { id: "rp-1", status: "COMPLETED", executionTime: 2000, delayTime: 1000, output: { job_id: j.id, duration_sec: 2, chars: 40, words: 8, files: { mp3: { bytes: 10 } } } });
    const [row] = await db().select().from(jobs).where(eq(jobs.id, j.id));
    expect(row.gpuMs).toBe(2000 + 1000 + 5000);
    expect(row.gpuCostMicros).toBe(4000); // 8 s * $0.0005
    expect((await budgetState()).spentUsd).toBeCloseTo(0.004);
  });

  it("refuses new jobs (without charging) once the budget is used up", async () => {
    runpodEnv({ GPU_BUDGET_USD: "0.02" }); // stop at $0.019
    const u = await createUser();
    const first = await createJob(u, body, new Headers()); // est ~ $0.015
    expect(first.status).toBe("processing");
    await finalizeJob(first.id, { id: "rp-1", status: "FAILED", executionTime: 20_000, delayTime: 0 }); // $0.0125 spent
    const before = await getBalances(db(), u.id);
    const err = await createJob(u, body, new Headers()).catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(503);
    expect(await getBalances(db(), u.id)).toEqual(before);
    expect(submitted).toHaveLength(1);
  });

  it("counts in-flight jobs so parallel users cannot overshoot", async () => {
    runpodEnv({ GPU_BUDGET_USD: "0.02" });
    const a = await createUser();
    const b = await createUser();
    expect((await createJob(a, body, new Headers())).status).toBe("processing");
    const err = await createJob(b, body, new Headers()).catch((e) => e);
    expect((err as HttpError).status).toBe(503);
  });

  it("is off for the local backend", async () => {
    const u = await createUser();
    expect((await createJob(u, body, new Headers())).status).toBe("processing");
    expect((await budgetState()).active).toBe(false);
  });
});
