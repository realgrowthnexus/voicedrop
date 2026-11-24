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
    expect(e.LOCAL_STORAGE_DIR).toMatch(/voicedrop-storage$/);
    // Deterministic, so every server process agrees.
    expect(parseEnv({ NODE_ENV: "production", DATABASE_URL: "postgres://u:p@db.example/x" }).BETTER_AUTH_SECRET).toBe(e.BETTER_AUTH_SECRET);
    expect(parseEnv({ NODE_ENV: "production", DATABASE_URL: "postgres://u:q@db.example/x" }).BETTER_AUTH_SECRET).not.toBe(e.BETTER_AUTH_SECRET);
  });

  it("requires a database URL", () => {
    expect(() => parseEnv({ NODE_ENV: "production" })).toThrow(/DATABASE_URL/);
  });

  it("rejects short secrets", () => {
    expect(() => parseEnv({ ...devEnv, BETTER_AUTH_SECRET: "short" })).toThrow(/BETTER_AUTH_SECRET/);
  });
});
