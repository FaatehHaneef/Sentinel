import { withRows } from "./sprite";

/**
 * Dash: always in a hurry, phone in hand. Spiky hair, ember hoodie, fast
 * trainers. 16 by 24 pixels.
 */

export const DASH_PALETTE: Record<string, string> = {
  H: "#2b2118", // hair
  S: "#e2b08a", // skin
  s: "#c48e66", // skin shade
  E: "#12152a", // eyes
  M: "#7a3b2a", // mouth
  O: "#e8743b", // hoodie
  o: "#b9552a", // hoodie shade
  P: "#2e3a5c", // phone
  G: "#8fe0ff", // phone screen
  J: "#3a4a7a", // jeans
  W: "#f3e9d2", // trainers
  R: "#e05a6d", // trainer stripe
};

const IDLE = [
  "................",
  "....H.H.H.H.....",
  "....HHHHHHHH....",
  "...HHHHHHHHHH...",
  "...HSSSSSSSSH...",
  "...SSESSSSESS...",
  "...SSSSSSSSSS...",
  "...sSSSMMSSSs...",
  "....sSSSSSSs....",
  "...OOOOOOOOOO...",
  "..OOOOOOOOOOOO..",
  "..OOoOOOOOOoOO..",
  "..OOoOOOOOOoOSP.",
  "..OOoOOOOOOoOSG.",
  "..SOOOOOOOOOO.P.",
  "...oooooooooo...",
  "....JJJJJJJJ....",
  "....JJJJJJJJ....",
  "....JJJ..JJJ....",
  "....JJJ..JJJ....",
  "....JJJ..JJJ....",
  "...WWWW..WWWW...",
  "..WRWWW..WRWWW..",
  "..WWWWW..WWWWW..",
] as const;

export const DASH_FRAMES: Record<string, readonly string[]> = {
  idle: IDLE,
  walk1: withRows(IDLE, { 21: "...WWWW...WWWW..", 22: "..WRWWW...WRWWW.", 23: "..WWWWW........." }),
  walk2: withRows(IDLE, { 21: "..WWWW...WWWW...", 22: ".WRWWW...WRWWW..", 23: ".........WWWWW.." }),
  // Checking the time, frowning.
  worry: withRows(IDLE, {
    5: "...SSESSSSESS...",
    7: "...sSSMMMMSSs...",
    10: "..OOOOOOOOOOOOS.",
    11: "..OOoOOOOOOoOOP.",
  }),
  // Tapping hard at the phone.
  fuss: withRows(IDLE, { 11: "..OOoOOOOOOoOSP.", 12: "..OOoOOOOOOoOSG.", 13: "..OOoOOOOOOoO.P." }),
  // Pleased: phone raised.
  happy: withRows(IDLE, {
    7: "...sSSMSSMSSs...",
    8: "....sSMMMMSs.P..",
    9: "...OOOOOOOOOOGS.",
    10: "..OOOOOOOOOOOOS.",
    12: "..OOoOOOOOOoOO..",
    13: "..OOoOOOOOOoOO..",
  }),
};
