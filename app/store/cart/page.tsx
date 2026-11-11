"use client";

import Link from "next/link";
import { setQuantity, useCart } from "@/components/store/cart";
import { findProduct, formatPrice } from "@/lib/store/catalogue";

export default function CartPage() {
  const items = useCart();
  const lines = items.flatMap((item) => {
    const product = findProduct(item.id);
    return product ? [{ product, quantity: item.quantity }] : [];
  });
  const totalCents = lines.reduce((sum, line) => sum + line.product.priceCents * line.quantity, 0);

  if (lines.length === 0) {
    return (
      <>
        <h1 className="font-display text-4xl font-bold">Your cart</h1>
        <p className="mt-4 text-lg">Your cart is empty.</p>
        <Link
          href="/store"
          className="mt-6 inline-block font-bold text-wax underline underline-offset-4"
        >
          Browse the candles
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display text-4xl font-bold">Your cart</h1>
      <ul className="mt-8 divide-y divide-line border-y border-line">
        {lines.map(({ product, quantity }) => (
          <li key={product.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div>
              <p className="text-lg font-bold">{product.name}</p>
              <p className="text-ink-soft">{formatPrice(product.priceCents)} each</p>
            </div>
            <div className="flex items-center gap-6">
              {/*
                Deliberate snags for the trials: the quantity controls are tiny,
                packed together, sit next to "remove", and are not real buttons,
                so they cannot be reached or used with a keyboard.
              */}
              <div className="flex items-center gap-0.5 text-xs">
                <div
                  onClick={() => setQuantity(product.id, quantity - 1)}
                  className="flex h-4 w-4 cursor-pointer items-center justify-center border border-line"
                >
                  -
                </div>
                <span className="w-5 text-center text-sm">{quantity}</span>
                <div
                  onClick={() => setQuantity(product.id, quantity + 1)}
                  className="flex h-4 w-4 cursor-pointer items-center justify-center border border-line"
                >
                  +
                </div>
                <div
                  onClick={() => setQuantity(product.id, 0)}
                  className="ml-0.5 cursor-pointer text-[10px] underline"
                >
                  remove
                </div>
              </div>
              <p className="w-20 text-right text-lg font-bold">
                {formatPrice(product.priceCents * quantity)}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-2xl font-bold">Total {formatPrice(totalCents)}</p>
        <Link
          href="/store/checkout"
          className="rounded bg-wax px-6 py-3 text-lg font-bold text-card hover:bg-ink"
        >
          Checkout
        </Link>
      </div>
    </>
  );
}
