import { composite, type Rgba } from "@/lib/trial/contrast";

const cache = new Map<string, Rgba>();
let context: CanvasRenderingContext2D | null = null;

const RGB_PATTERN =
  /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/;

/**
 * Turns any CSS colour the browser understands into red, green, blue and
 * alpha. The common `rgb()` form is read directly. Anything else (named
 * colours, `oklch()`, `color()`) is painted onto a one-pixel canvas and read
 * back, so the browser itself does the conversion.
 */
export function parseColour(css: string): Rgba {
  const cached = cache.get(css);
  if (cached) return cached;

  let result: Rgba;
  const match = RGB_PATTERN.exec(css.trim());
  if (match) {
    const alpha = match[4];
    result = {
      r: Number(match[1]),
      g: Number(match[2]),
      b: Number(match[3]),
      a: alpha === undefined ? 1 : alpha.endsWith("%") ? parseFloat(alpha) / 100 : Number(alpha),
    };
  } else if (css === "transparent" || css === "") {
    result = { r: 0, g: 0, b: 0, a: 0 };
  } else {
    context ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    if (!context) return { r: 0, g: 0, b: 0, a: 1 };
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = "#000";
    context.fillStyle = css;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
    result = { r, g, b, a: a / 255 };
  }
  cache.set(css, result);
  return result;
}

const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };

/**
 * The solid colour behind an element: its own background and its ancestors',
 * layered until one is opaque. Returns null when a background image is in the
 * way, because then the colour behind the text cannot be known from styles
 * alone and we refuse to guess.
 */
export function backgroundBehind(element: Element, includeSelf = true): Rgba | null {
  const layers: Rgba[] = [];
  let node: Element | null = includeSelf ? element : element.parentElement;
  while (node) {
    const style = getComputedStyle(node);
    if (style.backgroundImage !== "none") return null;
    const colour = parseColour(style.backgroundColor);
    if (colour.a > 0) {
      layers.push(colour);
      if (colour.a >= 1) break;
    }
    node = node.parentElement;
  }
  let result = WHITE;
  for (const layer of layers.reverse()) result = composite(layer, result);
  return result;
}

/** Combined opacity of an element and all its ancestors. */
export function effectiveOpacity(element: Element): number {
  let opacity = 1;
  for (let node: Element | null = element; node; node = node.parentElement) {
    opacity *= Number(getComputedStyle(node).opacity);
  }
  return opacity;
}
