import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signIn, sql, uniqueEmail } from "./helpers";

// @axe-core/playwright is typed against a newer playwright-core; the runtime API is identical.
const axe = (page: unknown) => new AxeBuilder({ page: page as ConstructorParameters<typeof AxeBuilder>[0]["page"] });

test.afterAll(async () => {
  await sql.end();
});

test("hero demo highlights words while it plays", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Play Atlas", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect.poll(() => page.locator("p[aria-label='Demo script'] .marker").count(), { timeout: 15_000 }).toBeGreaterThan(5);
});

test("signed-out visitors are sent to sign in, admin is hidden", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  const res = await page.goto("/admin");
  expect(res?.status()).toBe(404);
  // A forged router-state header must not let the admin page render without its layout check.
  const tree = encodeURIComponent(JSON.stringify(["", { children: ["admin", { children: ["users", { children: ["__PAGE__", {}] }] }] }, null, null, true]));
  const rsc = await page.request.get("/admin/users?q=", { headers: { RSC: "1", "Next-Router-State-Tree": tree } });
  expect(await rsc.text()).not.toContain("@gmail.com");
});

test("free user: sign in, generate, play and download an MP3", async ({ page }) => {
  const email = uniqueEmail("free");
  await signIn(page, email);
  await expect(page.getByRole("heading", { name: "Studio" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "WAV" })).toBeDisabled();
  await page.getByRole("radio", { name: /George/ }).first().check();
  await page.locator("#script").fill("Welcome back to the channel. Today we test three budget microphones under fifty dollars.");
  await page.getByRole("button", { name: /Generate voice-over/ }).click();
  await expect(page.getByText(/^Done:/)).toBeVisible({ timeout: 90_000 });
  const href = await page.getByRole("link", { name: "Download MP3" }).getAttribute("href");
  const dl = await page.request.get(href!);
  expect(dl.status()).toBe(200);
  expect(dl.headers()["content-type"]).toBe("audio/mpeg");
  expect((await dl.body()).length).toBeGreaterThan(20_000);
  const dur = await page.locator("audio[controls]").evaluate(
    (a: HTMLAudioElement) => new Promise<number>((r) => (a.readyState > 0 ? r(a.duration) : a.addEventListener("loadedmetadata", () => r(a.duration)))).then((d) => d),
  );
  expect(dur).toBeGreaterThan(2);
  await page.getByRole("link", { name: "History" }).click();
  await expect(page.getByText("Ready")).toBeVisible();
  // the WAV of a free job is not available
  const wav = await page.request.get(href!.replace("/mp3", "/wav"));
  expect(wav.status()).toBe(404);
});

test("banned user loses access immediately", async ({ page }) => {
  const email = uniqueEmail("ban");
  await signIn(page, email);
  expect((await page.request.get("/api/me")).status()).toBe(200);
  await sql`update "user" set banned = true where email = ${email}`;
  expect((await page.request.get("/api/me")).status()).toBe(403);
  const r = await page.request.post("/api/jobs", { data: { text: "hello", voice: "af_heart", formats: ["mp3"] } });
  expect(r.status()).toBe(403);
});

for (const scheme of ["light", "dark"] as const) {
  test(`no serious accessibility violations (${scheme})`, async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: scheme });
    const page = await ctx.newPage();
    for (const path of ["/", "/pricing", "/voices", "/login", "/terms"]) {
      await page.goto(path);
      const r = await axe(page).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(bad.map((v) => `${path}: ${v.id} (${v.nodes.length})`)).toEqual([]);
    }
    const email = uniqueEmail(`a11y-${scheme}`);
    await signIn(page, email);
    for (const path of ["/dashboard", "/history", "/billing"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const r = await axe(page).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(bad.map((v) => `${path}: ${v.id} ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
    }
    await ctx.close();
  });
}
