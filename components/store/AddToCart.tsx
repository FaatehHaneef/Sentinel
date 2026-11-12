"use client";

import Link from "next/link";
import { useState } from "react";
import { addToCart } from "./cart";

export function AddToCart({ productId, productName }: { productId: string; productName: string }) {
  const [added, setAdded] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-4">
      <button
        type="button"
        onClick={() => {
          addToCart(productId);
          setAdded(true);
        }}
        // Deliberate snag for the trials: no outline when the keyboard is on this button.
        style={{ outline: "none" }}
        className="rounded bg-wax px-6 py-3 text-lg font-bold text-card hover:bg-ink"
      >
        Add to cart
      </button>
      <p role="status" className="text-ink">
        {added ? (
          <>
            {productName} is in your cart.{" "}
            <Link href="/store/cart" className="font-bold text-wax underline underline-offset-4">
              View cart
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
