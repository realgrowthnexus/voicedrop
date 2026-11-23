import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyPaddleSignature } from "@/lib/billing/paddle";

const secret = "pdl_ntfset_test_secret";
const body = '{"event_id":"evt_1"}';
const sign = (ts: number, b = body, s = secret) => `ts=${ts};h1=${createHmac("sha256", s).update(`${ts}:${b}`).digest("hex")}`;
const now = 1_800_000_000_000;

describe("verifyPaddleSignature", () => {
  it("accepts a valid signature", () => {
    expect(verifyPaddleSignature(body, sign(now / 1000), secret, now)).toBe(true);
  });
  it("rejects tampered body, wrong secret, missing header", () => {
    expect(verifyPaddleSignature(body + " ", sign(now / 1000), secret, now)).toBe(false);
    expect(verifyPaddleSignature(body, sign(now / 1000, body, "other"), secret, now)).toBe(false);
    expect(verifyPaddleSignature(body, null, secret, now)).toBe(false);
    expect(verifyPaddleSignature(body, "garbage", secret, now)).toBe(false);
  });
  it("rejects expired timestamps", () => {
    expect(verifyPaddleSignature(body, sign(now / 1000 - 120), secret, now)).toBe(false);
  });
});
