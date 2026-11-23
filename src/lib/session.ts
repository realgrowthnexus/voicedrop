import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { user, type User } from "@/db/schema";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http";

/** Current user or null. Always reads the user row (so bans apply immediately). */
export async function getUser(reqHeaders?: Headers): Promise<User | null> {
  const h = reqHeaders ?? (await headers());
  const s = await auth().api.getSession({ headers: h });
  if (!s) return null;
  const [u] = await db().select().from(user).where(eq(user.id, s.user.id));
  return u ?? null;
}

export async function requireUser(reqHeaders?: Headers): Promise<User> {
  const u = await getUser(reqHeaders);
  if (!u) throw new HttpError(401, "unauthorized", "Please sign in.");
  if (u.banned) throw new HttpError(403, "banned", "This account is suspended.");
  return u;
}

export function isAdminEmail(email: string): boolean {
  return env().ADMIN_EMAILS.includes(email.toLowerCase());
}

export async function requireAdmin(reqHeaders?: Headers): Promise<User> {
  const u = await requireUser(reqHeaders);
  if (!u.emailVerified || !isAdminEmail(u.email)) throw new HttpError(403, "forbidden", "Admins only.");
  return u;
}

/**
 * For admin pages: 404 unless the viewer is an admin. Call it in EVERY admin page,
 * not only the layout — layouts are not re-rendered on client navigation.
 */
export async function requireAdminPage(): Promise<User> {
  const u = await getUser();
  if (!u || u.banned || !u.emailVerified || !isAdminEmail(u.email)) notFound();
  return u;
}
