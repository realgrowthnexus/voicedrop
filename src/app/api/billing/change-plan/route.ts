import { NextResponse, type NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { paddleApi, priceIdFor } from "@/lib/billing/paddle";
import { assertSameOrigin, handle, HttpError } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const Body = z.object({ plan: z.enum(["creator", "pro"]) });

/** Switch Creator <-> Pro on the existing Paddle subscription (prorated immediately). */
export const POST = handle(async (req: NextRequest) => {
  assertSameOrigin(req);
  const u = await requireUser(req.headers);
  if (!(await rateLimit(`change-plan:${u.id}`, 5, 600)).ok) throw new HttpError(429, "rate_limited", "Too many attempts.");
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, "invalid", "Invalid request.");
  const [sub] = await db()
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, u.id), inArray(subscriptions.status, ["active", "trialing", "past_due"])));
  if (!sub) throw new HttpError(404, "no_subscription", "You don't have an active subscription.");
  if (sub.plan === parsed.data.plan) return NextResponse.json({ ok: true, unchanged: true });
  await paddleApi("PATCH", `/subscriptions/${encodeURIComponent(sub.paddleSubscriptionId)}`, {
    items: [{ price_id: priceIdFor(parsed.data.plan), quantity: 1 }],
    proration_billing_mode: "prorated_immediately",
  });
  return NextResponse.json({ ok: true });
});
