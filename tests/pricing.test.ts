import { describe, expect, it } from "vitest";
import { PRODUCTS } from "@/lib/store/catalogue";
import {
  cartItemsSchema,
  centsToAmount,
  MAX_QUANTITY,
  priceCart,
  UnknownProductError,
} from "@/lib/store/pricing";

const [first, second] = PRODUCTS;

describe("server-side pricing", () => {
  it("prices lines from the catalogue", () => {
    const cart = priceCart([
      { id: first.id, quantity: 2 },
      { id: second.id, quantity: 1 },
    ]);
    expect(cart.totalCents).toBe(first.priceCents * 2 + second.priceCents);
    expect(cart.lines[0]).toMatchObject({ name: first.name, unitCents: first.priceCents });
  });

  it("merges repeated products and caps the quantity", () => {
    const cart = priceCart([
      { id: first.id, quantity: 8 },
      { id: first.id, quantity: 8 },
    ]);
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].quantity).toBe(MAX_QUANTITY);
  });

  it("refuses products that are not in the catalogue", () => {
    expect(() => priceCart([{ id: "free-gold", quantity: 1 }])).toThrow(UnknownProductError);
  });

  it("ignores any price the browser sends", () => {
    const parsed = cartItemsSchema.parse([{ id: first.id, quantity: 1, priceCents: 1 }]);
    expect(parsed[0]).not.toHaveProperty("priceCents");
    expect(priceCart(parsed).totalCents).toBe(first.priceCents);
  });

  it("rejects empty carts and impossible quantities", () => {
    expect(cartItemsSchema.safeParse([]).success).toBe(false);
    expect(cartItemsSchema.safeParse([{ id: first.id, quantity: 0 }]).success).toBe(false);
    expect(cartItemsSchema.safeParse([{ id: first.id, quantity: -3 }]).success).toBe(false);
    expect(cartItemsSchema.safeParse([{ id: first.id, quantity: 1.5 }]).success).toBe(false);
    expect(cartItemsSchema.safeParse([{ id: first.id, quantity: 999 }]).success).toBe(false);
  });

  it("formats amounts with two decimals", () => {
    expect(centsToAmount(1800)).toBe("18.00");
    expect(centsToAmount(5)).toBe("0.05");
  });
});
