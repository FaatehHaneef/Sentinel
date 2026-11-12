import { z } from "zod";
import { checkOrigin } from "@/lib/guards/allow-list";
import { callerOrigin, getTokenSecret, requestOrigin } from "@/lib/trial/server";
import { verifyLaunchToken } from "@/lib/trial/token";

const handshakeSchema = z.object({ token: z.string().min(20).max(4000) });

/**
 * The engine calls this before it does anything on a page. The run starts
 * only if the token is genuine and unexpired, and the page making the call is
 * on the exact origin the token was issued for.
 *
 * On an owner's own site the engine calls from that site's origin, so the
 * answer carries permission for that one origin to read it. Nothing else on
 * this server is open to other origins.
 */

function corsHeaders(origin: string | null): HeadersInit {
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

/** The browser's check before a cross-origin call. It reveals nothing and starts nothing. */
export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(callerOrigin(request)) });
}

export async function POST(request: Request) {
  const caller = callerOrigin(request);
  const headers = corsHeaders(caller);
  const parsed = handshakeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request." }, { status: 400, headers });

  const config = await verifyLaunchToken(parsed.data.token, getTokenSecret());
  if (!config) {
    return Response.json(
      { error: "This trial link is not valid or has expired." },
      { status: 401, headers },
    );
  }

  if (!caller || caller !== config.origin) {
    return Response.json(
      { error: "This trial was issued for a different site." },
      { status: 403, headers },
    );
  }

  // Demo-store runs must come from this app's own origin. Owners' sites must
  // pass the same origin rules as any trial.
  const own = requestOrigin(request);
  const decision = checkOrigin(caller, {
    ownOrigins: [own],
    verifiedOrigins: config.kind === "verified" ? [config.origin] : [],
  });
  if (!decision.allowed || decision.kind !== config.kind) {
    return Response.json({ error: "Trials cannot run on this site." }, { status: 403, headers });
  }

  return Response.json({ config }, { headers });
}
