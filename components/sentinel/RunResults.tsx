"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { getCharacter } from "@/lib/cast";
import { summarize, type CharacterSummary } from "@/lib/trial/scoring";
import { RUN_STORAGE_PREFIX, type RunRecord, type Severity } from "@/lib/trial/types";

const SEVERITY_LABEL: Record<Severity, string> = {
  blocker: "Blocker",
  major: "Major",
  minor: "Minor",
};

const SEVERITY_STYLE: Record<Severity, string> = {
  blocker: "bg-rose text-night",
  major: "bg-ember text-night",
  minor: "bg-mist text-night",
};

const OUTCOME_TEXT: Record<CharacterSummary["outcome"], string> = {
  purchased: "Completed the purchase",
  abandoned: "Left without buying",
  stopped: "Trial ended early",
  running: "Trial did not finish",
};

// The record is read as a string so React can compare snapshots cheaply.
const noSubscription = () => () => {};

function useRunRecord(id: string): RunRecord | null | undefined {
  const raw = useSyncExternalStore(
    noSubscription,
    () => {
      try {
        return window.localStorage.getItem(RUN_STORAGE_PREFIX + id);
      } catch {
        return null;
      }
    },
    () => undefined,
  );
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as RunRecord;
  } catch {
    return null;
  }
}

function CharacterResult({ summary }: { summary: CharacterSummary }) {
  const character = getCharacter(summary.character);
  const purse = summary.coinsLeft + summary.coinsLost;
  const good = summary.outcome === "purchased";

  return (
    <section className="rounded-lg border-2 border-slate bg-indigo/80 p-6">
      <h2 className="font-display text-3xl font-bold text-amber">{character.name}</h2>
      <p className="text-mist">{character.represents}</p>

      <p className={`mt-4 text-2xl font-bold ${good ? "text-moss" : "text-rose"}`}>
        {OUTCOME_TEXT[summary.outcome]}
      </p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded bg-night p-3">
          <dt className="text-sm uppercase tracking-widest text-mist">Coins lost</dt>
          <dd className="text-2xl font-bold text-parchment">
            {summary.coinsLost} of {purse}
          </dd>
        </div>
        <div className="rounded bg-night p-3">
          <dt className="text-sm uppercase tracking-widest text-mist">Snags found</dt>
          <dd className="text-2xl font-bold text-parchment">{summary.snags.length}</dd>
        </div>
        <div className="rounded bg-night p-3">
          <dt className="text-sm uppercase tracking-widest text-mist">XP earned</dt>
          <dd className="text-2xl font-bold text-parchment">{summary.xp}</dd>
        </div>
      </dl>

      {summary.snags.length > 0 ? (
        <>
          <h3 className="font-display mt-6 text-xl font-bold text-parchment">Snags</h3>
          <ol className="mt-3 space-y-3">
            {summary.snags.map((snag, index) => (
              <li key={index} className="rounded border-l-4 border-rose bg-night p-4">
                <p className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-sm font-bold ${SEVERITY_STYLE[snag.finding.severity]}`}
                  >
                    {SEVERITY_LABEL[snag.finding.severity]}
                  </span>
                  <span className="text-lg font-bold text-parchment">{snag.finding.label}</span>
                  {snag.finding.onPath ? (
                    <span className="rounded border border-amber px-2 py-0.5 text-sm text-amber">
                      Needed to buy
                    </span>
                  ) : null}
                </p>
                <p className="mt-2 text-parchment">{snag.finding.measured}</p>
                <p className="mt-1 text-mist italic">&ldquo;{snag.line}&rdquo;</p>
                <p className="mt-2 text-sm text-mist">
                  Check: {snag.title}. Cost {snag.coins} coins.
                </p>
              </li>
            ))}
          </ol>
        </>
      ) : null}

      {summary.passes.length > 0 ? (
        <>
          <h3 className="font-display mt-6 text-xl font-bold text-parchment">Passed</h3>
          <ul className="mt-3 space-y-1 text-parchment">
            {summary.passes.map((pass, index) => (
              <li key={index}>
                <span className="font-bold text-moss">+{pass.xp} XP</span> {pass.title}{" "}
                <span className="text-mist">({pass.scene})</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

export function RunResults() {
  const { id } = useParams<{ id: string }>();
  const record = useRunRecord(id);

  if (record === undefined) return <p className="text-lg text-mist">Reading the trial record…</p>;

  if (record === null) {
    return (
      <>
        <h1 className="font-display text-4xl font-bold text-parchment">No record of that trial</h1>
        <p className="mt-3 max-w-xl text-lg text-mist">
          Trial records are kept in the browser that ran them. Open this page in the same browser,
          or run a new trial.
        </p>
        <Link href="/lobby" className="mt-6 inline-block font-bold text-amber underline">
          Choose your shoppers
        </Link>
      </>
    );
  }

  const summaries = summarize(record.events);
  return (
    <>
      <h1 className="font-display text-4xl font-bold text-parchment sm:text-5xl">Trial results</h1>
      <p className="mt-3 text-lg text-mist">
        Tallowmere demo store, {new Date(record.startedAt).toLocaleString()}
      </p>
      <p className="mt-2 max-w-2xl text-mist">
        Every measurement below was taken from the live page by the browser. The words are the
        characters&apos; own.
      </p>
      <div className="mt-8 space-y-6">
        {summaries.map((summary) => (
          <CharacterResult key={summary.character} summary={summary} />
        ))}
      </div>
      <Link
        href="/lobby"
        className="font-display mt-8 inline-block rounded border-b-4 border-ember bg-amber px-6 py-3 text-lg font-bold text-indigo"
      >
        Run another trial
      </Link>
    </>
  );
}
