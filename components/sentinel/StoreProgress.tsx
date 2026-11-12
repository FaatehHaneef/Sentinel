"use client";

import { useSyncExternalStore } from "react";
import {
  ACHIEVEMENTS,
  earnedAchievements,
  levelFor,
  newlyEarned,
  readAllRecords,
  totalXp,
} from "@/lib/trial/progress";
import type { RunRecord } from "@/lib/trial/types";

const noSubscription = () => () => {};

/** Every trial record in this browser, read once as a string so React can compare snapshots. */
function useAllRecords(): RunRecord[] | null {
  const raw = useSyncExternalStore(
    noSubscription,
    () => JSON.stringify(readAllRecords(window.localStorage)),
    () => null,
  );
  return raw === null ? null : (JSON.parse(raw) as RunRecord[]);
}

/**
 * The store's level and its achievements, from every trial kept in this
 * browser. On a results page, the achievements this trial earned are marked.
 */
export function StoreProgress({ runId }: { runId?: string }) {
  const records = useAllRecords();
  if (!records) return null;

  const level = levelFor(totalXp(records));
  const earned = new Set(earnedAchievements(records));
  const fresh = new Set(
    runId ? newlyEarned(records, runId).map((achievement) => achievement.id) : [],
  );
  const span = level.next === null ? 1 : level.next - level.from;
  const progress = level.next === null ? 1 : (level.xp - level.from) / span;

  return (
    <section
      className="rounded-lg border-2 border-amber/60 bg-indigo/80 p-6"
      aria-label="Store progress"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-sm uppercase tracking-widest text-amber">Store level</p>
          <p className="font-display text-3xl font-bold text-parchment">
            {level.level}. {level.rank}
          </p>
        </div>
        <p className="text-mist">
          {level.xp.toLocaleString("en-US")} XP
          {level.next !== null
            ? ` · ${(level.next - level.xp).toLocaleString("en-US")} to the next level`
            : " · the top level"}
        </p>
      </div>
      <div
        className="mt-3 h-3 overflow-hidden rounded bg-night"
        role="progressbar"
        aria-label="Progress to the next level"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <div className="h-full bg-amber" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>

      <h2 className="font-display mt-6 text-xl font-bold text-parchment">
        Achievements ({earned.size} of {ACHIEVEMENTS.length})
      </h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ACHIEVEMENTS.map((achievement) => {
          const has = earned.has(achievement.id);
          return (
            <li
              key={achievement.id}
              className={`rounded border-2 p-3 ${
                fresh.has(achievement.id)
                  ? "border-amber bg-night"
                  : has
                    ? "border-moss bg-night"
                    : "border-slate bg-indigo"
              }`}
            >
              <p className={`font-bold ${has ? "text-parchment" : "text-mist"}`}>
                <span aria-hidden="true">{has ? "★ " : "☆ "}</span>
                {achievement.name}
                <span className="sr-only">{has ? " (earned)" : " (not yet earned)"}</span>
                {fresh.has(achievement.id) ? (
                  <span className="ml-2 rounded bg-amber px-2 py-0.5 text-xs font-bold text-indigo">
                    New
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-sm text-mist">{achievement.description}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
