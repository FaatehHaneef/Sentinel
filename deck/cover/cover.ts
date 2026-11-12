// Draws the Devpost cover: the seven shoppers crowding into a selfie, framed
// as a phone camera, with the real sprite art from engine/art.
import { COG_FRAMES, COG_PALETTE } from "../../engine/art/cog";
import { DASH_FRAMES, DASH_PALETTE } from "../../engine/art/dash";
import { ECHO_FRAMES, ECHO_PALETTE } from "../../engine/art/echo";
import { IRIS_FRAMES, IRIS_PALETTE } from "../../engine/art/iris";
import { KNOCK_FRAMES, KNOCK_PALETTE } from "../../engine/art/knock";
import { PELL_FRAMES, PELL_PALETTE } from "../../engine/art/pell";
import { TOBIN_FRAMES, TOBIN_PALETTE } from "../../engine/art/tobin";

type Art = { frames: Record<string, readonly string[]>; palette: Record<string, string> };
const ART: Record<string, Art> = {
  iris: { frames: IRIS_FRAMES, palette: IRIS_PALETTE },
  tobin: { frames: TOBIN_FRAMES, palette: TOBIN_PALETTE },
  pell: { frames: PELL_FRAMES, palette: PELL_PALETTE },
  knock: { frames: KNOCK_FRAMES, palette: KNOCK_PALETTE },
  echo: { frames: ECHO_FRAMES, palette: ECHO_PALETTE },
  dash: { frames: DASH_FRAMES, palette: DASH_PALETTE },
  cog: { frames: COG_FRAMES, palette: COG_PALETTE },
};

/** Paints one sprite onto a canvas element, flipped if asked, at a whole-number scale. */
function paint(canvas: HTMLCanvasElement, id: string, scale: number, flip: boolean) {
  const { frames, palette } = ART[id];
  const rows = frames.happy ?? frames.idle;
  canvas.width = rows[0].length * scale;
  canvas.height = rows.length * scale;
  const context = canvas.getContext("2d")!;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const colour = palette[row[x]];
      if (!colour) continue;
      context.fillStyle = colour;
      const drawX = flip ? row.length - 1 - x : x;
      context.fillRect(drawX * scale, y * scale, scale, scale);
    }
  });
}

for (const canvas of document.querySelectorAll<HTMLCanvasElement>("canvas[data-who]")) {
  paint(canvas, canvas.dataset.who!, Number(canvas.dataset.scale), canvas.dataset.flip === "1");
}
document.body.dataset.ready = "1";
