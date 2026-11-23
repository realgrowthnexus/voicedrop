import { execSync } from "node:child_process";
import postgres from "postgres";

const url = process.env.DATABASE_URL_TEST ?? "postgres://postgres:postgres@127.0.0.1:5432/voiceoverdrop_test";

export default async function setup() {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql.unsafe("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
  await sql.end();
  execSync("node scripts/migrate.mjs", { env: { ...process.env, DATABASE_URL: url }, stdio: "inherit" });
}
