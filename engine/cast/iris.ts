import { IRIS_FRAMES, IRIS_PALETTE } from "../art/iris";
import { runIrisChecks } from "../checks/iris";
import type { EngineCharacter } from "./types";

export const iris: EngineCharacter = {
  id: "iris",
  frames: IRIS_FRAMES,
  palette: IRIS_PALETTE,
  lens: { label: "See as Iris", kind: "blur" },
  checks: runIrisChecks,
  lines: {
    "iris.contrast": "This writing is too faint for me, dear.",
    "iris.text-size": "Such tiny letters. I'd need my magnifier.",
    "iris.labels": "Once I start typing, how do I know what this box was for?",
    "iris.button": "Is that a button? It melts right into the page.",
  },
  reactions: {
    "iris.contrast": "fuss",
    "iris.text-size": "worry",
    "iris.labels": "worry",
    "iris.button": "fuss",
  },
  greeting: "Let's see if I can buy a candle, dear.",
  onPurchase: "There we are. That was pleasant.",
  onAbandon: "I'm sorry, dear. I can't make this out. I'll shop somewhere else.",
  onFixed: "Oh, that's much better, dear. I can see that now.",
  shopper: { name: "Iris Hart", email: "iris@example.com", quantity: 1 },
};
