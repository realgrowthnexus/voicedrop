import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { account, user } from "@/db/schema";
import { env } from "@/lib/env";

const g = globalThis as unknown as { __vdBoot?: Promise<void>; __vdBackupTimer?: NodeJS.Timeout };

async function migrateDb() {
  const folder = path.join(process.cwd(), "drizzle");
  if (env().DATABASE_URL) {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(db() as never, { migrationsFolder: folder });
  } else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db() as never, { migrationsFolder: folder });
  }
}

/**
 * The owner's admin account: ADMIN_EMAILS (first address) + ADMIN_PASSWORD. Created or re-synced on every
 * start, marked verified, so nobody else can register that address first and the password in the host's
 * settings is always the one that works.
 */
export async function seedAdmin(): Promise<"none" | "created" | "updated"> {
  const e = env();
  const email = e.ADMIN_EMAILS[0];
  const password = e.ADMIN_PASSWORD;
  if (!email || !password) return "none";
  const hash = await hashPassword(password);
  const [existing] = await db().select().from(user).where(eq(user.email, email));
  const now = new Date();
  if (!existing) {
    const id = randomUUID();
    await db().insert(user).values({ id, name: email.split("@")[0], email, emailVerified: true, createdAt: now, updatedAt: now });
    await db().insert(account).values({ id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: hash, createdAt: now, updatedAt: now });
    return "created";
  }
  await db().update(user).set({ emailVerified: true, banned: false, updatedAt: now }).where(eq(user.id, existing.id));
  const [cred] = await db()
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, existing.id), eq(account.providerId, "credential")));
  if (cred) await db().update(account).set({ password: hash, updatedAt: now }).where(eq(account.id, cred.id));
  else await db().insert(account).values({ id: randomUUID(), accountId: existing.id, providerId: "credential", userId: existing.id, password: hash, createdAt: now, updatedAt: now });
  return "updated";
}

const BACKUP_EVERY_MS = 24 * 60 * 60 * 1000;
const BACKUPS_KEPT = 7;

/** Embedded database only: a daily compressed snapshot in DATA_DIR/backups (last 7 kept). */
export async function backupEmbeddedDb(): Promise<string | null> {
  const e = env();
  if (e.DATABASE_URL) return null;
  const client = (db() as unknown as { $client: { dumpDataDir: (c?: "gzip" | "none") => Promise<Blob> } }).$client;
  const dir = path.join(e.DATA_DIR, "backups");
  await mkdir(dir, { recursive: true });
  const blob = await client.dumpDataDir("gzip");
  const file = path.join(dir, `voicedrop-${new Date().toISOString().replace(/[:.]/g, "-")}.tar.gz`);
  await writeFile(file, Buffer.from(await blob.arrayBuffer()));
  const all = (await readdir(dir)).filter((f) => f.startsWith("voicedrop-") && f.endsWith(".tar.gz")).sort();
  for (const old of all.slice(0, Math.max(0, all.length - BACKUPS_KEPT))) await rm(path.join(dir, old), { force: true });
  return file;
}

async function boot() {
  await migrateDb();
  const admin = await seedAdmin();
  const e = env();
  console.log(`[boot] database ready (${e.DATABASE_URL ? "postgres server" : `embedded at ${e.EMBEDDED_DB_DIR}`}); admin: ${admin}`);
  if (!e.DATABASE_URL && !g.__vdBackupTimer) {
    const run = () => backupEmbeddedDb().then((f) => f && console.log(`[backup] ${f}`)).catch((err) => console.error("[backup] failed", err));
    setTimeout(run, 60_000).unref();
    g.__vdBackupTimer = setInterval(run, BACKUP_EVERY_MS);
    g.__vdBackupTimer.unref();
  }
}

/** Run once per server process (migrations, admin account, backups). */
export function ensureBooted(): Promise<void> {
  if (!g.__vdBoot) g.__vdBoot = boot();
  return g.__vdBoot;
}
