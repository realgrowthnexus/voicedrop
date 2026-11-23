import "server-only";
import { env } from "@/lib/env";

type Cache = { at: number; usd: number | null };
const g = globalThis as unknown as { __vdRunpodSpend?: Cache };
const TTL_MS = 2 * 60 * 1000;

/**
 * Actual billed USD for our serverless endpoint since GPU_BUDGET_SINCE, from RunPod's
 * billing API (second, independent budget guard). Cached for 2 minutes. Returns the last
 * known value (or null) if the API is unavailable — the local estimate still applies.
 */
export async function runpodActualSpendUsd(now = Date.now()): Promise<number | null> {
  const e = env();
  if (e.TTS_BACKEND !== "runpod" || !e.RUNPOD_ENDPOINT_ID || !e.RUNPOD_API_KEY) return null;
  const c = g.__vdRunpodSpend;
  if (c && now - c.at < TTL_MS) return c.usd;
  try {
    const q = new URLSearchParams({ serverlessId: e.RUNPOD_ENDPOINT_ID, bucketSize: "day" });
    if (e.GPU_BUDGET_SINCE) q.set("startTime", e.GPU_BUDGET_SINCE);
    const res = await fetch(`https://api.runpod.io/v2/billing/serverless?${q}`, {
      headers: { authorization: `Bearer ${e.RUNPOD_API_KEY}` },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { metadata?: { totals?: { totalAmount?: number } } };
    const usd = Number(data.metadata?.totals?.totalAmount ?? 0);
    g.__vdRunpodSpend = { at: now, usd: Number.isFinite(usd) ? usd : (c?.usd ?? null) };
  } catch (err) {
    console.error("[budget] RunPod billing check failed", err);
    g.__vdRunpodSpend = { at: now - TTL_MS + 30_000, usd: c?.usd ?? null }; // retry in 30s
  }
  return g.__vdRunpodSpend!.usd;
}
