import "server-only";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { env } from "@/lib/env";

/**
 * Service settings. Each value comes from the environment variable of the same name if it is set,
 * otherwise from Admin → Settings (app_settings table). So the owner only has to put the database
 * URL, admin email and mail login into the host; everything else is pasted into the site itself.
 */
export type SettingDef = {
  key: string;
  label: string;
  group: "voice" | "email" | "google" | "captcha" | "payments" | "analytics";
  secret?: boolean;
  placeholder?: string;
  help?: string;
};

export const RUNPOD_DEFAULT_ENDPOINT = "lizqs4oqlbbm62";

export const SETTINGS: SettingDef[] = [
  { key: "RUNPOD_API_KEY", label: "RunPod API key", group: "voice", secret: true, help: "RunPod → Settings → API Keys → create a key with access to Serverless." },
  { key: "RUNPOD_ENDPOINT_ID", label: "RunPod endpoint ID", group: "voice", placeholder: RUNPOD_DEFAULT_ENDPOINT, help: "Leave empty to use the VoiceDrop endpoint that is already deployed." },

  { key: "SMTP_HOST", label: "SMTP host", group: "email", placeholder: "smtp.hostinger.com" },
  { key: "SMTP_PORT", label: "SMTP port", group: "email", placeholder: "465" },
  { key: "SMTP_USER", label: "SMTP user (mailbox address)", group: "email", placeholder: "login@voicedrop.rest" },
  { key: "SMTP_PASSWORD", label: "SMTP password", group: "email", secret: true },
  { key: "RESEND_API_KEY", label: "Resend API key (instead of SMTP)", group: "email", secret: true },
  { key: "EMAIL_FROM", label: "From address", group: "email", placeholder: "VoiceDrop <login@voicedrop.rest>", help: "Defaults to the SMTP user." },

  { key: "GOOGLE_CLIENT_ID", label: "Google client ID", group: "google" },
  { key: "GOOGLE_CLIENT_SECRET", label: "Google client secret", group: "google", secret: true },

  { key: "NEXT_PUBLIC_TURNSTILE_SITE_KEY", label: "Turnstile site key", group: "captcha" },
  { key: "TURNSTILE_SECRET_KEY", label: "Turnstile secret key", group: "captcha", secret: true },

  { key: "PADDLE_ENV", label: "Paddle environment (sandbox or production)", group: "payments", placeholder: "sandbox" },
  { key: "PADDLE_API_KEY", label: "Paddle API key", group: "payments", secret: true },
  { key: "PADDLE_WEBHOOK_SECRET", label: "Paddle webhook secret", group: "payments", secret: true },
  { key: "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN", label: "Paddle client-side token", group: "payments" },
  { key: "PADDLE_PRICE_CREATOR", label: "Price ID: Creator", group: "payments", placeholder: "pri_…" },
  { key: "PADDLE_PRICE_PRO", label: "Price ID: Pro", group: "payments", placeholder: "pri_…" },
  { key: "PADDLE_PRICE_PACK", label: "Price ID: Credit pack", group: "payments", placeholder: "pri_…" },
];

const KEYS = new Set(SETTINGS.map((s) => s.key));
export const isSettingKey = (k: string) => KEYS.has(k);

export type Config = {
  raw: Record<string, string | undefined>;
  /** Which source each set key came from (for the admin page). */
  source: Record<string, "env" | "site">;
  email: { mode: "log" | "smtp" | "resend" | "none"; from: string; smtp?: { host: string; port: number; user: string; password: string }; resendKey?: string };
  google: { clientId: string; clientSecret: string } | null;
  captcha: { siteKey: string; secretKey: string } | null;
  tts: { mode: "local"; url: string } | { mode: "runpod"; apiKey: string; endpointId: string } | { mode: "none" };
  paddle: {
    env: "sandbox" | "production";
    apiKey?: string;
    webhookSecret?: string;
    clientToken?: string;
    prices: { creator?: string; pro?: string; pack?: string };
  };
  /** Changes whenever a value that is baked into the auth instance changes. */
  authFingerprint: string;
};

const CACHE_MS = 15_000;
const g = globalThis as unknown as { __vdCfg?: { at: number; value: Config } };

async function readDb(): Promise<Record<string, string>> {
  try {
    const rows = await db().select({ key: appSettings.key, value: appSettings.value }).from(appSettings);
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch (err) {
    // Table may not exist yet on a brand-new database before migrations; run on env alone.
    console.warn("[config] could not read app_settings:", (err as Error).message);
    return {};
  }
}

export function buildConfig(dbValues: Record<string, string>, processEnv: Record<string, string | undefined> = process.env): Config {
  const e = env();
  const raw: Record<string, string | undefined> = {};
  const source: Record<string, "env" | "site"> = {};
  for (const { key } of SETTINGS) {
    const fromEnv = processEnv[key]?.trim();
    const fromDb = dbValues[key]?.trim();
    if (fromEnv) {
      raw[key] = fromEnv;
      source[key] = "env";
    } else if (fromDb) {
      raw[key] = fromDb;
      source[key] = "site";
    }
  }

  const smtp =
    raw.SMTP_USER && raw.SMTP_PASSWORD
      ? { host: raw.SMTP_HOST || "smtp.hostinger.com", port: Number(raw.SMTP_PORT || 465) || 465, user: raw.SMTP_USER, password: raw.SMTP_PASSWORD }
      : undefined;
  const emailMode: Config["email"]["mode"] = e.EMAIL_BACKEND === "log" ? "log" : smtp ? "smtp" : raw.RESEND_API_KEY ? "resend" : "none";
  const from = raw.EMAIL_FROM || (smtp ? `VoiceDrop <${smtp.user}>` : "VoiceDrop <login@voicedrop.rest>");

  const google = raw.GOOGLE_CLIENT_ID && raw.GOOGLE_CLIENT_SECRET ? { clientId: raw.GOOGLE_CLIENT_ID, clientSecret: raw.GOOGLE_CLIENT_SECRET } : null;
  const captcha =
    !e.CAPTCHA_DISABLED && raw.NEXT_PUBLIC_TURNSTILE_SITE_KEY && raw.TURNSTILE_SECRET_KEY
      ? { siteKey: raw.NEXT_PUBLIC_TURNSTILE_SITE_KEY, secretKey: raw.TURNSTILE_SECRET_KEY }
      : null;

  let tts: Config["tts"] = { mode: "none" };
  if (e.TTS_BACKEND === "local") tts = { mode: "local", url: e.LOCAL_WORKER_URL.replace(/\/$/, "") };
  else if (raw.RUNPOD_API_KEY) tts = { mode: "runpod", apiKey: raw.RUNPOD_API_KEY, endpointId: raw.RUNPOD_ENDPOINT_ID || RUNPOD_DEFAULT_ENDPOINT };

  const authFingerprint = createHash("sha256")
    .update(JSON.stringify([google, captcha?.secretKey ?? null, emailMode]))
    .digest("hex");

  return {
    raw,
    source,
    email: { mode: emailMode, from, smtp, resendKey: raw.RESEND_API_KEY },
    google,
    captcha,
    tts,
    paddle: {
      env: raw.PADDLE_ENV === "production" ? "production" : "sandbox",
      apiKey: raw.PADDLE_API_KEY,
      webhookSecret: raw.PADDLE_WEBHOOK_SECRET,
      clientToken: raw.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
      prices: { creator: raw.PADDLE_PRICE_CREATOR, pro: raw.PADDLE_PRICE_PRO, pack: raw.PADDLE_PRICE_PACK },
    },
    authFingerprint,
  };
}

/** Current settings (cached for a few seconds). */
export async function cfg(): Promise<Config> {
  const hit = g.__vdCfg;
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = buildConfig(await readDb());
  g.__vdCfg = { at: Date.now(), value };
  return value;
}

export function invalidateConfig() {
  g.__vdCfg = undefined;
}

/** Save values from the admin page. Empty string clears a value; undefined leaves it unchanged. */
export async function saveSettings(patch: Record<string, string | undefined>, adminId: string): Promise<void> {
  for (const [key, value] of Object.entries(patch)) {
    if (!isSettingKey(key) || value === undefined) continue;
    const v = value.trim();
    if (!v) {
      await db().delete(appSettings).where(eq(appSettings.key, key));
    } else {
      await db()
        .insert(appSettings)
        .values({ key, value: v, updatedBy: adminId, updatedAt: new Date() })
        .onConflictDoUpdate({ target: appSettings.key, set: { value: v, updatedBy: adminId, updatedAt: new Date() } });
    }
  }
  invalidateConfig();
}
