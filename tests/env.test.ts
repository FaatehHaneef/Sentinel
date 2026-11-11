import { describe, expect, it } from "vitest";
import { collectAiKeys, parseServerEnv } from "@/lib/env";

describe("server environment", () => {
  it("names the variables that are missing", () => {
    expect(() => parseServerEnv({ BRAINTREE_MERCHANT_ID: "m" })).toThrow(
      /BRAINTREE_PUBLIC_KEY, BRAINTREE_PRIVATE_KEY/,
    );
  });

  it("parses a complete environment", () => {
    const env = parseServerEnv({
      BRAINTREE_MERCHANT_ID: "m",
      BRAINTREE_PUBLIC_KEY: "p",
      BRAINTREE_PRIVATE_KEY: "s",
    });
    expect(env.BRAINTREE_MERCHANT_ID).toBe("m");
  });
});

describe("AI keys", () => {
  it("reads a comma-separated list and numbered variables in order, without duplicates", () => {
    const keys = collectAiKeys({
      GEMINI_API_KEYS: "a, b",
      GEMINI_API_KEY_10: "e",
      GEMINI_API_KEY_2: "d",
      GEMINI_API_KEY_1: "b",
      GEMINI_API_KEY_3: " ",
    });
    expect(keys).toEqual(["a", "b", "d", "e"]);
  });

  it("returns an empty list when no key is configured", () => {
    expect(collectAiKeys({})).toEqual([]);
  });
});
