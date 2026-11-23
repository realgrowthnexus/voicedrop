import { describe, expect, it } from "vitest";
import { screenScript } from "@/lib/abuse/content";

describe("screenScript", () => {
  it("flags scam phrasing", () => {
    expect(screenScript("Call me to verify your account and buy gift cards").flagged).toBe(true);
    expect(screenScript("Hello, this is your bank calling about your card.").flagged).toBe(true);
    expect(screenScript("Please read me your one-time password").flagged).toBe(true);
  });
  it("does not flag normal YouTube scripts or innocent substrings", () => {
    expect(screenScript("Welcome back to the channel! Today we test 5 budget gaming mice.").flagged).toBe(false);
    expect(screenScript("Scunthorpe United played Spiceworks and the bank of the river flooded.").flagged).toBe(false);
    expect(screenScript("Verify your sources before you publish a video.").flagged).toBe(false);
  });
  it("flags violent threats", () => {
    expect(screenScript("I will kill you tomorrow").flagged).toBe(true);
  });
});
