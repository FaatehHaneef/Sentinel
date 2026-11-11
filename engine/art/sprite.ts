/**
 * Pixel sprites defined as text. Each frame is a grid of characters and each
 * character is a palette entry, so every sprite is original and can be
 * reviewed in a diff.
 */

export type SpriteSheet = {
  width: number;
  height: number;
  frames: Record<string, HTMLCanvasElement>;
};

export function buildSprite(
  frames: Record<string, readonly string[]>,
  palette: Record<string, string>,
): SpriteSheet {
  const first = Object.values(frames)[0];
  const width = first[0].length;
  const height = first.length;
  const built: Record<string, HTMLCanvasElement> = {};

  for (const [name, rows] of Object.entries(frames)) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (context) {
      rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const colour = palette[row[x]];
          if (!colour) continue;
          context.fillStyle = colour;
          context.fillRect(x, y, 1, 1);
        }
      });
    }
    built[name] = canvas;
  }
  return { width, height, frames: built };
}

/** Returns a copy of `base` with some rows replaced, for building frame variations. */
export function withRows(base: readonly string[], changes: Record<number, string>): string[] {
  return base.map((row, index) => changes[index] ?? row);
}
