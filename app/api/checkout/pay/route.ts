import { z } from "zod";
import { payForCheckout } from "@/lib/payments/checkout";
import { cartItemsSchema, UnknownProductError } from "@/lib/store/pricing";

const payRequestSchema = z.object({
  checkoutId: z.uuid(),
  nonce: z.string().min(1).max(200),
  items: cartItemsSchema,
  customer: z.object({
    name: z.string().trim().min(1).max(120),
    email: z.email().max(200),
  }),
});

const STATUS: Record<string, number> = { declined: 402, duplicate: 409, invalid: 400, error: 502 };

/**
 * Pays for a checkout. Note what is absent from the request: there is no
 * amount. The server prices the items itself.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, reason: "invalid", message: "Bad request." },
      { status: 400 },
    );
  }

  const parsed = payRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, reason: "invalid", message: "Please check your details and try again." },
      { status: 400 },
    );
  }

  try {
    const result = await payForCheckout(parsed.data);
    return Response.json(result, { status: result.ok ? 200 : STATUS[result.reason] });
  } catch (error) {
    if (error instanceof UnknownProductError) {
      return Response.json(
        { ok: false, reason: "invalid", message: "Something in your cart is no longer sold." },
        { status: 400 },
      );
    }
    console.error("payment failed", error);
    return Response.json(
      { ok: false, reason: "error", message: "The payment could not be completed." },
      { status: 502 },
    );
  }
}
