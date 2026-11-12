"use client";

import { useSyncExternalStore } from "react";
import { CURRENCY, type Product } from "@/lib/store/catalogue";
import { readStoreFixes, STORE_FIX_ATTRIBUTE } from "@/lib/store/variants";

const noSubscription = () => () => {};

/**
 * Machine-readable product data, the kind a shopping agent reads instead of
 * the page's pictures and layout.
 *
 * Deliberate snag for the trials: the store leaves it out unless the
 * "product-data" store fix is switched on. Cog, the AI shopping agent, cannot
 * be sure what it would pay without it. A real shop should put this in the
 * page's HTML on the server.
 */
export function ProductData({ product }: { product: Product }) {
  const on = useSyncExternalStore(
    noSubscription,
    () => readStoreFixes(window.localStorage).includes("product-data"),
    () => false,
  );
  if (!on) return <span hidden {...{ [STORE_FIX_ATTRIBUTE]: "product-data" }} />;

  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.id,
    description: product.description,
    offers: {
      "@type": "Offer",
      price: (product.priceCents / 100).toFixed(2),
      priceCurrency: CURRENCY,
      availability: "https://schema.org/InStock",
    },
  };
  return (
    <script
      type="application/ld+json"
      {...{ [STORE_FIX_ATTRIBUTE]: "product-data" }}
      // The data is built from the store's own catalogue, never from input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
