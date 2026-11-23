import { defineConfig } from "@playwright/test";

const PORT = 3100;
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  fullyParallel: false,
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
      // Production build + start, with the local (dev) backends explicitly allowed.
      command: `npm run build && PORT=${PORT} npm start -- -p ${PORT}`,
      url: `http://localhost:${PORT}/`,
      reuseExistingServer: true,
      timeout: 600_000,
      env: {
        NODE_ENV: "production",
        ALLOW_DEV_BACKENDS: "1",
        APP_URL: `http://localhost:${PORT}`,
        DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/voiceoverdrop",
      },
    },
  ],
});
