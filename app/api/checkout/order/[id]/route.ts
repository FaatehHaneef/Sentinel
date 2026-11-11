import { findOrder } from "@/lib/payments/checkout";
import { getStore } from "@/lib/storage/get-store";

/** Returns one Tallowmere order, with whether its settlement notice has arrived. */
export async function GET(_request: Request, context: RouteContext<"/api/checkout/order/[id]">) {
  const { id } = await context.params;
  try {
    const order = await findOrder(id);
    if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
    const confirmedAt = await getStore().get<string>(`order:${order.id}:settled`);
    return Response.json({ order, confirmedAt });
  } catch (error) {
    console.error("order lookup failed", error);
    return Response.json({ error: "The order could not be loaded." }, { status: 502 });
  }
}
