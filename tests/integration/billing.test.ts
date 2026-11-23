import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, db } from "@/db";
import { getBalances } from "@/lib/quota/ledger";
import { createUser, resetDb } from "../helpers/db";
import { deliver, refundApproved, subscriptionEvent, transactionCompleted } from "../helpers/paddle";

beforeEach(resetDb);
afterAll(closeDb);
const DAY = 86_400_000;

describe("paddle billing", () => {
  it("rejects bad signatures", async () => {
    const res = await deliver(subscriptionEvent("subscription.created", { subId: "sub_x" }), "wrong");
    expect(res.status).toBe(401);
  });

  it("creator subscription gives 100k and the creator tier", async () => {
    const u = await createUser();
    const res = await deliver(subscriptionEvent("subscription.created", { subId: "sub_1", userId: u.id }));
    expect(await res.json()).toMatchObject({ result: "applied" });
    const b = await getBalances(db(), u.id);
    expect(b.subscriptionPlan).toBe("creator");
    expect(b.subscriptionRemaining).toBe(100_000);
  });

  it("duplicate event is no-op", async () => {
    const u = await createUser();
    const evt = transactionCompleted({ txnId: "txn_1", userId: u.id, price: "pri_pack" });
    await deliver(evt);
    const again = await deliver(evt);
    expect(await again.json()).toMatchObject({ result: "duplicate" });
    expect((await getBalances(db(), u.id)).packRemaining).toBe(50_000);
  });

  it("pack quantity 2 grants 100k; refund revokes the unused part", async () => {
    const u = await createUser();
    await deliver(transactionCompleted({ txnId: "txn_2", userId: u.id, price: "pri_pack", quantity: 2, total: "1000" }));
    expect((await getBalances(db(), u.id)).packRemaining).toBe(100_000);
    await deliver(refundApproved("txn_2"));
    expect((await getBalances(db(), u.id)).packRemaining).toBe(0);
  });

  it("older subscription update ignored", async () => {
    const u = await createUser();
    await deliver(subscriptionEvent("subscription.updated", { subId: "sub_2", userId: u.id, price: "pri_pro", occurredAt: new Date() }));
    const old = await deliver(
      subscriptionEvent("subscription.updated", { subId: "sub_2", userId: u.id, price: "pri_creator", occurredAt: new Date(Date.now() - 60_000) }),
    );
    expect(await old.json()).toMatchObject({ result: "stale" });
    expect((await getBalances(db(), u.id)).subscriptionPlan).toBe("pro");
  });

  it("scheduled cancel keeps access until period end, then it lapses", async () => {
    const u = await createUser();
    await deliver(subscriptionEvent("subscription.updated", { subId: "sub_3", userId: u.id, cancel: true }));
    expect((await getBalances(db(), u.id)).subscriptionPlan).toBe("creator");
    await deliver(subscriptionEvent("subscription.canceled", { subId: "sub_3", status: "canceled" }));
    expect((await getBalances(db(), u.id)).subscriptionPlan).toBeNull();
  });

  it("renewal moves the period and resets the allowance", async () => {
    const u = await createUser();
    const now = Date.now();
    await deliver(subscriptionEvent("subscription.created", { subId: "sub_4", userId: u.id, start: new Date(now - 31 * DAY), end: new Date(now - DAY), occurredAt: new Date(now - 31 * DAY) }));
    expect((await getBalances(db(), u.id)).subscriptionPlan).toBeNull();
    await deliver(subscriptionEvent("subscription.updated", { subId: "sub_4", start: new Date(now - DAY), end: new Date(now + 29 * DAY) }));
    expect((await getBalances(db(), u.id)).subscriptionRemaining).toBe(100_000);
  });

  it("events for unknown users are recorded as unmatched", async () => {
    const res = await deliver(subscriptionEvent("subscription.created", { subId: "sub_5", userId: "nope", customerId: "ctm_unknown" }));
    expect(await res.json()).toMatchObject({ result: "unmatched" });
  });
});
