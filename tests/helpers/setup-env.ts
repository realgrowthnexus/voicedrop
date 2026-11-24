// Deterministic env for tests; real secrets never used here.
Object.assign(process.env, {
  NODE_ENV: "test",
  APP_URL: "http://localhost:3000",
  DATABASE_URL: process.env.DATABASE_URL_TEST ?? "postgres://postgres:postgres@127.0.0.1:5432/voiceoverdrop_test",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-1234",
  IP_HASH_SECRET: "test-ip-hash-secret",
  RUNPOD_WEBHOOK_SECRET: "test-runpod-webhook-secret",
  TTS_BACKEND: "local",
  STORAGE_BACKEND: "local",
  LOCAL_STORAGE_DIR: ".data/test-storage",
  EMAIL_BACKEND: "log",
  CAPTCHA_DISABLED: "1",
  ADMIN_EMAILS: "admin@example.com",
  PADDLE_WEBHOOK_SECRET: "pdl_ntfset_test_secret",
  PADDLE_PRICE_CREATOR: "pri_creator",
  PADDLE_PRICE_PRO: "pri_pro",
  PADDLE_PRICE_PACK: "pri_pack",
});

// TEST_DB=embedded runs the same suite on the embedded database (PGlite), one fresh copy per test file.
if (process.env.TEST_DB === "embedded") {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  delete process.env.DATABASE_URL;
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "vd-test-"));
  process.env.LOCAL_STORAGE_DIR = path.join(process.env.DATA_DIR, "storage");
  const { ensureBooted } = await import("@/lib/bootstrap");
  await ensureBooted();
}
export {};
