/**
 * Where the trial panel should sit. The panel is a card in one corner of the
 * screen. Before each step it checks what it would cover in each corner and
 * takes the corner that hides the least of what matters on the page: the
 * element being checked, the character, and the page's own headings, prices,
 * fields, buttons and links.
 */

export type Corner = "top-right" | "top-left" | "bottom-right" | "bottom-left";

export const CORNERS: readonly Corner[] = ["top-right", "top-left", "bottom-right", "bottom-left"];

export const PANEL_MARGIN = 12;

type Box = { left: number; top: number; right: number; bottom: number };

export type Weighted = { box: Box; weight: number };

export function panelBox(
  corner: Corner,
  width: number,
  height: number,
  viewport: { width: number; height: number },
): Box {
  const left = corner.endsWith("left") ? PANEL_MARGIN : viewport.width - PANEL_MARGIN - width;
  const top = corner.startsWith("top") ? PANEL_MARGIN : viewport.height - PANEL_MARGIN - height;
  return { left, top, right: left + width, bottom: top + height };
}

function overlap(a: Box, b: Box): number {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return width > 0 && height > 0 ? width * height : 0;
}

/** How much of what matters a panel in this place would hide. */
export function cost(panel: Box, items: readonly Weighted[]): number {
  return items.reduce((sum, item) => sum + overlap(panel, item.box) * item.weight, 0);
}

/**
 * The best corner. The current corner is kept unless another hides clearly
 * less, so the panel does not jump about over small differences.
 */
export function chooseCorner(
  current: Corner,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  items: readonly Weighted[],
): Corner {
  const scores = CORNERS.map((corner) => ({
    corner,
    score: cost(panelBox(corner, size.width, size.height, viewport), items),
  }));
  const here = scores.find((entry) => entry.corner === current)!.score;
  const best = scores.reduce((low, entry) => (entry.score < low.score ? entry : low));
  // Move only for a real gain: a fifth less hidden, and more than a small sliver.
  return best.score < here * 0.8 && here - best.score > 400 ? best.corner : current;
}
