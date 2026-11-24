import "server-only";
import { cfg } from "@/lib/config";
import { env } from "@/lib/env";
import { hmac, safeEqualHex } from "@/lib/sign";
import type { Format } from "@/lib/plans";

export type JobInput = {
  job_id: string;
  text: string;
  voice: string;
  speed: number;
  formats: Format[];
  uploads: Partial<Record<Format, string>>;
};

export type JobOutput = {
  job_id: string;
  duration_sec: number;
  chars: number;
  words: number;
  files: Partial<Record<Format, { bytes: number }>>;
};

export type BackendStatus = "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED" | "TIMED_OUT";
export type StatusResult = {
  id: string;
  status: BackendStatus;
  output?: JobOutput;
  error?: string;
  /** RunPod reports these (ms) on /status and in webhooks. */
  executionTime?: number;
  delayTime?: number;
};

export interface TtsBackend {
  submit(input: JobInput, webhookUrl: string): Promise<{ id: string }>;
  status(id: string): Promise<StatusResult>;
}

export function webhookSig(jobId: string): string {
  return hmac(env().RUNPOD_WEBHOOK_SECRET, `runpod-webhook|${jobId}`);
}

export function verifyWebhookSig(jobId: string, sig: string): boolean {
  return safeEqualHex(sig, webhookSig(jobId));
}

export function webhookUrl(jobId: string): string {
  const q = new URLSearchParams({ job: jobId, sig: webhookSig(jobId) });
  return `${env().APP_URL.replace(/\/$/, "")}/api/webhooks/runpod?${q}`;
}

async function call(url: string, init: RequestInit & { headers?: Record<string, string> }): Promise<unknown> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000), cache: "no-store" });
  if (!res.ok) throw new Error(`TTS backend HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/**
 * RunPod SDK 2 queue functions are called as `fn(**input)`; our worker function is
 * `synthesize(job)`, so the job goes under the `job` key. The local dev server and the
 * Docker handler accept both shapes.
 */
export function runpodPayload(input: JobInput): { job: JobInput } {
  return { job: input };
}

function httpBackend(base: string, token: string | undefined, extra: Record<string, unknown> = {}): TtsBackend {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return {
    async submit(input, webhook) {
      const body = JSON.stringify({ input: runpodPayload(input), webhook, ...extra });
      const r = (await call(`${base}/run`, { method: "POST", headers, body })) as { id?: string };
      if (!r.id) throw new Error("TTS backend returned no job id");
      return { id: r.id };
    },
    async status(id) {
      return (await call(`${base}/status/${encodeURIComponent(id)}`, { method: "GET", headers })) as StatusResult;
    },
  };
}

let override: TtsBackend | null = null;
/** Tests can inject a fake backend. */
export function setTtsBackendForTests(b: TtsBackend | null) {
  override = b;
}

export class TtsNotConfiguredError extends Error {
  constructor() {
    super("Voice generation is not set up yet (Admin → Settings → Voice engine).");
  }
}

export async function ttsBackend(): Promise<TtsBackend> {
  if (override) return override;
  const t = (await cfg()).tts;
  if (t.mode === "local") return httpBackend(t.url, process.env.LOCAL_WORKER_TOKEN);
  if (t.mode === "none") throw new TtsNotConfiguredError();
  return httpBackend(`https://api.runpod.ai/v2/${t.endpointId}`, t.apiKey, {
    policy: { executionTimeout: 10 * 60 * 1000, ttl: 60 * 60 * 1000 },
  });
}
