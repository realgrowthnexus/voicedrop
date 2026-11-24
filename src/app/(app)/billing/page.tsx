import type { Metadata } from "next";
import { BillingPanel } from "@/components/BillingPanel";
import { accountSummary } from "@/lib/account/summary";
import { cfg } from "@/lib/config";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Plan & billing" };

export default async function BillingPage() {
  const u = await requireUser();
  const summary = await accountSummary(u);
  const p = (await cfg()).paddle;
  return (
    <BillingPanel
      initial={summary}
      hasCustomer={!!u.paddleCustomerId}
      paddle={p.clientToken && p.apiKey ? { token: p.clientToken, environment: p.env } : null}
    />
  );
}
