import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";

/** The Hostinger setup: no database server, no email service — the embedded database and passwords. */
const PORT = 3300;
const DATA_DIR = mkdtempSync(path.join(tmpdir(), "vd-e2e-embedded-"));
export default defineConfig({
  testDir: "tests/e2e-embedded",
  timeout: 120_000,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "off" },
  webServer: [
    {
      command: "worker/.venv/bin/python worker/local_server.py",
      url: "http://127.0.0.1:8188/health",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: `npm run build && npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}/`,
      reuseExistingServer: false,
      timeout: 600_000,
      env: {
        NODE_ENV: "production",
        ALLOW_DEV_BACKENDS: "1",
        APP_URL: `http://localhost:${PORT}`,
        DATABASE_URL: "",
        DATA_DIR,
        ADMIN_EMAILS: "owner@example.com",
        ADMIN_PASSWORD: "embedded-owner-pass",
        TTS_BACKEND: "local",
        STORAGE_BACKEND: "disk",
        CAPTCHA_DISABLED: "",
        EMAIL_BACKEND: "auto",
      },
    },
  ],
});
