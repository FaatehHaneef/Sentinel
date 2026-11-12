/**
 * Changes to the demo store's own code that a trial can switch on.
 *
 * Some snags cannot be fixed by restyling a page that has already loaded: a
 * banner that is too heavy has been downloaded by the time anything could
 * change it. For those, Tallowmere carries the fixed version in its own code,
 * and the results page switches it on in this browser before a re-run. The
 * engine switches it off again when the trial ends. It only ever exists on
 * the demo store: on any other site these fixes are advice to follow.
 */

export const STORE_FIX_IDS = ["hero-image", "product-data", "phone-popup"] as const;

export type StoreFixId = (typeof STORE_FIX_IDS)[number];

/** Where the switched-on store fixes are kept, in this browser's local storage. */
export const STORE_FIXES_KEY = "tallowmere-fixes";

/** Marks an element that a store fix replaces, so a check can offer that fix. */
export const STORE_FIX_ATTRIBUTE = "data-tallowmere-fix";

export function isStoreFixId(value: unknown): value is StoreFixId {
  return typeof value === "string" && (STORE_FIX_IDS as readonly string[]).includes(value);
}

/** What each store fix changes, as a developer would make the change in their own shop. */
export const STORE_FIX_ADVICE: Record<StoreFixId, { summary: string; snippet: string }> = {
  "hero-image": {
    summary: "Serve the banner at the size it is shown, compressed, with its size set",
    snippet:
      "<!-- Export the picture at the width it is shown (1000 pixels, not 1600),\n" +
      "     compress it, and set its width and height -->\n" +
      '<img src="banner.png" width="1000" height="375" alt="…" />',
  },
  "phone-popup": {
    summary: "Do not open a popup over the page on arrival on small screens",
    snippet:
      "<!-- On phones, show the offer inside the page instead of over it,\n" +
      "     and never before the shopper has had a chance to look around -->\n" +
      '<section class="club-offer">…</section>',
  },
  "product-data": {
    summary: "Describe the product in machine-readable data, in the page's own HTML",
    snippet:
      '<script type="application/ld+json">\n' +
      "{\n" +
      '  "@context": "https://schema.org",\n' +
      '  "@type": "Product",\n' +
      '  "name": "Dusk Ember",\n' +
      '  "sku": "dusk-ember",\n' +
      '  "offers": {\n' +
      '    "@type": "Offer",\n' +
      '    "price": "18.00",\n' +
      '    "priceCurrency": "USD",\n' +
      '    "availability": "https://schema.org/InStock"\n' +
      "  }\n" +
      "}\n" +
      "</script>",
  },
};

export function readStoreFixes(storage: Storage): StoreFixId[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(STORE_FIXES_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter(isStoreFixId) : [];
  } catch {
    return [];
  }
}

export function writeStoreFixes(storage: Storage, ids: readonly StoreFixId[]): void {
  try {
    if (ids.length === 0) storage.removeItem(STORE_FIXES_KEY);
    else storage.setItem(STORE_FIXES_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    // Without storage the store simply shows its unfixed version.
  }
}
