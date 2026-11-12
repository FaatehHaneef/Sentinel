import { describe, expect, it } from "vitest";
import { IRIS_FRAMES, IRIS_PALETTE } from "@/engine/art/iris";
import { TOBIN_FRAMES, TOBIN_PALETTE } from "@/engine/art/tobin";

const SHEETS = {
  iris: { frames: IRIS_FRAMES, palette: IRIS_PALETTE },
  tobin: { frames: TOBIN_FRAMES, palette: TOBIN_PALETTE },
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
