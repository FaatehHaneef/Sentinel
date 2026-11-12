import { ECHO_FRAMES, ECHO_PALETTE } from "../art/echo";
import { runEchoChecks } from "../checks/echo";
import type { EngineCharacter } from "./types";

export const echo: EngineCharacter = {
  id: "echo",
  frames: ECHO_FRAMES,
  palette: ECHO_PALETTE,
  // Echo does not see the page at all: the lens turns the screen off.
  lens: { label: "Screen off, as for Echo", kind: "dark" },
  checks: runEchoChecks,
  lines: {
    "echo.image-names": 'I hear: "image". An image of what?',
    "echo.control-names": "I can't tell what this does.",
    "echo.headings": "The headings don't make a map I can follow.",
    "echo.landmarks": "Nothing marks where the content starts. I have to listen to all of it.",
    "echo.page-basics": "It's reading this page in the wrong voice.",
  },
  reactions: {
    "echo.image-names": "worry",
    "echo.control-names": "fuss",
    "echo.headings": "worry",
    "echo.landmarks": "worry",
    "echo.page-basics": "fuss",
  },
  greeting: "I'll listen my way through.",
  onPurchase: "Clear enough to follow. Done.",
  onAbandon: "I can't tell what anything is. I'm leaving.",
  onFixed: "Now it says what it is.",
  shopper: { name: "Echo Lindqvist", email: "echo@example.com", quantity: 1 },
};
