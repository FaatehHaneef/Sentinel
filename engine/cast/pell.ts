import { PELL_FRAMES, PELL_PALETTE } from "../art/pell";
import { runPellChecks } from "../checks/pell";
import type { EngineCharacter } from "./types";

export const pell: EngineCharacter = {
  id: "pell",
  frames: PELL_FRAMES,
  palette: PELL_PALETTE,
  checks: runPellChecks,
  lines: {
    "pell.wait": "One bar out here. This page would take an age.",
    "pell.heavy-images": "All this for one picture? My pack's lighter.",
    "pell.layout-shift": "Everything keeps jumping about while it loads.",
    "pell.lazy-images": "Why is it loading things I can't even see yet?",
  },
  reactions: {
    "pell.wait": "worry",
    "pell.heavy-images": "fuss",
    "pell.layout-shift": "worry",
    "pell.lazy-images": "fuss",
  },
  greeting: "Long road from the hills. Let's hope the signal holds.",
  onPurchase: "Made it, even on one bar.",
  onAbandon: "I can't wait this long for a shop to load. I'm off.",
  onFixed: "That came through quickly. Much better.",
  shopper: { name: "Pell Moor", email: "pell@example.com", quantity: 1 },
};
