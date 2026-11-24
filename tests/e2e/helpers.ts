import { expect, type Page } from "@playwright/test";
import postgres from "postgres";

export const sql = postgres(process.env.E2E_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/voiceoverdrop", { max: 2, onnotice: () => {} });

export function uniqueEmail(tag: string) {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@gmail.com`;
}

/** Sign in through the real UI: request a magic link, then open it (read from the dev mailbox). */
export async function signIn(page: Page, email: string) {
  await sql`delete from rate_limit`; // all e2e logins come from one IP
  await page.goto("/login");
  await page.getByRole("button", { name: "Email me a sign-in link instead" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
  const rows = await sql<{ url: string }[]>`select props->>'url' as url from app_events where name = 'dev_email' and props->>'to' = ${email} order by created_at desc limit 1`;
  const url = new URL(rows[0].url);
  await page.goto(url.pathname + url.search);
  await page.waitForURL("**/dashboard");
}
