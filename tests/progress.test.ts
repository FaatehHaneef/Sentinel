import { describe, expect, it } from "vitest";
import type { CharacterId } from "@/lib/cast";
import {
  earnedAchievements,
  levelFor,
  newlyEarned,
  readAllRecords,
  totalXp,
} from "@/lib/trial/progress";
import type { Outcome, RunRecord, TrialEvent } from "@/lib/trial/types";

function finish(character: CharacterId, outcome: Outcome, xp = 100): TrialEvent {
  return { t: 1, character, type: "finish", outcome, coinsLeft: 0, coinsLost: 0, xp };
}

function snag(character: CharacterId): TrialEvent {
  return {
    t: 1,
    character,
    type: "snag",
    scene: "cart",
    funnel: 1,
    title: "t",
    line: "l",
    coins: 1,
    patience: 1,
    finding: {
      check: "x",
      severity: "minor",
      selector: "body",
      label: "l",
      measured: "m",
      onPath: false,
    },
  };
}

function fixed(character: CharacterId): TrialEvent {
  return {
    t: 1,
    character,
    type: "fixed",
    scene: "cart",
    check: "x",
    selector: "body",
    label: "l",
    coinsSaved: 1,
    xp: 10,
  };
}

let counter = 0;
function record(events: TrialEvent[], previousRunId?: string): RunRecord {
  counter += 1;
  return {
    config: {
      runId: `run-${String(counter).padStart(4, "0")}`,
      party: ["iris"],
      seed: 1,
      pace: "fast",
      origin: "http://localhost:3000",
      kind: "own",
      previousRunId,
    },
    startedAt: `2026-11-12T10:${String(counter).padStart(2, "0")}:00.000Z`,
    finishedAt: "2026-11-12T11:00:00.000Z",
    events,
  };
}

describe("store level", () => {
  it("starts at the bottom and climbs with XP", () => {
    expect(levelFor(0)).toMatchObject({ level: 1, rank: "Unlit stall", next: 300 });
    expect(levelFor(299).level).toBe(1);
    expect(levelFor(300)).toMatchObject({
      level: 2,
      rank: "Flickering wick",
      from: 300,
      next: 900,
    });
    expect(levelFor(99_999)).toMatchObject({ level: 6, next: null });
  });

  it("adds up the XP of every shopper in every trial", () => {
    expect(
      totalXp([
        record([finish("iris", "abandoned", 280)]),
        record([finish("tobin", "purchased", 960)]),
      ]),
    ).toBe(1240);
  });
});

describe("achievements", () => {
  it("awards first light for a finished trial", () => {
    expect(earnedAchievements([record([finish("iris", "abandoned")])])).toEqual(["first-light"]);
  });

  it("awards a clean purchase only when the shopper met no snag", () => {
    expect(earnedAchievements([record([snag("iris"), finish("iris", "purchased")])])).not.toContain(
      "clear-as-day",
    );
    expect(earnedAchievements([record([finish("iris", "purchased")])])).toContain("clear-as-day");
  });

  it("awards a second chance when a fixed re-run turns a lost sale into a purchase", () => {
    const first = record([finish("knock", "abandoned")]);
    const second = record([finish("knock", "purchased")], first.config.runId);
    expect(earnedAchievements([first, second])).toContain("second-chance");
    expect(newlyEarned([first, second], second.config.runId).map((a) => a.id)).toContain(
      "second-chance",
    );
    expect(newlyEarned([first, second], first.config.runId).map((a) => a.id)).not.toContain(
      "second-chance",
    );
  });

  it("counts fixes across trials", () => {
    const nine = record(Array.from({ length: 9 }, () => fixed("iris")));
    expect(earnedAchievements([nine])).not.toContain("ten-fixes");
    expect(earnedAchievements([nine, record([fixed("tobin")])])).toContain("ten-fixes");
  });

  it("awards a full house when seven shoppers buy in one trial", () => {
    const all: CharacterId[] = ["iris", "tobin", "pell", "knock", "echo", "dash", "cog"];
    expect(earnedAchievements([record(all.map((id) => finish(id, "purchased")))])).toContain(
      "full-house",
    );
  });
});

describe("reading records", () => {
  it("reads every record, skips the pointer to the latest and damaged entries, oldest first", () => {
    const store = new Map<string, string>();
    const storage = {
      get length() {
        return store.size;
      },
      key: (index: number) => [...store.keys()][index] ?? null,
      getItem: (key: string) => store.get(key) ?? null,
    } as unknown as Storage;
    const older = record([finish("iris", "abandoned")]);
    const newer = record([finish("tobin", "abandoned")]);
    store.set(`sentinel:run:${newer.config.runId}`, JSON.stringify(newer));
    store.set(`sentinel:run:${older.config.runId}`, JSON.stringify(older));
    store.set("sentinel:run:latest", newer.config.runId);
    store.set("sentinel:run:broken", "{");
    store.set("unrelated", "1");
    expect(readAllRecords(storage).map((entry) => entry.config.runId)).toEqual([
      older.config.runId,
      newer.config.runId,
    ]);
  });
});
