import { STORE_FIX_ADVICE, STORE_FIX_ATTRIBUTE } from "@/lib/store/variants";
import type { Fix } from "@/lib/trial/types";
import { cssPath, describe, findByText, isVisible, textOf } from "../core/dom";
import { keepWorst, type CheckContext, type CheckResult, type Located } from "./types";

/**
 * Cog's checks: what an AI shopping agent needs from a shop. An agent does
 * not look at pictures and layout. It reads the page's structured data and
 * its controls, and it will not pay a price it cannot confirm.
 */

export type ProductData = {
  name: string;
  sku?: string;
  price: string;
  currency: string;
  availability?: string;
};

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : null;
}

function isProduct(node: JsonObject): boolean {
  const type = node["@type"];
  return type === "Product" || (Array.isArray(type) && type.includes("Product"));
}

/** Reads the first schema.org Product in the page's JSON-LD, if there is one with a price. */
export function readProductData(root: ParentNode = document): ProductData | null {
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(script.textContent ?? "");
    } catch {
      continue;
    }
    const top = asObject(parsed);
    const candidates = [
      ...(Array.isArray(parsed) ? parsed : []),
      ...(Array.isArray(top?.["@graph"]) ? (top!["@graph"] as unknown[]) : []),
      parsed,
    ]
      .map(asObject)
      .filter((node): node is JsonObject => node !== null && isProduct(node));

    for (const product of candidates) {
      const offers = product.offers;
      const offer = asObject(Array.isArray(offers) ? offers[0] : offers);
      const price = offer?.price;
      const currency = offer?.priceCurrency;
      if (
        (typeof price !== "string" && typeof price !== "number") ||
        typeof currency !== "string"
      ) {
        continue;
      }
      return {
        name: String(product.name ?? "").slice(0, 120),
        sku: typeof product.sku === "string" ? product.sku.slice(0, 64) : undefined,
        price: Number(price).toFixed(2),
        currency: currency.slice(0, 3).toUpperCase(),
        availability: typeof offer?.availability === "string" ? offer.availability : undefined,
      };
    }
  }
  return null;
}

/** The first price shown in the page's main content, as "18.00". */
function visiblePrice(): string | null {
  const main = document.querySelector("main") ?? document.body;
  const match = /\$\s?(\d+(?:\.\d{2})?)/.exec(textOf(main));
  return match ? Number(match[1]).toFixed(2) : null;
}

/** A product page shows one product with a way to buy it. */
function isProductPage(): boolean {
  return (
    document.querySelector("main h1") !== null &&
    findByText("button, a, input[type='submit']", /add to (cart|basket|bag)|buy now/i) !== null
  );
}

function productFix(): Fix | undefined {
  // Only the demo store carries this change in its own code; elsewhere it is advice.
  if (!document.querySelector(`[${STORE_FIX_ATTRIBUTE}="product-data"]`)) return undefined;
  return {
    summary: STORE_FIX_ADVICE["product-data"].summary,
    storeFix: "product-data",
    source: "rule",
  };
}

const REAL_CONTROLS =
  "a[href], button, input, select, textarea, summary, [role='button'], [role='link']";

export function runCogChecks(context: CheckContext): CheckResult[] {
  const data: CheckResult = {
    check: "cog.product-data",
    title: "The product can be read by a machine",
    weight: "blocker",
    findings: [],
  };
  const price: CheckResult = {
    check: "cog.price-match",
    title: "The price in the data matches the page",
    weight: "major",
    findings: [],
  };
  const controls: CheckResult = {
    check: "cog.real-controls",
    title: "The way to buy uses real buttons and links",
    weight: "major",
    findings: [],
  };

  // Whatever the page, the things an agent must press have to be real controls.
  for (const element of context.pathElements) {
    if (element.matches(REAL_CONTROLS) || !isVisible(element)) continue;
    controls.findings.push({
      element,
      check: "cog.real-controls",
      severity: "major",
      selector: cssPath(element),
      label: describe(element),
      measured:
        "This is needed to buy but is not a button or a link, so an agent cannot tell it can be pressed",
      onPath: true,
    });
  }
  controls.findings = keepWorst(controls.findings);

  if (!isProductPage()) {
    return [{ ...data, skipped: true }, { ...price, skipped: true }, controls];
  }

  const heading = document.querySelector("main h1")!;
  const located = (
    finding: Omit<Located, "element" | "selector" | "label" | "onPath">,
  ): Located => ({
    ...finding,
    element: heading,
    selector: cssPath(heading),
    label: `The "${textOf(heading).slice(0, 40)}" product`,
    onPath: true,
  });

  const product = readProductData();
  if (!product) {
    data.findings.push({
      ...located({
        check: "cog.product-data",
        severity: "blocker",
        measured:
          "No machine-readable product data: no name, price, currency or stock an agent can rely on",
        stops: true,
        fix: productFix(),
      }),
      stopReason: "could not confirm what it would pay: the product has no machine-readable data",
    });
    return [data, { ...price, skipped: true }, controls];
  }

  const shown = visiblePrice();
  if (shown && shown !== product.price) {
    price.findings.push({
      ...located({
        check: "cog.price-match",
        severity: "major",
        measured: `The data says ${product.price} ${product.currency} but the page shows $${shown}`,
        stops: true,
      }),
      stopReason: "would not pay: the price in the data and on the page disagree",
    });
  }
  return [data, price, controls];
}
