import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { paddleApi } from "@/lib/billing/paddle";
import { handle, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** One-time link to Paddle's customer portal (invoices, payment method, cancel). */
export const POST = handle(async (req: NextRequest) => {
  const u = await requireUser(req.headers);
  if (!u.paddleCustomerId) throw new HttpError(404, "no_customer", "No billing account yet — buy a plan or pack first.");
  const subs = await db()
    .select({ id: subscriptions.paddleSubscriptionId })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, u.id)));
  const session = await paddleApi<{ urls: { general: { overview: string } } }>("POST", `/customers/${encodeURIComponent(u.paddleCustomerId)}/portal-sessions`, {
    subscription_ids: subs.map((s) => s.id),
  });
  return NextResponse.json({ url: session.urls.general.overview });
});
