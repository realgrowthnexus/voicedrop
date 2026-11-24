import "server-only";
import { rm } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { hmac, safeEqualHex } from "@/lib/sign";
import { URL_TTL_SEC, type StorageAdapter } from "./index";

/** Files on this server's disk behind short-lived HMAC-signed URLs served by /api/files. */
export const LOCAL_KEY_RE = /^jobs\/[A-Za-z0-9-]+\/[A-Za-z0-9-]+\.(mp3|wav|srt)$/;

function sigFor(op: string, key: string, exp: number, extra: string): string {
  return hmac(env().BETTER_AUTH_SECRET + ":files", `${op}|${key}|${exp}|${extra}`);
}

export function verifyLocalUrl(op: "put" | "get", key: string, params: URLSearchParams): boolean {
  const exp = Number(params.get("exp"));
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const extra = op === "put" ? params.get("ct") ?? "" : `${params.get("ct") ?? ""}|${params.get("fn") ?? ""}|${params.get("dl") ?? ""}`;
  return safeEqualHex(params.get("sig") ?? "", sigFor(op, key, exp, extra));
}

export function storageRoot(): string {
  return path.resolve(env().LOCAL_STORAGE_DIR!);
}

export function localStorageAdapter(): StorageAdapter {
  const base = env().APP_URL.replace(/\/$/, "");
  return {
    async putUrl(key, contentType) {
      const exp = Math.floor(Date.now() / 1000) + URL_TTL_SEC;
      const q = new URLSearchParams({ op: "put", exp: String(exp), ct: contentType, sig: sigFor("put", key, exp, contentType) });
      return `${base}/api/files/${key}?${q}`;
    },
    async remove(key) {
      if (!LOCAL_KEY_RE.test(key)) return;
      await rm(path.join(storageRoot(), key), { force: true });
    },
    async getUrl(key, o) {
      const exp = Math.floor(Date.now() / 1000) + URL_TTL_SEC;
      const dl = o.download ? "1" : "0";
      const q = new URLSearchParams({ op: "get", exp: String(exp), ct: o.contentType, fn: o.filename, dl });
      q.set("sig", sigFor("get", key, exp, `${o.contentType}|${o.filename}|${dl}`));
      return `${base}/api/files/${key}?${q}`;
    },
  };
}
