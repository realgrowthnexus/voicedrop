import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, db } from "@/db";
import { adminActions, appEvents, session, user } from "@/db/schema";
import { adjustCredits, banUser, getStats, moderate, setCompPlan, unbanUser } from "@/lib/admin/ops";
import { createJob } from "@/lib/jobs/service";
import { getBalances } from "@/lib/quota/ledger";
import { setTtsBackendForTests } from "@/lib/tts";
import { createUser, resetDb } from "../helpers/db";

beforeEach(async () => {
  await resetDb();
  setTtsBackendForTests({ submit: async () => ({ id: "rp" }), status: async (id) => ({ id, status: "IN_PROGRESS" }) });
});
afterEach(() => setTtsBackendForTests(null));
afterAll(closeDb);

describe("admin ops", () => {
  it("ban revokes sessions, rejects held jobs with refund, and is logged", async () => {
    const admin = await createUser({ email: "admin@example.com" });
    const u = await createUser();
    await db().insert(session).values({ id: "s1", token: "t1", userId: u.id, expiresAt: new Date(Date.now() + 86_400_000) });
    const held = await createJob(u, { text: "This is your bank, verify your account.", voice: "af_heart", formats: ["mp3"] }, new Headers());
    expect(held.status).toBe("held");
    await banUser(admin, u.id, "scam");
    const [row] = await db().select().from(user).where(eq(user.id, u.id));
    expect(row.banned).toBe(true);
    expect(await db().select().from(session).where(eq(session.userId, u.id))).toHaveLength(0);
    expect((await getBalances(db(), u.id)).freeRemaining).toBe(3000);
    await unbanUser(admin, u.id);
    expect((await db().select().from(user).where(eq(user.id, u.id)))[0].banned).toBe(false);
    expect((await db().select().from(adminActions)).map((a) => a.action).sort()).toEqual(["ban", "unban"]);
  });

  it("admin cannot ban themselves", async () => {
    const admin = await createUser();
    await expect(banUser(admin, admin.id, "x")).rejects.toThrow();
  });

  it("credits and comp plans change the user's balance", async () => {
    const admin = await createUser();
    const u = await createUser();
    await adjustCredits(admin, u.id, 20_000, "promo");
    expect((await getBalances(db(), u.id)).packRemaining).toBe(20_000);
    await setCompPlan(admin, u.id, "pro", 30);
    expect((await getBalances(db(), u.id)).subscriptionPlan).toBe("pro");
    await setCompPlan(admin, u.id, null, 1);
    expect((await getBalances(db(), u.id)).subscriptionPlan).toBeNull();
  });

  it("moderation approve dispatches", async () => {
    const admin = await createUser();
    const u = await createUser();
    const held = await createJob(u, { text: "Pay with gift cards now.", voice: "af_heart", formats: ["mp3"] }, new Headers());
    expect(await moderate(admin, held.id, "approve")).toBe(true);
    expect(await moderate(admin, held.id, "approve")).toBe(false);
  });

  it("stats count users, jobs, funnel", async () => {
    const u = await createUser();
    await db().insert(appEvents).values([{ userId: u.id, name: "signup" }, { userId: u.id, name: "purchase" }]);
    await createJob(u, { text: "Hello world.", voice: "af_heart", formats: ["mp3"] }, new Headers());
    const s = await getStats();
    expect(s.users).toBe(1);
    expect(s.queue.processing).toBe(1);
    expect(s.funnel30d).toMatchObject({ signedUp: 1, paid: 1 });
  });
});
