import type { Metadata } from "next";
import { BillingPanel } from "@/components/BillingPanel";
import { accountSummary } from "@/lib/account/summary";
import { env } from "@/lib/env";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Plan & billing" };

export default async function BillingPage() {
  const u = await requireUser();
  const summary = await accountSummary(u);
  const e = env();
  return (
    <BillingPanel
      initial={summary}
      hasCustomer={!!u.paddleCustomerId}
      paddle={e.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ? { token: e.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN, environment: e.PADDLE_ENV } : null}
    />
  );
}
