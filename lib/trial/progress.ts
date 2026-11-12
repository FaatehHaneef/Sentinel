import type { CharacterId } from "@/lib/cast";
import { RUN_STORAGE_PREFIX, type RunRecord, type TrialEvent } from "./types";

/**
 * The store's progress across trials: a level from the XP its shoppers have
 * earned, and achievements for what they managed. Everything is worked out
 * from the trial records, so nothing here can drift from what happened.
 */

export const LEVELS = [
  { level: 1, rank: "Unlit stall", from: 0 },
  { level: 2, rank: "Flickering wick", from: 300 },
  { level: 3, rank: "Steady flame", from: 900 },
  { level: 4, rank: "Lantern row", from: 2000 },
  { level: 5, rank: "Beacon of the road", from: 3500 },
  { level: 6, rank: "Lighthouse", from: 6000 },
] as const;

export type Level = {
  level: number;
  rank: string;
  xp: number;
  /** XP at which this level started. */
  from: number;
  /** XP needed for the next level, or null at the top. */
  next: number | null;
};

export function levelFor(xp: number): Level {
  const index = LEVELS.findLastIndex((entry) => xp >= entry.from);
  const current = LEVELS[Math.max(0, index)];
  const next = LEVELS[index + 1];
  return {
    level: current.level,
    rank: current.rank,
    xp,
    from: current.from,
    next: next?.from ?? null,
  };
}

type Finish = Extract<TrialEvent, { type: "finish" }>;

function finishes(record: RunRecord): Finish[] {
  return record.events.filter((event): event is Finish => event.type === "finish");
}

/** True if this character bought in this trial and met no snag on the way. */
function cleanPurchase(record: RunRecord, character: CharacterId): boolean {
  const bought = finishes(record).some(
    (event) => event.character === character && event.outcome === "purchased",
  );
  const snagged = record.events.some(
    (event) => event.type === "snag" && event.character === character,
  );
  return bought && !snagged;
}

export type Achievement = {
  id: string;
  name: string;
  description: string;
  earned(records: readonly RunRecord[]): boolean;
};

function clean(id: string, name: string, character: CharacterId, who: string): Achievement {
  return {
    id,
    name,
    description: `${who} buys without a single snag.`,
    earned: (records) => records.some((record) => cleanPurchase(record, character)),
  };
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: "first-light",
    name: "First light",
    description: "Finish your first trial.",
    earned: (records) => records.some((record) => Boolean(record.finishedAt)),
  },
  {
    id: "second-chance",
    name: "Second chance",
    description: "A shopper who left without buying buys after your fixes.",
    earned: (records) =>
      records.some((record) => {
        const before = records.find((other) => other.config.runId === record.config.previousRunId);
        if (!before) return false;
        return finishes(record).some(
          (event) =>
            event.outcome === "purchased" &&
            finishes(before).some(
              (earlier) => earlier.character === event.character && earlier.outcome === "abandoned",
            ),
        );
      }),
  },
  {
    id: "ten-fixes",
    name: "Handy with a wrench",
    description: "Fix ten snags across your trials.",
    earned: (records) =>
      records.reduce(
        (sum, record) => sum + record.events.filter((event) => event.type === "fixed").length,
        0,
      ) >= 10,
  },
  clean("clear-as-day", "Clear as day", "iris", "Grandma Iris"),
  clean("steady-hands", "Steady hands", "tobin", "Tobin"),
  clean("one-bar", "One bar is enough", "pell", "Pell"),
  clean("every-door", "Every door opens", "knock", "Knock"),
  clean("heard-clearly", "Heard clearly", "echo", "Echo"),
  clean("thumb-friendly", "Thumb-friendly", "dash", "Dash"),
  clean("machine-readable", "Machine-readable", "cog", "Cog"),
  {
    id: "full-house",
    name: "Full house",
    description: "All seven shoppers buy in a single trial.",
    earned: (records) =>
      records.some(
        (record) => finishes(record).filter((event) => event.outcome === "purchased").length >= 7,
      ),
  },
];

export function totalXp(records: readonly RunRecord[]): number {
  return records.reduce(
    (sum, record) => sum + finishes(record).reduce((inner, event) => inner + event.xp, 0),
    0,
  );
}

export function earnedAchievements(records: readonly RunRecord[]): string[] {
  return ACHIEVEMENTS.filter((achievement) => achievement.earned(records)).map(
    (achievement) => achievement.id,
  );
}

/** Achievements this trial earned that the trials before it had not. Later trials are ignored. */
export function newlyEarned(records: readonly RunRecord[], runId: string): Achievement[] {
  const ordered = [...records].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const index = ordered.findIndex((record) => record.config.runId === runId);
  if (index < 0) return [];
  const upTo = ordered.slice(0, index + 1);
  const before = new Set(earnedAchievements(ordered.slice(0, index)));
  return ACHIEVEMENTS.filter(
    (achievement) => !before.has(achievement.id) && achievement.earned(upTo),
  );
}

/** Every trial record kept in this browser. */
export function readAllRecords(storage: Storage): RunRecord[] {
  const records: RunRecord[] = [];
  try {
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (!key?.startsWith(RUN_STORAGE_PREFIX) || key === `${RUN_STORAGE_PREFIX}latest`) continue;
      try {
        const record = JSON.parse(storage.getItem(key) ?? "null") as RunRecord | null;
        if (record?.config?.runId && Array.isArray(record.events)) records.push(record);
      } catch {
        // A damaged record is skipped.
      }
    }
  } catch {
    // Storage unavailable: no progress to show.
  }
  return records.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}
