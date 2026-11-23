import { describe, expect, it } from "vitest";
import { countChars, normalizeScript } from "@/lib/quota/count";
import { checkSubmit, resolveTier, type Balances } from "@/lib/quota/rules";

const base: Balances = {
  freeRemaining: 3000,
  subscriptionRemaining: 0,
  packRemaining: 0,
  usedLast24h: 0,
  activeJobs: 0,
  subscriptionPlan: null,
};

const ok = (chars: number, b: Partial<Balances>, formats: ("mp3" | "wav" | "srt")[] = ["mp3"]) =>
  checkSubmit({ chars, formats, banned: false }, { ...base, ...b });

describe("count", () => {
  it("normalises whitespace", () => {
    expect(normalizeScript("  a \n\n b ")).toBe("a b");
    expect(countChars("  a \n\n b ")).toBe(3);
    expect(countChars("\t\n ")).toBe(0);
  });
});

describe("resolveTier", () => {
  it("prefers subscription, then pack, then free", () => {
    expect(resolveTier({ ...base, subscriptionPlan: "pro", packRemaining: 10 })).toBe("pro");
    expect(resolveTier({ ...base, packRemaining: 1 })).toBe("pack");
    expect(resolveTier(base)).toBe("free");
  });
});

describe("checkSubmit", () => {
  it("rejects banned users and empty scripts", () => {
    expect(checkSubmit({ chars: 10, formats: ["mp3"], banned: true }, base)).toEqual({ ok: false, code: "banned" });
    expect(ok(0, {})).toEqual({ ok: false, code: "empty" });
  });

  it("enforces the free per-request limit and formats", () => {
    expect(ok(1501, {})).toEqual({ ok: false, code: "too_long" });
    expect(ok(100, {}, ["mp3", "wav"])).toEqual({ ok: false, code: "format_not_allowed" });
    expect(ok(1500, {})).toEqual({ ok: true, tier: "free", charges: [{ bucket: "free", amount: 1500 }] });
  });

  it("rejects when the free weekly balance is not enough", () => {
    expect(ok(600, { freeRemaining: 500 })).toEqual({ ok: false, code: "insufficient" });
  });

  it("allows only one active job", () => {
    expect(ok(10, { activeJobs: 1 })).toEqual({ ok: false, code: "job_active" });
  });

  it("applies the creator daily cap", () => {
    expect(ok(2000, { subscriptionPlan: "creator", subscriptionRemaining: 90_000, usedLast24h: 24_000 })).toEqual({
      ok: false,
      code: "daily_cap",
    });
  });

  it("spends subscription before pack", () => {
    expect(ok(3000, { subscriptionPlan: "creator", subscriptionRemaining: 1000, packRemaining: 50_000 }, ["wav", "srt"])).toEqual({
      ok: true,
      tier: "creator",
      charges: [
        { bucket: "subscription", amount: 1000 },
        { bucket: "pack", amount: 2000 },
      ],
    });
  });

  it("pack tier spends free weekly first, then pack, and may send 10k", () => {
    expect(ok(5000, { packRemaining: 50_000 })).toEqual({
      ok: true,
      tier: "pack",
      charges: [
        { bucket: "free", amount: 3000 },
        { bucket: "pack", amount: 2000 },
      ],
    });
    expect(ok(10_001, { packRemaining: 50_000 })).toEqual({ ok: false, code: "too_long" });
  });

  it("subscribers do not spend the free weekly allowance", () => {
    expect(ok(500, { subscriptionPlan: "pro", subscriptionRemaining: 0, freeRemaining: 3000 })).toEqual({
      ok: false,
      code: "insufficient",
    });
  });

  it("pro daily cap is 60k", () => {
    expect(ok(10_000, { subscriptionPlan: "pro", subscriptionRemaining: 300_000, usedLast24h: 50_000 }).ok).toBe(true);
    expect(ok(10_000, { subscriptionPlan: "pro", subscriptionRemaining: 300_000, usedLast24h: 50_001 })).toEqual({
      ok: false,
      code: "daily_cap",
    });
  });
});
