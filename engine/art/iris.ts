import { withRows } from "./sprite";

/**
 * Grandma Iris: grey bun, round glasses, amber shawl, plum dress.
 * 16 by 24 pixels.
 */

export const IRIS_PALETTE: Record<string, string> = {
  H: "#d5d5e0", // hair
  h: "#a3a3b8", // hair shade
  S: "#f2c9a0", // skin
  s: "#d9a67c", // skin shade
  G: "#2b2118", // glasses
  W: "#ffffff", // lens glint
  M: "#a0522d", // mouth
  A: "#ffb347", // shawl
  a: "#d98f2b", // shawl shade
  D: "#6b5b95", // dress
  d: "#4b3f6e", // dress shade
  B: "#3a2a20", // boots
};

const IDLE = [
  "................",
  "......HHHH......",
  ".....HHHHHH.....",
  "......HHHH......",
  "....HHHHHHHH....",
  "...HHHHHHHHHH...",
  "..HhSSSSSSSShH..",
  "..HSGGGSSGGGSH..",
  "..HSGWGGGGWGSH..",
  "..HSGGGSSGGGSH..",
  "...SSSSSSSSSS...",
  "...sSSSMMSSSs...",
  "....sSSSSSSs....",
  "...AAAAAAAAAA...",
  "..AAAAAAAAAAAA..",
  "..AAaAAAAAAaAA..",
  "..SAaAAAAAAaAS..",
  "...DDDDDDDDDD...",
  "...DDDDDDDDDD...",
  "...DdDDDDDDdD...",
  "..DDDDDDDDDDDD..",
  "..DdDDDDDDDDdD..",
  "....BB....BB....",
  "...BBB....BBB...",
] as const;

export const IRIS_FRAMES: Record<string, readonly string[]> = {
  idle: IDLE,
  walk1: withRows(IDLE, { 22: "....BB...BBB....", 23: "...BBB.........." }),
  walk2: withRows(IDLE, { 22: "...BBB....BB....", 23: "..........BBB..." }),
  // Squinting: eyes narrowed to nothing behind the lenses, mouth tight.
  squint: withRows(IDLE, { 8: "..HSGsGGGGsGSH..", 11: "...sSSMMMMSSs..." }),
  // Pushing her glasses up: glasses one row higher, one hand raised to them.
  push: withRows(IDLE, {
    6: "..HhGGGSSGGGhH..",
    7: "..HSGWGGGGWGSHS.",
    8: "..HSGGGSSGGGSHS.",
    9: "..HSSSSSSSSSSHA.",
    10: "...SSSSSSSSSS.A.",
    11: "...sSSSMMSSSs.A.",
    12: "....sSSSSSSs..A.",
    13: "...AAAAAAAAAAAA.",
    16: "..SAaAAAAAAaAA..",
  }),
  // Pleased: a smile.
  happy: withRows(IDLE, { 10: "...SSMSSSSMSS...", 11: "...sSSMMMMSSs..." }),
};
