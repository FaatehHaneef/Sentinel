import { describe, expect, it } from "vitest";
import {
  composite,
  contrastRatio,
  contrastSeverity,
  formatRatio,
  requiredContrast,
} from "@/lib/trial/contrast";
import {
  coinCost,
  patienceCost,
  purseFor,
  STARTING_PATIENCE,
  summarize,
} from "@/lib/trial/scoring";
import { createLaunchToken, LAUNCH_TOKEN_TTL_SECONDS, verifyLaunchToken } from "@/lib/trial/token";
import type { RunConfig, TrialEvent } from "@/lib/trial/types";

const black = { r: 0, g: 0, b: 0, a: 1 };
const white = { r: 255, g: 255, b: 255, a: 1 };

describe("contrast", () => {
  it("matches the WCAG reference values", () => {
    expect(contrastRatio(black, white)).toBeCloseTo(21, 5);
    expect(contrastRatio(white, white)).toBe(1);
    // #767676 on white is the well-known lightest grey that passes 4.5:1.
    expect(contrastRatio({ r: 118, g: 118, b: 118, a: 1 }, white)).toBeCloseTo(4.54, 2);
  });

  it("blends translucent text over its background before measuring", () => {
    const halfBlack = composite({ ...black, a: 0.5 }, white);
    expect(halfBlack.r).toBeCloseTo(127.5);
    expect(contrastRatio(halfBlack, white)).toBeLessThan(contrastRatio(black, white));
  });

  it("requires less contrast for large text", () => {
    expect(requiredContrast(16, 400)).toBe(4.5);
    expect(requiredContrast(24, 400)).toBe(3);
    expect(requiredContrast(19, 700)).toBe(3);
    expect(requiredContrast(19, 400)).toBe(4.5);
  });

  it("grades a shortfall by how far below the requirement it is", () => {
    expect(contrastSeverity(4.5, 4.5)).toBeNull();
    expect(contrastSeverity(3.5, 4.5)).toBe("minor");
    expect(contrastSeverity(2.5, 4.5)).toBe("major");
    expect(contrastSeverity(1.7, 4.5)).toBe("blocker");
  });

  it("never rounds a failing ratio up to a passing one", () => {
    expect(formatRatio(4.49)).toBe("4.4:1");
  });
});

describe("scoring", () => {
  it("gives ten coins per dollar in the cart", () => {
    expect(purseFor(1800)).toBe(180);
  });

  it("costs more patience for worse snags and for snags on the path to buying", () => {
    const off = { severity: "major" as const, onPath: false };
    const on = { severity: "major" as const, onPath: true };
    expect(patienceCost(on)).toBeGreaterThan(patienceCost(off));
    expect(patienceCost({ severity: "blocker", onPath: false })).toBeGreaterThan(patienceCost(off));
    // No single snag ends a walk on its own.
    expect(patienceCost({ severity: "blocker", onPath: true })).toBeLessThan(STARTING_PATIENCE);
  });

  it("costs more coins near payment and never more than the purse holds", () => {
    const finding = { severity: "major" as const, onPath: false };
    expect(coinCost(180, 180, finding, 1.5)).toBeGreaterThan(coinCost(180, 180, finding, 0.5));
    expect(coinCost(180, 3, { severity: "blocker", onPath: true }, 1.5)).toBe(3);
    expect(coinCost(180, 180, { severity: "minor", onPath: false }, 0.5)).toBeGreaterThanOrEqual(1);
  });

  it("summarises an event log per character", () => {
    const events: TrialEvent[] = [
      {
        t: 1,
        character: "iris",
        type: "snag",
        scene: "details",
        title: "Text stands out",
        line: "Too faint.",
        coins: 20,
        patience: 37.5,
        finding: {
          check: "iris.contrast",
          severity: "blocker",
          selector: "input",
          label: '"Full name" field',
          measured: "Contrast 1.7:1, needs 4.5:1",
          onPath: true,
        },
      },
      { t: 2, character: "iris", type: "pass", scene: "details", check: "x", title: "X", xp: 20 },
      {
        t: 3,
        character: "iris",
        type: "abandon",
        scene: "details",
        reason: "patience",
        coins: 160,
      },
      {
        t: 4,
        character: "iris",
        type: "finish",
        outcome: "abandoned",
        coinsLeft: 0,
        coinsLost: 180,
        xp: 20,
      },
    ];
    const [summary] = summarize(events);
    expect(summary).toMatchObject({
      character: "iris",
      outcome: "abandoned",
      coinsLost: 180,
      xp: 20,
      abandonedAt: "details",
    });
    expect(summary.snags).toHaveLength(1);
    expect(summary.passes).toHaveLength(1);
  });
});

describe("launch tokens", () => {
  const secret = new TextEncoder().encode("test-secret-test-secret-test-secret");
  const config: RunConfig = {
    runId: "0c1f4a1e-1111-4222-8333-444455556666",
    party: ["iris"],
    seed: 42,
    pace: "normal",
    origin: "https://sentinel.example",
    kind: "own",
  };
  const now = new Date("2026-11-11T12:00:00Z");

  it("round-trips a run", async () => {
    const token = await createLaunchToken(config, secret, now);
    expect(await verifyLaunchToken(token, secret, now)).toEqual(config);
  });

  it("refuses an expired token", async () => {
    const token = await createLaunchToken(config, secret, now);
    const later = new Date(now.getTime() + (LAUNCH_TOKEN_TTL_SECONDS + 1) * 1000);
    expect(await verifyLaunchToken(token, secret, later)).toBeNull();
  });

  it("refuses a token signed with another key", async () => {
    const token = await createLaunchToken(
      config,
      new TextEncoder().encode("another-secret-another-secret-xx"),
      now,
    );
    expect(await verifyLaunchToken(token, secret, now)).toBeNull();
  });

  it("refuses a token whose contents were changed", async () => {
    const token = await createLaunchToken(config, secret, now);
    const [header, payload, signature] = token.split(".");
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
    decoded.run.origin = "https://someone-else.example";
    const forged = [
      header,
      Buffer.from(JSON.stringify(decoded)).toString("base64url"),
      signature,
    ].join(".");
    expect(await verifyLaunchToken(forged, secret, now)).toBeNull();
  });

  it("refuses anything that is not a token", async () => {
    expect(await verifyLaunchToken("not-a-token", secret, now)).toBeNull();
  });
});
