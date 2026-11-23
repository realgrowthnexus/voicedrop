import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "@/lib/env";

export type DB = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type Executor = DB | Tx;

const globalForDb = globalThis as unknown as { __vdSql?: postgres.Sql; __vdDb?: DB };

function create(): DB {
  const url = env().DATABASE_URL;
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const client = postgres(url, {
    max: Number(process.env.DB_POOL_MAX ?? 5),
    idle_timeout: 20,
    connect_timeout: 15,
    ssl: isLocal ? false : "require",
    prepare: false,
  });
  globalForDb.__vdSql = client;
  return drizzle(client, { schema });
}

/** Lazily-created singleton (survives Next dev hot reloads). */
export function db(): DB {
  if (!globalForDb.__vdDb) globalForDb.__vdDb = create();
  return globalForDb.__vdDb;
}

export async function closeDb() {
  await globalForDb.__vdSql?.end({ timeout: 5 });
  globalForDb.__vdSql = undefined;
  globalForDb.__vdDb = undefined;
}

export { schema };
