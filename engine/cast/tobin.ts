import { TOBIN_FRAMES, TOBIN_PALETTE } from "../art/tobin";
import { runTobinChecks } from "../checks/tobin";
import type { EngineCharacter } from "./types";

export const tobin: EngineCharacter = {
  id: "tobin",
  frames: TOBIN_FRAMES,
  palette: TOBIN_PALETTE,
  checks: runTobinChecks,
  lines: {
    "tobin.target-size": "My hands shake, you see. I can't land on something that small.",
    "tobin.spacing": "These are packed too tight. I'll hit the wrong one.",
    "tobin.risky-neighbour": "One slip and I'd remove the lot.",
    "tobin.miss-rate": "I keep missing it. Give me something I can hit.",
    "tobin.precision": "I can't hold a slider steady.",
  },
  reactions: {
    "tobin.target-size": "shake",
    "tobin.spacing": "shake",
    "tobin.risky-neighbour": "worry",
    "tobin.miss-rate": "shake",
    "tobin.precision": "shake",
  },
  greeting: "Two candles, if my hands allow it.",
  onPurchase: "Got there. Steady as she goes.",
  onAbandon: "I can't hit these little buttons. I'll leave it.",
  onFixed: "Now that, I can press.",
  // Tobin wants two candles, so he has to use the cart's quantity control.
  shopper: { name: "Tobin Reyes", email: "tobin@example.com", quantity: 2 },
};
