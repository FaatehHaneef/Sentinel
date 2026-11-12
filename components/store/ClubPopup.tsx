"use client";

import { useState, useSyncExternalStore } from "react";
import { readStoreFixes, STORE_FIX_ATTRIBUTE } from "@/lib/store/variants";

const noSubscription = () => () => {};

/**
 * A newsletter offer that opens over the page on arrival.
 *
 * Deliberate snag for the trials: on phone-sized screens (it is hidden from
 * 640 pixels up) it covers most of the screen before the shopper has seen a
 * single candle. The "phone-popup" store fix switches it off.
 */
export function ClubPopup() {
  const [closed, setClosed] = useState(false);
  const fixed = useSyncExternalStore(
    noSubscription,
    () => readStoreFixes(window.localStorage).includes("phone-popup"),
    () => true,
  );
  if (fixed || closed) return null;

  return (
    <div
      {...{ [STORE_FIX_ATTRIBUTE]: "phone-popup" }}
      className="fixed inset-x-3 bottom-3 z-40 rounded-xl border border-line bg-card p-6 shadow-2xl sm:hidden"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={() => setClosed(true)}
        className="absolute right-2 top-1 text-xs text-ink-soft"
      >
        ×
      </button>
      <p className="font-display text-2xl font-bold text-wax">Join the candle club</p>
      <p className="mt-2 text-ink">
        Ten percent off your first order, and first word of every new scent we pour.
      </p>
      <div className="my-5 flex justify-center gap-3" aria-hidden="true">
        {["#e8743b", "#6fae75", "#ffb347", "#6b5b95"].map((wax) => (
          <span key={wax} className="block h-24 w-12 rounded-t-md" style={{ background: wax }} />
        ))}
      </div>
      <input
        placeholder="Your email address"
        className="w-full rounded border border-line bg-paper px-3 py-2"
      />
      <button type="button" className="mt-3 w-full rounded bg-wax px-4 py-3 font-bold text-card">
        Join the club
      </button>
    </div>
  );
}
