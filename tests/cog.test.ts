import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { decideByRules } from "@/lib/ai/cog";

const goal = { quantity: 1, budgetPerItem: 25, currency: "USD" };
const offer = {
  name: "Dusk Ember",
  sku: "dusk-ember",
  price: "18.00",
  currency: "USD",
  availability: "https://schema.org/InStock",
};

describe("Cog's rules", () => {
  it("orders a product that is in stock and within budget", () => {
    expect(decideByRules(goal, offer)).toMatchObject({ order: true, quantity: 1 });
  });

  it("declines over budget, out of stock, or in another currency", () => {
    expect(decideByRules(goal, { ...offer, price: "30.00" }).order).toBe(false);
    expect(
      decideByRules(goal, { ...offer, availability: "https://schema.org/OutOfStock" }).order,
    ).toBe(false);
    expect(decideByRules(goal, { ...offer, currency: "EUR" }).order).toBe(false);
    expect(decideByRules(goal, { ...offer, price: "0" }).order).toBe(false);
  });

  it("orders when stock is not stated", () => {
    expect(decideByRules(goal, { ...offer, availability: undefined }).order).toBe(true);
  });
});
