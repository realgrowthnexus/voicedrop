import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb } from "@/db";
import { rateLimit } from "@/lib/ratelimit";
import { resetDb } from "../helpers/db";

beforeEach(resetDb);
afterAll(closeDb);

describe("rateLimit", () => {
  it("blocks the 11th call in a window and resets in the next window", async () => {
    const t = 1_700_000_000_000;
    for (let i = 0; i < 10; i++) expect((await rateLimit("k", 10, 60, t)).ok).toBe(true);
    const blocked = await rateLimit("k", 10, 60, t);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect((await rateLimit("k", 10, 60, t + 61_000)).ok).toBe(true);
    expect((await rateLimit("other", 10, 60, t)).ok).toBe(true);
  });
});
