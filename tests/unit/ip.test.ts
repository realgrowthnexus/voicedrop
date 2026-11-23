import { describe, expect, it } from "vitest";
import { clientIp, isPrivateIp } from "@/lib/abuse/ip";

const h = (xff: string) => new Headers({ "x-forwarded-for": xff });

describe("clientIp", () => {
  it("takes the right-most public address and ignores proxies", () => {
    expect(clientIp(h("203.0.113.9"))).toBe("203.0.113.9");
    expect(clientIp(h("1.2.3.4, 203.0.113.9"))).toBe("203.0.113.9"); // left entry may be forged
    expect(clientIp(h("203.0.113.9, 10.0.0.5"))).toBe("203.0.113.9"); // internal proxy hop
    expect(clientIp(h("203.0.113.9, 172.18.0.2, 127.0.0.1"))).toBe("203.0.113.9");
    expect(clientIp(h("2001:db8::7, fd00::1"))).toBe("2001:db8::7");
    expect(clientIp(h("::ffff:198.51.100.4"))).toBe("198.51.100.4");
  });
  it("returns unknown when only private or garbage values exist", () => {
    expect(clientIp(h("::1"))).toBe("unknown");
    expect(clientIp(h("127.0.0.1, 10.1.1.1"))).toBe("unknown");
    expect(clientIp(h("not-an-ip"))).toBe("unknown");
    expect(clientIp(new Headers())).toBe("unknown");
  });
  it("classifies private ranges", () => {
    for (const ip of ["10.0.0.1", "192.168.1.1", "172.31.255.1", "100.64.0.1", "fe80::1"]) expect(isPrivateIp(ip)).toBe(true);
    for (const ip of ["8.8.8.8", "172.32.0.1", "2001:4860::8888"]) expect(isPrivateIp(ip)).toBe(false);
  });
});
