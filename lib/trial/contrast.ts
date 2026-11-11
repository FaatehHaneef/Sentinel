import type { Severity } from "./types";

/**
 * Contrast maths from WCAG 2. Pure functions, so the numbers a character
 * reports can be checked by hand and by tests.
 */

export type Rgba = { r: number; g: number; b: number; a: number };

/** Paints a translucent colour over an opaque one. */
export function composite(top: Rgba, under: Rgba): Rgba {
  const a = top.a;
  return {
    r: top.r * a + under.r * (1 - a),
    g: top.g * a + under.g * (1 - a),
    b: top.b * a + under.b * (1 - a),
    a: 1,
  };
}

function channel(value: number): number {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function luminance(colour: Rgba): number {
  return 0.2126 * channel(colour.r) + 0.7152 * channel(colour.g) + 0.0722 * channel(colour.b);
}

/** Contrast ratio between two opaque colours, from 1 (identical) to 21 (black on white). */
export function contrastRatio(a: Rgba, b: Rgba): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** WCAG "large text": 24px and up, or 18.66px and up when bold. */
export function isLargeText(fontSizePx: number, fontWeight: number): boolean {
  return fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeight >= 700);
}

/** Minimum contrast for text of this size: 3:1 for large text, 4.5:1 otherwise. */
export function requiredContrast(fontSizePx: number, fontWeight: number): number {
  return isLargeText(fontSizePx, fontWeight) ? 3 : 4.5;
}

/**
 * How bad a contrast shortfall is, or null when the text passes. Below about
 * 45% of the requirement the text is close to invisible for a low-vision
 * reader; below two thirds it is a serious strain.
 */
export function contrastSeverity(ratio: number, required: number): Severity | null {
  if (ratio >= required) return null;
  const share = ratio / required;
  if (share < 0.45) return "blocker";
  if (share < 0.67) return "major";
  return "minor";
}

export function formatRatio(ratio: number): string {
  return `${(Math.floor(ratio * 10) / 10).toFixed(1)}:1`;
}
