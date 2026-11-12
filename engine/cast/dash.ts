import { DASH_FRAMES, DASH_PALETTE } from "../art/dash";
import { runDashChecks } from "../checks/dash";
import type { EngineCharacter } from "./types";

export const dash: EngineCharacter = {
  id: "dash",
  frames: DASH_FRAMES,
  palette: DASH_PALETTE,
  checks: runDashChecks,
  lines: {
    "dash.overflow": "Why is the page sliding sideways? Ugh.",
    "dash.viewport": "It's a tiny desktop page. I'm not pinching all day.",
    "dash.popup": "A popup before I've even seen anything? Bye.",
    "dash.input-help": "No autofill? I have to type all of that?",
  },
  reactions: {
    "dash.overflow": "fuss",
    "dash.viewport": "fuss",
    "dash.popup": "worry",
    "dash.input-help": "fuss",
  },
  greeting: "On my phone, between stops. This better be quick.",
  onPurchase: "Done. That was fast enough.",
  onAbandon: "Not worth it. Closing the tab.",
  onFixed: "Oh, that works on my phone now.",
  shopper: { name: "Dash Okafor", email: "dash@example.com", quantity: 1 },
};
