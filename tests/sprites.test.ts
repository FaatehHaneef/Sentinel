import { describe, expect, it } from "vitest";
import { ECHO_FRAMES, ECHO_PALETTE } from "@/engine/art/echo";
import { IRIS_FRAMES, IRIS_PALETTE } from "@/engine/art/iris";
import { KNOCK_FRAMES, KNOCK_PALETTE } from "@/engine/art/knock";
import { PELL_FRAMES, PELL_PALETTE } from "@/engine/art/pell";
import { TOBIN_FRAMES, TOBIN_PALETTE } from "@/engine/art/tobin";

const SHEETS = {
  iris: { frames: IRIS_FRAMES, palette: IRIS_PALETTE },
  tobin: { frames: TOBIN_FRAMES, palette: TOBIN_PALETTE },
  knock: { frames: KNOCK_FRAMES, palette: KNOCK_PALETTE },
  echo: { frames: ECHO_FRAMES, palette: ECHO_PALETTE },
  pell: { frames: PELL_FRAMES, palette: PELL_PALETTE },
};

/** Every character must supply these, because the stage animates them by name. */
const REQUIRED = ["idle", "walk1", "walk2", "worry", "fuss", "happy"];

describe.each(Object.entries(SHEETS))("%s sprite", (_name, sheet) => {
  it("has every frame the stage needs", () => {
    expect(Object.keys(sheet.frames)).toEqual(expect.arrayContaining(REQUIRED));
  });

  it("draws every frame on the same 16 by 24 grid", () => {
    for (const [frame, rows] of Object.entries(sheet.frames)) {
      expect(rows, frame).toHaveLength(24);
      for (const row of rows) expect(row, `${frame}: "${row}"`).toHaveLength(16);
    }
  });

  it("uses only colours from its palette", () => {
    for (const [frame, rows] of Object.entries(sheet.frames)) {
      for (const cell of rows.join("")) {
        if (cell !== ".") expect(sheet.palette[cell], `${frame}: "${cell}"`).toBeDefined();
      }
    }
  });
});
