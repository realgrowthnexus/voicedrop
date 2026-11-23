import "server-only";
import { z } from "zod";

const bool = z
  .enum(["0", "1", "true", "false", ""])
  .optional()
  .transform((v) => v === "1" || v === "true");

const optStr = z.string().trim().optional().transform((v) => (v ? v : undefined));

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.url(),
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 chars"),
    IP_HASH_SECRET: z.string().min(16),
    ADMIN_EMAILS: z
      .string()
      .default("")
      .transform((s) => s.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)),

    GOOGLE_CLIENT_ID: optStr,
    GOOGLE_CLIENT_SECRET: optStr,

    EMAIL_BACKEND: z.enum(["resend", "log"]).default("resend"),
    RESEND_API_KEY: optStr,
    EMAIL_FROM: z.string().default("VoiceoverDrop <login@voiceoverdrop.com>"),

    CAPTCHA_DISABLED: bool,
    TURNSTILE_SECRET_KEY: optStr,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: optStr,

    TTS_BACKEND: z.enum(["runpod", "local"]).default("runpod"),
    RUNPOD_API_KEY: optStr,
    RUNPOD_ENDPOINT_ID: optStr,
    LOCAL_WORKER_URL: z.string().default("http://127.0.0.1:8188"),
    RUNPOD_WEBHOOK_SECRET: z.string().min(16),

    STORAGE_BACKEND: z.enum(["r2", "local"]).default("r2"),
    R2_ACCOUNT_ID: optStr,
    R2_ACCESS_KEY_ID: optStr,
    R2_SECRET_ACCESS_KEY: optStr,
    R2_BUCKET: optStr,
    LOCAL_STORAGE_DIR: z.string().default(".data/storage"),

    PADDLE_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
    PADDLE_API_KEY: optStr,
    PADDLE_WEBHOOK_SECRET: optStr,
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: optStr,
    PADDLE_PRICE_CREATOR: optStr,
    PADDLE_PRICE_PRO: optStr,
    PADDLE_PRICE_PACK: optStr,

    FREE_MAX_INFLIGHT: z.coerce.number().int().min(0).default(2),
    /** Spend guard: max characters generated across all users per rolling 24h. 0 = unlimited. */
    GLOBAL_DAILY_CHAR_LIMIT: z.coerce.number().int().min(0).default(3_000_000),

    NEXT_PUBLIC_UMAMI_SRC: optStr,
    NEXT_PUBLIC_UMAMI_WEBSITE_ID: optStr,

    ALLOW_DEV_BACKENDS: bool,
  })
  .superRefine((e, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    if (e.NODE_ENV === "production" && !e.ALLOW_DEV_BACKENDS) {
      if (e.TTS_BACKEND === "local") issue("TTS_BACKEND=local is not allowed in production");
      if (e.STORAGE_BACKEND === "local") issue("STORAGE_BACKEND=local is not allowed in production");
      if (e.EMAIL_BACKEND === "log") issue("EMAIL_BACKEND=log is not allowed in production");
      if (e.CAPTCHA_DISABLED) issue("CAPTCHA_DISABLED is not allowed in production");
      if (!e.PADDLE_WEBHOOK_SECRET) issue("PADDLE_WEBHOOK_SECRET is required in production");
    }
    if (e.TTS_BACKEND === "runpod" && (!e.RUNPOD_API_KEY || !e.RUNPOD_ENDPOINT_ID))
      issue("RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID are required when TTS_BACKEND=runpod");
    if (e.STORAGE_BACKEND === "r2" && (!e.R2_ACCOUNT_ID || !e.R2_ACCESS_KEY_ID || !e.R2_SECRET_ACCESS_KEY || !e.R2_BUCKET))
      issue("R2_* variables are required when STORAGE_BACKEND=r2");
    if (e.EMAIL_BACKEND === "resend" && !e.RESEND_API_KEY) issue("RESEND_API_KEY is required when EMAIL_BACKEND=resend");
    if (!e.CAPTCHA_DISABLED && (!e.TURNSTILE_SECRET_KEY || !e.NEXT_PUBLIC_TURNSTILE_SITE_KEY))
      issue("Turnstile keys are required unless CAPTCHA_DISABLED=1");
  });

export type Env = z.output<typeof schema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const res = schema.safeParse(raw);
  if (!res.success) {
    const msg = res.error.issues.map((i) => `- ${i.path.join(".") || "env"}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${msg}`);
  }
  return res.data;
}

let cached: Env | undefined;
/** Lazily parsed so `next build` works without runtime secrets. */
export function env(): Env {
  if (!cached) cached = parseEnv(process.env);
  return cached;
}

/** Test helper: drop the cached env after mutating process.env. */
export function resetEnvCache() {
  cached = undefined;
}
