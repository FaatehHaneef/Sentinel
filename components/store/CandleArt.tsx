import type { Product } from "@/lib/store/catalogue";

/**
 * Pixel-art candle, drawn from a grid so every product image is original.
 * F flame, C flame core, K wick, W wax, S wax shade, D dish.
 */
const GRID = [
  "................",
  ".......F........",
  "......FFF.......",
  "......FCF.......",
  ".....FFCFF......",
  "......FFF.......",
  ".......K........",
  ".....WWWWWS.....",
  "....WWWWWWSS....",
  "....WWWWWWSS....",
  "....WWWWWWSS....",
  "....WWWWWWSS....",
  "....WWWWWWSS....",
  "....WWWWWWSS....",
  "...DDDDDDDDDD...",
  "....DDDDDDDD....",
];

export function CandleArt({ product, size = 160 }: { product: Product; size?: number }) {
  const colours: Record<string, string> = {
    F: "#ffb347",
    C: product.art.flame,
    K: "#2b2118",
    W: product.art.wax,
    S: product.art.shade,
    D: "#5c4a3a",
  };

  const cells = GRID.flatMap((row, y) =>
    [...row].map((cell, x) =>
      cell === "." ? null : (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={colours[cell]} />
      ),
    ),
  );

  // Deliberate snag for the trials: this picture has no text description.
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges">
      {cells}
    </svg>
  );
}
