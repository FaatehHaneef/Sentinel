import type { CharacterId } from "@/lib/cast";

/**
 * Shared vocabulary for a trial. The engine that runs inside the tested page
 * and the Sentinel app both use these types, and the event log is the single
 * record everything else is built from.
 */

export type Severity = "minor" | "major" | "blocker";

/** One measured problem on one element. */
export type Finding = {
  /** Check id, for example "iris.contrast". */
  check: string;
  severity: Severity;
  /** CSS selector that locates the element again. */
  selector: string;
  /** Short human description of the element, for example: "Full name" field. */
  label: string;
  /** The measurement in plain words, for example "Contrast 1.7:1, needs 4.5:1". */
  measured: string;
  /** True when the shopper has to use this element to complete the purchase. */
  onPath: boolean;
};

export type Outcome = "purchased" | "abandoned" | "stopped";

type EventBody =
  | { type: "scene"; scene: string; path: string; title: string }
  | { type: "pass"; scene: string; check: string; title: string; xp: number }
  | {
      type: "snag";
      scene: string;
      finding: Finding;
      title: string;
      /** What the character says about it. */
      line: string;
      coins: number;
      patience: number;
    }
  | { type: "action"; scene: string; text: string }
  | { type: "purchase"; orderId: string; xp: number }
  | { type: "abandon"; scene: string; reason: string; coins: number }
  | { type: "finish"; outcome: Outcome; coinsLeft: number; coinsLost: number; xp: number };

export type TrialEvent = EventBody & {
  /** Milliseconds since the run started. */
  t: number;
  character: CharacterId;
};

export type Pace = "normal" | "fast";

/** What a run is allowed to do. Issued by the server inside a signed launch token. */
export type RunConfig = {
  runId: string;
  party: CharacterId[];
  seed: number;
  pace: Pace;
  /** The only origin this run may execute on. */
  origin: string;
  /** own: Sentinel's demo store. verified: a site whose owner installed the script. */
  kind: "own" | "verified";
};

/** A finished or in-progress run, as saved for the results page. */
export type RunRecord = {
  config: RunConfig;
  startedAt: string;
  finishedAt?: string;
  events: TrialEvent[];
};

export const RUN_STORAGE_PREFIX = "sentinel:run:";
