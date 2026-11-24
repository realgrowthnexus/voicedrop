import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { paddleApi, priceIdFor, prices } from "@/lib/billing/paddle";
import { track } from "@/lib/events";
import { assertSameOrigin, handle, HttpError } from "@/lib/http";
import { getActivePlan } from "@/lib/quota/ledger";
import { rateLimit } from "@/lib/ratelimit";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const Body = z.object({ product: z.enum(["creator", "pro", "pack"]), quantity: z.number().int().min(1).max(10).default(1) });

/** Creates the Paddle transaction server-side (price + userId can't be tampered with) and returns its id for Paddle.js. */
export const POST = handle(async (req: NextRequest) => {
  assertSameOrigin(req);
  const u = await requireUser(req.headers);
  if (!(await rateLimit(`checkout:${u.id}`, 10, 300)).ok) throw new HttpError(429, "rate_limited", "Too many attempts. Please wait a few minutes.");
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, "invalid", "Invalid request.");
  const { product, quantity } = parsed.data;

  if (product !== "pack") {
    const active = await getActivePlan(db(), u.id, new Date());
    if (active?.source === "paddle") throw new HttpError(409, "already_subscribed", "You already have a plan. Use “Change plan” on the billing page.");
  }

  const txn = await paddleApi<{ id: string }>("POST", "/transactions", {
    items: [{ price_id: priceIdFor(product, await prices()), quantity: product === "pack" ? quantity : 1 }],
    custom_data: { userId: u.id },
    ...(u.paddleCustomerId ? { customer_id: u.paddleCustomerId } : {}),
  });
  await track(u.id, "checkout_opened", { product, quantity });
  return NextResponse.json({ transactionId: txn.id, email: u.paddleCustomerId ? null : u.email });
});
