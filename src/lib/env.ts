import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { z } from "zod";
import { SITE_URL } from "@/lib/brand";

/** A random 32-byte key kept in DATA_DIR/secret.key (created once, never leaves the server). */
function installSecret(dataDir: string): string {
  const file = path.join(dataDir, "secret.key");
  try {
    return readFileSync(file, "utf8").trim();
  } catch {
    mkdirSync(dataDir, { recursive: true });
    const key = randomBytes(32).toString("hex");
    try {
      writeFileSync(file, key, { mode: 0o600, flag: "wx" });
      return key;
    } catch {
      return readFileSync(file, "utf8").trim(); // another process created it first
    }
  }
}

const bool = z
  .enum(["0", "1", "true", "false", ""])
  .optional()
  .transform((v) => v === "1" || v === "true");

const optStr = z.string().trim().optional().transform((v) => (v ? v : undefined));

/** Infrastructure only. Service keys (RunPod, Google, email, Paddle, Turnstile) live in `@/lib/config`,
 *  read from the environment first and then from the admin Settings page (app_settings table). */
const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.url().default(SITE_URL),
    /** Postgres server. Leave empty to use the embedded database in DATA_DIR (single server, zero setup). */
    DATABASE_URL: optStr,
    /** Where the embedded database, audio files, backups and the generated secret live. */
    DATA_DIR: optStr,
    /** Optional: derived from a per-install secret when unset. */
    BETTER_AUTH_SECRET: optStr.pipe(z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 chars").optional()),
    IP_HASH_SECRET: optStr.pipe(z.string().min(16).optional()),
    RUNPOD_WEBHOOK_SECRET: optStr.pipe(z.string().min(16).optional()),
    /** Header carrying the real client IP. Hostinger: x-forwarded-for; behind Cloudflare proxy: cf-connecting-ip. */
    IP_HEADER: z.string().default("x-forwarded-for").transform((s) => s.toLowerCase()),
    /** Password for the first ADMIN_EMAILS address; the account is created/synced on every start. */
    ADMIN_PASSWORD: optStr.pipe(z.string().min(10, "ADMIN_PASSWORD must be at least 10 characters").optional()),
    ADMIN_EMAILS: z
      .string()
      .default("")
      .transform((s) => s.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)),

    /** Dev/test switches. */
    EMAIL_BACKEND: z.enum(["auto", "log"]).default("auto"),
    CAPTCHA_DISABLED: bool,
    TTS_BACKEND: z.enum(["auto", "runpod", "local"]).default("auto"),
    LOCAL_WORKER_URL: z.string().default("http://127.0.0.1:8188"),

    /** disk = files on this server behind signed URLs (default, works on Hostinger); r2 = Cloudflare R2. */
    STORAGE_BACKEND: z.enum(["disk", "local", "r2"]).default("disk").transform((v) => (v === "local" ? "disk" : v)),
    LOCAL_STORAGE_DIR: optStr,
    R2_ACCOUNT_ID: optStr,
    R2_ACCESS_KEY_ID: optStr,
    R2_SECRET_ACCESS_KEY: optStr,
    R2_BUCKET: optStr,

    FREE_MAX_INFLIGHT: z.coerce.number().int().min(0).default(2),
    /** Spend guard: max characters generated across all users per rolling 24h. 0 = unlimited. */
    GLOBAL_DAILY_CHAR_LIMIT: z.coerce.number().int().min(0).default(3_000_000),

    /** Hard GPU spend budget in USD (lifetime, raise it to allow more). New jobs stop at 95% of it. 0 = no budget. */
    GPU_BUDGET_USD: z.coerce.number().min(0).default(25),
    /** RunPod price of the endpoint's GPU in USD per second (flex). */
    GPU_PRICE_PER_SEC: z.coerce.number().min(0).default(0.00031),
    /** Endpoint idle timeout in seconds: billed after each job before the worker scales down. */
    GPU_IDLE_TIMEOUT_SEC: z.coerce.number().min(0).default(5),
    /** RFC 3339 start of the budget window for RunPod's billing API (e.g. the endpoint's creation day). */
    GPU_BUDGET_SINCE: optStr,

    ALLOW_DEV_BACKENDS: bool,
  })
  .superRefine((e, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    if (e.NODE_ENV === "production" && !e.ALLOW_DEV_BACKENDS) {
      if (e.TTS_BACKEND === "local") issue("TTS_BACKEND=local is not allowed in production");
      if (e.EMAIL_BACKEND === "log") issue("EMAIL_BACKEND=log is not allowed in production");
      if (e.CAPTCHA_DISABLED) issue("CAPTCHA_DISABLED is not allowed in production");
    }
    if (e.STORAGE_BACKEND === "r2" && (!e.R2_ACCOUNT_ID || !e.R2_ACCESS_KEY_ID || !e.R2_SECRET_ACCESS_KEY || !e.R2_BUCKET))
      issue("R2_* variables are required when STORAGE_BACKEND=r2");
  })
  .transform((e) => {
    const dataDir = path.resolve(e.DATA_DIR ?? (e.NODE_ENV === "production" ? path.join(homedir(), "voicedrop-data") : ".data"));
    // Root secret: the DB URL (holding it already means full control) or a random key created on first boot.
    const root = e.DATABASE_URL ?? installSecret(dataDir);
    const derive = (purpose: string) => createHmac("sha256", root).update(`voicedrop:${purpose}`).digest("hex");
    return {
      ...e,
      DATA_DIR: dataDir,
      EMBEDDED_DB_DIR: path.join(dataDir, "db"),
      BETTER_AUTH_SECRET: e.BETTER_AUTH_SECRET ?? derive("auth"),
      IP_HASH_SECRET: e.IP_HASH_SECRET ?? derive("ip-hash"),
      RUNPOD_WEBHOOK_SECRET: e.RUNPOD_WEBHOOK_SECRET ?? derive("runpod-webhook"),
      LOCAL_STORAGE_DIR:
        e.LOCAL_STORAGE_DIR ?? (e.NODE_ENV === "production" ? path.join(dataDir, "storage") : ".data/storage"),
    };
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

/**
 * Optional `voicedrop.env` next to package.json (KEY=value lines), shipped inside the upload ZIP so the
 * owner doesn't have to type settings into the host. Real environment variables always win.
 * Never committed to git; the server never serves files from the project root.
 */
export function loadSettingsFile(file = path.join(process.cwd(), "voicedrop.env"), target: Record<string, string | undefined> = process.env): number {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return 0;
  }
  let n = 0;
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trimStart().startsWith("#")) continue;
    const value = m[2].replace(/^(['"])(.*)\1$/, "$2");
    if (target[m[1]] === undefined || target[m[1]] === "") {
      target[m[1]] = value;
      n++;
    }
  }
  return n;
}

let cached: Env | undefined;
let fileLoaded = false;
/** Lazily parsed so `next build` works without runtime secrets. */
export function env(): Env {
  if (!fileLoaded && process.env.NODE_ENV !== "test") {
    fileLoaded = true;
    loadSettingsFile();
  }
  if (!cached) cached = parseEnv(process.env);
  return cached;
}

/** Test helper: drop the cached env after mutating process.env. */
export function resetEnvCache() {
  cached = undefined;
  (globalThis as { __vdCfg?: unknown }).__vdCfg = undefined;
}
