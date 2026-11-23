import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { env } from "@/lib/env";

/** Loopback, private (RFC1918), link-local, CGNAT and IPv6 ULA ranges: these are proxies, never real clients. */
export function isPrivateIp(ip: string): boolean {
  const v = ip.replace(/^::ffff:/i, "");
  if (isIP(v) === 4) {
    const [a, b] = v.split(".").map(Number);
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127) || a === 0;
  }
  if (isIP(v) === 6) {
    const l = v.toLowerCase();
    return l === "::1" || l === "::" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80");
  }
  return true; // not an IP at all
}

/**
 * Real client IP from the configured trusted header, or "unknown".
 * For x-forwarded-for we walk from the right (entries appended by our own
 * proxies) and take the first public address; anything to its left may be
 * forged by the client.
 */
export function clientIp(headers: Headers): string {
  const name = env().IP_HEADER;
  const raw = headers.get(name);
  if (!raw) return "unknown";
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const ordered = name === "x-forwarded-for" ? [...parts].reverse() : parts.slice(0, 1);
  for (const p of ordered) {
    const ip = p.replace(/^\[|\]$/g, "").replace(/:\d+$/, (m) => (p.includes(".") ? "" : m));
    if (isIP(ip.replace(/^::ffff:/i, "")) && !isPrivateIp(ip)) return ip.replace(/^::ffff:/i, "");
  }
  return "unknown";
}

/** Stable, non-reversible identifier for an IP (we never store raw IPs in app tables). */
export function hashIp(ip: string): string {
  return createHmac("sha256", env().IP_HASH_SECRET).update(ip).digest("hex").slice(0, 32);
}
