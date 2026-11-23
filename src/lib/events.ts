import "server-only";
import { db } from "@/db";
import { appEvents } from "@/db/schema";

export type EventName = "signup" | "job_created" | "job_done" | "job_failed" | "checkout_opened" | "purchase" | "subscription_started";

/** Fire-and-forget product analytics event (never throws). */
export async function track(userId: string | null, name: EventName, props?: Record<string, unknown>): Promise<void> {
  try {
    await db().insert(appEvents).values({ userId, name, props: props ?? null });
  } catch (e) {
    console.error("[events] failed", e);
  }
}
