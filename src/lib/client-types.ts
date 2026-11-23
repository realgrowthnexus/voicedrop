// Shapes returned by our JSON APIs (kept separate so client code never imports server modules).
export type Format = "mp3" | "wav" | "srt";
export type JobStatus = "held" | "queued" | "processing" | "done" | "failed" | "rejected";

export type PublicJob = {
  id: string;
  status: JobStatus;
  voice: string;
  voiceName: string;
  speed: number;
  chars: number;
  formats: Format[];
  preview: string;
  durationSec: number | null;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
  expiresAt: string;
  expired: boolean;
};

export type Me = {
  user: { id: string; email: string; name: string; image: string | null; isAdmin: boolean };
  tier: "free" | "pack" | "creator" | "pro";
  limits: { maxPerRequest: number; dailyCap: number | null; formats: Format[]; priority: boolean };
  balances: {
    freeRemaining: number;
    freeWeekly: number;
    subscriptionRemaining: number;
    subscriptionAllowance: number;
    packRemaining: number;
    usedLast24h: number;
    dailyCap: number | null;
    activeJobs: number;
  };
  plan: { plan: "creator" | "pro"; periodEnd: string; source: "paddle" | "comp" } | null;
  availableNow: number;
};

export const ACTIVE: JobStatus[] = ["held", "queued", "processing"];

export { countChars } from "@/lib/quota/count";

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string; error?: string };
  if (!res.ok) throw Object.assign(new Error(data.message ?? "Something went wrong. Please try again."), { status: res.status, code: data.error });
  return data;
}
