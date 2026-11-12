"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { getCharacter } from "@/lib/cast";
import { writeStoreFixes } from "@/lib/store/variants";
import { fixToCss, fixToSnippet } from "@/lib/trial/fixes";
import { DEFAULT_REVENUE_INPUTS, type RevenueInputs } from "@/lib/trial/revenue";
import { COINS_PER_DOLLAR, summarize, type CharacterSummary } from "@/lib/trial/scoring";
import {
  FIXES_STORAGE_KEY,
  type AppliedFix,
  type Fix,
  type PendingFixes,
  type RunRecord,
  type Severity,
} from "@/lib/trial/types";
import { withSuggestedColour, type Verdict } from "@/lib/trial/verdict";
import { RevenueEstimate, RevenueInputsForm } from "./RevenueEstimate";
import { StoreProgress } from "./StoreProgress";
import { sceneNames, useRunRecord, useVerdicts, type VerdictState } from "./useRunData";

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

type Snag = CharacterSummary["snags"][number];

function fixKey(character: string, snag: Snag): string {
  return `${character}|${snag.finding.check}|${snag.finding.selector}`;
}

/** The fix to offer for a snag: the computed one, or AI's colour where it passed the check. */
function offeredFix(snag: Snag, verdict: Verdict, index: number): Fix | undefined {
  return withSuggestedColour(snag.finding.fix, verdict.notes[index]?.colour, snag.finding.evidence);
}

function VerdictCard({ state }: { state: VerdictState }) {
  const { verdict, waiting, note } = state;
  return (
    <div className="mt-5 rounded border-l-4 border-amber bg-night p-4">
      <p className="font-display text-sm uppercase tracking-widest text-amber">
        Wick&apos;s verdict
      </p>
      <p className="mt-2 text-xl font-bold text-parchment">{verdict.headline}</p>
      <p className="mt-2 text-parchment">{verdict.story}</p>
      <p className="mt-3 text-sm text-mist" role="status">
        {waiting
          ? "Wick is still writing. These are his standard notes for now."
          : verdict.source === "ai"
            ? "Written by AI (Gemini) from the measurements below. The numbers are the browser's, not the AI's."
            : `Wick's standard notes, written without AI.${note ? ` ${note}` : ""}`}
      </p>
    </div>
  );
}

function Comparison({ before, after }: { before: CharacterSummary; after: CharacterSummary }) {
  const rows: [string, string, string][] = [
    ["Outcome", OUTCOME_TEXT[before.outcome], OUTCOME_TEXT[after.outcome]],
    ["Coins lost", String(before.coinsLost), String(after.coinsLost)],
    ["Snags", String(before.snags.length), String(after.snags.length)],
  ];
  return (
    <table className="mt-5 w-full border-collapse overflow-hidden rounded bg-night text-left">
      <caption className="font-display pb-2 text-left text-xl font-bold text-parchment">
        Before and after the fixes
      </caption>
      <thead>
        <tr className="text-sm uppercase tracking-widest text-mist">
          <th scope="col" className="p-3"></th>
          <th scope="col" className="p-3">
            Before
          </th>
          <th scope="col" className="p-3">
            After
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, was, now]) => (
          <tr key={label} className="border-t border-slate">
            <th scope="row" className="p-3 font-normal text-mist">
              {label}
            </th>
            <td className="p-3 text-parchment">{was}</td>
            <td className="p-3 font-bold text-moss">{now}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CharacterResult({
  summary,
  before,
  verdict,
  inputs,
  excluded,
  onToggle,
}: {
  summary: CharacterSummary;
  before?: CharacterSummary;
  verdict: VerdictState;
  inputs: RevenueInputs;
  excluded: Set<string>;
  onToggle: (key: string) => void;
}) {
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

      <VerdictCard state={verdict} />

      <dl className="mt-5 grid gap-3 sm:grid-cols-3">
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

      {before ? <Comparison before={before} after={summary} /> : null}

      <RevenueEstimate name={character.name} summary={summary} before={before} inputs={inputs} />

      {summary.fixed.length > 0 ? (
        <>
          <h3 className="font-display mt-6 text-xl font-bold text-parchment">
            Fixed since the last trial
          </h3>
          <ul className="mt-3 space-y-1 text-parchment">
            {summary.fixed.map((fixed, index) => (
              <li key={index}>
                <span className="font-bold text-moss">+{fixed.xp} XP</span> {fixed.label}{" "}
                <span className="text-mist">({fixed.coinsSaved} coins kept)</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {summary.snags.length > 0 ? (
        <>
          <h3 className="font-display mt-6 text-xl font-bold text-parchment">Snags and fixes</h3>
          <ol className="mt-3 space-y-3">
            {summary.snags.map((snag, index) => {
              const fix = offeredFix(snag, verdict.verdict, index);
              const key = fixKey(summary.character, snag);
              const why = verdict.verdict.notes[index]?.why;
              return (
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
                  {why ? <p className="mt-2 text-parchment">{why}</p> : null}
                  <p className="mt-2 text-sm text-mist">
                    Check: {snag.title}. Cost {snag.coins} coins.
                  </p>

                  {fix ? (
                    <div className="mt-3 rounded border border-slate p-3">
                      <label className="flex cursor-pointer items-start gap-3 font-bold text-parchment">
                        <input
                          type="checkbox"
                          className="mt-1 h-5 w-5 flex-none accent-amber"
                          checked={!excluded.has(key)}
                          onChange={() => onToggle(key)}
                        />
                        <span>
                          Fix: {fix.summary}
                          <span className="ml-2 font-normal text-mist">
                            {fix.storeFix
                              ? "(a change to the demo store's own code, switched on in your browser for the re-run)"
                              : fix.source === "ai"
                                ? "(colour suggested by AI, checked by the contrast maths)"
                                : "(computed from the measurement)"}
                          </span>
                        </span>
                      </label>
                      <pre className="mt-2 overflow-x-auto rounded bg-indigo p-3 text-sm text-parchment">
                        <code>{fixToSnippet(snag.finding.selector, fix)}</code>
                      </pre>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </>
      ) : null}

      {summary.passes.length > 0 ? (
        <details className="mt-6">
          <summary className="font-display cursor-pointer text-xl font-bold text-parchment">
            Passed checks ({summary.passes.length})
          </summary>
          <ul className="mt-3 space-y-1 text-parchment">
            {summary.passes.map((pass, index) => (
              <li key={index}>
                <span className="font-bold text-moss">+{pass.xp} XP</span> {pass.title}{" "}
                <span className="text-mist">({pass.scene})</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

/** The fixes that were tried in this trial, as one stylesheet to copy into the site. */
function AppliedFixes({ record }: { record: RunRecord }) {
  const fixes = record.fixes ?? [];
  if (fixes.length === 0) return null;
  const css = fixes
    .map(({ selector, fix }) => fixToCss(selector, fix))
    .filter(Boolean)
    .join("\n\n");
  const labels = fixes.filter(({ fix }) => fix.label);
  return (
    <section className="rounded-lg border-2 border-moss bg-indigo/80 p-6">
      <h2 className="font-display text-2xl font-bold text-moss">
        {fixes.length} {fixes.length === 1 ? "fix was" : "fixes were"} tried in this trial
      </h2>
      <p className="mt-2 max-w-2xl text-parchment">
        They were applied to the page in your browser only, for this trial. Nothing on the shop
        itself was changed. To keep them, copy them into the shop&apos;s code.
      </p>
      {labels.length > 0 ? (
        <>
          <h3 className="mt-4 font-bold text-parchment">Labels to add</h3>
          <ul className="mt-1 list-disc pl-6 text-parchment">
            {labels.map(({ label, fix }, index) => (
              <li key={index}>
                A visible label reading &ldquo;{fix.label}&rdquo; above the {label}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {css ? (
        <>
          <h3 className="mt-4 font-bold text-parchment">Styles to add</h3>
          <pre className="mt-2 max-h-96 overflow-auto rounded bg-night p-3 text-sm text-parchment">
            <code>{css}</code>
          </pre>
        </>
      ) : null}
    </section>
  );
}

export function RunResults() {
  const { id } = useParams<{ id: string }>();
  const record = useRunRecord(id);
  const previous = useRunRecord(record?.config.previousRunId);

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

  return <Results record={record} previous={previous ?? null} />;
}

function Results({ record, previous }: { record: RunRecord; previous: RunRecord | null }) {
  const summaries = summarize(record.events);
  const before = previous ? summarize(previous.events) : [];
  const verdicts = useVerdicts(record.config.runId, summaries, sceneNames(record));

  const purse = summaries[0] ? summaries[0].coinsLeft + summaries[0].coinsLost : 0;
  const [inputs, setInputs] = useState<RevenueInputs>({
    ...DEFAULT_REVENUE_INPUTS,
    averageOrderValue: purse / COINS_PER_DOLLAR,
  });
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const chosen: AppliedFix[] = [];
  const taken = new Set<string>();
  for (const summary of summaries) {
    summary.snags.forEach((snag, index) => {
      const fix = offeredFix(snag, verdicts[summary.character].verdict, index);
      const unique = `${snag.finding.check}|${snag.finding.selector}`;
      if (!fix || excluded.has(fixKey(summary.character, snag)) || taken.has(unique)) return;
      taken.add(unique);
      chosen.push({
        check: snag.finding.check,
        selector: snag.finding.selector,
        label: snag.finding.label,
        fix,
      });
    });
  }

  function toggle(key: string) {
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function tryFixes() {
    setStarting(true);
    setError("");
    try {
      // Fixes build up from trial to trial: the ones already tried stay, and the new ones join them.
      const fixes = [...(record.fixes ?? [])];
      for (const fix of chosen) {
        const same = fixes.findIndex(
          (entry) => entry.check === fix.check && entry.selector === fix.selector,
        );
        if (same >= 0) fixes[same] = fix;
        else fixes.push(fix);
      }
      const pending: PendingFixes = { fromRun: record.config.runId, fixes };
      window.localStorage.setItem(FIXES_STORAGE_KEY, JSON.stringify(pending));
      writeStoreFixes(
        window.localStorage,
        fixes.flatMap(({ fix }) => (fix.storeFix ? [fix.storeFix] : [])),
      );
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          party: record.config.party,
          pace: record.config.pace,
          previousRunId: record.config.runId,
        }),
      });
      const data = (await response.json()) as { startUrl?: string; error?: string };
      if (!response.ok || !data.startUrl)
        throw new Error(data.error ?? "The trial could not start.");
      window.location.assign(data.startUrl);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The trial could not start.");
      setStarting(false);
    }
  }

  return (
    <>
      <h1 className="font-display text-4xl font-bold text-parchment sm:text-5xl">Trial results</h1>
      <p className="mt-3 text-lg text-mist">
        Tallowmere demo store, {new Date(record.startedAt).toLocaleString()}
        {record.config.previousRunId ? ". A re-run with fixes applied." : ""}
      </p>
      <p className="mt-2 max-w-2xl text-mist">
        Every measurement below was taken from the live page by the browser. The characters&apos;
        lines are their own.
      </p>

      <div className="mt-8 space-y-6">
        <StoreProgress runId={record.config.runId} />
        <AppliedFixes record={record} />
        <RevenueInputsForm inputs={inputs} onChange={setInputs} />
        {summaries.map((summary) => (
          <CharacterResult
            key={summary.character}
            summary={summary}
            before={before.find((entry) => entry.character === summary.character)}
            verdict={verdicts[summary.character]}
            inputs={inputs}
            excluded={excluded}
            onToggle={toggle}
          />
        ))}
      </div>

      <div className="sticky bottom-0 mt-8 flex flex-wrap items-center gap-4 border-t-2 border-slate bg-night/95 py-4">
        {chosen.length > 0 ? (
          <button
            type="button"
            onClick={tryFixes}
            disabled={starting}
            className="font-display rounded border-b-4 border-ember bg-amber px-6 py-3 text-lg font-bold text-indigo disabled:opacity-50"
          >
            {starting
              ? "Opening the road…"
              : `Try ${chosen.length} ${chosen.length === 1 ? "fix" : "fixes"} and run the trial again`}
          </button>
        ) : null}
        <Link href="/lobby" className="font-bold text-amber underline underline-offset-4">
          Start a new trial
        </Link>
        {chosen.length > 0 ? (
          <p className="w-full text-sm text-mist">
            The fixes are tried on the page in your browser only. Nothing on the shop is changed.
          </p>
        ) : null}
        <p role="alert" className="w-full font-bold text-rose">
          {error}
        </p>
      </div>
    </>
  );
}
