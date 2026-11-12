import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import type { RunConfig } from "./types";

/**
 * Launch tokens. A trial can only start from a token the Sentinel server
 * signed. The token names the one origin the run may execute on and expires
 * quickly, so it cannot be replayed elsewhere or later.
 */

export const LAUNCH_TOKEN_TTL_SECONDS = 10 * 60;

const ISSUER = "sentinel";

const runConfigSchema = z.object({
  runId: z.string().min(8).max(64),
  party: z
    .array(z.enum(["iris", "tobin", "pell", "knock", "echo", "dash", "cog"]))
    .min(1)
    .max(7),
  seed: z.number().int(),
  pace: z.enum(["normal", "fast"]),
  origin: z.url(),
  kind: z.enum(["own", "verified"]),
  previousRunId: z.uuid().optional(),
});

export async function createLaunchToken(
  config: RunConfig,
  secret: Uint8Array,
  now: Date = new Date(),
): Promise<string> {
  return new SignJWT({ run: config })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setIssuedAt(Math.floor(now.getTime() / 1000))
    .setExpirationTime(Math.floor(now.getTime() / 1000) + LAUNCH_TOKEN_TTL_SECONDS)
    .sign(secret);
}

/** Returns the run the token authorises, or null if it is forged, altered or expired. */
export async function verifyLaunchToken(
  token: string,
  secret: Uint8Array,
  now: Date = new Date(),
): Promise<RunConfig | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      algorithms: ["HS256"],
      currentDate: now,
    });
    const parsed = runConfigSchema.safeParse(payload.run);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
