import { afterEach, describe, expect, it } from "vitest";
import { buildConfig, RUNPOD_DEFAULT_ENDPOINT } from "@/lib/config";
import { resetEnvCache } from "@/lib/env";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
  resetEnvCache();
});

function prod(over: Record<string, string> = {}) {
  process.env = { NODE_ENV: "production", DATABASE_URL: "postgres://u:p@db.example/x", ...over } as NodeJS.ProcessEnv;
  resetEnvCache();
}

describe("buildConfig", () => {
  it("is safe with nothing configured: services report off", () => {
    prod();
    const c = buildConfig({}, process.env);
    expect(c.email.mode).toBe("none");
    expect(c.tts.mode).toBe("none");
    expect(c.google).toBeNull();
    expect(c.captcha).toBeNull();
  });

  it("uses site settings, with environment variables taking precedence", () => {
    prod({ SMTP_USER: "login@voicedrop.rest", SMTP_PASSWORD: "pw-env" });
    const c = buildConfig({ SMTP_PASSWORD: "pw-site", RUNPOD_API_KEY: "rk" }, process.env);
    expect(c.email.mode).toBe("smtp");
    expect(c.email.smtp).toMatchObject({ host: "smtp.hostinger.com", port: 465, user: "login@voicedrop.rest", password: "pw-env" });
    expect(c.email.from).toBe("VoiceDrop <login@voicedrop.rest>");
    expect(c.source.SMTP_PASSWORD).toBe("env");
    expect(c.source.RUNPOD_API_KEY).toBe("site");
    expect(c.tts).toEqual({ mode: "runpod", apiKey: "rk", endpointId: RUNPOD_DEFAULT_ENDPOINT });
  });

  it("enables Google and Turnstile only when both halves are present", () => {
    prod();
    expect(buildConfig({ GOOGLE_CLIENT_ID: "id" }, process.env).google).toBeNull();
    expect(buildConfig({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s" }, process.env).google).not.toBeNull();
    expect(buildConfig({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: "a", TURNSTILE_SECRET_KEY: "b" }, process.env).captcha).toEqual({ siteKey: "a", secretKey: "b" });
  });

  it("changes the auth fingerprint when sign-in settings change", () => {
    prod();
    const a = buildConfig({}, process.env).authFingerprint;
    const b = buildConfig({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s" }, process.env).authFingerprint;
    expect(a).not.toBe(b);
    expect(buildConfig({ RUNPOD_API_KEY: "x" }, process.env).authFingerprint).toBe(a);
  });
});
