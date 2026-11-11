"use client";

import { useState } from "react";
import { CAST, type Character, type CharacterId } from "@/lib/cast";

const ACCENT_TEXT: Record<Character["accent"], string> = {
  amber: "text-amber",
  ember: "text-ember",
  moss: "text-moss",
  mist: "text-mist",
  rose: "text-rose",
  parchment: "text-parchment",
};

/** Starts a trial on the demo store with the chosen shoppers. */
async function startTrial(party: CharacterId[]): Promise<string> {
  const response = await fetch("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ party }),
  });
  const data = (await response.json()) as { startUrl?: string; error?: string };
  if (!response.ok || !data.startUrl) throw new Error(data.error ?? "The trial could not start.");
  return data.startUrl;
}

export function PartyPicker() {
  const ready = CAST.filter((character) => character.ready).map((character) => character.id);
  const [party, setParty] = useState<CharacterId[]>(ready.slice(0, 1));
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  function toggle(id: CharacterId) {
    setParty((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  }

  async function start() {
    setStarting(true);
    setError("");
    try {
      // Keep the party in cast order, whatever order it was picked in.
      const ordered = CAST.map((character) => character.id).filter((id) => party.includes(id));
      window.location.assign(await startTrial(ordered));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The trial could not start.");
      setStarting(false);
    }
  }

  return (
    <>
      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {CAST.map((character) => {
          const chosen = party.includes(character.id);
          return (
            <li
              key={character.id}
              className={`flex flex-col gap-3 rounded-lg border-2 bg-indigo/80 p-5 ${
                chosen ? "border-amber" : "border-slate"
              } ${character.ready ? "" : "opacity-70"}`}
            >
              <h2 className={`font-display text-2xl font-bold ${ACCENT_TEXT[character.accent]}`}>
                {character.name}
              </h2>
              <p className="text-parchment">{character.represents}</p>
              <p className="text-mist italic">&ldquo;{character.motto}&rdquo;</p>
              <h3 className="font-display mt-1 text-sm uppercase tracking-widest text-mist">
                Checks
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-parchment">
                {character.checks.map((check) => (
                  <li key={check}>{check}</li>
                ))}
              </ul>
              <div className="mt-auto pt-3">
                {character.ready ? (
                  <label className="flex cursor-pointer items-center gap-3 text-lg font-bold text-parchment">
                    <input
                      type="checkbox"
                      checked={chosen}
                      onChange={() => toggle(character.id)}
                      className="h-5 w-5 accent-amber"
                    />
                    Send {character.name}
                  </label>
                ) : (
                  <p className="text-mist">Still rehearsing. Joins the trials soon.</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-0 mt-8 flex flex-wrap items-center gap-4 border-t-2 border-slate bg-night/95 py-4">
        <button
          type="button"
          onClick={start}
          disabled={party.length === 0 || starting}
          className="font-display rounded border-b-4 border-ember bg-amber px-8 py-3 text-xl font-bold text-indigo disabled:opacity-50"
        >
          {starting ? "Opening the road…" : "Start the trial"}
        </button>
        <p className="text-mist">
          {party.length === 0
            ? "Choose at least one shopper."
            : `${party.length} ${party.length === 1 ? "shopper" : "shoppers"} will walk through Tallowmere, our demo store.`}
        </p>
        <p role="alert" className="w-full font-bold text-rose">
          {error}
        </p>
      </div>
    </>
  );
}
