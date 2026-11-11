import type { Metadata } from "next";
import Link from "next/link";
import { CAST, type Character } from "@/lib/cast";

export const metadata: Metadata = {
  title: "The shoppers | Sentinel",
};

const ACCENT_TEXT: Record<Character["accent"], string> = {
  amber: "text-amber",
  ember: "text-ember",
  moss: "text-moss",
  mist: "text-mist",
  rose: "text-rose",
  parchment: "text-parchment",
};

function CharacterCard({ character }: { character: Character }) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border-2 border-slate bg-indigo/80 p-5">
      <h2 className={`font-display text-2xl font-bold ${ACCENT_TEXT[character.accent]}`}>
        {character.name}
      </h2>
      <p className="text-parchment">{character.represents}</p>
      <p className="text-mist italic">&ldquo;{character.motto}&rdquo;</p>
      <h3 className="font-display mt-1 text-sm uppercase tracking-widest text-mist">Checks</h3>
      <ul className="list-disc space-y-1 pl-5 text-parchment">
        {character.checks.map((check) => (
          <li key={check}>{check}</li>
        ))}
      </ul>
    </li>
  );
}

export default function LobbyPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
      <Link href="/" className="text-mist underline underline-offset-4 hover:text-parchment">
        Back to the road
      </Link>
      <h1 className="font-display mt-6 text-4xl font-bold text-parchment sm:text-5xl">
        The shoppers
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-mist">
        Each one stands for a real kind of customer and checks your store the way that customer
        experiences it.
      </p>
      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {CAST.map((character) => (
          <CharacterCard key={character.id} character={character} />
        ))}
      </ul>
    </main>
  );
}
