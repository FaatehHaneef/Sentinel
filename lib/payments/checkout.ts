import "server-only";
import { CURRENCY } from "@/lib/store/catalogue";
import { centsToAmount, priceCart, type CartItem, type PricedLine } from "@/lib/store/pricing";
import { getGateway } from "./gateway";

/** Every Tallowmere order reference starts with this, so lookups never return anything else. */
export const ORDER_PREFIX = "TM-";

export type OrderSummary = {
  id: string;
  reference: string;
  status: string;
  amount: string;
  currency: string;
  paidWith: string;
  createdAt: string;
  lines: { name: string; quantity: number; total: string }[];
};

export type PayResult =
  | { ok: true; orderId: string }
  | {
      ok: false;
      /** declined: the card was refused. duplicate: this checkout was already paid. */
      reason: "declined" | "duplicate" | "invalid" | "error";
      message: string;
    };

export async function createClientToken(): Promise<string> {
  const response = await getGateway().clientToken.generate({});
  return response.clientToken;
}

/** The payments API limits line item names to 35 characters and product codes to 12. */
export const LINE_NAME_LIMIT = 35;
export const PRODUCT_CODE_LIMIT = 12;

export function toLineItems(lines: PricedLine[]) {
  return lines.map((line) => ({
    kind: "debit" as const,
    name: line.name.slice(0, LINE_NAME_LIMIT),
    productCode: line.id.slice(0, PRODUCT_CODE_LIMIT),
    quantity: String(line.quantity),
    unitAmount: centsToAmount(line.unitCents),
    totalAmount: centsToAmount(line.totalCents),
  }));
}

/**
 * Charges a checkout. The amount comes from pricing the items on the server.
 * The checkout id becomes the order reference: the payments sandbox refuses a
 * second identical charge with the same reference, so a double submit cannot
 * create two orders.
 */
export async function payForCheckout(input: {
  checkoutId: string;
  nonce: string;
  items: readonly CartItem[];
  customer: { name: string; email: string };
}): Promise<PayResult> {
  const cart = priceCart(input.items);
  const [firstName, ...rest] = input.customer.name.trim().split(/\s+/);

  const result = await getGateway().transaction.sale({
    amount: centsToAmount(cart.totalCents),
    orderId: `${ORDER_PREFIX}${input.checkoutId}`,
    paymentMethodNonce: input.nonce,
    customer: { firstName, lastName: rest.join(" ") || undefined, email: input.customer.email },
    lineItems: toLineItems(cart.lines),
    options: { submitForSettlement: true },
  });

  if (result.success) return { ok: true, orderId: result.transaction.id };

  const transaction = result.transaction;
  if (transaction?.gatewayRejectionReason === "duplicate") {
    return {
      ok: false,
      reason: "duplicate",
      message: "This order was already placed. You have not been charged twice.",
    };
  }
  if (transaction?.status === "processor_declined" || transaction?.status === "gateway_rejected") {
    return {
      ok: false,
      reason: "declined",
      message:
        "Your payment was declined, and you have not been charged. Please try another card or payment method.",
    };
  }
  if (!transaction) {
    return { ok: false, reason: "invalid", message: result.message };
  }
  return { ok: false, reason: "error", message: "The payment could not be completed." };
}

/** Looks up an order by its payment id. Returns null for anything that is not a Tallowmere order. */
export async function findOrder(id: string): Promise<OrderSummary | null> {
  if (!/^[a-z0-9]{6,36}$/i.test(id)) return null;
  const gateway = getGateway();

  let transaction;
  try {
    transaction = await gateway.transaction.find(id);
  } catch {
    return null;
  }
  if (!transaction.orderId?.startsWith(ORDER_PREFIX)) return null;

  const items = await gateway.transactionLineItem.findAll(id);
  const paidWith =
    transaction.paymentInstrumentType === "paypal_account"
      ? "PayPal"
      : transaction.creditCard?.last4
        ? `${transaction.creditCard.cardType} ending ${transaction.creditCard.last4}`
        : "Card";

  return {
    id: transaction.id,
    reference: transaction.orderId,
    status: transaction.status,
    amount: transaction.amount,
    currency: transaction.currencyIsoCode ?? CURRENCY,
    paidWith,
    createdAt: new Date(transaction.createdAt).toISOString(),
    lines: items.map((item) => ({
      name: item.name,
      quantity: Number(item.quantity),
      total: item.totalAmount,
    })),
  };
}
