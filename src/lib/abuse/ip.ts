import "server-only";
import { createHmac } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Client IP from the configured trusted header. For x-forwarded-for we take the
 * right-most entry: that one is appended by our own hosting proxy, while the
 * left-most entries can be forged by the client.
 */
export function clientIp(headers: Headers): string {
  const name = env().IP_HEADER;
  const raw = headers.get(name);
  if (!raw) return "unknown";
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const ip = name === "x-forwarded-for" ? parts[parts.length - 1] : parts[0];
  return ip || "unknown";
}

/** Stable, non-reversible identifier for an IP (we never store raw IPs in app tables). */
export function hashIp(ip: string): string {
  return createHmac("sha256", env().IP_HASH_SECRET).update(ip).digest("hex").slice(0, 32);
}
