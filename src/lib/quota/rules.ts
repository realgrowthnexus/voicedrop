import { TIERS, type Bucket, type Format, type PaidPlan, type TierId } from "@/lib/plans";

export type Balances = {
  freeRemaining: number;
  subscriptionRemaining: number;
  packRemaining: number;
  /** Characters charged in the rolling last 24h (all buckets, net of refunds). */
  usedLast24h: number;
  activeJobs: number;
  subscriptionPlan: PaidPlan | null;
};

export type Charge = { bucket: Bucket; amount: number };

export type SubmitErrorCode =
  | "banned"
  | "empty"
  | "too_long"
  | "format_not_allowed"
  | "job_active"
  | "daily_cap"
  | "insufficient";

export type SubmitDecision = { ok: true; tier: TierId; charges: Charge[] } | { ok: false; code: SubmitErrorCode };

export function resolveTier(b: Balances): TierId {
  if (b.subscriptionPlan) return b.subscriptionPlan;
  if (b.packRemaining > 0) return "pack";
  return "free";
}

/** Which buckets a tier may spend, in order. */
const SPEND_ORDER: Record<TierId, Bucket[]> = {
  free: ["free"],
  pack: ["free", "pack"],
  creator: ["subscription", "pack"],
  pro: ["subscription", "pack"],
};

function available(b: Balances, bucket: Bucket): number {
  const v = bucket === "free" ? b.freeRemaining : bucket === "subscription" ? b.subscriptionRemaining : b.packRemaining;
  return Math.max(0, v);
}

export function checkSubmit(input: { chars: number; formats: Format[]; banned: boolean }, b: Balances): SubmitDecision {
  if (input.banned) return { ok: false, code: "banned" };
  if (input.chars <= 0) return { ok: false, code: "empty" };

  const tier = resolveTier(b);
  const limits = TIERS[tier];
  if (input.chars > limits.maxPerRequest) return { ok: false, code: "too_long" };
  if (input.formats.some((f) => !limits.formats.includes(f))) return { ok: false, code: "format_not_allowed" };
  if (b.activeJobs > 0) return { ok: false, code: "job_active" };
  if (limits.dailyCap !== null && b.usedLast24h + input.chars > limits.dailyCap) return { ok: false, code: "daily_cap" };

  let left = input.chars;
  const charges: Charge[] = [];
  for (const bucket of SPEND_ORDER[tier]) {
    if (left === 0) break;
    const take = Math.min(left, available(b, bucket));
    if (take > 0) {
      charges.push({ bucket, amount: take });
      left -= take;
    }
  }
  if (left > 0) return { ok: false, code: "insufficient" };
  return { ok: true, tier, charges };
}

export const SUBMIT_ERROR_MESSAGES: Record<SubmitErrorCode, string> = {
  banned: "Your account is suspended. Contact support if you think this is a mistake.",
  empty: "Please paste a script first.",
  too_long: "This script is longer than your plan allows in one go. Split it or upgrade.",
  format_not_allowed: "WAV and SRT downloads are available on paid plans and credit packs.",
  job_active: "You already have a voice-over in progress. Please wait for it to finish.",
  daily_cap: "You've reached today's fair-use limit. It resets on a rolling 24-hour basis.",
  insufficient: "You don't have enough characters left. Upgrade or buy a credit pack to continue.",
};
