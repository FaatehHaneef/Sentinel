import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { CAST } from "@/lib/cast";
import { checkOrigin } from "@/lib/guards/allow-list";
import { getTokenSecret, requestOrigin } from "@/lib/trial/server";
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
});

/**
 * Starts a trial on the demo store. Note what the request cannot contain: an
 * address. The run is bound to this app's own origin and nothing else.
 */
export async function POST(request: Request) {
  const parsed = createRunSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Choose at least one shopper who is ready." }, { status: 400 });
  }

  const origin = requestOrigin(request);
  const decision = checkOrigin(origin, { ownOrigins: [origin] });
  if (!decision.allowed) {
    return Response.json({ error: "Trials cannot run from this address." }, { status: 403 });
  }

  const config: RunConfig = {
    runId: randomUUID(),
    party: parsed.data.party,
    seed: randomInt(0, 2 ** 31),
    pace: parsed.data.pace,
    origin: decision.origin,
    kind: "own",
  };
  const token = await createLaunchToken(config, getTokenSecret());

  return Response.json({
    runId: config.runId,
    // The token travels in the URL fragment, which browsers never send to a server.
    startUrl: `${decision.origin}/store#sentinel=${token}`,
  });
}
