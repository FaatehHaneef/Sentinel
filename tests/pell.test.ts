import { describe, expect, it } from "vitest";
import { projectedWait, SLOW_PROFILE } from "@/engine/checks/pell";
import { sanitizeFix, fixToSnippet } from "@/lib/trial/fixes";

describe("projected wait on Pell's connection", () => {
  it("adds connection setup, round trips and transfer time", () => {
    // 1 MB at 1 Mbps is 8 seconds, plus 3 setup trips and 1 batch of requests at 300 ms.
    expect(SLOW_PROFILE).toEqual({ megabitsPerSecond: 1, roundTripMs: 300, parallel: 6 });
    expect(projectedWait(1_000_000, 6)).toBeCloseTo(8 + 0.9 + 0.3, 5);
    expect(projectedWait(1_000_000, 7)).toBeCloseTo(8 + 0.9 + 0.6, 5);
  });

  it("separates the heavy and the fixed shop front", () => {
    // The demo store's shop front, as measured: about 1.63 MB in 16 requests, or 0.24 MB in 20.
    expect(projectedWait(1_634_803, 16)).toBeGreaterThan(12);
    expect(projectedWait(236_000, 20)).toBeLessThan(5);
  });
});

describe("store fixes", () => {
  it("keeps a known store fix and shows it as advice for the shop's own code", () => {
    const fix = sanitizeFix({ summary: "Smaller banner", storeFix: "hero-image", source: "rule" });
    expect(fix).toMatchObject({ storeFix: "hero-image" });
    expect(fixToSnippet("body > main", fix!)).toContain('width="1000" height="375"');
  });

  it("drops store fixes that do not exist", () => {
    expect(sanitizeFix({ summary: "x", storeFix: "delete-everything", source: "rule" })).toBeNull();
  });

  it("allows lazy loading and nothing else for the loading attribute", () => {
    expect(sanitizeFix({ summary: "x", attributes: { loading: "lazy" } })?.attributes).toEqual({
      loading: "lazy",
    });
    expect(sanitizeFix({ summary: "x", attributes: { loading: "eager" } })).toBeNull();
  });
});
