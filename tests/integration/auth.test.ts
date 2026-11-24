import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, db } from "@/db";
import { user } from "@/db/schema";
import { isDisposableEmail } from "@/lib/abuse/disposable";
import { requireAdmin, requireUser } from "@/lib/session";
import { HttpError } from "@/lib/http";
import { resetDb } from "../helpers/db";
import { signIn } from "../helpers/auth";

beforeEach(resetDb);
afterAll(closeDb);

const status = async (p: Promise<unknown>) => {
  try {
    await p;
    return 200;
  } catch (e) {
    return e instanceof HttpError ? e.status : 500;
  }
};

describe("auth", () => {
  it("detects disposable domains incl. subdomains", () => {
    expect(isDisposableEmail("a@mailinator.com")).toBe(true);
    expect(isDisposableEmail("a@x.mailinator.com")).toBe(true);
    expect(isDisposableEmail("a@gmail.com")).toBe(false);
  });

  it("magic link creates a user and a working session", async () => {
    const r = await signIn("creator@gmail.com");
    expect(r.status).toBe(302);
    expect(r.res.headers.get("location")).toContain("/dashboard");
    expect(r.cookie).toContain("better-auth.session_token");
    const u = await requireUser(new Headers({ cookie: r.cookie! }));
    expect(u.email).toBe("creator@gmail.com");
    expect(u.signupIpHash).toMatch(/^[0-9a-f]{32}$/);
  });

  it("rejects disposable email signups", async () => {
    const r = await signIn("spam@mailinator.com");
    const [u] = await db().select().from(user).where(eq(user.email, "spam@mailinator.com"));
    expect(u).toBeUndefined();
    expect(r.cookie ?? "").not.toContain("session_token");
  });

  it("allows at most 3 new accounts per IP", async () => {
    for (const n of [1, 2, 3]) expect((await signIn(`u${n}@gmail.com`, "198.51.100.9")).cookie).toContain("session_token");
    const fourth = await signIn("u4@gmail.com", "198.51.100.9");
    expect(fourth.cookie ?? "").not.toContain("session_token");
    const other = await signIn("u5@gmail.com", "198.51.100.10");
    expect(other.cookie).toContain("session_token");
  });

  it("signups without a client IP are not blocked by the per-IP limit", async () => {
    const { auth } = await import("@/lib/auth");
    const { sql: rawSql } = await import("drizzle-orm");
    for (const n of [1, 2, 3, 4]) {
      const email = `noip${n}@gmail.com`;
      await db().execute(rawSql`delete from rate_limit`); // isolate from Better Auth's own per-IP limiter
      await (await auth()).handler(
        new Request("http://localhost:3000/api/auth/sign-in/magic-link", {
          method: "POST",
          headers: { "content-type": "application/json", origin: "http://localhost:3000", "x-forwarded-for": `203.0.113.${n}` },
          body: JSON.stringify({ email, callbackURL: "/dashboard" }),
        }),
      );
      const { db: d } = await import("@/db");
      const { appEvents } = await import("@/db/schema");
      const { desc, eq } = await import("drizzle-orm");
      const [ev] = await d().select().from(appEvents).where(eq(appEvents.name, "dev_email")).orderBy(desc(appEvents.createdAt)).limit(1);
      const res = await (await auth()).handler(new Request((ev.props as { url: string }).url)); // no IP header at all
      expect(res.headers.getSetCookie().join(";")).toContain("session_token");
    }
  });

  it("banned user is rejected even with a live session, and cannot sign in again", async () => {
    const r = await signIn("bad@gmail.com");
    await db().update(user).set({ banned: true }).where(eq(user.email, "bad@gmail.com"));
    expect(await status(requireUser(new Headers({ cookie: r.cookie! })))).toBe(403);
    const again = await signIn("bad@gmail.com", "192.0.2.1");
    expect(again.cookie ?? "").not.toContain("session_token");
  });

  it("anonymous is 401 and non-admin is 403", async () => {
    expect(await status(requireUser(new Headers()))).toBe(401);
    const r = await signIn("someone@gmail.com");
    expect(await status(requireAdmin(new Headers({ cookie: r.cookie! })))).toBe(403);
    const a = await signIn("admin@example.com", "192.0.2.50");
    expect(await status(requireAdmin(new Headers({ cookie: a.cookie! })))).toBe(200);
  });
});
