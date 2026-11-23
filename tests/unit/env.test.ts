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

  it("requires runpod credentials when TTS_BACKEND=runpod", () => {
    expect(() => parseEnv({ ...devEnv, TTS_BACKEND: "runpod" })).toThrow(/RUNPOD_API_KEY/);
  });

  it("rejects short secrets", () => {
    expect(() => parseEnv({ ...devEnv, BETTER_AUTH_SECRET: "short" })).toThrow(/BETTER_AUTH_SECRET/);
  });
});
