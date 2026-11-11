import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { LINE_NAME_LIMIT, PRODUCT_CODE_LIMIT, toLineItems } from "@/lib/payments/checkout";
import { PRODUCTS } from "@/lib/store/catalogue";
import { priceCart } from "@/lib/store/pricing";

describe("payment line items", () => {
  it("keeps every product in the catalogue within the payments API limits", () => {
    const cart = priceCart(PRODUCTS.map((product) => ({ id: product.id, quantity: 1 })));
    for (const item of toLineItems(cart.lines)) {
      expect(item.name.length).toBeLessThanOrEqual(LINE_NAME_LIMIT);
      expect(item.productCode.length).toBeLessThanOrEqual(PRODUCT_CODE_LIMIT);
      expect(item.totalAmount).toMatch(/^\d+\.\d{2}$/);
    }
  });
});
