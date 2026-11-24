import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql as rawSql } from "drizzle-orm";
import { closeDb, db } from "@/db";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { seedAdmin } from "@/lib/bootstrap";
import { resetEnvCache } from "@/lib/env";
import { getUser, isAdminEmail } from "@/lib/session";
import { resetDb } from "../helpers/db";

const BASE = "http://localhost:3000";

async function call(path: string, body: unknown, ip = "203.0.113.20") {
  const res = await (await auth()).handler(
    new Request(`${BASE}/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE, "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }),
  );
  const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ") || null;
  return { res, cookie, json: (await res.json().catch(() => null)) as { code?: string } | null };
}

beforeEach(async () => {
  await resetDb();
  await db().execute(rawSql`delete from rate_limit`);
});
afterAll(async () => {
  delete process.env.ADMIN_PASSWORD;
  resetEnvCache();
  await closeDb();
});

describe("email + password accounts (no email service needed)", () => {
  it("signs up, signs in, and gets a working session", async () => {
    const up = await call("/sign-up/email", { email: "maker@gmail.com", password: "correct horse 1", name: "maker" });
    expect(up.res.status).toBe(200);
    expect(up.cookie).toContain("better-auth.session_token");
    const u = await getUser(new Headers({ cookie: up.cookie! }));
    expect(u?.email).toBe("maker@gmail.com");
    expect(u?.emailVerified).toBe(false);

    const bad = await call("/sign-in/email", { email: "maker@gmail.com", password: "wrong password" });
    expect(bad.res.status).toBe(401);
    const ok = await call("/sign-in/email", { email: "maker@gmail.com", password: "correct horse 1" });
    expect(ok.res.status).toBe(200);
  });

  it("rejects short passwords and disposable inboxes", async () => {
    expect((await call("/sign-up/email", { email: "a@gmail.com", password: "short", name: "a" })).res.status).toBe(400);
    const d = await call("/sign-up/email", { email: "a@mailinator.com", password: "long enough 123", name: "a" });
    expect(d.res.status).toBeGreaterThanOrEqual(400);
  });

  it("applies the per-network sign-up limit to password accounts too", async () => {
    for (let i = 0; i < 3; i++) {
      await db().execute(rawSql`delete from rate_limit`);
      expect((await call("/sign-up/email", { email: `u${i}@gmail.com`, password: "long enough 123", name: "u" }, "198.51.100.9")).res.status).toBe(200);
    }
    await db().execute(rawSql`delete from rate_limit`);
    const fourth = await call("/sign-up/email", { email: "u4@gmail.com", password: "long enough 123", name: "u" }, "198.51.100.9");
    expect(fourth.res.status).toBe(403);
  });
});

describe("owner admin account", () => {
  it("is created verified from ADMIN_PASSWORD, blocks look-alike sign-ups, and follows password changes", async () => {
    process.env.ADMIN_PASSWORD = "owner-password-1";
    resetEnvCache();
    expect(await seedAdmin()).toBe("created");
    const [a] = await db().select().from(user).where(eq(user.email, "admin@example.com"));
    expect(a.emailVerified).toBe(true);
    expect(isAdminEmail(a.email)).toBe(true);

    // Someone else can't claim the admin address.
    const steal = await call("/sign-up/email", { email: "admin@example.com", password: "attacker pass 1", name: "x" });
    expect(steal.res.status).toBe(422);

    expect((await call("/sign-in/email", { email: "admin@example.com", password: "owner-password-1" })).res.status).toBe(200);

    process.env.ADMIN_PASSWORD = "owner-password-2";
    resetEnvCache();
    expect(await seedAdmin()).toBe("updated");
    expect((await call("/sign-in/email", { email: "admin@example.com", password: "owner-password-1" })).res.status).toBe(401);
    expect((await call("/sign-in/email", { email: "admin@example.com", password: "owner-password-2" })).res.status).toBe(200);
  });
});
