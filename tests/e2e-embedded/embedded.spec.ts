import { expect, test } from "@playwright/test";

const uniq = () => `maker-${Date.now()}-${Math.floor(Math.random() * 1e6)}@gmail.com`;

test("new creator: create account with a password, generate, play and download", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: /Email me a sign-in link/ })).toHaveCount(0); // no email service
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Email address").fill(uniq());
  await page.getByLabel("Password", { exact: true }).fill("my strong pass 1");
  await page.getByRole("button", { name: "Create account" }).last().click();
  await expect(page.getByRole("heading", { name: "Studio" })).toBeVisible({ timeout: 20_000 });

  await page.locator("#script").fill("Welcome back to the channel. Today we test three budget microphones under fifty dollars.");
  await page.getByRole("button", { name: /Generate voice-over/ }).click();
  await expect(page.getByText(/^Done:/)).toBeVisible({ timeout: 90_000 });
  const href = await page.getByRole("link", { name: "Download MP3" }).getAttribute("href");
  const dl = await page.request.get(href!);
  expect(dl.status()).toBe(200);
  expect((await dl.body()).length).toBeGreaterThan(20_000);
  // Range requests (Safari) on the on-disk file URL.
  const media = await page.locator("audio[controls]").getAttribute("src");
  if (media) {
    const part = await page.request.get(media, { headers: { range: "bytes=0-99" } });
    expect(part.status()).toBe(206);
    expect((await part.body()).length).toBe(100);
  }
});

test("wrong password is refused, and the owner signs in with the password from settings", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("owner@example.com");
  await page.getByLabel("Password", { exact: true }).fill("not the password");
  await page.getByRole("button", { name: "Sign in" }).last().click();
  await expect(page.locator("#login-error")).toContainText("don't match");

  await page.getByLabel("Password", { exact: true }).fill("embedded-owner-pass");
  await page.getByRole("button", { name: "Sign in" }).last().click();
  await expect(page.getByRole("heading", { name: "Studio" })).toBeVisible({ timeout: 20_000 });
  await page.goto("/admin/settings");
  await expect(page.getByText(/Built-in database on this server/)).toBeVisible();
});

test("nobody can register the owner's address", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Email address").fill("owner@example.com");
  await page.getByLabel("Password", { exact: true }).fill("attacker pass 123");
  await page.getByRole("button", { name: "Create account" }).last().click();
  await expect(page.locator("#login-error")).toContainText("already exists");
});
