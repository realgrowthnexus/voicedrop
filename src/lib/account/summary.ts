import "server-only";
import { db } from "@/db";
import type { User } from "@/db/schema";
import { FREE_WEEKLY_CHARS, PLAN_ALLOWANCE, TIERS, type TierId } from "@/lib/plans";
import { getBalances } from "@/lib/quota/ledger";
import { resolveTier } from "@/lib/quota/rules";
import { isAdminEmail } from "@/lib/session";

export type AccountSummary = {
  user: { id: string; email: string; name: string; image: string | null; isAdmin: boolean };
  tier: TierId;
  limits: (typeof TIERS)[TierId];
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
  /** Max characters the user could submit right now (0 = blocked). */
  availableNow: number;
};

export async function accountSummary(u: User): Promise<AccountSummary> {
  const b = await getBalances(db(), u.id);
  const tier = resolveTier(b);
  const limits = TIERS[tier];
  const spendable =
    tier === "free" ? b.freeRemaining : tier === "pack" ? b.freeRemaining + b.packRemaining : b.subscriptionRemaining + b.packRemaining;
  const dailyLeft = limits.dailyCap === null ? Infinity : Math.max(0, limits.dailyCap - b.usedLast24h);
  return {
    user: { id: u.id, email: u.email, name: u.name, image: u.image, isAdmin: u.emailVerified && isAdminEmail(u.email) },
    tier,
    limits,
    balances: {
      freeRemaining: b.freeRemaining,
      freeWeekly: FREE_WEEKLY_CHARS,
      subscriptionRemaining: b.subscriptionRemaining,
      subscriptionAllowance: b.subscriptionPlan ? PLAN_ALLOWANCE[b.subscriptionPlan] : 0,
      packRemaining: b.packRemaining,
      usedLast24h: b.usedLast24h,
      dailyCap: limits.dailyCap,
      activeJobs: b.activeJobs,
    },
    plan: b.period ? { plan: b.period.plan, periodEnd: b.period.end.toISOString(), source: b.period.source } : null,
    availableNow: Math.max(0, Math.min(spendable, dailyLeft, limits.maxPerRequest)),
  };
}
