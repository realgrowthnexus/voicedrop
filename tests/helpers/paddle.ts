import { createHmac, randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/webhooks/paddle/route";

export const SECRET = "pdl_ntfset_test_secret";

export function subscriptionEvent(type: string, o: { subId: string; userId?: string; customerId?: string; price?: string; status?: string; occurredAt?: Date; start?: Date; end?: Date; cancel?: boolean }) {
  const start = o.start ?? new Date(Date.now() - 86_400_000);
  const end = o.end ?? new Date(Date.now() + 29 * 86_400_000);
  return {
    event_id: `evt_${randomUUID()}`,
    event_type: type,
    occurred_at: (o.occurredAt ?? new Date()).toISOString(),
    notification_id: `ntf_${randomUUID()}`,
    data: {
      id: o.subId,
      status: o.status ?? "active",
      customer_id: o.customerId ?? "ctm_1",
      custom_data: o.userId ? { userId: o.userId } : null,
      current_billing_period: { starts_at: start.toISOString(), ends_at: end.toISOString() },
      scheduled_change: o.cancel ? { action: "cancel", effective_at: end.toISOString() } : null,
      items: [{ price: { id: o.price ?? "pri_creator" }, quantity: 1 }],
    },
  };
}

export function transactionCompleted(o: { txnId: string; userId: string; price: string; quantity?: number; subId?: string; total?: string }) {
  return {
    event_id: `evt_${randomUUID()}`,
    event_type: "transaction.completed",
    occurred_at: new Date().toISOString(),
    data: {
      id: o.txnId,
      status: "completed",
      customer_id: "ctm_1",
      subscription_id: o.subId ?? null,
      custom_data: { userId: o.userId },
      currency_code: "USD",
      items: [{ price_id: o.price, price: { id: o.price }, quantity: o.quantity ?? 1 }],
      details: { totals: { grand_total: o.total ?? "500" } },
    },
  };
}

export function refundApproved(txnId: string) {
  return {
    event_id: `evt_${randomUUID()}`,
    event_type: "adjustment.updated",
    occurred_at: new Date().toISOString(),
    data: { id: `adj_${randomUUID()}`, action: "refund", status: "approved", transaction_id: txnId, customer_id: "ctm_1" },
  };
}

export async function deliver(evt: object, secret = SECRET) {
  const raw = JSON.stringify(evt);
  const ts = Math.floor(Date.now() / 1000);
  const h1 = createHmac("sha256", secret).update(`${ts}:${raw}`).digest("hex");
  return POST(new NextRequest("http://localhost:3000/api/webhooks/paddle", { method: "POST", body: raw, headers: { "paddle-signature": `ts=${ts};h1=${h1}` } }));
}
