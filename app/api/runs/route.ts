import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { CAST } from "@/lib/cast";
import { checkOrigin } from "@/lib/guards/allow-list";
import { getTokenSecret, requestOrigin } from "@/lib/trial/server";
import { verifySiteKey } from "@/lib/trial/sites";
import { createLaunchToken } from "@/lib/trial/token";
import type { RunConfig } from "@/lib/trial/types";

const READY = CAST.filter((character) => character.ready).map((character) => character.id);

const createRunSchema = z.object({
  party: z
    .array(z.enum(["iris", "tobin", "pell", "knock", "echo", "dash", "cog"]))
    .min(1)
    .max(7)
    .refine((party) => new Set(party).size === party.length, "Each character can join once.")
    .refine((party) => party.every((id) => READY.includes(id)), "That character is not ready yet."),
  pace: z.enum(["normal", "fast"]).default("normal"),
  /** Set when re-running with fixes chosen from an earlier trial. */
  previousRunId: z.uuid().optional(),
  /** Set to run on an owner's own site instead of the demo store. */
  siteKey: z.string().max(400).optional(),
});

/**
 * Starts a trial. Note what the request cannot contain: an address. A trial
 * runs either on this app's own demo store, or on the one origin named in a
 * site key this server signed, and there only if the site carries the script.
 */
export async function POST(request: Request) {
  const parsed = createRunSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Choose at least one shopper who is ready." }, { status: 400 });
  }
  const own = requestOrigin(request);

  let origin: string;
  let kind: RunConfig["kind"];
  if (parsed.data.siteKey) {
    const site = verifySiteKey(parsed.data.siteKey);
    const decision = site ? checkOrigin(site, { ownOrigins: [], verifiedOrigins: [site] }) : null;
    if (!decision?.allowed) {
      return Response.json({ error: "That site key is not valid." }, { status: 403 });
    }
    origin = decision.origin;
    kind = "verified";
  } else {
    const decision = checkOrigin(own, { ownOrigins: [own] });
    if (!decision.allowed) {
      return Response.json({ error: "Trials cannot run from this address." }, { status: 403 });
    }
    origin = decision.origin;
    kind = "own";
  }

  const config: RunConfig = {
    runId: randomUUID(),
    party: parsed.data.party,
    seed: randomInt(0, 2 ** 31),
    pace: parsed.data.pace,
    origin,
    kind,
    // Re-running with fixes is for the demo store, where the fixes can be tried on the page.
    previousRunId: kind === "own" ? parsed.data.previousRunId : undefined,
  };
  const token = await createLaunchToken(config, getTokenSecret());

  return Response.json({
    runId: config.runId,
    // The token travels in the URL fragment, which browsers never send to a server.
    startUrl: kind === "own" ? `${origin}/store#sentinel=${token}` : `${origin}/#sentinel=${token}`,
  });
}
