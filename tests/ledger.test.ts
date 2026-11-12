import { describe, expect, it } from "vitest";
import { buildHistory, buildLedger } from "@/lib/trial/ledger";
import type { RunRecord, TrialEvent } from "@/lib/trial/types";

function snag(selector: string): TrialEvent {
  return {
    t: 1,
    character: "iris",
    type: "snag",
    scene: "details",
    funnel: 1.25,
    title: "Text stands out from its background",
    line: "Too faint.",
    coins: 20,
    patience: 10,
    finding: {
      check: "iris.contrast",
      severity: "blocker",
      selector,
      label: `"${selector}" field`,
      measured: "Contrast 1.6:1, needs 4.5:1",
      onPath: true,
      fix: {
        summary: "Darken",
        source: "rule",
        css: [{ target: "placeholder", declarations: { color: "#5c4a3a" } }],
      },
    },
  };
}

function record(
  runId: string,
  startedAt: string,
  events: TrialEvent[],
  previousRunId?: string,
): RunRecord {
  return {
    config: {
      runId,
      party: ["iris"],
      seed: 1,
      pace: "fast",
      origin: "http://x",
      kind: "own",
      previousRunId,
    },
    startedAt,
    finishedAt: startedAt,
    events: [
      {
        t: 0,
        character: "iris",
        type: "scene",
        scene: "details",
        path: "/store/checkout",
        title: "Your details",
      },
      ...events,
    ],
  };
}

describe("ledger", () => {
  const first = record("a", "2026-11-12T10:00:00.000Z", [
    snag("name"),
    snag("email"),
    {
      t: 2,
      character: "iris",
      type: "finish",
      outcome: "abandoned",
      coinsLeft: 0,
      coinsLost: 180,
      xp: 200,
    },
  ]);
  const second = record(
    "b",
    "2026-11-12T10:05:00.000Z",
    [
      {
        t: 1,
        character: "iris",
        type: "fixed",
        scene: "details",
        check: "iris.contrast",
        selector: "name",
        label: "l",
        coinsSaved: 20,
        xp: 40,
      },
      snag("email"),
      {
        t: 2,
        character: "iris",
        type: "finish",
        outcome: "purchased",
        coinsLeft: 170,
        coinsLost: 10,
        xp: 600,
      },
    ],
    "a",
  );

  it("lists every snag with its page name and whether the next trial fixed it", () => {
    const rows = buildLedger([first, second]);
    expect(rows).toHaveLength(3);
    const firstRows = rows.filter((row) => row.runId === "a");
    expect(firstRows.find((row) => row.element.includes("name"))).toMatchObject({
      shopper: "Grandma Iris",
      page: "Your details",
      status: "Fixed in the next trial",
      fixOffered: true,
    });
    expect(firstRows.find((row) => row.element.includes("email"))?.status).toBe("Still open");
    expect(rows.find((row) => row.runId === "b")?.status).toBe("Not re-run yet");
  });

  it("summarises each trial, newest first", () => {
    const history = buildHistory([first, second]);
    expect(history.map((row) => row.runId)).toEqual(["b", "a"]);
    expect(history[0]).toMatchObject({
      purchases: 1,
      shopperCount: 1,
      snags: 1,
      fixed: 1,
      xp: 600,
      rerunOf: "2026-11-12 10:00",
    });
    expect(history[1]).toMatchObject({ purchases: 0, coinsLost: 180, rerunOf: null });
  });
});
