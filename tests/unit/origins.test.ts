import { afterEach, describe, expect, it } from "vitest";
import { resetEnvCache } from "@/lib/env";
import { appOrigins } from "@/lib/http";

const saved = process.env.APP_URL;
afterEach(() => {
  process.env.APP_URL = saved;
  resetEnvCache();
});

describe("appOrigins", () => {
  it("accepts both the bare domain and www", () => {
    process.env.APP_URL = "https://voicedrop.rest";
    resetEnvCache();
    expect(appOrigins()).toEqual(["https://voicedrop.rest", "https://www.voicedrop.rest"]);
    process.env.APP_URL = "https://www.voicedrop.rest/";
    resetEnvCache();
    expect(appOrigins()).toEqual(["https://www.voicedrop.rest", "https://voicedrop.rest"]);
  });
  it("leaves localhost alone", () => {
    process.env.APP_URL = "http://localhost:3000";
    resetEnvCache();
    expect(appOrigins()).toEqual(["http://localhost:3000"]);
  });
});
