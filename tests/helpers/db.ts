import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";

const TABLES = [
  "credit_ledger", "jobs", "subscriptions", "transactions", "paddle_events", "app_rate_limits",
  "app_events", "admin_actions", "session", "account", "verification", "rate_limit", "user",
];

export async function resetDb() {
  await db().execute(sql.raw(`truncate ${TABLES.map((t) => `"${t}"`).join(", ")} cascade`));
}

export async function createUser(over: Partial<typeof user.$inferInsert> = {}) {
  const id = over.id ?? randomUUID();
  const [u] = await db()
    .insert(user)
    .values({ id, name: "Test", email: `${id}@example.com`, emailVerified: true, ...over })
    .returning();
  return u;
}
