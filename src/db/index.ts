import "server-only";
import { mkdirSync } from "node:fs";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "@/lib/env";

type Schema = typeof schema;
export type DB = PgDatabase<PgQueryResultHKT, Schema>;
export type Tx = PgTransaction<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;
export type Executor = DB | Tx;

type Closer = () => Promise<void>;
const g = globalThis as unknown as { __vdDb?: DB; __vdClose?: Closer };

/**
 * Two modes:
 * - DATABASE_URL set → a normal Postgres server (local dev, tests, Neon/Supabase).
 * - no DATABASE_URL  → embedded Postgres (PGlite) stored on this server's disk (Hostinger, zero setup).
 *   Embedded mode must run in ONE Node process; `next start` does.
 */
function create(): DB {
  const e = env();
  if (e.DATABASE_URL) {
    const url = e.DATABASE_URL;
    const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    const client = postgres(url, {
      max: Number(process.env.DB_POOL_MAX ?? 5),
      idle_timeout: 20,
      connect_timeout: 15,
      ssl: isLocal ? false : "require",
      prepare: false,
    });
    g.__vdClose = () => client.end({ timeout: 5 });
    return drizzlePg(client, { schema }) as unknown as DB;
  }
  // Loaded lazily so Postgres-server deployments never load the WASM build.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
  mkdirSync(e.EMBEDDED_DB_DIR, { recursive: true });
  const client = new PGlite(e.EMBEDDED_DB_DIR);
  g.__vdClose = () => client.close();
  return drizzle(client, { schema }) as unknown as DB;
}

/** Rows from `db.execute(sql...)`: postgres-js returns an array, PGlite returns `{ rows }`. */
export function rowsOf<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  return ((res as { rows?: T[] } | null)?.rows ?? []) as T[];
}

/** Lazily-created singleton (survives Next dev hot reloads). */
export function db(): DB {
  if (!g.__vdDb) g.__vdDb = create();
  return g.__vdDb;
}

export async function closeDb() {
  await g.__vdClose?.();
  g.__vdClose = undefined;
  g.__vdDb = undefined;
}

export { schema };
