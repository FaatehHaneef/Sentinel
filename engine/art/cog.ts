import { withRows } from "./sprite";

/**
 * Cog: a small brass automaton with one amber lens for an eye and an
 * antenna that glows when it is thinking. 16 by 24 pixels.
 */

export const COG_PALETTE: Record<string, string> = {
  A: "#ffe08a", // antenna light
  a: "#8a7a5c", // antenna
  K: "#c9a24a", // brass
  k: "#9c7a2e", // brass shade
  L: "#ffb347", // lens
  l: "#e8743b", // lens ring
  D: "#2b2118", // dark detail
  G: "#6fae75", // indicator lights
  R: "#e05a6d", // warning light
  S: "#8fa3bf", // steel joints
  B: "#2e3a5c", // feet
};

const IDLE = [
  ".......A........",
  ".......a........",
  ".......a........",
  ".....KKKKKK.....",
  "....KKKKKKKK....",
  "...KKKllllKKK...",
  "...KKlLLLLlKK...",
  "...KKlLDDLlKK...",
  "...KKlLLLLlKK...",
  "...KKKllllKKK...",
  "....kKKKKKKk....",
  ".....SSSSSS.....",
  "...kKKKKKKKKk...",
  "..SkKKGKKGKKkS..",
  "..SkKKKKKKKKkS..",
  "..SkKDDDDDDKkS..",
  "..SkKKKKKKKKkS..",
  "...kKKKKKKKKk...",
  ".....SS..SS.....",
  ".....SS..SS.....",
  ".....SS..SS.....",
  "....kKK..KKk....",
  "...BBBB..BBBB...",
  "...BBBB..BBBB...",
] as const;

export const COG_FRAMES: Record<string, readonly string[]> = {
  idle: IDLE,
  walk1: withRows(IDLE, { 21: "....kKK...KKk...", 22: "...BBBB...BBBB..", 23: "...BBBB........." }),
  walk2: withRows(IDLE, { 21: "...kKK...KKk....", 22: "..BBBB...BBBB...", 23: ".........BBBB..." }),
  // Scanning: the lens narrows and the warning light comes on.
  worry: withRows(IDLE, { 0: ".......R........", 7: "...KKlDDDDlKK...", 13: "..SkKKRKKRKKkS.." }),
  // Puzzled: the head tilts and the antenna flickers.
  fuss: withRows(IDLE, {
    0: "........R.......",
    1: "........a.......",
    5: "...KKKKllllKK...",
    6: "...KKKlLLLLlK...",
    7: "...KKKlLDDLlK...",
    8: "...KKKlLLLLlK...",
    9: "...KKKKllllKK...",
  }),
  // Pleased: both lights green, arms raised.
  happy: withRows(IDLE, {
    0: ".......G........",
    12: "S..kKKKKKKKKk..S",
    13: "SSSkKKGKKGKKkSSS",
    14: "...kKKKKKKKKk...",
  }),
};
