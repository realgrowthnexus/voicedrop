import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

const devEnv = {
  NODE_ENV: "development",
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgres://x",
  BETTER_AUTH_SECRET: "x".repeat(32),
  IP_HASH_SECRET: "y".repeat(16),
  RUNPOD_WEBHOOK_SECRET: "z".repeat(16),
  TTS_BACKEND: "local",
  STORAGE_BACKEND: "local",
  EMAIL_BACKEND: "log",
  CAPTCHA_DISABLED: "1",
  ADMIN_EMAILS: " Owner@Example.com, ",
};

describe("parseEnv", () => {
  it("accepts a dev configuration with local backends", () => {
    const e = parseEnv(devEnv);
    expect(e.TTS_BACKEND).toBe("local");
    expect(e.CAPTCHA_DISABLED).toBe(true);
    expect(e.ADMIN_EMAILS).toEqual(["owner@example.com"]);
  });

  it("refuses dev backends in production", () => {
    expect(() => parseEnv({ ...devEnv, NODE_ENV: "production" })).toThrow(/not allowed in production/);
  });

  it("needs only a database URL in production; secrets are derived from it", () => {
    const e = parseEnv({ NODE_ENV: "production", DATABASE_URL: "postgres://u:p@db.example/x" });
    expect(e.APP_URL).toBe("https://voicedrop.rest");
    expect(e.BETTER_AUTH_SECRET).toMatch(/^[0-9a-f]{64}$/);
    expect(e.IP_HASH_SECRET).not.toBe(e.BETTER_AUTH_SECRET);
    expect(e.STORAGE_BACKEND).toBe("disk");
    expect(e.LOCAL_STORAGE_DIR).toMatch(/voicedrop-data\/storage$/);
    // Deterministic, so every server process agrees.
    expect(parseEnv({ NODE_ENV: "production", DATABASE_URL: "postgres://u:p@db.example/x" }).BETTER_AUTH_SECRET).toBe(e.BETTER_AUTH_SECRET);
    expect(parseEnv({ NODE_ENV: "production", DATABASE_URL: "postgres://u:q@db.example/x" }).BETTER_AUTH_SECRET).not.toBe(e.BETTER_AUTH_SECRET);
  });

  it("runs with nothing set: embedded database and a per-install secret kept in DATA_DIR", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "vd-env-"));
    const a = parseEnv({ NODE_ENV: "production", DATA_DIR: dir });
    expect(a.DATABASE_URL).toBeUndefined();
    expect(a.EMBEDDED_DB_DIR).toBe(path.join(dir, "db"));
    expect(a.LOCAL_STORAGE_DIR).toBe(path.join(dir, "storage"));
    expect(readFileSync(path.join(dir, "secret.key"), "utf8")).toMatch(/^[0-9a-f]{64}$/);
    // Same install → same secrets after a restart.
    expect(parseEnv({ NODE_ENV: "production", DATA_DIR: dir }).BETTER_AUTH_SECRET).toBe(a.BETTER_AUTH_SECRET);
    const other = mkdtempSync(path.join(tmpdir(), "vd-env-"));
    expect(parseEnv({ NODE_ENV: "production", DATA_DIR: other }).BETTER_AUTH_SECRET).not.toBe(a.BETTER_AUTH_SECRET);
  });

  it("rejects short secrets", () => {
    expect(() => parseEnv({ ...devEnv, BETTER_AUTH_SECRET: "short" })).toThrow(/BETTER_AUTH_SECRET/);
  });
});

describe("loadSettingsFile", () => {
  it("reads KEY=value lines without overriding real environment variables", async () => {
    const { loadSettingsFile } = await import("@/lib/env");
    const { writeFileSync } = await import("node:fs");
    const dir = mkdtempSync(path.join(tmpdir(), "vd-file-"));
    const file = path.join(dir, "voicedrop.env");
    writeFileSync(file, '# comment\nADMIN_EMAILS=owner@gmail.com\nRUNPOD_API_KEY="rk_123"\nAPP_URL=https://x.test\n\nbad line\n');
    const target: Record<string, string | undefined> = { APP_URL: "https://keep.test" };
    expect(loadSettingsFile(file, target)).toBe(2);
    expect(target).toEqual({ APP_URL: "https://keep.test", ADMIN_EMAILS: "owner@gmail.com", RUNPOD_API_KEY: "rk_123" });
    expect(loadSettingsFile(path.join(dir, "missing.env"), target)).toBe(0);
  });
});
