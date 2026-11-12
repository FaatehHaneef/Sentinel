import {
  composite,
  contrastRatio,
  contrastSeverity,
  fixColour,
  formatRatio,
  requiredContrast,
  toHex,
  type Rgba,
} from "@/lib/trial/contrast";
import type { Evidence, Fix } from "@/lib/trial/types";
import { backgroundBehind, effectiveOpacity, parseColour } from "../core/colour";
import { cssPath, describe, isIgnored, isVisible, textOf, visibleLabel } from "../core/dom";
import { isOnPath, keepWorst, type CheckContext, type CheckResult, type Located } from "./types";

/**
 * Grandma Iris's checks: what a shopper with low vision runs into. Every
 * number comes from the browser's own computed styles, and every finding
 * carries a fix computed from the same numbers.
 */

const DISABLED =
  "button:disabled, input:disabled, select:disabled, textarea:disabled, [aria-disabled='true']";

/** Smallest text size, in CSS pixels, that Iris can reasonably be asked to read. */
const MIN_TEXT_PX = 12;

/** Size the text-size fix raises small text to. */
const FIXED_TEXT_PX = 14;

/** Minimum contrast for the edge of a control against its surroundings (WCAG 1.4.11). */
const CONTROL_CONTRAST = 3;

/** A filled link taller or wordier than this is treated as a card, not a button. */
const BUTTON_MAX_HEIGHT = 72;
const BUTTON_MAX_LABEL = 40;

/** Elements that directly contain visible text, in document order. */
function textElements(): Element[] {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const found = new Set<Element>();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.nodeValue?.trim()) continue;
    const element = node.parentElement;
    if (!element || found.has(element)) continue;
    if (isIgnored(element) || element.closest(DISABLED) || !isVisible(element)) continue;
    found.add(element);
  }
  return [...found];
}

function fields(): (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)[] {
  const skip = new Set(["hidden", "submit", "button", "reset", "image", "checkbox", "radio"]);
  return Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input, textarea, select",
    ),
  ).filter(
    (field) =>
      !skip.has((field.getAttribute("type") ?? "").toLowerCase()) &&
      !field.disabled &&
      !isIgnored(field) &&
      isVisible(field),
  );
}

function located(
  element: Element,
  context: CheckContext,
  finding: Omit<Located, "element" | "selector" | "label" | "onPath">,
): Located {
  return {
    ...finding,
    element,
    selector: cssPath(element),
    label: describe(element),
    onPath: isOnPath(element, context),
  };
}

function contrastEvidence(seen: Rgba, background: Rgba, ratio: number, required: number): Evidence {
  return {
    foreground: toHex(seen),
    background: toHex(background),
    ratio: Math.floor(ratio * 100) / 100,
    required,
  };
}

function colourFix(
  target: "element" | "placeholder",
  seen: Rgba,
  background: Rgba,
  required: number,
): Fix {
  const colour = fixColour(seen, background, required);
  const hex = toHex(colour);
  const what = target === "placeholder" ? "placeholder text" : "text";
  const darker = colour.r + colour.g + colour.b < seen.r + seen.g + seen.b;
  const direction = darker ? "Darken" : "Lighten";
  return {
    summary: `${direction} the ${what} to ${hex}, which gives ${formatRatio(contrastRatio(colour, background))}`,
    css: [{ target, declarations: { color: hex } }],
    source: "rule",
  };
}

function contrastCheck(context: CheckContext): CheckResult {
  const findings: Located[] = [];

  for (const element of textElements()) {
    const style = getComputedStyle(element);
    const background = backgroundBehind(element);
    if (!background) continue; // A background image is in the way: not measurable from styles.
    const colour = parseColour(style.color);
    const seen = composite({ ...colour, a: colour.a * effectiveOpacity(element) }, background);
    const ratio = contrastRatio(seen, background);
    const required = requiredContrast(parseFloat(style.fontSize), Number(style.fontWeight) || 400);
    const severity = contrastSeverity(ratio, required);
    if (!severity) continue;
    findings.push(
      located(element, context, {
        check: "iris.contrast",
        severity,
        measured: `Contrast ${formatRatio(ratio)}, needs ${required}:1`,
        evidence: contrastEvidence(seen, background, ratio, required),
        fix: colourFix("element", seen, background, required),
      }),
    );
  }

  // Placeholder text is styled separately from typed text, so it is measured separately.
  for (const field of fields()) {
    if (field instanceof HTMLSelectElement || !field.placeholder || field.value) continue;
    const background = backgroundBehind(field);
    if (!background) continue;
    const seen = composite(parseColour(getComputedStyle(field, "::placeholder").color), background);
    const ratio = contrastRatio(seen, background);
    const severity = contrastSeverity(ratio, 4.5);
    if (!severity) continue;
    findings.push(
      located(field, context, {
        check: "iris.contrast",
        severity,
        measured: `Placeholder contrast ${formatRatio(ratio)}, needs 4.5:1`,
        evidence: contrastEvidence(seen, background, ratio, 4.5),
        fix: colourFix("placeholder", seen, background, 4.5),
      }),
    );
  }

  return {
    check: "iris.contrast",
    title: "Text stands out from its background",
    weight: "blocker",
    findings: keepWorst(findings),
  };
}

function textSizeCheck(context: CheckContext): CheckResult {
  const findings: Located[] = [];
  for (const element of textElements()) {
    const size = parseFloat(getComputedStyle(element).fontSize);
    if (size >= MIN_TEXT_PX) continue;
    findings.push(
      located(element, context, {
        check: "iris.text-size",
        severity: "major",
        measured: `Text is ${Math.round(size * 10) / 10}px, needs at least ${MIN_TEXT_PX}px`,
        evidence: { fontSizePx: size },
        fix: {
          summary: `Raise the text size to ${FIXED_TEXT_PX}px`,
          css: [{ target: "element", declarations: { "font-size": `${FIXED_TEXT_PX}px` } }],
          source: "rule",
        },
      }),
    );
  }
  return {
    check: "iris.text-size",
    title: "Text is large enough to read",
    weight: "major",
    findings: keepWorst(findings),
  };
}

/** A readable label for a field that has none, taken from its own hints. */
function suggestedLabel(field: Element): string {
  const hint =
    field.getAttribute("placeholder") ||
    field.getAttribute("aria-label") ||
    field.getAttribute("name") ||
    "Label";
  const words = hint.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function labelCheck(context: CheckContext): CheckResult {
  const findings: Located[] = [];
  for (const field of fields()) {
    if (visibleLabel(field)) continue;
    const label = suggestedLabel(field);
    findings.push(
      located(field, context, {
        check: "iris.labels",
        severity: "major",
        measured: field.getAttribute("placeholder")
          ? "No visible label. The only hint is a placeholder, which disappears once typing starts"
          : "No visible label",
        fix: {
          summary: `Add a visible label, "${label}", above the field`,
          label,
          source: "rule",
        },
      }),
    );
  }
  return {
    check: "iris.labels",
    title: "Every field has a label that stays",
    weight: "major",
    findings: keepWorst(findings),
  };
}

function buttonCheck(context: CheckContext): CheckResult {
  const findings: Located[] = [];
  const candidates = document.querySelectorAll(
    "button, [role='button'], input[type='submit'], input[type='button'], a",
  );
  for (const element of candidates) {
    if (isIgnored(element) || element.matches(DISABLED) || !isVisible(element)) continue;
    const style = getComputedStyle(element);
    const own = parseColour(style.backgroundColor);
    // Only things drawn as a filled button are judged as buttons.
    if (own.a < 0.5 || style.backgroundImage !== "none") continue;
    // A link with a background is a button only if it is button-sized: a short
    // label on one or two lines. Larger filled links are cards or panels.
    if (element.tagName === "A") {
      const rect = element.getBoundingClientRect();
      if (rect.height > BUTTON_MAX_HEIGHT || textOf(element).length > BUTTON_MAX_LABEL) continue;
    }
    const around = element.parentElement ? backgroundBehind(element.parentElement) : null;
    if (!around) continue;

    const fill = composite(own, around);
    const fillRatio = contrastRatio(fill, around);
    if (fillRatio >= CONTROL_CONTRAST) continue;
    const borderWidth = parseFloat(style.borderTopWidth);
    const border = composite(parseColour(style.borderTopColor), around);
    if (borderWidth >= 1 && contrastRatio(border, around) >= CONTROL_CONTRAST) continue;

    // The fix outlines the button in a deeper shade of its own colour.
    const edge = toHex(fixColour(fill, around, CONTROL_CONTRAST));
    findings.push(
      located(element, context, {
        check: "iris.button",
        severity: "major",
        measured: `Button stands out from the page by only ${formatRatio(fillRatio)}, needs ${CONTROL_CONTRAST}:1`,
        evidence: {
          foreground: toHex(fill),
          background: toHex(around),
          ratio: Math.floor(fillRatio * 100) / 100,
          required: CONTROL_CONTRAST,
        },
        fix: {
          summary: `Give the button a 2px border in ${edge} so its edge is visible`,
          css: [{ target: "element", declarations: { border: `2px solid ${edge}` } }],
          source: "rule",
        },
      }),
    );
  }
  return {
    check: "iris.button",
    title: "Buttons stand out from the page",
    weight: "major",
    findings: keepWorst(findings),
  };
}

export function runIrisChecks(context: CheckContext): CheckResult[] {
  return [
    contrastCheck(context),
    textSizeCheck(context),
    labelCheck(context),
    buttonCheck(context),
  ];
}
