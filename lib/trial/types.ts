import type { CharacterId } from "@/lib/cast";
import type { StoreFixId } from "@/lib/store/variants";

/**
 * Shared vocabulary for a trial. The engine that runs inside the tested page
 * and the Sentinel app both use these types, and the event log is the single
 * record everything else is built from.
 */

export type Severity = "minor" | "major" | "blocker";

/** The numbers behind a measurement, kept so a fix can be checked against them. */
export type Evidence = {
  /** Colours as #rrggbb, after blending any transparency. */
  foreground?: string;
  background?: string;
  /** The contrast ratio measured, and the ratio required. */
  ratio?: number;
  required?: number;
  fontSizePx?: number;
};

/** One style change: which part of the element, and the declarations to set. */
export type CssChange = {
  /** element: the element itself. placeholder: its placeholder text. focus: the element while it has keyboard focus. */
  target: "element" | "placeholder" | "focus";
  declarations: Record<string, string>;
};

/**
 * A suggested repair for one finding. It can restyle the element, add a
 * visible label above a field, set a few named attributes, or make the
 * element work from the keyboard. Nothing else is expressible.
 */
export type Fix = {
  /** What the fix does, in plain words. */
  summary: string;
  css?: CssChange[];
  /** Text of a visible label to add above a field. */
  label?: string;
  /** Attributes to set, from a short allowed list (a name, a role, a place in the tab order). */
  attributes?: Record<string, string>;
  /** Make the element respond to Enter and Space as a button does. */
  keyboard?: boolean;
  /** A change to the demo store's own code, switched on in this browser for the re-run. */
  storeFix?: StoreFixId;
  /** rule: computed from the measurement. ai: a colour suggested by AI and checked by the same maths. */
  source: "rule" | "ai";
};

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
  /** True when this shopper cannot use the element at all, however patient they are. */
  stops?: boolean;
  evidence?: Evidence;
  fix?: Fix;
};

/** A fix chosen to be tried on the page during a re-run. */
export type AppliedFix = {
  check: string;
  selector: string;
  /** The element's description, for the feed and the results. */
  label: string;
  fix: Fix;
};

export type Outcome = "purchased" | "abandoned" | "stopped";

type EventBody =
  | { type: "scene"; scene: string; path: string; title: string }
  | { type: "pass"; scene: string; check: string; title: string; xp: number }
  | {
      type: "snag";
      scene: string;
      /** How close to payment the scene is: 0.5 at the shop front, 1.5 at the pay step. */
      funnel: number;
      finding: Finding;
      title: string;
      /** What the character says about it. */
      line: string;
      coins: number;
      patience: number;
    }
  | {
      /** A snag from the previous trial that is gone in this one. */
      type: "fixed";
      scene: string;
      check: string;
      selector: string;
      label: string;
      /** Coins the snag cost last time, now kept. */
      coinsSaved: number;
      xp: number;
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
  /** Set on a re-run: the trial whose chosen fixes are being tried. */
  previousRunId?: string;
};

/** A finished or in-progress run, as saved for the results page. */
export type RunRecord = {
  config: RunConfig;
  startedAt: string;
  finishedAt?: string;
  events: TrialEvent[];
  /** Fixes that were applied to the page during this run. */
  fixes?: AppliedFix[];
};

export const RUN_STORAGE_PREFIX = "sentinel:run:";

/** Where the fixes chosen on the results page wait for the re-run to pick them up. */
export const FIXES_STORAGE_KEY = "sentinel:fixes";

export type PendingFixes = { fromRun: string; fixes: AppliedFix[] };
