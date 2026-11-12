import type { Metadata } from "next";
import Link from "next/link";
import { Ledger } from "@/components/sentinel/Ledger";
import { StoreProgress } from "@/components/sentinel/StoreProgress";

export const metadata: Metadata = {
  title: "The ledger | Sentinel",
};

export default function LedgerPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-12">
      <header className="pixel-panel flush relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/store/banner.png"
          alt=""
          width={1000}
          height={375}
          className="pixelated absolute inset-0 h-full w-full object-cover opacity-60"
        />
        <div className="relative bg-gradient-to-r from-night via-night/85 to-transparent p-6 sm:p-8">
          <Link href="/lobby" className="pixel-button quiet text-sm">
            Back to the shoppers
          </Link>
          <h1 className="font-display mt-5 text-4xl font-bold text-parchment sm:text-5xl">
            The ledger
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-parchment">
            Everything your shoppers found, across every trial kept in this browser, and what has
            been fixed since.
          </p>
        </div>
      </header>
      <div className="mt-8 space-y-10">
        <StoreProgress />
        <Ledger />
      </div>
    </main>
  );
}
