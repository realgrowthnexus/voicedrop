import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/* ---------------- Better Auth core tables ---------------- */

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    // app fields
    banned: boolean("banned").notNull().default(false),
    banReason: text("ban_reason"),
    signupIpHash: text("signup_ip_hash"),
    compPlan: text("comp_plan"), // 'creator' | 'pro' granted by admin
    compUntil: ts("comp_until"),
    paddleCustomerId: text("paddle_customer_id"),
  },
  (t) => [index("user_signup_ip_idx").on(t.signupIpHash, t.createdAt)],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: ts("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ts("access_token_expires_at"),
    refreshTokenExpiresAt: ts("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

/* ---------------- App tables ---------------- */

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    paddleSubscriptionId: text("paddle_subscription_id").notNull().unique(),
    paddleCustomerId: text("paddle_customer_id"),
    plan: text("plan").notNull(), // 'creator' | 'pro'
    status: text("status").notNull(), // paddle status
    periodStart: ts("period_start"),
    periodEnd: ts("period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    lastEventAt: ts("last_event_at").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("subscriptions_user_idx").on(t.userId)],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status").notNull(), // held | queued | processing | done | failed | rejected
    text: text("text").notNull(),
    voice: text("voice").notNull(),
    speed: real("speed").notNull().default(1),
    formats: text("formats").array().notNull(),
    chars: integer("chars").notNull(),
    tier: text("tier").notNull(),
    priority: boolean("priority").notNull().default(false),
    runpodId: text("runpod_id"),
    error: text("error"),
    durationSec: real("duration_sec"),
    /** Billed GPU time we attribute to this job (execution + queue/cold start + idle tail), ms. */
    gpuMs: integer("gpu_ms"),
    /** Estimated GPU cost in micro-dollars (1e-6 USD). */
    gpuCostMicros: integer("gpu_cost_micros"),
    files: jsonb("files").$type<Record<string, { bytes: number }>>(),
    flagReason: text("flag_reason"),
    ipHash: text("ip_hash"),
    createdAt: ts("created_at").notNull().defaultNow(),
    dispatchedAt: ts("dispatched_at"),
    finishedAt: ts("finished_at"),
    expiresAt: ts("expires_at").notNull(),
  },
  (t) => [
    index("jobs_user_created_idx").on(t.userId, t.createdAt),
    index("jobs_status_idx").on(t.status, t.priority, t.createdAt),
  ],
);

export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    bucket: text("bucket").notNull(), // free | subscription | pack
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(), // job_charge | job_refund | pack_purchase | pack_refund | admin_grant | admin_revoke
    jobId: uuid("job_id"),
    paddleRef: text("paddle_ref"),
    note: text("note"),
    effectiveAt: ts("effective_at").notNull().defaultNow(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("ledger_user_bucket_idx").on(t.userId, t.bucket, t.effectiveAt),
    uniqueIndex("ledger_job_reason_bucket_uq")
      .on(t.jobId, t.reason, t.bucket)
      .where(sql`${t.jobId} is not null`),
    uniqueIndex("ledger_paddle_reason_uq")
      .on(t.paddleRef, t.reason)
      .where(sql`${t.paddleRef} is not null`),
  ],
);

export const paddleEvents = pgTable("paddle_events", {
  eventId: text("event_id").primaryKey(),
  type: text("type").notNull(),
  occurredAt: ts("occurred_at").notNull(),
  payload: jsonb("payload").notNull(),
  processedAt: ts("processed_at").notNull().defaultNow(),
});

export const transactions = pgTable(
  "transactions",
  {
    paddleTransactionId: text("paddle_transaction_id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    kind: text("kind").notNull(), // subscription | pack
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    status: text("status").notNull(), // completed | refunded
    packQuantity: integer("pack_quantity").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("transactions_created_idx").on(t.createdAt)],
);

export const rateLimits = pgTable(
  "app_rate_limits",
  {
    key: text("key").notNull(),
    windowStart: bigint("window_start", { mode: "number" }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

export const appEvents = pgTable(
  "app_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id"),
    name: text("name").notNull(),
    props: jsonb("props"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("app_events_name_created_idx").on(t.name, t.createdAt)],
);

export const adminActions = pgTable("admin_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: text("admin_id").notNull(),
  targetUserId: text("target_user_id"),
  action: text("action").notNull(),
  details: jsonb("details"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export type User = typeof user.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
