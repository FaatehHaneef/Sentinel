import type { Severity, TrialEvent } from "./types";

/**
 * The revenue-at-risk estimate. It is a model with stated assumptions, not a
 * measurement, and the interface says so wherever a number from here appears.
 *
 *   at risk per month = monthly checkouts
 *                     × share of shoppers like this character
 *                     × chance such a shopper gives up
 *                     × average order value
 *
 * The first, second and fourth inputs are the merchant's to set. The chance
 * of giving up is built from the snags the character met.
 */

/** Chance that one snag, on its own, makes a shopper give up. Assumptions of the model. */
const SNAG_WEIGHT: Record<Severity, number> = { minor: 0.02, major: 0.06, blocker: 0.15 };

/** A snag on something needed to buy counts half as much again. */
const ON_PATH_FACTOR = 1.5;

/** No single snag is assumed to lose more than this share of shoppers. */
const MAX_SINGLE = 0.6;

type Snag = Extract<TrialEvent, { type: "snag" }>;

export function snagWeight(
  snag: Pick<Snag, "funnel"> & { finding: Pick<Snag["finding"], "severity" | "onPath"> },
): number {
  const weight =
    SNAG_WEIGHT[snag.finding.severity] *
    (snag.finding.onPath ? ON_PATH_FACTOR : 1) *
    (snag.funnel || 1);
  return Math.min(MAX_SINGLE, weight);
}

/**
 * Chance that a shopper like this gives up, given every snag they met. Each
 * snag is treated as an independent chance to lose them, so the result rises
 * with each one and never reaches 100%.
 */
export function abandonmentChance(snags: readonly Parameters<typeof snagWeight>[0][]): number {
  let stays = 1;
  for (const snag of snags) stays *= 1 - snagWeight(snag);
  return 1 - stays;
}

export type RevenueInputs = {
  monthlyCheckouts: number;
  /** Share of shoppers who are like this character, from 0 to 1. */
  shopperShare: number;
  averageOrderValue: number;
};

/** Starting values, shown as assumptions for the merchant to replace with their own. */
export const DEFAULT_REVENUE_INPUTS: Omit<RevenueInputs, "averageOrderValue"> = {
  monthlyCheckouts: 1000,
  shopperShare: 0.05,
};

export function revenueAtRisk(inputs: RevenueInputs, chance: number): number {
  const safe = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);
  return (
    safe(inputs.monthlyCheckouts) *
    Math.min(1, safe(inputs.shopperShare)) *
    Math.min(1, safe(chance)) *
    safe(inputs.averageOrderValue)
  );
}
