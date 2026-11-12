import { getCharacter, type CharacterId } from "@/lib/cast";
import { plainProblem } from "./plain";
import type { RunRecord, Severity } from "./types";

/**
 * The ledger: every snag from every trial kept in this browser, as table
 * rows, and one row per trial for the history.
 */

export type LedgerStatus = "Fixed in the next trial" | "Still open" | "Not re-run yet";

export type LedgerRow = {
  runId: string;
  trial: string;
  shopper: string;
  page: string;
  check: string;
  /** The problem in plain words. */
  problem: string;
  element: string;
  severity: Severity;
  neededToBuy: boolean;
  measured: string;
  coins: number;
  status: LedgerStatus;
  fixOffered: boolean;
};

export type HistoryRow = {
  runId: string;
  started: string;
  shoppers: string;
  purchases: number;
  shopperCount: number;
  snags: number;
  fixed: number;
  coinsLost: number;
  xp: number;
  rerunOf: string | null;
};

function shortDate(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

function sceneNames(record: RunRecord): Record<string, string> {
  const names: Record<string, string> = {};
  for (const event of record.events) {
    if (event.type === "scene") names[event.scene] = event.title;
  }
  return names;
}

export function buildLedger(records: readonly RunRecord[]): LedgerRow[] {
  // For each trial, the snags its re-run found fixed, and whether it was re-run at all.
  const fixedLater = new Map<string, Set<string>>();
  const rerun = new Set<string>();
  for (const record of records) {
    const previous = record.config.previousRunId;
    if (!previous) continue;
    rerun.add(previous);
    const keys = fixedLater.get(previous) ?? new Set<string>();
    for (const event of record.events) {
      if (event.type === "fixed") keys.add(`${event.character}|${event.check}|${event.selector}`);
    }
    fixedLater.set(previous, keys);
  }

  const rows: LedgerRow[] = [];
  for (const record of records) {
    const names = sceneNames(record);
    const fixed = fixedLater.get(record.config.runId);
    for (const event of record.events) {
      if (event.type !== "snag") continue;
      const key = `${event.character}|${event.finding.check}|${event.finding.selector}`;
      rows.push({
        runId: record.config.runId,
        trial: shortDate(record.startedAt),
        shopper: getCharacter(event.character).name,
        page: names[event.scene] ?? event.scene,
        check: event.title,
        problem: plainProblem(event.finding.check),
        element: event.finding.label,
        severity: event.finding.severity,
        neededToBuy: event.finding.onPath,
        measured: event.finding.measured,
        coins: event.coins,
        status: fixed?.has(key)
          ? "Fixed in the next trial"
          : rerun.has(record.config.runId)
            ? "Still open"
            : "Not re-run yet",
        fixOffered: Boolean(event.finding.fix),
      });
    }
  }
  return rows;
}

export function buildHistory(records: readonly RunRecord[]): HistoryRow[] {
  return [...records]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .map((record) => {
      const finishes = record.events.filter((event) => event.type === "finish");
      return {
        runId: record.config.runId,
        started: shortDate(record.startedAt),
        shoppers: record.config.party.map((id: CharacterId) => getCharacter(id).name).join(", "),
        purchases: finishes.filter((event) => event.outcome === "purchased").length,
        shopperCount: record.config.party.length,
        snags: record.events.filter((event) => event.type === "snag").length,
        fixed: record.events.filter((event) => event.type === "fixed").length,
        coinsLost: finishes.reduce((sum, event) => sum + event.coinsLost, 0),
        xp: finishes.reduce((sum, event) => sum + event.xp, 0),
        rerunOf: record.config.previousRunId
          ? shortDate(
              records.find((other) => other.config.runId === record.config.previousRunId)
                ?.startedAt ?? "",
            ) || "an earlier trial"
          : null,
      };
    });
}
