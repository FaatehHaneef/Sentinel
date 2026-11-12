import type { Metadata } from "next";
import Link from "next/link";
import { GameLobby } from "@/components/sentinel/GameLobby";
import { LobbyBackdrop } from "@/components/sentinel/LobbyBackdrop";
import { StoreProgress } from "@/components/sentinel/StoreProgress";

export const metadata: Metadata = {
  title: "The shoppers | Sentinel",
};

export default function LobbyPage() {
  return (
    <main id="main" className="relative isolate mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <LobbyBackdrop />
      <Link href="/" className="pixel-button quiet text-sm">
        Back to the road
      </Link>
      <h1 className="font-display mt-6 text-4xl font-bold text-parchment sm:text-5xl">
        Choose your shoppers
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-parchment">
        Each one stands for a real kind of customer and checks a store the way that customer
        experiences it. Pick who walks the road, then watch them try to buy a candle.
      </p>
      <div className="mt-6">
        <GameLobby start="line" />
      </div>
      <div className="mt-12">
        <StoreProgress />
      </div>
    </main>
  );
}
