import "server-only";
import { createHmac } from "node:crypto";
import { getServerEnv } from "@/lib/env";

/**
 * Key for signing launch tokens. Uses SENTINEL_TOKEN_SECRET when set.
 * Otherwise it is derived from a secret the deployment already holds, with a
 * fixed label so the derived key is useless for anything else.
 */
export function getTokenSecret(): Uint8Array {
  const explicit = process.env.SENTINEL_TOKEN_SECRET?.trim();
  if (explicit) return new TextEncoder().encode(explicit);
  return createHmac("sha256", getServerEnv().BRAINTREE_PRIVATE_KEY)
    .update("sentinel-launch-token-v1")
    .digest();
}

/** The public origin this request was made to, as the browser sees it. */
export function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

/** The origin of the page that made this request, from headers the browser sets itself. */
export function callerOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (origin && origin !== "null") return origin;
  const referer = request.headers.get("referer");
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}
