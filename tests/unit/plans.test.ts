import { describe, expect, it } from "vitest";
import { TIERS, VOICES, FREE_WEEKLY_CHARS, PLAN_ALLOWANCE, PACK_CHARS, voiceById } from "@/lib/plans";

describe("plan constants", () => {
  it("matches the spec limits", () => {
    expect(FREE_WEEKLY_CHARS).toBe(3000);
    expect(PLAN_ALLOWANCE).toEqual({ creator: 100_000, pro: 300_000 });
    expect(PACK_CHARS).toBe(50_000);
    expect(TIERS.free.maxPerRequest).toBe(1500);
    expect(TIERS.free.dailyCap).toBeNull();
    expect(TIERS.free.formats).toEqual(["mp3"]);
    expect(TIERS.free.priority).toBe(false);
    for (const t of ["pack", "creator", "pro"] as const) {
      expect(TIERS[t].maxPerRequest).toBe(10_000);
      expect(TIERS[t].formats).toEqual(["mp3", "wav", "srt"]);
      expect(TIERS[t].priority).toBe(true);
    }
    expect(TIERS.creator.dailyCap).toBe(25_000);
    expect(TIERS.pro.dailyCap).toBe(60_000);
    expect(TIERS.pack.dailyCap).toBe(25_000);
  });

  it("has 12 unique voices with the blend", () => {
    expect(VOICES).toHaveLength(12);
    expect(new Set(VOICES.map((v) => v.id)).size).toBe(12);
    expect(voiceById("blend_michael_fenrir")?.blend).toEqual(["am_michael", "am_fenrir"]);
    expect(voiceById("nope")).toBeUndefined();
  });
});
