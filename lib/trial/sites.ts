import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getTokenSecret } from "./server";

/**
 * Site keys for owners' own sites. A key names one origin and is signed by
 * the Sentinel server, so it needs no database: whoever holds the key can
 * start a trial for that origin, and the trial only runs if the owner has
 * put the Sentinel script on that site. Installing the script is the consent.
 */

function signature(origin: string): string {
  return createHmac("sha256", getTokenSecret())
    .update(`sentinel-site-key-v1|${origin}`)
    .digest("base64url")
    .slice(0, 32);
}

export function createSiteKey(origin: string): string {
  return `${Buffer.from(origin).toString("base64url")}.${signature(origin)}`;
}

/** The origin a site key was issued for, or null if the key is not genuine. */
export function verifySiteKey(key: string): string | null {
  const [encoded, given] = key.split(".");
  if (!encoded || !given || key.length > 400) return null;
  let origin: string;
  try {
    origin = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = Buffer.from(signature(origin));
  const actual = Buffer.from(given);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return origin;
}
