"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { CharacterSummary } from "@/lib/trial/scoring";
import { RUN_STORAGE_PREFIX, type RunRecord } from "@/lib/trial/types";
import {
  buildVerdictRequest,
  builtInVerdict,
  type Verdict,
  type VerdictRequest,
} from "@/lib/trial/verdict";

const noSubscription = () => () => {};

/**
 * Reads a trial record from this browser's storage.
 * undefined: not read yet. null: there is no such record.
 */
export function useRunRecord(id: string | undefined): RunRecord | null | undefined {
  // The record is read as a string so React can compare snapshots cheaply.
  const raw = useSyncExternalStore(
    noSubscription,
    () => {
      if (!id) return null;
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

/** Display names of the scenes a run passed through, by scene id. */
export function sceneNames(record: RunRecord): Record<string, string> {
  const names: Record<string, string> = {};
  for (const event of record.events) {
    if (event.type === "scene") names[event.scene] = event.title;
  }
  return names;
}

export type VerdictState = { verdict: Verdict; waiting: boolean; note?: string };

function cacheKey(runId: string, character: string): string {
  return `sentinel:verdict:${runId}:${character}`;
}

function readCache(key: string): Verdict | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Verdict) : null;
  } catch {
    return null;
  }
}

/**
 * Wick's verdict for each character in a run. The built-in notes are shown
 * at once, then replaced by the AI-written verdict if one arrives. An AI
 * verdict is kept in this browser so reopening the page does not ask again.
 */
export function useVerdicts(
  runId: string,
  summaries: CharacterSummary[],
  names: Record<string, string>,
): Record<string, VerdictState> {
  const requests: [string, VerdictRequest][] = summaries.map((summary) => [
    summary.character,
    buildVerdictRequest(summary, names, summary.fixed.length),
  ]);
  const signature = JSON.stringify(requests);
  const [fetched, setFetched] = useState<Record<string, VerdictState>>({});

  useEffect(() => {
    let cancelled = false;
    const pending = JSON.parse(signature) as [string, VerdictRequest][];
    for (const [character, request] of pending) {
      if (request.outcome === "running") continue;
      const key = cacheKey(runId, character);
      const cached = readCache(key);
      if (cached) {
        queueMicrotask(() => {
          if (!cancelled) {
            setFetched((current) => ({
              ...current,
              [character]: { verdict: cached, waiting: false },
            }));
          }
        });
        continue;
      }
      fetch("/api/verdict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("verdict");
          return (await response.json()) as { verdict: Verdict; note?: string };
        })
        .then(({ verdict, note }) => {
          if (cancelled) return;
          if (verdict.source === "ai") {
            try {
              window.localStorage.setItem(key, JSON.stringify(verdict));
            } catch {
              // Not being able to cache only means asking again next time.
            }
          }
          setFetched((current) => ({ ...current, [character]: { verdict, waiting: false, note } }));
        })
        .catch(() => {
          if (cancelled) return;
          setFetched((current) => ({
            ...current,
            [character]: {
              verdict: builtInVerdict(request),
              waiting: false,
              note: "AI could not be reached.",
            },
          }));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [runId, signature]);

  const result: Record<string, VerdictState> = {};
  for (const [character, request] of requests) {
    result[character] = fetched[character] ?? {
      verdict: builtInVerdict(request),
      waiting: request.outcome !== "running",
    };
  }
  return result;
}
