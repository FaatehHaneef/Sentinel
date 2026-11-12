import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { AiUnavailableError } from "@/lib/ai/gemini";
import { decideByRules, decideWithAi, type Decision, type Goal } from "@/lib/ai/cog";
import { payForCheckout } from "@/lib/payments/checkout";
import { getStore } from "@/lib/storage/get-store";
import { CURRENCY, findProduct } from "@/lib/store/catalogue";
import { callerOrigin, requestOrigin } from "@/lib/trial/server";

export const maxDuration = 60;

/** Cog's goal: one candle, at most $25 each. */
const BUDGET_PER_ITEM = 25;
const PER_MINUTE = 6;
const CACHE_SECONDS = 60 * 60 * 24;

const orderSchema = z.object({
  product: z.object({
    name: z.string().max(120),
    sku: z.string().max(64).optional(),
    price: z.string().regex(/^\d+(\.\d{1,2})?$/),
    currency: z.string().length(3),
    availability: z.string().max(120).optional(),
  }),
  quantity: z.number().int().min(1).max(3),
  customer: z.object({ name: z.string().trim().min(1).max(120), email: z.email().max(200) }),
});

type Reply = { ok: boolean; orderId?: string; reason: string; decidedBy: "ai" | "rules" };

/**
 * Cog's purchase on the demo store. The agent decides from the product data
 * the page published; the server then checks that data against the store's
 * own catalogue and places a sandbox order. Payment is the sandbox's test
 * payment method: no real card and no real money.
 */
export async function POST(request: Request) {
  if (callerOrigin(request) !== requestOrigin(request)) {
    return Response.json({ error: "Not allowed from this address." }, { status: 403 });
  }
  const parsed = orderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request." }, { status: 400 });
  const { product, quantity, customer } = parsed.data;

  const store = getStore();
  const visitor = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const minute = Math.floor(Date.now() / 60_000);
  if ((await store.increment(`limit:agent:${visitor}:${minute}`, 1, 120)) > PER_MINUTE) {
    return Response.json({
      ok: false,
      reason: "Too many orders just now.",
      decidedBy: "rules",
    } satisfies Reply);
  }

  // The page's data is checked against the store's own catalogue before anything else.
  const listed = product.sku ? findProduct(product.sku) : undefined;
  if (!listed) {
    return Response.json({
      ok: false,
      reason: "The product in the data is not one the store sells.",
      decidedBy: "rules",
    } satisfies Reply);
  }
  const catalogue = (listed.priceCents / 100).toFixed(2);
  if (Number(product.price).toFixed(2) !== catalogue || product.currency !== CURRENCY) {
    return Response.json({
      ok: false,
      reason: `The data says ${product.price} ${product.currency} but the store charges ${catalogue} ${CURRENCY}, so I did not order.`,
      decidedBy: "rules",
    } satisfies Reply);
  }

  const goal: Goal = { quantity, budgetPerItem: BUDGET_PER_ITEM, currency: CURRENCY };
  const offer = { ...product, sku: listed.id };

  let decision: Decision;
  let decidedBy: Reply["decidedBy"] = "ai";
  const cacheKey = `agent:${createHash("sha256").update(JSON.stringify({ goal, offer })).digest("hex")}`;
  const cached = await store.get<Decision>(cacheKey);
  if (cached) {
    decision = cached;
  } else if (process.env.SENTINEL_AI === "off") {
    decision = decideByRules(goal, offer);
    decidedBy = "rules";
  } else {
    try {
      decision = await decideWithAi(goal, offer);
      await store.set(cacheKey, decision, CACHE_SECONDS);
    } catch (error) {
      if (!(error instanceof AiUnavailableError)) console.error("agent decision failed", error);
      decision = decideByRules(goal, offer);
      decidedBy = "rules";
    }
  }

  // The agent's decision is held to the goal whatever it says.
  const allowed = decideByRules(goal, offer);
  if (!decision.order || !allowed.order) {
    return Response.json({
      ok: false,
      reason: decision.order ? allowed.reason : decision.reason,
      decidedBy,
    } satisfies Reply);
  }
  const amount = Math.min(Math.max(1, decision.quantity), quantity);

  const result = await payForCheckout({
    checkoutId: randomUUID(),
    nonce: "fake-valid-nonce",
    items: [{ id: listed.id, quantity: amount }],
    customer,
  });
  if (!result.ok) {
    return Response.json({ ok: false, reason: result.message, decidedBy } satisfies Reply);
  }
  return Response.json({
    ok: true,
    orderId: result.orderId,
    reason: decision.reason,
    decidedBy,
  } satisfies Reply);
}
