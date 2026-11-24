import "server-only";
import { db, type Executor } from "@/db";
import { appEvents } from "@/db/schema";

export type EventName = "signup" | "job_created" | "job_done" | "job_failed" | "checkout_opened" | "purchase" | "subscription_started";

/** Fire-and-forget product analytics event (never throws). */
/** Pass `ex` (the open transaction) when called inside one: the embedded database runs one transaction at a time. */
export async function track(userId: string | null, name: EventName, props?: Record<string, unknown>, ex: Executor = db()): Promise<void> {
  try {
    await ex.insert(appEvents).values({ userId, name, props: props ?? null });
  } catch (e) {
    console.error("[events] failed", e);
  }
}
