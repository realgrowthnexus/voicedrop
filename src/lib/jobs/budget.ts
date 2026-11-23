import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { env } from "@/lib/env";
import { runpodActualSpendUsd } from "./runpod-billing";

/** New jobs stop once committed + in-flight spend would pass this share of the budget. */
export const BUDGET_STOP_RATIO = 0.95;
/** Conservative GPU seconds per 1,000 characters (Kokoro on a GPU is ~50x real time; 1k chars ≈ 1 min audio). */
export const EST_GPU_SEC_PER_1K_CHARS = 3;
/** Conservative per-job overhead: possible cold start + model load + idle tail. */
export const EST_GPU_OVERHEAD_SEC = 30;

export function budgetActive(): boolean {
  const e = env();
  return e.TTS_BACKEND === "runpod" && e.GPU_BUDGET_USD > 0;
}

/** Upper-bound cost estimate (micro-USD) for a job that has not finished yet. */
export function estimateJobCostMicros(chars: number): number {
  const sec = (chars / 1000) * EST_GPU_SEC_PER_1K_CHARS + EST_GPU_OVERHEAD_SEC;
  return Math.ceil(sec * env().GPU_PRICE_PER_SEC * 1e6);
}

/**
 * Billed time we attribute to a finished job. RunPod bills a worker from start to stop, so we
 * count execution + queue/cold-start delay + the idle tail. This over-counts when jobs share a
 * warm worker, which keeps the budget on the safe side.
 */
export function actualJobCost(executionMs: number | undefined, delayMs: number | undefined, chars: number): { gpuMs: number; micros: number } {
  if (typeof executionMs !== "number" || !Number.isFinite(executionMs)) {
    const micros = estimateJobCostMicros(chars);
    return { gpuMs: Math.ceil((micros / 1e6 / Math.max(env().GPU_PRICE_PER_SEC, 1e-9)) * 1000), micros };
  }
  const gpuMs = Math.max(0, Math.round(executionMs)) + Math.max(0, Math.round(delayMs ?? 0)) + env().GPU_IDLE_TIMEOUT_SEC * 1000;
  return { gpuMs, micros: Math.ceil((gpuMs / 1000) * env().GPU_PRICE_PER_SEC * 1e6) };
}

export type BudgetState = {
  budgetUsd: number;
  /** max(our estimate, RunPod's billed amount) — whichever is higher. */
  spentUsd: number;
  estimatedUsd: number;
  billedUsd: number | null;
  inflightUsd: number;
  stopAtUsd: number;
  active: boolean;
};

export async function budgetState(): Promise<BudgetState> {
  const billed = budgetActive() ? await runpodActualSpendUsd() : null;
  const [row] = await db()
    .select({
      spent: sql<number>`coalesce(sum(${jobs.gpuCostMicros}), 0)::bigint`,
      inflightChars: sql<number>`coalesce(sum(case when ${jobs.status} = 'processing' then ${jobs.chars} end), 0)::int`,
      inflightJobs: sql<number>`count(*) filter (where ${jobs.status} = 'processing')::int`,
    })
    .from(jobs);
  const e = env();
  const inflightSec = (Number(row?.inflightChars ?? 0) / 1000) * EST_GPU_SEC_PER_1K_CHARS + Number(row?.inflightJobs ?? 0) * EST_GPU_OVERHEAD_SEC;
  const inflight = inflightSec * e.GPU_PRICE_PER_SEC * 1e6;
  return {
    budgetUsd: e.GPU_BUDGET_USD,
    spentUsd: Math.max(Number(row?.spent ?? 0) / 1e6, billed ?? 0),
    estimatedUsd: Number(row?.spent ?? 0) / 1e6,
    billedUsd: billed,
    inflightUsd: inflight / 1e6,
    stopAtUsd: e.GPU_BUDGET_USD * BUDGET_STOP_RATIO,
    active: budgetActive(),
  };
}

/**
 * True if a job of `chars` characters fits in the remaining GPU budget.
 * Pass `alreadyInFlight` when the job is itself counted as processing (at dispatch time).
 */
export async function budgetAllows(chars: number, alreadyInFlight = false): Promise<boolean> {
  if (!budgetActive()) return true;
  const s = await budgetState();
  const extra = alreadyInFlight ? 0 : estimateJobCostMicros(chars) / 1e6;
  return s.spentUsd + s.inflightUsd + extra <= s.stopAtUsd;
}

export async function recordJobCost(jobId: string, gpuMs: number, micros: number): Promise<void> {
  await db().update(jobs).set({ gpuMs, gpuCostMicros: micros }).where(eq(jobs.id, jobId));
}
