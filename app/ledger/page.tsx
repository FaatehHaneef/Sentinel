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
      <nav className="flex flex-wrap gap-6">
        <Link href="/lobby" className="text-mist underline underline-offset-4 hover:text-parchment">
          Back to the shoppers
        </Link>
      </nav>
      <h1 className="font-display mt-6 text-4xl font-bold text-parchment sm:text-5xl">
        The ledger
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-mist">
        Everything your shoppers found, across every trial kept in this browser, and what has been
        fixed since.
      </p>
      <div className="mt-8 space-y-10">
        <StoreProgress />
        <Ledger />
      </div>
    </main>
  );
}
