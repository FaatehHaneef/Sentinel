import { withRows } from "./sprite";

/**
 * Knock: a small knight who gets everywhere by keyboard. Steel helm with an
 * ember plume, a tabard with a golden key square. 16 by 24 pixels.
 */

export const KNOCK_PALETTE: Record<string, string> = {
  P: "#e8743b", // plume
  H: "#8fa3bf", // helm
  h: "#6b7f9c", // helm shade
  V: "#1b1f3b", // visor
  S: "#f2c9a0", // skin (eyes through the visor, hands)
  A: "#c9d3e2", // armour
  a: "#8fa3bf", // armour shade
  T: "#f3e9d2", // tabard
  K: "#ffb347", // emblem
  L: "#2e3a5c", // legs
  B: "#12152a", // boots
};

const IDLE = [
  "........PP......",
  ".......PPP......",
  ".....HHHHHH.....",
  "....HHHHHHHH....",
  "...HHHHHHHHHH...",
  "...HhhhhhhhhH...",
  "...HVVSVVSVVH...",
  "...HVVVVVVVVH...",
  "...HhHHHHHHhH...",
  "....HHHHHHHH....",
  ".....hhhhhh.....",
  "...AATTTTTTAA...",
  "..AAATTTTTTAAA..",
  "..AAATTKKTTAAA..",
  "..AAATTKKTTAAA..",
  "..aAATTTTTTAAa..",
  "..SS.TTTTTT.SS..",
  "....TTTTTTTT....",
  "....LLLLLLLL....",
  "....LLL..LLL....",
  "....LLL..LLL....",
  "....LLL..LLL....",
  "...BBBB..BBBB...",
  "..BBBBB..BBBBB..",
] as const;

export const KNOCK_FRAMES: Record<string, readonly string[]> = {
  idle: IDLE,
  walk1: withRows(IDLE, { 22: "...BBBB...BBBB..", 23: "..BBBBB........." }),
  walk2: withRows(IDLE, { 22: "..BBBB...BBBB...", 23: ".........BBBBB.." }),
  // Knocking: one fist raised, then a little lower. The two frames alternate.
  worry: withRows(IDLE, {
    13: "..AAATTKKTTAAASS",
    15: "..aAATTTTTTAA...",
    16: "..SS.TTTTTT.....",
  }),
  fuss: withRows(IDLE, {
    14: "..AAATTKKTTAAASS",
    15: "..aAATTTTTTAA...",
    16: "..SS.TTTTTT.....",
  }),
  // Pleased: both arms up.
  happy: withRows(IDLE, {
    10: "S....hhhhhh....S",
    11: "A..AATTTTTTAA..A",
    12: "AAAAATTTTTTAAAAA",
    16: ".....TTTTTT.....",
  }),
};
