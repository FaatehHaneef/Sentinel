import { createClientToken } from "@/lib/payments/checkout";

/** Issues a short-lived token that lets the browser show the payment form. */
export async function POST() {
  try {
    return Response.json({ clientToken: await createClientToken() });
  } catch (error) {
    console.error("client token failed", error);
    return Response.json({ error: "Payments are unavailable right now." }, { status: 503 });
  }
}
