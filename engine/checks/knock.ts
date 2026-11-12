import { contrastRatio, fromHex, luminance, toHex, fixColour } from "@/lib/trial/contrast";
import { backgroundBehind } from "../core/colour";
import { cssPath, describe, isIgnored, isVisible, textOf } from "../core/dom";
import { isOnPath, keepWorst, type CheckContext, type CheckResult, type Located } from "./types";

/**
 * Knock's checks: what a shopper who uses only a keyboard runs into.
 *
 * A script cannot press the Tab key the way a person does, so focus is moved
 * with the browser's own focus call. Reachability and tab order are read from
 * the page exactly. Whether a focus outline shows is measured only when the
 * browser confirms it is treating focus as keyboard focus; otherwise that
 * check is skipped and counts as neither a pass nor a snag.
 */

const NATIVE = "a[href], button, input, select, textarea, summary, [contenteditable='true']";
const DISABLED = ":disabled, [aria-disabled='true']";

/** Outline minimum contrast against what is around the element (WCAG 1.4.11). */
const OUTLINE_CONTRAST = 3;
/** With more links than this before the main content, a skip link is expected. */
const SKIP_LINK_THRESHOLD = 4;
/** Styles that can show focus. If none of them changes, focus is invisible. */
const FOCUS_STYLES = [
  "outlineStyle",
  "outlineWidth",
  "outlineColor",
  "boxShadow",
  "borderTopColor",
  "borderBottomColor",
  "borderLeftColor",
  "backgroundColor",
  "color",
  "textDecorationLine",
] as const;

const INK = fromHex("#1b1f3b")!;
const AMBER = fromHex("#ffb347")!;

function usable(element: Element): boolean {
  return !isIgnored(element) && !element.matches(DISABLED) && isVisible(element);
}

/** Everything the Tab key stops at, in the order it stops there. */
function tabbables(): HTMLElement[] {
  const all = Array.from(document.querySelectorAll<HTMLElement>(`${NATIVE}, [tabindex]`)).filter(
    (element) =>
      usable(element) && element.tabIndex >= 0 && (element as HTMLInputElement).type !== "hidden",
  );
  // Positive tab indexes come first, in numeric order, then everything else in page order.
  const forced = all
    .filter((element) => element.tabIndex > 0)
    .sort((a, b) => a.tabIndex - b.tabIndex);
  return [...forced, ...all.filter((element) => element.tabIndex === 0)];
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

function reachableCheck(context: CheckContext): CheckResult {
  const findings: Located[] = [];
  // Things that look pressable (a pointer cursor of their own) but are not controls.
  for (const element of document.body.querySelectorAll<HTMLElement>("*")) {
    if (element.tagName === "LABEL" || element.closest(NATIVE) || !usable(element)) continue;
    if (getComputedStyle(element).cursor !== "pointer") continue;
    if (element.parentElement && getComputedStyle(element.parentElement).cursor === "pointer")
      continue;
    if (element.tabIndex >= 0) continue;
    findings.push(
      located(element, context, {
        check: "knock.reachable",
        severity: "blocker",
        measured: "The Tab key never reaches this, so it cannot be pressed without a mouse",
        stops: true,
        fix: {
          summary: "Make it a real button, so the keyboard can reach it and press it",
          attributes: { tabindex: "0", role: "button" },
          keyboard: true,
          source: "rule",
        },
      }),
    );
  }
  return {
    check: "knock.reachable",
    title: "Everything can be reached with the keyboard",
    weight: "blocker",
    findings: keepWorst(findings),
  };
}

/** True when the browser is currently showing focus rings for focus moved by script. */
function focusIsMeasurable(): boolean {
  const probe = document.createElement("button");
  probe.setAttribute("data-sentinel-ignore", "");
  probe.style.cssText = "position:fixed;left:-9999px;top:0;";
  document.body.append(probe);
  probe.focus({ preventScroll: true });
  const measurable = probe.matches(":focus-visible");
  probe.remove();
  return measurable;
}

function snapshot(element: Element): string {
  const style = getComputedStyle(element);
  return FOCUS_STYLES.map((name) => style[name]).join("|");
}

function focusVisibleCheck(context: CheckContext): CheckResult {
  const result: CheckResult = {
    check: "knock.focus-visible",
    title: "Keyboard focus is visible",
    weight: "major",
    findings: [],
  };
  const before = document.activeElement as HTMLElement | null;
  if (!focusIsMeasurable()) {
    before?.focus?.({ preventScroll: true });
    return { ...result, skipped: true };
  }

  const findings: Located[] = [];
  for (const element of tabbables().slice(0, 60)) {
    const resting = snapshot(element);
    element.focus({ preventScroll: true });
    const focused = document.activeElement === element ? snapshot(element) : null;
    element.blur();
    if (focused === null || focused !== resting) continue;

    // The fix outlines the element in a colour that stands out from what is around it.
    const around = element.parentElement ? backgroundBehind(element.parentElement) : null;
    const base = around && luminance(around) <= 0.18 ? AMBER : INK;
    const outline = around ? fixColour(base, around, OUTLINE_CONTRAST) : base;
    const ratio = around ? contrastRatio(outline, around) : 0;
    findings.push(
      located(element, context, {
        check: "knock.focus-visible",
        severity: "major",
        measured: "Nothing about it changes when the keyboard is on it",
        evidence: around
          ? { background: toHex(around), required: OUTLINE_CONTRAST, ratio }
          : undefined,
        fix: {
          summary: `Show a 3 pixel outline in ${toHex(outline)} when the keyboard is on it`,
          css: [
            {
              target: "focus",
              declarations: { outline: `3px solid ${toHex(outline)}`, "outline-offset": "2px" },
            },
          ],
          source: "rule",
        },
      }),
    );
  }
  before?.focus?.({ preventScroll: true });
  return { ...result, findings: keepWorst(findings) };
}

function tabOrderCheck(context: CheckContext): CheckResult {
  const findings: Located[] = [];
  for (const element of tabbables()) {
    if (element.tabIndex <= 0) continue;
    findings.push(
      located(element, context, {
        check: "knock.tab-order",
        severity: "minor",
        measured: `It forces its place in the tab order with tabindex ${element.tabIndex}, so focus jumps out of page order`,
      }),
    );
  }
  return {
    check: "knock.tab-order",
    title: "Focus moves through the page in order",
    weight: "minor",
    findings: keepWorst(findings),
  };
}

function skipLinkCheck(context: CheckContext): CheckResult {
  const findings: Located[] = [];
  const main = document.querySelector("main, [role='main']");
  const stops = tabbables();
  const beforeMain = main
    ? stops.filter(
        (element) =>
          !main.contains(element) &&
          Boolean(element.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING),
      )
    : [];
  // A skip link is usually hidden until focused, so it is looked for directly.
  const hasSkipLink = Array.from(document.querySelectorAll("a[href^='#']")).some((link) =>
    /skip|jump to/i.test(textOf(link)),
  );
  if (beforeMain.length > SKIP_LINK_THRESHOLD && !hasSkipLink) {
    findings.push(
      located(beforeMain[0], context, {
        check: "knock.skip-link",
        severity: "minor",
        measured: `${beforeMain.length} stops come before the main content, with no link to skip past them`,
      }),
    );
  }
  return {
    check: "knock.skip-link",
    title: "Long menus can be skipped",
    weight: "minor",
    findings,
  };
}

export function runKnockChecks(context: CheckContext): CheckResult[] {
  return [
    reachableCheck(context),
    focusVisibleCheck(context),
    tabOrderCheck(context),
    skipLinkCheck(context),
  ];
}
