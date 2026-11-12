import type { CharacterId } from "@/lib/cast";
import type { CheckContext, CheckResult } from "../checks/types";
import type { Animation } from "../hud/stage";
import type { Actor, Scene, Shopper } from "../journeys/types";

/** blur: soft and washed out, as with low vision. dark: the screen off, as for a screen reader user. */
export type Lens = { label: string; kind: "blur" | "dark" };

/** Everything the engine needs to play one character. */
export type EngineCharacter = {
  id: CharacterId;
  frames: Record<string, readonly string[]>;
  palette: Record<string, string>;
  /** How the page looks to this character, for the button that shows it. Omitted when sight is not the issue. */
  lens?: Lens;
  checks(context: CheckContext): CheckResult[] | Promise<CheckResult[]>;
  /** What the character says about a snag, by check id. Used until AI lines are available. */
  lines: Record<string, string>;
  /** Which reaction to play for a snag, by check id. */
  reactions: Record<string, Animation>;
  greeting: string;
  onPurchase: string;
  onAbandon: string;
  /** Said on a re-run, at a place that was a snag last time and is not any more. */
  onFixed: string;
  /** Details the character types at checkout. */
  shopper: Shopper;
  /**
   * Lets a character move on from a scene in its own way instead of the
   * journey's. Returns true if it did; false leaves it to the journey.
   */
  takeOver?(scene: Scene, actor: Actor): Promise<boolean>;
};
