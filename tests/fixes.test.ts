import { describe, expect, it } from "vitest";
import { contrastRatio, fixColour, fromHex, toHex } from "@/lib/trial/contrast";
import {
  fixToCss,
  fixToSnippet,
  isSafeSelector,
  sanitizeAppliedFix,
  sanitizeFix,
} from "@/lib/trial/fixes";
import { abandonmentChance, revenueAtRisk, snagWeight } from "@/lib/trial/revenue";
import {
  builtInVerdict,
  checkSuggestedColour,
  verdictRequestSchema,
  withSuggestedColour,
  type VerdictRequest,
} from "@/lib/trial/verdict";
import type { Fix } from "@/lib/trial/types";

const paper = fromHex("#fffaf0")!;

describe("colour fix", () => {
  it("finds a shade that meets the requirement and keeps to the same hue", () => {
    const faint = fromHex("#cfc5b0")!;
    expect(contrastRatio(faint, paper)).toBeLessThan(4.5);
    const fixed = fixColour(faint, paper, 4.5);
    expect(contrastRatio(fixed, paper)).toBeGreaterThanOrEqual(4.5);
    // Warm beige stays warm: red is still the strongest channel.
    expect(fixed.r).toBeGreaterThanOrEqual(fixed.b);
  });

  it("lightens text on a dark background", () => {
    const night = fromHex("#12152a")!;
    const dim = fromHex("#3a3f5c")!;
    const fixed = fixColour(dim, night, 4.5);
    expect(contrastRatio(fixed, night)).toBeGreaterThanOrEqual(4.5);
    expect(fixed.r).toBeGreaterThan(dim.r);
  });

  it("converts colours to and from hex", () => {
    expect(toHex({ r: 255, g: 179, b: 71, a: 1 })).toBe("#ffb347");
    expect(fromHex("#abc")).toEqual({ r: 170, g: 187, b: 204, a: 1 });
    expect(fromHex("red")).toBeNull();
    expect(fromHex("#12345")).toBeNull();
  });
});

describe("fix allow-list", () => {
  it("keeps allowed style changes and labels", () => {
    const fix = sanitizeFix({
      summary: "Darken",
      css: [{ target: "placeholder", declarations: { color: "#5c4a3a", "font-size": "14px" } }],
      label: "  Full name  ",
      source: "ai",
    });
    expect(fix).toEqual({
      summary: "Darken",
      css: [{ target: "placeholder", declarations: { color: "#5c4a3a", "font-size": "14px" } }],
      label: "Full name",
      source: "ai",
    });
  });

  it("drops properties and values that are not allowed", () => {
    const fix = sanitizeFix({
      summary: "x",
      css: [
        {
          target: "element",
          declarations: {
            color: "#000",
            position: "fixed",
            "background-color": "url(https://example.com/x.png)",
            border: "2px solid #000; } body { display: none",
            outline: "expression(alert(1))",
            padding: "var(--x)",
            "font-size": "14px",
          },
        },
      ],
    });
    expect(fix?.css?.[0].declarations).toEqual({ color: "#000", "font-size": "14px" });
  });

  it("rejects a fix with nothing usable in it", () => {
    expect(
      sanitizeFix({
        summary: "x",
        css: [{ target: "element", declarations: { content: "'hi'" } }],
      }),
    ).toBeNull();
    expect(
      sanitizeFix({ summary: "x", css: [{ target: "page", declarations: { color: "#000" } }] }),
    ).toBeNull();
    expect(sanitizeFix("color: red")).toBeNull();
    expect(sanitizeFix(null)).toBeNull();
  });

  it("accepts only selectors of the shape the engine produces", () => {
    expect(isSafeSelector("body > div > main > div > form > input:nth-of-type(2)")).toBe(true);
    expect(isSafeSelector("#checkout > p")).toBe(true);
    expect(isSafeSelector("body, html")).toBe(false);
    expect(isSafeSelector("body > *")).toBe(false);
    expect(isSafeSelector("body { } html")).toBe(false);
    expect(isSafeSelector("body > input[type=password]")).toBe(false);
    expect(isSafeSelector("")).toBe(false);
  });

  it("rejects an applied fix with an unsafe selector", () => {
    const fix: Fix = {
      summary: "x",
      css: [{ target: "element", declarations: { color: "#000" } }],
      source: "rule",
    };
    expect(
      sanitizeAppliedFix({ check: "c", selector: "body > p", label: "l", fix }),
    ).not.toBeNull();
    expect(sanitizeAppliedFix({ check: "c", selector: "*", label: "l", fix })).toBeNull();
  });

  it("writes the fix as CSS, with !important only when trying it live", () => {
    const fix: Fix = {
      summary: "x",
      css: [{ target: "placeholder", declarations: { color: "#5c4a3a" } }],
      label: "Full name",
      source: "rule",
    };
    expect(fixToCss("body > input", fix)).toBe("body > input::placeholder {\n  color: #5c4a3a;\n}");
    expect(fixToCss("body > input", fix, true)).toContain("color: #5c4a3a !important;");
    expect(fixToSnippet("body > input", fix)).toContain('<label for="field-id">Full name</label>');
  });
});

describe("revenue at risk", () => {
  const snag = (severity: "minor" | "major" | "blocker", onPath: boolean, funnel: number) => ({
    funnel,
    finding: { severity, onPath },
  });

  it("weighs serious snags, snags needed to buy, and snags near payment more heavily", () => {
    expect(snagWeight(snag("blocker", false, 1))).toBeGreaterThan(
      snagWeight(snag("major", false, 1)),
    );
    expect(snagWeight(snag("major", true, 1))).toBeGreaterThan(snagWeight(snag("major", false, 1)));
    expect(snagWeight(snag("major", false, 1.5))).toBeGreaterThan(
      snagWeight(snag("major", false, 0.5)),
    );
  });

  it("rises with every snag and never reaches certainty", () => {
    expect(abandonmentChance([])).toBe(0);
    const one = abandonmentChance([snag("blocker", true, 1.25)]);
    const two = abandonmentChance([snag("blocker", true, 1.25), snag("major", true, 1.25)]);
    expect(two).toBeGreaterThan(one);
    expect(
      abandonmentChance(Array.from({ length: 60 }, () => snag("blocker", true, 1.5))),
    ).toBeLessThan(1);
  });

  it("multiplies the four inputs", () => {
    const inputs = { monthlyCheckouts: 1000, shopperShare: 0.05, averageOrderValue: 18 };
    expect(revenueAtRisk(inputs, 0.5)).toBeCloseTo(450);
    expect(revenueAtRisk(inputs, 0)).toBe(0);
    expect(revenueAtRisk({ ...inputs, monthlyCheckouts: Number.NaN }, 0.5)).toBe(0);
  });
});

describe("verdict", () => {
  const request: VerdictRequest = verdictRequestSchema.parse({
    character: "iris",
    outcome: "abandoned",
    abandonedAt: "Your details",
    purse: 180,
    coinsLost: 180,
    snags: [
      {
        check: "iris.contrast",
        title: "Text stands out from its background",
        severity: "blocker",
        label: '"Full name" field',
        measured: "Placeholder contrast 1.6:1, needs 4.5:1",
        onPath: true,
        scene: "Your details",
        evidence: { foreground: "#cfc5b0", background: "#fffaf0", ratio: 1.67, required: 4.5 },
      },
      {
        check: "something.new",
        title: "A check with no standard note",
        severity: "minor",
        label: '"x" text',
        measured: "m",
        onPath: false,
        scene: "Cart",
      },
    ],
  });

  it("writes standard notes from the facts, one per snag", () => {
    const verdict = builtInVerdict(request);
    expect(verdict.source).toBe("built-in");
    expect(verdict.headline).toBe('Grandma Iris left at "Your details" without buying');
    expect(verdict.story).toContain("180 coins");
    expect(verdict.notes).toHaveLength(2);
    expect(verdict.notes[0].why).toMatch(/darker colour/);
    expect(verdict.notes[1].why.length).toBeGreaterThan(10);
  });

  it("describes a completed purchase and what was fixed", () => {
    const verdict = builtInVerdict({
      ...request,
      outcome: "purchased",
      coinsLost: 9,
      snags: [],
      fixedCount: 8,
    });
    expect(verdict.headline).toBe("Grandma Iris bought without a single snag");
    expect(verdict.story).toContain("8 snags from the last trial are gone");
  });

  it("accepts a suggested colour only if it really meets the requirement", () => {
    const evidence = request.snags[0].evidence;
    expect(checkSuggestedColour("#5c4a3a", evidence)).toBeGreaterThan(4.6);
    expect(checkSuggestedColour("#bbb09a", evidence)).toBeNull();
    expect(checkSuggestedColour("javascript:alert(1)", evidence)).toBeNull();
    expect(checkSuggestedColour("#5c4a3a", undefined)).toBeNull();
  });

  it("swaps in a verified colour and ignores a failing one", () => {
    const fix: Fix = {
      summary: "Darken",
      css: [{ target: "placeholder", declarations: { color: "#766d5c" } }],
      source: "rule",
    };
    const evidence = request.snags[0].evidence;
    const swapped = withSuggestedColour(fix, "#5C4A3A", evidence);
    expect(swapped).toMatchObject({
      source: "ai",
      css: [{ target: "placeholder", declarations: { color: "#5c4a3a" } }],
    });
    expect(withSuggestedColour(fix, "#eeeeee", evidence)).toBe(fix);
    const border: Fix = {
      summary: "b",
      css: [{ target: "element", declarations: { border: "2px solid #000" } }],
      source: "rule",
    };
    expect(withSuggestedColour(border, "#5c4a3a", evidence)).toBe(border);
  });

  it("refuses oversized or malformed requests", () => {
    expect(verdictRequestSchema.safeParse({ ...request, character: "nobody" }).success).toBe(false);
    expect(
      verdictRequestSchema.safeParse({
        ...request,
        snags: Array.from({ length: 41 }, () => request.snags[0]),
      }).success,
    ).toBe(false);
    expect(
      verdictRequestSchema.safeParse({
        ...request,
        snags: [{ ...request.snags[0], evidence: { foreground: "red" } }],
      }).success,
    ).toBe(false);
  });
});
