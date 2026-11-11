import type { Metadata } from "next";
import Link from "next/link";
import { CartLink } from "@/components/store/CartLink";

export const metadata: Metadata = {
  title: "Tallowmere Candles",
  description: "Hand-poured candles from the stall at the end of the road.",
};

export default function StoreLayout({ children }: LayoutProps<"/store">) {
  return (
    <div className="flex flex-1 flex-col bg-paper text-ink">
      <p className="bg-ink px-4 py-2 text-center text-sm text-paper">
        Demo store for Sentinel. Payments run in a sandbox, so no real money moves.
      </p>
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/store" className="font-display text-3xl font-bold text-wax">
            Tallowmere
          </Link>
          <nav className="flex items-center gap-5">
            <Link href="/store" className="text-ink underline-offset-4 hover:underline">
              Candles
            </Link>
            <CartLink />
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        {children}
      </main>
      <footer className="border-t border-line px-4 py-6 text-center text-sm text-ink-soft">
        Tallowmere is a fictional shop built to be tested.{" "}
        <Link href="/" className="underline underline-offset-4">
          Back to Sentinel
        </Link>
      </footer>
    </div>
  );
}
