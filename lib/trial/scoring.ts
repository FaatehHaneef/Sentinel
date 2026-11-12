import type { CharacterId } from "@/lib/cast";
import type { Finding, Outcome, Severity, TrialEvent } from "./types";

/**
 * Scoring rules. Every number here is a stated assumption of the game, kept
 * in one place so it can be read, tested and tuned.
 */

/** A shopper's purse holds ten coins for every dollar in their cart. */
export const COINS_PER_DOLLAR = 10;

export const STARTING_PATIENCE = 100;

export const PURCHASE_XP = 100;

const PATIENCE_COST: Record<Severity, number> = { minor: 4, major: 10, blocker: 25 };

/** Share of the purse that spills at a snag, before the funnel weighting. */
const COIN_SHARE: Record<Severity, number> = { minor: 0.01, major: 0.025, blocker: 0.06 };

const PASS_XP: Record<Severity, number> = { minor: 10, major: 20, blocker: 40 };

/** A snag on something the shopper must use hurts half as much again. */
const ON_PATH_FACTOR = 1.5;

export function purseFor(cartCents: number): number {
  return Math.round((cartCents / 100) * COINS_PER_DOLLAR);
}

export function patienceCost(finding: Pick<Finding, "severity" | "onPath">): number {
  return PATIENCE_COST[finding.severity] * (finding.onPath ? ON_PATH_FACTOR : 1);
}

/**
 * Coins lost at a snag. `funnel` grows as the shopper nears payment (0.5 on
 * the shop front, 1.5 at the pay step): a problem at the till costs more than
 * one at the door. Never more than what is left in the purse.
 */
export function coinCost(
  startingPurse: number,
  coinsLeft: number,
  finding: Pick<Finding, "severity" | "onPath">,
  funnel: number,
): number {
  const raw =
    startingPurse * COIN_SHARE[finding.severity] * funnel * (finding.onPath ? ON_PATH_FACTOR : 1);
  return Math.min(coinsLeft, Math.max(1, Math.round(raw)));
}

/** XP for a check that found nothing wrong, by how serious its failures would be. */
export function passXp(weight: Severity): number {
  return PASS_XP[weight];
}

export type CharacterSummary = {
  character: CharacterId;
  outcome: Outcome | "running";
  xp: number;
  coinsLost: number;
  coinsLeft: number;
  snags: Extract<TrialEvent, { type: "snag" }>[];
  passes: Extract<TrialEvent, { type: "pass" }>[];
  /** Snags from the previous trial that were gone in this one. */
  fixed: Extract<TrialEvent, { type: "fixed" }>[];
  abandonedAt?: string;
  orderId?: string;
};

/** Folds a run's event log into one summary per character, in party order. */
export function summarize(events: readonly TrialEvent[]): CharacterSummary[] {
  const byCharacter = new Map<CharacterId, CharacterSummary>();
  for (const event of events) {
    let summary = byCharacter.get(event.character);
    if (!summary) {
      summary = {
        character: event.character,
        outcome: "running",
        xp: 0,
        coinsLost: 0,
        coinsLeft: 0,
        snags: [],
        passes: [],
        fixed: [],
      };
      byCharacter.set(event.character, summary);
    }
    switch (event.type) {
      case "snag":
        summary.snags.push(event);
        break;
      case "pass":
        summary.passes.push(event);
        break;
      case "fixed":
        summary.fixed.push(event);
        break;
      case "purchase":
        summary.orderId = event.orderId;
        break;
      case "abandon":
        summary.abandonedAt = event.scene;
        break;
      case "finish":
        summary.outcome = event.outcome;
        summary.xp = event.xp;
        summary.coinsLost = event.coinsLost;
        summary.coinsLeft = event.coinsLeft;
        break;
    }
  }
  return [...byCharacter.values()];
}
