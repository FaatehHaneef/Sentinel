import { KNOCK_FRAMES, KNOCK_PALETTE } from "../art/knock";
import { runKnockChecks } from "../checks/knock";
import type { EngineCharacter } from "./types";

export const knock: EngineCharacter = {
  id: "knock",
  frames: KNOCK_FRAMES,
  palette: KNOCK_PALETTE,
  checks: runKnockChecks,
  lines: {
    "knock.reachable": "Knock, knock. Nobody answers. The Tab key can't reach this.",
    "knock.focus-visible": "I'm on something, but I can't see where I am.",
    "knock.tab-order": "Why did I just jump over there?",
    "knock.skip-link": "The whole menu again, on every page.",
  },
  reactions: {
    "knock.reachable": "shake",
    "knock.focus-visible": "worry",
    "knock.tab-order": "worry",
    "knock.skip-link": "fuss",
  },
  greeting: "Keyboard only. Let's see how far Tab gets me.",
  onPurchase: "All the way through without a mouse.",
  onAbandon: "No way to press it without a mouse. I'm stuck.",
  onFixed: "Ah. Now Tab finds it.",
  // Knock wants two candles, so he has to use the cart's quantity control.
  shopper: { name: "Knock Arden", email: "knock@example.com", quantity: 2 },
};
