import { createHash } from "node:crypto";
import { AiUnavailableError } from "@/lib/ai/gemini";
import { writeVerdict } from "@/lib/ai/wick";
import { getStore } from "@/lib/storage/get-store";
import { callerOrigin, requestOrigin } from "@/lib/trial/server";
import { builtInVerdict, verdictRequestSchema, type Verdict } from "@/lib/trial/verdict";

export const maxDuration = 60;

const CACHE_SECONDS = 60 * 60 * 24 * 7;
const PER_MINUTE = 8;

/**
 * Wick's verdict for one character's walk. The answer is always usable: when
 * AI is switched off, out of quota or slow, the built-in notes are returned
 * and marked as such. Identical findings are answered from the cache, so
 * repeat trials of the same store do not spend AI requests.
 */
export async function POST(request: Request) {
  // Only this app's own pages may ask.
  if (callerOrigin(request) !== requestOrigin(request)) {
    return Response.json({ error: "Not allowed from this address." }, { status: 403 });
  }

  const parsed = verdictRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request." }, { status: 400 });
  const input = parsed.data;

  const respond = (verdict: Verdict, note?: string) => Response.json({ verdict, note });

  if (process.env.SENTINEL_AI === "off" || input.outcome === "running") {
    return respond(builtInVerdict(input), "AI is switched off.");
  }

  const store = getStore();
  const key = `verdict:${createHash("sha256").update(JSON.stringify(input)).digest("hex")}`;
  const cached = await store.get<Verdict>(key);
  if (cached) return respond(cached);

  const visitor = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const minute = Math.floor(Date.now() / 60_000);
  if ((await store.increment(`limit:verdict:${visitor}:${minute}`, 1, 120)) > PER_MINUTE) {
    return respond(builtInVerdict(input), "Too many requests just now.");
  }

  try {
    const verdict = await writeVerdict(input);
    await store.set(key, verdict, CACHE_SECONDS);
    return respond(verdict);
  } catch (error) {
    if (!(error instanceof AiUnavailableError)) console.error("verdict failed", error);
    return respond(
      builtInVerdict(input),
      error instanceof AiUnavailableError ? error.message : "AI could not be reached.",
    );
  }
}
