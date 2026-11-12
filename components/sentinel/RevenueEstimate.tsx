"use client";

import { abandonmentChance, revenueAtRisk, type RevenueInputs } from "@/lib/trial/revenue";
import type { CharacterSummary } from "@/lib/trial/scoring";

function money(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** The three numbers a shop owner sets for the estimate. Shared by every character on the page. */
export function RevenueInputsForm({
  inputs,
  onChange,
}: {
  inputs: RevenueInputs;
  onChange: (inputs: RevenueInputs) => void;
}) {
  const field =
    "mt-1 w-full rounded border-2 border-slate bg-night px-3 py-2 text-lg text-parchment";
  const number = (value: string) => Math.max(0, Number(value) || 0);
  return (
    <section className="rounded-lg border-2 border-slate bg-indigo/80 p-6">
      <h2 className="font-display text-2xl font-bold text-parchment">Your shop&apos;s numbers</h2>
      <p className="mt-2 max-w-2xl text-mist">
        The money estimates on this page use these three numbers. The starting values are
        placeholders, not facts about your shop. Replace them with your own.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="text-parchment">
          Checkouts started per month
          <input
            type="number"
            min={0}
            inputMode="numeric"
            className={field}
            value={inputs.monthlyCheckouts}
            onChange={(event) =>
              onChange({ ...inputs, monthlyCheckouts: number(event.target.value) })
            }
          />
        </label>
        <label className="text-parchment">
          Shoppers like each character (%)
          <input
            type="number"
            min={0}
            max={100}
            inputMode="decimal"
            className={field}
            value={Math.round(inputs.shopperShare * 1000) / 10}
            onChange={(event) =>
              onChange({ ...inputs, shopperShare: Math.min(100, number(event.target.value)) / 100 })
            }
          />
        </label>
        <label className="text-parchment">
          Average order value ($)
          <input
            type="number"
            min={0}
            inputMode="decimal"
            className={field}
            value={inputs.averageOrderValue}
            onChange={(event) =>
              onChange({ ...inputs, averageOrderValue: number(event.target.value) })
            }
          />
        </label>
      </div>
    </section>
  );
}

/** Revenue at risk for one character, with the working shown. */
export function RevenueEstimate({
  name,
  summary,
  before,
  inputs,
}: {
  name: string;
  summary: CharacterSummary;
  before?: CharacterSummary;
  inputs: RevenueInputs;
}) {
  const chance = abandonmentChance(summary.snags);
  const atRisk = revenueAtRisk(inputs, chance);
  const chanceBefore = before ? abandonmentChance(before.snags) : null;
  const atRiskBefore = chanceBefore === null ? null : revenueAtRisk(inputs, chanceBefore);

  return (
    <div className="mt-6 rounded border-2 border-amber/60 bg-night p-4">
      <h3 className="font-display text-xl font-bold text-amber">Revenue at risk (estimate)</h3>
      <p className="mt-2 text-3xl font-bold text-parchment">
        {money(atRisk)} <span className="text-lg font-normal text-mist">per month</span>
      </p>
      {atRiskBefore !== null ? (
        <p className="mt-1 text-moss">
          Down from {money(atRiskBefore)} per month in the previous trial.
        </p>
      ) : null}
      <p className="mt-3 text-parchment">
        From the snags {name} met, the model estimates that <strong>{percent(chance)}</strong> of
        shoppers like {name} would give up
        {chanceBefore !== null ? ` (${percent(chanceBefore)} before)` : ""}.
      </p>
      <p className="mt-2 text-sm text-mist">
        {inputs.monthlyCheckouts.toLocaleString("en-US")} checkouts × {percent(inputs.shopperShare)}{" "}
        shoppers like {name} × {percent(chance)} giving up × {money(inputs.averageOrderValue)}{" "}
        average order. Each snag adds a chance of losing the shopper: more for serious ones, for
        things needed to buy, and for steps close to payment. This is an estimate to compare before
        and after, not a forecast.
      </p>
    </div>
  );
}
