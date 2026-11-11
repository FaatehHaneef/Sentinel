"use client";

import type { Dropin } from "braintree-web-drop-in";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { clearCart, useCart } from "@/components/store/cart";
import { findProduct, formatPrice } from "@/lib/store/catalogue";

type Step = "details" | "payment";

export default function CheckoutPage() {
  const router = useRouter();
  const items = useCart();
  const totalCents = items.reduce(
    (sum, item) => sum + (findProduct(item.id)?.priceCents ?? 0) * item.quantity,
    0,
  );

  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [formReady, setFormReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [message, setMessage] = useState("");

  const container = useRef<HTMLDivElement>(null);
  const dropin = useRef<Dropin | null>(null);
  // One id per purchase attempt. A double submit reuses it, so the server
  // refuses the second charge. It is replaced only after a decline.
  const checkoutId = useRef<string | null>(null);

  useEffect(() => {
    if (step !== "payment" || !container.current) return;
    let cancelled = false;
    const target = container.current;

    (async () => {
      try {
        const response = await fetch("/api/checkout/token", { method: "POST" });
        if (!response.ok) throw new Error("token");
        const { clientToken } = (await response.json()) as { clientToken: string };
        const { default: braintreeDropin } = await import("braintree-web-drop-in");
        const instance = await braintreeDropin.create({
          authorization: clientToken,
          container: target,
          paypal: { flow: "checkout", amount: (totalCents / 100).toFixed(2), currency: "USD" },
        });
        if (cancelled) {
          await instance.teardown();
          return;
        }
        dropin.current = instance;
        setFormReady(true);
      } catch {
        if (!cancelled) setMessage("The payment form could not be loaded. Please try again.");
      }
    })();

    return () => {
      cancelled = true;
      setFormReady(false);
      void dropin.current?.teardown();
      dropin.current = null;
    };
    // The form is built once per visit to the payment step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  /** Pays with the payment form, or with the sandbox's built-in test payment when given. */
  async function pay(sandboxNonce?: string) {
    if (paying || (!sandboxNonce && !dropin.current)) return;
    setPaying(true);
    setMessage("");
    try {
      const nonce = sandboxNonce ?? (await dropin.current!.requestPaymentMethod()).nonce;
      checkoutId.current ??= crypto.randomUUID();
      const response = await fetch("/api/checkout/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutId: checkoutId.current,
          nonce,
          items,
          customer: { name, email },
        }),
      });
      const result = (await response.json()) as
        { ok: true; orderId: string } | { ok: false; reason: string; message: string };

      if (result.ok) {
        clearCart();
        router.push(`/store/thanks/${result.orderId}`);
        return;
      }
      if (result.reason === "declined") {
        checkoutId.current = null;
        dropin.current?.clearSelectedPaymentMethod();
      }
      setMessage(result.message);
    } catch {
      setMessage("Please choose a payment method and complete its details.");
    } finally {
      setPaying(false);
    }
  }

  if (items.length === 0 && !paying) {
    return (
      <>
        <h1 className="font-display text-4xl font-bold">Checkout</h1>
        <p className="mt-4 text-lg">Your cart is empty.</p>
        <Link
          href="/store"
          className="mt-6 inline-block font-bold text-wax underline underline-offset-4"
        >
          Browse the candles
        </Link>
      </>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-4xl font-bold">Checkout</h1>
      <p className="mt-2 text-lg">Order total {formatPrice(totalCents)}</p>

      {step === "details" ? (
        <form
          className="mt-8 flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setStep("payment");
          }}
        >
          <h2 className="font-display text-2xl font-bold">Your details</h2>
          {/*
            Deliberate snags for the trials: the fields have no labels, only
            pale placeholders that vanish when typing starts; the help text is
            small and faint; the fields give phones no typing or autofill
            hints; and the button below is hard to tell from the page.
          */}
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Full name"
            className="rounded border border-[#e6dcc6] bg-card px-3 py-2 placeholder:text-[#cfc5b0]"
          />
          <input
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email address"
            className="rounded border border-[#e6dcc6] bg-card px-3 py-2 placeholder:text-[#cfc5b0]"
          />
          <p className="text-[11px] text-[#b9ad96]">
            We send your receipt here. We never share your address.
          </p>
          <button
            type="submit"
            className="self-start rounded bg-[#efe6d0] px-4 py-2 text-sm text-[#c2b393]"
          >
            Continue to payment
          </button>
        </form>
      ) : (
        <section className="mt-8 flex flex-col gap-4">
          <h2 className="font-display text-2xl font-bold">Payment</h2>
          <p className="rounded border border-line bg-card p-3 text-sm">
            This is a sandbox. Use the test card <strong>4111 1111 1111 1111</strong> with any
            future expiry date, or press the sandbox test card button to skip the typing.
          </p>
          <div ref={container} />
          {!formReady && !message ? <p>Loading the payment form…</p> : null}
          <p role="alert" className="font-bold text-[#a3211f]">
            {message}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => pay()}
              disabled={!formReady || paying}
              className="rounded bg-wax px-6 py-3 text-lg font-bold text-card hover:bg-ink disabled:opacity-60"
            >
              {paying ? "Paying…" : `Pay ${formatPrice(totalCents)}`}
            </button>
            <button
              type="button"
              onClick={() => pay("fake-valid-nonce")}
              disabled={paying}
              className="rounded border-2 border-wax px-4 py-3 font-bold text-wax hover:bg-card disabled:opacity-60"
            >
              Pay with the sandbox test card
            </button>
            <button
              type="button"
              onClick={() => setStep("details")}
              className="text-ink-soft underline underline-offset-4"
            >
              Back to your details
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
