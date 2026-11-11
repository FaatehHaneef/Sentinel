import type { Metadata } from "next";
import Link from "next/link";
import { PartyPicker } from "@/components/sentinel/PartyPicker";

export const metadata: Metadata = {
  title: "The shoppers | Sentinel",
};

export default function LobbyPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
      <Link href="/" className="text-mist underline underline-offset-4 hover:text-parchment">
        Back to the road
      </Link>
      <h1 className="font-display mt-6 text-4xl font-bold text-parchment sm:text-5xl">
        Choose your shoppers
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-mist">
        Each one stands for a real kind of customer and checks a store the way that customer
        experiences it. Pick who walks the road, then watch them try to buy a candle.
      </p>
      <PartyPicker />
    </main>
  );
}
