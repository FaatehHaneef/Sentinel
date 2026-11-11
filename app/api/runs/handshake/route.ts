import { z } from "zod";
import { checkOrigin } from "@/lib/guards/allow-list";
import { callerOrigin, getTokenSecret, requestOrigin } from "@/lib/trial/server";
import { verifyLaunchToken } from "@/lib/trial/token";

const handshakeSchema = z.object({ token: z.string().min(20).max(4000) });

/**
 * The engine calls this before it does anything on a page. The run starts
 * only if the token is genuine and unexpired, and the page making the call is
 * on the exact origin the token was issued for.
 */
export async function POST(request: Request) {
  const parsed = handshakeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request." }, { status: 400 });

  const config = await verifyLaunchToken(parsed.data.token, getTokenSecret());
  if (!config) {
    return Response.json(
      { error: "This trial link is not valid or has expired." },
      { status: 401 },
    );
  }

  const caller = callerOrigin(request);
  if (!caller || caller !== config.origin) {
    return Response.json({ error: "This trial was issued for a different site." }, { status: 403 });
  }

  // Demo-store runs must come from this app's own origin.
  const own = requestOrigin(request);
  const decision = checkOrigin(caller, { ownOrigins: [own] });
  if (!decision.allowed || (config.kind === "own" && decision.kind !== "own")) {
    return Response.json({ error: "Trials cannot run on this site." }, { status: 403 });
  }

  return Response.json({ config });
}
