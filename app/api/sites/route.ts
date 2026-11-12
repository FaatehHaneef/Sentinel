import { z } from "zod";
import { checkOrigin, normalizeOrigin } from "@/lib/guards/allow-list";
import { requestOrigin } from "@/lib/trial/server";
import { createSiteKey } from "@/lib/trial/sites";

const siteSchema = z.object({ address: z.string().trim().min(4).max(300) });

/**
 * Registers an owner's site: returns its key and the one line to paste into
 * it. Registering tests nothing. A trial can only run once the line is on
 * the site, which only someone who controls the site can do.
 */
export async function POST(request: Request) {
  const parsed = siteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "Enter your site's address." }, { status: 400 });

  const withScheme = /^https?:\/\//i.test(parsed.data.address)
    ? parsed.data.address
    : `https://${parsed.data.address}`;
  const origin = normalizeOrigin(withScheme);
  if (!origin) return Response.json({ error: "That is not a web address." }, { status: 400 });

  // The same rules as any trial: https, except for local development.
  const decision = checkOrigin(origin, { ownOrigins: [], verifiedOrigins: [origin] });
  if (!decision.allowed) {
    return Response.json(
      { error: "Sentinel only runs on sites served over https." },
      { status: 400 },
    );
  }

  const key = createSiteKey(origin);
  const scriptSrc = `${requestOrigin(request)}/v.js`;
  return Response.json({
    origin,
    siteKey: key,
    snippet: `<script src="${scriptSrc}" data-site="${key}" async></script>`,
  });
}
