import { withRows } from "./sprite";

/**
 * Echo: listens to the page instead of looking at it. Dark hair, rose
 * headphones, a soft blue jumper. 16 by 24 pixels.
 */

export const ECHO_PALETTE: Record<string, string> = {
  P: "#e05a6d", // headphone band
  p: "#a83a4c", // ear cups
  H: "#3a2a20", // hair
  S: "#d9a67c", // skin
  s: "#b98558", // skin shade
  E: "#2b2118", // eyes
  M: "#7a3b2a", // mouth
  J: "#8fa3bf", // jumper
  j: "#6b7f9c", // jumper shade
  T: "#2e3a5c", // trousers
  B: "#12152a", // boots
};

const IDLE = [
  "................",
  ".....PPPPPP.....",
  "....PHHHHHHP....",
  "...PHHHHHHHHP...",
  "..ppHHHHHHHHpp..",
  "..ppSSSSSSSSpp..",
  "..ppSESSSSESpp..",
  "...SSSSSSSSSS...",
  "...sSSSMMSSSs...",
  "....sSSSSSSs....",
  "......SSSS......",
  "...JJJJJJJJJJ...",
  "..JJJJJJJJJJJJ..",
  "..JJjJJJJJJjJJ..",
  "..JJjJJJJJJjJJ..",
  "..JJjJJJJJJjJJ..",
  "..SSjJJJJJJjSS..",
  "...TTTTTTTTTT...",
  "...TTTTTTTTTT...",
  "...TTTT..TTTT...",
  "...TTTT..TTTT...",
  "...TTTT..TTTT...",
  "...BBBB..BBBB...",
  "..BBBBB..BBBBB..",
] as const;

/** One hand raised to an ear cup, listening hard. */
const LISTENING = withRows(IDLE, {
  5: "..ppSSSSSSSSppS.",
  6: "..ppSESSSSESppJ.",
  7: "...SSSSSSSSSS.J.",
  8: "...sSSSMMSSSs.J.",
  11: "...JJJJJJJJJJJJ.",
  16: "..SSjJJJJJJjJJ..",
});

export const ECHO_FRAMES: Record<string, readonly string[]> = {
  idle: IDLE,
  walk1: withRows(IDLE, { 22: "...BBBB...BBBB..", 23: "..BBBBB........." }),
  walk2: withRows(IDLE, { 22: "..BBBB...BBBB...", 23: ".........BBBBB.." }),
  worry: LISTENING,
  // Puzzled: still listening, mouth open.
  fuss: withRows(LISTENING, { 8: "...sSSMMMMSSs.J." }),
  // Pleased: a smile.
  happy: withRows(IDLE, { 7: "...SSMSSSSMSS...", 8: "...sSSMMMMSSs..." }),
};
