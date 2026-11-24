import { expect, test, type Page } from "@playwright/test";
import { signIn, uniqueEmail } from "./helpers";

/**
 * Site-wide polish audit: every clickable element shows the hand cursor, no page
 * scrolls sideways on a phone, and no page logs console errors or failed requests.
 */
const PUBLIC = ["/", "/pricing", "/voices", "/login", "/terms", "/privacy", "/refunds", "/acceptable-use", "/missing-page"];
const SIGNED_IN = ["/dashboard", "/history", "/billing"];

async function settle(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    window.scrollTo(0, 0);
  });
}

async function cursorProblems(page: Page) {
  return page.evaluate(() => {
    const sel = 'a[href], button, summary, select, [role="button"], label:has(input[type="radio"]), label:has(input[type="checkbox"]), input[type="range"]';
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const disabled =
        (el as HTMLButtonElement).disabled ||
        el.getAttribute("aria-disabled") === "true" ||
        (el.tagName === "LABEL" && !!el.querySelector("input:disabled"));
      const got = getComputedStyle(el).cursor;
      // A disabled control is either forbidden (not-allowed) or simply fixed (default), never a hand.
      const ok = disabled ? got === "not-allowed" || got === "default" : got === "pointer";
      if (!ok) out.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 40)}" cursor=${got}`);
    }
    return out;
  });
}

async function audit(page: Page, path: string) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().endsWith(path)) errors.push(`${r.status()} ${r.url()}`);
  });
  const res = await page.goto(path);
  expect(res?.status(), `status of ${path}`).toBe(path === "/missing-page" ? 404 : 200);
  await page.waitForLoadState("networkidle");
  await settle(page);
  expect(await cursorProblems(page), `cursor on ${path}`).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
  // The 404 page itself answers 404; ignore console noise about that one document.
  expect(errors.filter((e) => !(path === "/missing-page" && e.includes("404"))), `errors on ${path}`).toEqual([]);
}

for (const width of [390, 1280]) {
  test(`public pages are polished at ${width}px`, async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width, height: 860 } });
    for (const path of PUBLIC) await audit(page, path);
    await page.close();
  });
}

test("signed-in pages are polished on a phone", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 860 } });
  await signIn(page, uniqueEmail("audit"));
  for (const path of SIGNED_IN) await audit(page, path);
  await page.close();
});

test("admin pages are polished", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  await signIn(page, process.env.E2E_ADMIN_EMAIL ?? "owner@example.com");
  for (const path of ["/admin", "/admin/users", "/admin/jobs", "/admin/flags", "/admin/settings"]) await audit(page, path);
  await page.close();
});

test("admin can turn on Google sign-in from Settings without touching the host", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await signIn(page, process.env.E2E_ADMIN_EMAIL ?? "owner@example.com");
  await page.goto("/admin/settings");
  await expect(page.getByRole("heading", { name: "System check" })).toBeVisible();
  await expect(page.getByText("Connected.")).toBeVisible();
  await page.getByLabel("Google client ID").fill("e2e-client.apps.googleusercontent.com");
  await page.getByLabel("Google client secret").fill("e2e-secret");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Saved. Changes are live now.")).toBeVisible();

  const visitor = await browser.newPage();
  await visitor.goto("/login");
  await expect(visitor.getByRole("button", { name: "Continue with Google" })).toBeVisible();

  // Clean up so other tests see the default login.
  await page.reload();
  await page.getByLabel("Google client ID").fill("");
  await page.getByLabel("Remove this value").first().check();
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Saved. Changes are live now.")).toBeVisible();
  await visitor.goto("/login");
  await expect(visitor.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
  await visitor.close();
  await page.close();
});
