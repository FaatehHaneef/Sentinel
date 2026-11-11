import { getGateway } from "@/lib/payments/gateway";
import { getStore } from "@/lib/storage/get-store";

const ONE_DAY = 60 * 60 * 24;

/**
 * Receives payment notifications. Every notification is verified against its
 * signature before anything is done with it, and each one is handled once.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const signature = form?.get("bt_signature");
  const payload = form?.get("bt_payload");
  if (typeof signature !== "string" || typeof payload !== "string") {
    return new Response("Missing signature or payload.", { status: 400 });
  }

  let notification;
  try {
    notification = await getGateway().webhookNotification.parse(signature, payload);
  } catch {
    return new Response("Signature verification failed.", { status: 400 });
  }

  const store = getStore();
  const transactionId =
    "transaction" in notification ? (notification.transaction?.id ?? "none") : "none";
  const eventKey = `webhook:${notification.kind}:${transactionId}:${String(notification.timestamp)}`;
  const firstTime = await store.setIfAbsent(eventKey, true, ONE_DAY);
  if (!firstTime) return new Response("Already handled.", { status: 200 });

  if (notification.kind === "transaction_settled" && transactionId !== "none") {
    await store.set(`order:${transactionId}:settled`, new Date().toISOString(), ONE_DAY * 30);
  }

  return new Response("OK", { status: 200 });
}
