import { withRows } from "./sprite";

/**
 * Tobin: a retired clockmaker. Flat cap, white moustache, green waistcoat.
 * 16 by 24 pixels.
 */

export const TOBIN_PALETTE: Record<string, string> = {
  C: "#6b4a2f", // cap
  c: "#4d3421", // cap brim
  S: "#f2c9a0", // skin
  s: "#d9a67c", // skin shade
  E: "#2b2118", // eyes
  W: "#f4f4f4", // moustache
  V: "#6fae75", // waistcoat
  v: "#4d8a57", // waistcoat buttons and shade
  R: "#f3e9d2", // shirt
  T: "#5c4a3a", // trousers
  t: "#44362a", // trouser shade
  B: "#2b2118", // boots
};

const IDLE = [
  "................",
  "................",
  ".....CCCCCC.....",
  "....CCCCCCCC....",
  "...CCCCCCCCCC...",
  "..cccccccccccC..",
  "...SSSSSSSSSS...",
  "...SESSSSSSES...",
  "...SSSSSSSSSS...",
  "...sWWWWWWWWs...",
  "...sSWSSSSWSs...",
  "....sSSSSSSs....",
  "...RVVVVVVVVR...",
  "..RRVVVVVVVVRR..",
  "..RRVvVVVVvVRR..",
  "..RRVVVVVVVVRR..",
  "..SRVvVVVVvVRS..",
  "...TTTTTTTTTT...",
  "...TTTTTTTTTT...",
  "...TTTT..TTTT...",
  "...TTTT..TTTT...",
  "...TtTT..TTtT...",
  "...BBBB..BBBB...",
  "..BBBBB..BBBBB..",
] as const;

export const TOBIN_FRAMES: Record<string, readonly string[]> = {
  idle: IDLE,
  walk1: withRows(IDLE, { 22: "...BBBB...BBBB..", 23: "..BBBBB........." }),
  walk2: withRows(IDLE, { 22: "..BBBB...BBBB...", 23: ".........BBBBB.." }),
  // Hands held out, trembling: these two frames alternate quickly.
  worry: withRows(IDLE, { 15: ".SRRVVVVVVVVRRS.", 16: "...RVvVVVVvVR..." }),
  fuss: withRows(IDLE, { 14: "S.RRVvVVVVvVRR.S", 16: "...RVvVVVVvVR..." }),
  // Pleased: both hands up.
  happy: withRows(IDLE, {
    11: "S...sSSSSSSs...S",
    12: "R..RVVVVVVVVR..R",
    13: "RRRRVVVVVVVVRRRR",
    16: "...RVvVVVVvVR...",
  }),
};
