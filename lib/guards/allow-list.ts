/**
 * The allow-list decides where a trial may run. A trial may run only on:
 *
 *   1. Sentinel's own origins, which host the demo store, and
 *   2. origins whose owner registered the site and installed the visitor script.
 *
 * Nothing else is ever tested. There is no code path that takes an arbitrary
 * address and runs a trial against it.
 */

/** Returns the canonical origin ("https://shop.example") or null if the input is not a web origin. */
export function normalizeOrigin(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  return url.origin;
}

function isLocalhost(origin: string): boolean {
  const { hostname } = new URL(origin);
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export type AllowListConfig = {
  /** Origins that serve Sentinel itself, and so the demo store. */
  ownOrigins: readonly string[];
  /** Origins of sites whose owner installed the visitor script. */
  verifiedOrigins?: readonly string[];
};

export type AllowDecision =
  | { allowed: true; origin: string; kind: "own" | "verified" }
  | { allowed: false; reason: "not-an-origin" | "insecure" | "not-registered" };

export function checkOrigin(input: string, config: AllowListConfig): AllowDecision {
  const origin = normalizeOrigin(input);
  if (!origin) return { allowed: false, reason: "not-an-origin" };

  // Plain http is accepted only for local development.
  if (origin.startsWith("http:") && !isLocalhost(origin)) {
    return { allowed: false, reason: "insecure" };
  }

  const own = config.ownOrigins.map(normalizeOrigin);
  if (own.includes(origin)) return { allowed: true, origin, kind: "own" };

  const verified = (config.verifiedOrigins ?? []).map(normalizeOrigin);
  if (verified.includes(origin)) return { allowed: true, origin, kind: "verified" };

  return { allowed: false, reason: "not-registered" };
}

/**
 * Sentinel's own origins for the current deployment: the configured public
 * address, Vercel's per-deployment address, and localhost during development.
 */
export function resolveOwnOrigins(source: Record<string, string | undefined>): string[] {
  const candidates = [
    source.APP_ORIGIN,
    source.VERCEL_PROJECT_PRODUCTION_URL && `https://${source.VERCEL_PROJECT_PRODUCTION_URL}`,
    source.VERCEL_URL && `https://${source.VERCEL_URL}`,
    source.NODE_ENV !== "production" ? "http://localhost:3000" : undefined,
  ];
  const origins = candidates
    .filter((value): value is string => Boolean(value))
    .map(normalizeOrigin)
    .filter((value): value is string => value !== null);
  return [...new Set(origins)];
}
