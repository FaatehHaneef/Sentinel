import { z } from "zod";
import { findProduct } from "./catalogue";

/**
 * Server-side pricing. The browser sends only product ids and quantities.
 * Every amount charged is computed here from the catalogue, so a tampered
 * request cannot change what an order costs.
 */

export const MAX_QUANTITY = 10;
export const MAX_LINES = 20;

export const cartItemsSchema = z
  .array(
    z.object({
      id: z.string().min(1).max(64),
      quantity: z.number().int().min(1).max(MAX_QUANTITY),
    }),
  )
  .min(1)
  .max(MAX_LINES);

export type CartItem = z.infer<typeof cartItemsSchema>[number];

export type PricedLine = {
  id: string;
  name: string;
  quantity: number;
  unitCents: number;
  totalCents: number;
};

export type PricedCart = {
  lines: PricedLine[];
  totalCents: number;
};

export class UnknownProductError extends Error {
  constructor(public readonly productId: string) {
    super(`Unknown product: ${productId}`);
    this.name = "UnknownProductError";
  }
}

/** Merges repeated ids, then prices each line from the catalogue. */
export function priceCart(items: readonly CartItem[]): PricedCart {
  const quantities = new Map<string, number>();
  for (const item of items) {
    quantities.set(item.id, (quantities.get(item.id) ?? 0) + item.quantity);
  }

  const lines: PricedLine[] = [];
  for (const [id, requested] of quantities) {
    const product = findProduct(id);
    if (!product) throw new UnknownProductError(id);
    const quantity = Math.min(requested, MAX_QUANTITY);
    lines.push({
      id,
      name: product.name,
      quantity,
      unitCents: product.priceCents,
      totalCents: product.priceCents * quantity,
    });
  }

  return { lines, totalCents: lines.reduce((sum, line) => sum + line.totalCents, 0) };
}

/** Cents to the decimal string the payments API expects, for example 1800 -> "18.00". */
export function centsToAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}
