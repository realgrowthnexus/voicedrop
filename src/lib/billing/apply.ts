import "server-only";
import { eq } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { paddleEvents, subscriptions, transactions, user } from "@/db/schema";
import { track } from "@/lib/events";
import { PACK_CHARS } from "@/lib/plans";
import { grantPack, revokePack } from "@/lib/quota/ledger";
import { isPackPrice, planForPrice, prices, type Prices } from "./paddle";

/* Minimal shapes of the Paddle Billing v2 payloads we use (snake_case, as sent). */
type CustomData = { userId?: unknown } | null | undefined;
type SubscriptionData = {
  id: string;
  status: string;
  customer_id: string;
  custom_data?: CustomData;
  current_billing_period?: { starts_at: string; ends_at: string } | null;
  scheduled_change?: { action: string; effective_at: string } | null;
  items: { price?: { id: string } | null; quantity: number }[];
};
type TransactionData = {
  id: string;
  status: string;
  customer_id?: string | null;
  subscription_id?: string | null;
  custom_data?: CustomData;
  currency_code: string;
  items: { price_id?: string | null; price?: { id: string } | null; quantity: number }[];
  details?: { totals?: { grand_total?: string; total?: string } | null } | null;
};
type AdjustmentData = { id: string; action: string; status: string; transaction_id: string; customer_id: string };

export type PaddleEvent = { event_id: string; event_type: string; occurred_at: string; data: unknown };
export type ApplyResult = "applied" | "duplicate" | "stale" | "ignored" | "unmatched";

async function resolveUserId(tx: Tx, custom: CustomData, customerId?: string | null, subscriptionId?: string | null): Promise<string | null> {
  const fromCustom = typeof custom?.userId === "string" ? custom.userId : null;
  if (fromCustom) {
    const [u] = await tx.select({ id: user.id }).from(user).where(eq(user.id, fromCustom));
    if (u) return u.id;
  }
  if (subscriptionId) {
    const [s] = await tx.select({ userId: subscriptions.userId }).from(subscriptions).where(eq(subscriptions.paddleSubscriptionId, subscriptionId));
    if (s) return s.userId;
  }
  if (customerId) {
    const [u] = await tx.select({ id: user.id }).from(user).where(eq(user.paddleCustomerId, customerId));
    if (u) return u.id;
  }
  return null;
}

async function linkCustomer(tx: Tx, userId: string, customerId?: string | null) {
  if (customerId) await tx.update(user).set({ paddleCustomerId: customerId }).where(eq(user.id, userId));
}

async function applySubscription(tx: Tx, evt: PaddleEvent, pr: Prices): Promise<ApplyResult> {
  const d = evt.data as SubscriptionData;
  const occurred = new Date(evt.occurred_at);
  const [existing] = await tx.select().from(subscriptions).where(eq(subscriptions.paddleSubscriptionId, d.id));
  if (existing && existing.lastEventAt > occurred) return "stale";

  const userId = existing?.userId ?? (await resolveUserId(tx, d.custom_data, d.customer_id, d.id));
  if (!userId) return "unmatched";
  const plan = d.items.map((i) => planForPrice(i.price?.id, pr)).find(Boolean) ?? (existing?.plan as "creator" | "pro" | undefined);
  if (!plan) return "ignored";

  const values = {
    userId,
    paddleSubscriptionId: d.id,
    paddleCustomerId: d.customer_id,
    plan,
    status: d.status,
    periodStart: d.current_billing_period ? new Date(d.current_billing_period.starts_at) : (existing?.periodStart ?? null),
    periodEnd: d.current_billing_period ? new Date(d.current_billing_period.ends_at) : (existing?.periodEnd ?? null),
    cancelAtPeriodEnd: d.scheduled_change?.action === "cancel",
    lastEventAt: occurred,
    updatedAt: new Date(),
  };
  await tx.insert(subscriptions).values(values).onConflictDoUpdate({ target: subscriptions.paddleSubscriptionId, set: values });
  await linkCustomer(tx, userId, d.customer_id);
  if (evt.event_type === "subscription.created") await track(userId, "subscription_started", { plan }, tx);
  return "applied";
}

async function applyTransactionCompleted(tx: Tx, evt: PaddleEvent, pr: Prices): Promise<ApplyResult> {
  const d = evt.data as TransactionData;
  const userId = await resolveUserId(tx, d.custom_data, d.customer_id, d.subscription_id);
  if (!userId) return "unmatched";
  const packQty = d.items.filter((i) => isPackPrice(i.price_id ?? i.price?.id, pr)).reduce((n, i) => n + (i.quantity || 0), 0);
  const total = Number.parseInt(d.details?.totals?.grand_total ?? d.details?.totals?.total ?? "0", 10) || 0;
  await tx
    .insert(transactions)
    .values({
      paddleTransactionId: d.id,
      userId,
      kind: d.subscription_id ? "subscription" : "pack",
      amountCents: total,
      currency: d.currency_code,
      status: "completed",
      packQuantity: packQty,
    })
    .onConflictDoNothing();
  if (packQty > 0) await grantPack(tx, userId, d.id, PACK_CHARS * packQty);
  await linkCustomer(tx, userId, d.customer_id);
  await track(userId, "purchase", { kind: d.subscription_id ? "subscription" : "pack", amountCents: total, currency: d.currency_code }, tx);
  return "applied";
}

async function applyAdjustment(tx: Tx, evt: PaddleEvent): Promise<ApplyResult> {
  const d = evt.data as AdjustmentData;
  if (d.action !== "refund" || d.status !== "approved") return "ignored";
  const [t] = await tx.select().from(transactions).where(eq(transactions.paddleTransactionId, d.transaction_id));
  if (!t || !t.userId) return "unmatched";
  await tx.update(transactions).set({ status: "refunded" }).where(eq(transactions.paddleTransactionId, t.paddleTransactionId));
  if (t.packQuantity > 0) await revokePack(tx, t.userId, t.paddleTransactionId, PACK_CHARS * t.packQuantity);
  return "applied";
}

/** Apply one verified Paddle event exactly once. */
export async function applyPaddleEvent(evt: PaddleEvent): Promise<ApplyResult> {
  // Read settings BEFORE the transaction: the embedded database runs one transaction at a time,
  // so any query outside `tx` while it is open would wait forever.
  const pr = await prices();
  return db().transaction(async (tx) => {
    const inserted = await tx
      .insert(paddleEvents)
      .values({ eventId: evt.event_id, type: evt.event_type, occurredAt: new Date(evt.occurred_at), payload: evt as unknown as object })
      .onConflictDoNothing()
      .returning({ id: paddleEvents.eventId });
    if (!inserted.length) return "duplicate";

    if (evt.event_type.startsWith("subscription.")) return applySubscription(tx, evt, pr);
    if (evt.event_type === "transaction.completed") return applyTransactionCompleted(tx, evt, pr);
    if (evt.event_type === "adjustment.created" || evt.event_type === "adjustment.updated") return applyAdjustment(tx, evt);
    return "ignored";
  });
}
