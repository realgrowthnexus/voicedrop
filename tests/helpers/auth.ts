import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { appEvents } from "@/db/schema";
import { auth } from "@/lib/auth";

const BASE = "http://localhost:3000";

export async function requestMagicLink(email: string, ip = "203.0.113.7") {
  return auth().handler(
    new Request(`${BASE}/api/auth/sign-in/magic-link`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE, "x-forwarded-for": ip },
      body: JSON.stringify({ email, callbackURL: "/dashboard" }),
    }),
  );
}

async function lastLinkFor(email: string): Promise<string> {
  const [ev] = await db()
    .select()
    .from(appEvents)
    .where(and(eq(appEvents.name, "dev_email")))
    .orderBy(desc(appEvents.createdAt))
    .limit(20);
  const rows = await db().select().from(appEvents).where(eq(appEvents.name, "dev_email")).orderBy(desc(appEvents.createdAt));
  const hit = rows.find((r) => (r.props as { to: string }).to === email) ?? ev;
  return (hit.props as { url: string }).url;
}

/** Full magic-link sign-in; returns the verify response and the session cookie header. */
export async function signIn(email: string, ip = "203.0.113.7") {
  const r = await requestMagicLink(email, ip);
  if (r.status !== 200) return { status: r.status, cookie: null as string | null, res: r };
  const url = await lastLinkFor(email);
  const res = await auth().handler(new Request(url, { headers: { "x-forwarded-for": ip } }));
  const setCookies = res.headers.getSetCookie();
  const cookie = setCookies.map((c) => c.split(";")[0]).join("; ") || null;
  return { status: res.status, cookie, res };
}
