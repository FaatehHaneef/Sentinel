/**
 * Tallowmere's catalogue. Prices live here, on the server side of every
 * payment: the browser only ever sends product ids and quantities.
 */

export type Product = {
  id: string;
  name: string;
  /** Price in US cents. */
  priceCents: number;
  blurb: string;
  description: string;
  /** Colours for the product's pixel art: wax, wax shade, flame. */
  art: { wax: string; shade: string; flame: string };
};

export const CURRENCY = "USD";

export const PRODUCTS: readonly Product[] = [
  {
    id: "dusk-ember",
    name: "Dusk Ember",
    priceCents: 1800,
    blurb: "Smoked cedar and orange peel",
    description:
      "A slow-burning pillar poured at sundown. Smoked cedar, orange peel and a thread of clove. Burns for about forty hours.",
    art: { wax: "#e8743b", shade: "#b9552a", flame: "#ffe08a" },
  },
  {
    id: "moss-path",
    name: "Moss Path",
    priceCents: 1600,
    blurb: "Wet fern, pine and rain",
    description:
      "The smell of the road after rain. Fern, pine needle and cool stone. Burns for about thirty-five hours.",
    art: { wax: "#6fae75", shade: "#4d8a57", flame: "#fff6d6" },
  },
  {
    id: "lantern-honey",
    name: "Lantern Honey",
    priceCents: 2200,
    blurb: "Beeswax, honey and warm milk",
    description:
      "Pure beeswax from the hives behind the stall. Honey, warm milk and a little vanilla. Burns for about fifty hours.",
    art: { wax: "#ffb347", shade: "#d98f2b", flame: "#fff6d6" },
  },
  {
    id: "night-market",
    name: "Night Market",
    priceCents: 2000,
    blurb: "Black tea, plum and incense",
    description:
      "For late evenings. Black tea, dark plum and a curl of incense. Burns for about forty-five hours.",
    art: { wax: "#6b5b95", shade: "#4b3f6e", flame: "#ffe08a" },
  },
];

export function findProduct(id: string): Product | undefined {
  return PRODUCTS.find((product) => product.id === id);
}

/** Formats cents as a price, for example 1800 -> "$18.00". */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
