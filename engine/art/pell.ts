import { withRows } from "./sprite";

/**
 * Pell: walks in from the far hills with a heavy pack. Wide-brimmed hat,
 * mist-blue coat, a pack bigger than their back. 16 by 24 pixels.
 */

export const PELL_PALETTE: Record<string, string> = {
  H: "#5c4a3a", // hat
  h: "#44362a", // hat band
  S: "#c98e62", // skin
  s: "#a8744c", // skin shade
  E: "#2b2118", // eyes
  M: "#7a3b2a", // mouth
  C: "#8fa3bf", // coat
  c: "#6b7f9c", // coat shade
  P: "#6b4a2f", // pack
  p: "#4d3421", // pack straps
  G: "#ffb347", // phone glow
  T: "#2e3a5c", // trousers
  B: "#2b2118", // boots
};

const IDLE = [
  "................",
  "................",
  "......HHHH......",
  ".....HHHHHH.....",
  "..HHHHHHHHHHHH..",
  "....hhhhhhhh....",
  "....SSSSSSSS....",
  "....SESSSSES....",
  "....sSSSSSSs....",
  ".....sSSSSs.PPP.",
  "...CCCCCCCCPPPPP",
  "..CCCCCCCCCPPPPP",
  "..CCpCCCCpCPPPPP",
  "..CCpCCCCpCPPPPP",
  "..CCCCCCCCCPPPPP",
  "..SCCCCCCCCPPPP.",
  "..S.CCCCCCC.....",
  "....TTTTTTTT....",
  "....TTTTTTTT....",
  "....TTT..TTT....",
  "....TTT..TTT....",
  "....TTT..TTT....",
  "...BBBB..BBBB...",
  "..BBBBB..BBBBB..",
] as const;

export const PELL_FRAMES: Record<string, readonly string[]> = {
  idle: IDLE,
  walk1: withRows(IDLE, { 22: "...BBBB...BBBB..", 23: "..BBBBB........." }),
  walk2: withRows(IDLE, { 22: "..BBBB...BBBB...", 23: ".........BBBBB.." }),
  // Holding up a phone that shows one bar.
  worry: withRows(IDLE, {
    8: "..G.sSSSSSSs....",
    9: "..GS.sSSSSs.PPP.",
    10: "..SCCCCCCCCPPPPP",
    15: "...CCCCCCCCPPPP.",
    16: "....CCCCCCC.....",
  }),
  // Sagging under the pack.
  fuss: withRows(IDLE, {
    2: "................",
    3: "......HHHH......",
    4: ".....HHHHHH.....",
    5: "..HHHHHHHHHHHH..",
    6: "....hhhhhhhh....",
    7: "....SSSSSSSS....",
    8: "....sEssssEs.PPP",
    9: ".....sSSSSs.PPPP",
  }),
  // Pleased: hat raised.
  happy: withRows(IDLE, {
    1: "..........HHHH..",
    2: ".........HHHHHH.",
    3: "......HHHHHHHH..",
    4: "....hhhhhhhhS...",
    5: "....SSSSSSSSS...",
    6: "....SSSSSSSSC...",
    7: "....SESSSSESC...",
    8: "....sSSMMSSsC...",
  }),
};
