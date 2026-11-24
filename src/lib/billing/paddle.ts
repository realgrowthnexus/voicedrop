import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cfg, type Config } from "@/lib/config";

/** Signature tolerance. Paddle's SDK uses 5s; we allow a little clock skew (replays are blocked by event-id idempotency). */
export const SIGNATURE_TOLERANCE_SEC = 60;

/** Verify a `Paddle-Signature: ts=...;h1=...` header (HMAC-SHA256 of `${ts}:${rawBody}`). */
export function verifyPaddleSignature(rawBody: string, header: string | null, secret: string, nowMs = Date.now()): boolean {
  if (!header || !secret) return false;
  let ts = "";
  const h1s: string[] = [];
  for (const part of header.split(";")) {
    const [k, v] = part.split("=", 2);
    if (!v) continue;
    if (k.trim() === "ts") ts = v.trim();
    else if (k.trim() === "h1") h1s.push(v.trim());
  }
  const tsNum = Number(ts);
  if (!ts || !Number.isInteger(tsNum) || !h1s.length) return false;
  if (Math.abs(nowMs - tsNum * 1000) > SIGNATURE_TOLERANCE_SEC * 1000) return false;
  const expected = createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest("hex");
  return h1s.some((h) => h.length === expected.length && /^[0-9a-f]+$/i.test(h) && timingSafeEqual(Buffer.from(h, "hex"), Buffer.from(expected, "hex")));
}

export async function paddleApi<T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T> {
  const p = (await cfg()).paddle;
  const key = p.apiKey;
  if (!key) throw new Error("PADDLE_API_KEY is not configured");
  const base = p.env === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { data?: T; error?: { detail?: string; code?: string } };
  if (!res.ok || !json.data) throw new Error(`Paddle API ${res.status}: ${json.error?.code ?? ""} ${json.error?.detail ?? ""}`.trim());
  return json.data;
}

export type PaddleProduct = "creator" | "pro" | "pack";

export type Prices = Config["paddle"]["prices"];

export async function prices(): Promise<Prices> {
  return (await cfg()).paddle.prices;
}

export function priceIdFor(p: PaddleProduct, pr: Prices): string {
  const id = pr[p];
  if (!id) throw new Error(`Paddle price for ${p} is not configured`);
  return id;
}

export function planForPrice(priceId: string | null | undefined, pr: Prices): "creator" | "pro" | null {
  if (priceId && priceId === pr.creator) return "creator";
  if (priceId && priceId === pr.pro) return "pro";
  return null;
}

export function isPackPrice(priceId: string | null | undefined, pr: Prices): boolean {
  return !!priceId && priceId === pr.pack;
}
