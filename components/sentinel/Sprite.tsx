"use client";

import { useEffect, useRef } from "react";
import type { CharacterId } from "@/lib/cast";
import { COG_FRAMES, COG_PALETTE } from "@/engine/art/cog";
import { DASH_FRAMES, DASH_PALETTE } from "@/engine/art/dash";
import { ECHO_FRAMES, ECHO_PALETTE } from "@/engine/art/echo";
import { IRIS_FRAMES, IRIS_PALETTE } from "@/engine/art/iris";
import { KNOCK_FRAMES, KNOCK_PALETTE } from "@/engine/art/knock";
import { PELL_FRAMES, PELL_PALETTE } from "@/engine/art/pell";
import { TOBIN_FRAMES, TOBIN_PALETTE } from "@/engine/art/tobin";

/** The same pixel art the characters have in a trial. */
export const SPRITES: Record<
  CharacterId,
  { frames: Record<string, readonly string[]>; palette: Record<string, string> }
> = {
  iris: { frames: IRIS_FRAMES, palette: IRIS_PALETTE },
  tobin: { frames: TOBIN_FRAMES, palette: TOBIN_PALETTE },
  pell: { frames: PELL_FRAMES, palette: PELL_PALETTE },
  knock: { frames: KNOCK_FRAMES, palette: KNOCK_PALETTE },
  echo: { frames: ECHO_FRAMES, palette: ECHO_PALETTE },
  dash: { frames: DASH_FRAMES, palette: DASH_PALETTE },
  cog: { frames: COG_FRAMES, palette: COG_PALETTE },
};

export type SpriteMood = "idle" | "walk" | "happy" | "worry";

function drawFrame(
  context: CanvasRenderingContext2D,
  rows: readonly string[],
  palette: Record<string, string>,
  scale: number,
) {
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const colour = palette[row[x]];
      if (!colour) continue;
      context.fillStyle = colour;
      context.fillRect(x * scale, y * scale, scale, scale);
    }
  });
}

/**
 * One character, drawn crisp at a whole-number scale. Idle characters
 * fidget now and then: a glance of worry or a smile. Still with reduced motion.
 */
export function Sprite({
  id,
  scale = 4,
  mood = "idle",
  className = "",
}: {
  id: CharacterId;
  scale?: number;
  mood?: SpriteMood;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    const { frames, palette } = SPRITES[id];
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const draw = (name: string) => drawFrame(context, frames[name] ?? frames.idle, palette, scale);

    if (still || mood === "happy" || mood === "worry") {
      draw(mood === "walk" ? "idle" : mood);
      return;
    }
    // Each character fidgets on its own rhythm, so a crowd never moves in step.
    const offset = id.charCodeAt(0) * 97;
    let frame = 0;
    const timer = window.setInterval(
      () => {
        frame += 1;
        if (mood === "walk") {
          draw(["walk1", "idle", "walk2", "idle"][frame % 4]);
          return;
        }
        const beat = (frame + offset) % 40;
        draw(beat === 0 || beat === 1 ? "fuss" : beat === 20 ? "worry" : "idle");
      },
      mood === "walk" ? 125 : 150,
    );
    draw("idle");
    return () => window.clearInterval(timer);
  }, [id, mood, scale]);

  return (
    <canvas
      ref={canvas}
      width={16 * scale}
      height={24 * scale}
      aria-hidden="true"
      className={`pixelated ${className}`}
    />
  );
}
