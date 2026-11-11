import type { CharacterId } from "@/lib/cast";
import type { CheckContext, CheckResult } from "../checks/types";
import type { Animation } from "../hud/stage";

/** Everything the engine needs to play one character. */
export type EngineCharacter = {
  id: CharacterId;
  frames: Record<string, readonly string[]>;
  palette: Record<string, string>;
  /** Label for the button that shows the page as this character perceives it. */
  lensLabel: string;
  checks(context: CheckContext): CheckResult[];
  /** What the character says about a snag, by check id. Used until AI lines are available. */
  lines: Record<string, string>;
  /** Which reaction to play for a snag, by check id. */
  reactions: Record<string, Animation>;
  greeting: string;
  onPurchase: string;
  onAbandon: string;
  /** Details the character types at checkout. */
  shopper: { name: string; email: string };
};
