import { describe, expect, it } from "vitest";
import { checkOrigin, normalizeOrigin, resolveOwnOrigins } from "@/lib/guards/allow-list";
import { assertSandboxOnly, LiveEnvironmentError } from "@/lib/guards/sandbox";

describe("sandbox-only guard", () => {
  it("accepts an unset or sandbox environment", () => {
    expect(() => assertSandboxOnly({})).not.toThrow();
    expect(() => assertSandboxOnly({ PAYMENTS_ENVIRONMENT: "Sandbox " })).not.toThrow();
  });

  it("refuses anything that is not the sandbox", () => {
    for (const value of ["production", "live", "prod"]) {
      expect(() => assertSandboxOnly({ PAYMENTS_ENVIRONMENT: value })).toThrow(
        LiveEnvironmentError,
      );
    }
  });
});

describe("allow-list", () => {
  const config = {
    ownOrigins: ["https://sentinel.example"],
    verifiedOrigins: ["https://shop.example"],
  };

  it("normalises addresses to their origin", () => {
    expect(normalizeOrigin("https://Shop.Example:443/cart?x=1#y")).toBe("https://shop.example");
    expect(normalizeOrigin("not a url")).toBeNull();
    expect(normalizeOrigin("javascript:alert(1)")).toBeNull();
    expect(normalizeOrigin("https://user:pass@shop.example")).toBeNull();
  });

  it("allows Sentinel's own origin and owner-verified origins", () => {
    expect(checkOrigin("https://sentinel.example/store", config)).toMatchObject({
      allowed: true,
      kind: "own",
    });
    expect(checkOrigin("https://shop.example", config)).toMatchObject({
      allowed: true,
      kind: "verified",
    });
  });

  it("refuses every other origin", () => {
    const refused = { allowed: false, reason: "not-registered" };
    expect(checkOrigin("https://someone-else.example", config)).toEqual(refused);
    expect(checkOrigin("https://shop.example.evil.test", config)).toEqual(refused);
    expect(checkOrigin("https://sub.shop.example", config)).toEqual(refused);
    expect(checkOrigin("ftp://shop.example", config)).toEqual({
      allowed: false,
      reason: "not-an-origin",
    });
  });

  it("refuses plain http except on localhost", () => {
    const withHttp = { ownOrigins: ["http://shop.example", "http://localhost:3000"] };
    expect(checkOrigin("http://shop.example", withHttp)).toEqual({
      allowed: false,
      reason: "insecure",
    });
    expect(checkOrigin("http://localhost:3000", withHttp)).toMatchObject({ allowed: true });
  });

  it("resolves own origins from the deployment, with localhost only outside production", () => {
    expect(
      resolveOwnOrigins({ APP_ORIGIN: "https://sentinel.example/", NODE_ENV: "production" }),
    ).toEqual(["https://sentinel.example"]);
    expect(
      resolveOwnOrigins({ VERCEL_URL: "sentinel-abc.vercel.app", NODE_ENV: "development" }),
    ).toEqual(["https://sentinel-abc.vercel.app", "http://localhost:3000"]);
  });
});
