import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export type RateLimitResult = { ok: boolean; remaining: number; retryAfter: number };

/** Fixed-window counter in Postgres. Atomic via upsert ... returning. */
export async function rateLimit(key: string, limit: number, windowSec: number, now = Date.now()): Promise<RateLimitResult> {
  const windowStart = Math.floor(now / 1000 / windowSec) * windowSec;
  const rows = await db().execute<{ count: number }>(sql`
    insert into app_rate_limits (key, window_start, count) values (${key}, ${windowStart}, 1)
    on conflict (key, window_start) do update set count = app_rate_limits.count + 1
    returning count`);
  const count = Number(rows[0]?.count ?? 1);
  // Opportunistic cleanup of old windows (cheap, bounded).
  if (Math.random() < 0.01) {
    await db().execute(sql`delete from app_rate_limits where window_start < ${Math.floor(now / 1000) - 86_400}`);
  }
  return { ok: count <= limit, remaining: Math.max(0, limit - count), retryAfter: windowStart + windowSec - Math.floor(now / 1000) };
}
