"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { OrderSummary } from "@/lib/payments/checkout";

type State =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "ready"; order: OrderSummary; confirmedAt: string | null };

const STATUS_TEXT: Record<string, string> = {
  authorized: "Payment authorised",
  submitted_for_settlement: "Payment received",
  settling: "Payment received",
  settled: "Payment received and settled",
};

export function OrderView() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/checkout/order/${encodeURIComponent(id)}`)
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) return setState({ kind: "missing" });
        const data = (await response.json()) as { order: OrderSummary; confirmedAt: string | null };
        setState({ kind: "ready", ...data });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "missing" });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.kind === "loading") return <p className="text-lg">Fetching your order…</p>;

  if (state.kind === "missing") {
    return (
      <>
        <h1 className="font-display text-4xl font-bold">We could not find that order</h1>
        <Link
          href="/store"
          className="mt-6 inline-block font-bold text-wax underline underline-offset-4"
        >
          Back to the candles
        </Link>
      </>
    );
  }

  const { order, confirmedAt } = state;
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-4xl font-bold">Thank you</h1>
      <p className="mt-3 text-lg">Your candles are on their way down the road.</p>

      <dl className="mt-8 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-lg border border-line bg-card p-5">
        <dt className="text-ink-soft">Order</dt>
        <dd className="font-bold">{order.id}</dd>
        <dt className="text-ink-soft">Status</dt>
        <dd className="font-bold">{STATUS_TEXT[order.status] ?? order.status}</dd>
        <dt className="text-ink-soft">Paid with</dt>
        <dd>{order.paidWith}</dd>
        <dt className="text-ink-soft">Confirmation</dt>
        <dd>{confirmedAt ? "Settlement notice received" : "Settlement notice pending"}</dd>
      </dl>

      <ul className="mt-6 divide-y divide-line border-y border-line">
        {order.lines.map((line) => (
          <li key={line.name} className="flex justify-between py-3">
            <span>
              {line.quantity} × {line.name}
            </span>
            <span className="font-bold">${line.total}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-right text-2xl font-bold">
        Total ${order.amount} {order.currency}
      </p>

      <Link
        href="/store"
        className="mt-8 inline-block font-bold text-wax underline underline-offset-4"
      >
        Keep browsing
      </Link>
    </div>
  );
}
