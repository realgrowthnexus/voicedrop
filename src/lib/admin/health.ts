import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { cfg } from "@/lib/config";
import { env } from "@/lib/env";
import { budgetState } from "@/lib/jobs/budget";

export type Check = {
  id: string;
  name: string;
  state: "ok" | "warn" | "off" | "error";
  detail: string;
  /** What the owner should do, in plain words. */
  fix?: string;
};

async function timed<T>(fn: () => Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([fn(), new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timed out")), ms))]);
}

async function checkDb(): Promise<Check> {
  try {
    await timed(() => db().execute(sql`select 1`));
    const e = env();
    return {
      id: "db",
      name: "Database",
      state: "ok",
      detail: e.DATABASE_URL
        ? "Connected."
        : `Connected. Built-in database on this server (${e.EMBEDDED_DB_DIR}); a backup is saved daily in ${e.DATA_DIR}/backups (last 7 kept).`,
    };
  } catch (e) {
    return { id: "db", name: "Database", state: "error", detail: (e as Error).message, fix: "Restart the app in Hostinger. If it persists, send this message to support." };
  }
}

async function checkStorage(): Promise<Check> {
  const e = env();
  if (e.STORAGE_BACKEND === "r2") return { id: "storage", name: "File storage", state: "ok", detail: `Cloudflare R2 bucket ${e.R2_BUCKET}.` };
  const dir = path.resolve(e.LOCAL_STORAGE_DIR!);
  try {
    const probe = path.join(dir, `.probe-${randomUUID()}`);
    await mkdir(dir, { recursive: true });
    await writeFile(probe, "ok");
    const back = await readFile(probe, "utf8");
    await rm(probe, { force: true });
    if (back !== "ok") throw new Error("read-back mismatch");
    return { id: "storage", name: "File storage", state: "ok", detail: `Audio files are saved on this server in ${dir} and deleted after 30 days.` };
  } catch (err) {
    return {
      id: "storage",
      name: "File storage",
      state: "error",
      detail: `${dir}: ${(err as Error).message}`,
      fix: "Set LOCAL_STORAGE_DIR in Hostinger to a folder the app can write to.",
    };
  }
}

async function checkVoice(): Promise<Check> {
  const t = (await cfg()).tts;
  if (t.mode === "none") {
    return { id: "voice", name: "Voice engine (RunPod)", state: "error", detail: "Not set up: nobody can generate audio.", fix: "Paste your RunPod API key below under Voice engine." };
  }
  if (t.mode === "local") return { id: "voice", name: "Voice engine", state: "warn", detail: `Local test worker at ${t.url}.` };
  try {
    const res = await timed(() =>
      fetch(`https://api.runpod.ai/v2/${encodeURIComponent(t.endpointId)}/health`, {
        headers: { authorization: `Bearer ${t.apiKey}` },
        cache: "no-store",
      }),
    );
    if (res.status === 401 || res.status === 403) {
      return { id: "voice", name: "Voice engine (RunPod)", state: "error", detail: "RunPod rejected the API key.", fix: "Create a new RunPod API key and paste it below." };
    }
    if (!res.ok) return { id: "voice", name: "Voice engine (RunPod)", state: "error", detail: `RunPod answered HTTP ${res.status} for endpoint ${t.endpointId}.` };
    const h = (await res.json()) as { workers?: Record<string, number>; jobs?: Record<string, number> };
    const w = h.workers ?? {};
    const live = (w.idle ?? 0) + (w.running ?? 0) + (w.ready ?? 0);
    return {
      id: "voice",
      name: "Voice engine (RunPod)",
      state: "ok",
      detail: `Endpoint ${t.endpointId} reachable. ${live ? `${live} worker(s) warm.` : "Sleeping (starts on the first job, ~10-30 s)."}`,
    };
  } catch (e) {
    return { id: "voice", name: "Voice engine (RunPod)", state: "error", detail: `Could not reach RunPod: ${(e as Error).message}` };
  }
}

export async function systemChecks(): Promise<Check[]> {
  const c = await cfg();
  const e = env();
  const [dbc, storage, voice] = await Promise.all([checkDb(), checkStorage(), checkVoice()]);
  const out: Check[] = [dbc, voice, storage];

  out.push(
    c.email.mode === "none"
      ? {
          id: "email",
          name: "Sign-in email",
          state: "off",
          detail: "Off (optional). People sign up with email + password. Add a mailbox below to also send sign-in links.",
        }
      : { id: "email", name: "Sign-in email", state: "ok", detail: c.email.mode === "smtp" ? `SMTP ${c.email.smtp!.host} as ${c.email.smtp!.user}.` : c.email.mode === "resend" ? "Resend." : "Test mode (logged, not sent)." },
  );
  out.push(
    c.google
      ? { id: "google", name: "Google sign-in", state: "ok", detail: "On." }
      : { id: "google", name: "Google sign-in", state: "off", detail: "Off (optional). Email sign-in works without it." },
  );
  out.push(
    c.captcha
      ? { id: "captcha", name: "Bot protection (Turnstile)", state: "ok", detail: "On for email sign-in." }
      : { id: "captcha", name: "Bot protection (Turnstile)", state: "warn", detail: "Off (optional). Rate limits and per-IP limits still apply." },
  );
  const p = c.paddle;
  const paddleReady = !!(p.apiKey && p.webhookSecret && p.clientToken && p.prices.creator && p.prices.pro && p.prices.pack);
  out.push(
    paddleReady
      ? { id: "payments", name: "Payments (Paddle)", state: "ok", detail: `On (${p.env}).` }
      : { id: "payments", name: "Payments (Paddle)", state: "off", detail: "Off. Free plan works; paid plans show “coming soon” until Paddle is set up." },
  );
  const b = await budgetState().catch(() => null);
  if (b?.active) {
    const near = b.spentUsd >= b.stopAtUsd * 0.8;
    out.push({
      id: "budget",
      name: "GPU budget",
      state: b.spentUsd >= b.stopAtUsd ? "error" : near ? "warn" : "ok",
      detail: `$${b.spentUsd.toFixed(2)} used of $${b.budgetUsd.toFixed(2)}. Generation stops automatically at $${b.stopAtUsd.toFixed(2)}.`,
    });
  }
  if (!e.ADMIN_EMAILS.length) out.push({ id: "admins", name: "Admins", state: "warn", detail: "ADMIN_EMAILS is empty." });
  return out;
}
