import type { Fix, Severity } from "@/lib/trial/types";
import { cssPath, describe, isIgnored, isVisible, textOf } from "../core/dom";
import { isOnPath, keepWorst, type CheckContext, type CheckResult, type Located } from "./types";

/**
 * Tobin's checks: what a shopper with a hand tremor runs into. Sizes and
 * distances are measured from the page. The shaky taps are simulated, from
 * the run's seed, and are described as simulated wherever they appear.
 */

/** Smallest target, in CSS pixels, that passes (WCAG 2.5.8). */
const MIN_TARGET = 24;
/** A target this small is close to unusable for an unsteady hand. */
const TINY_TARGET = 16;
/** Size the fixes raise small targets to (WCAG 2.5.5). */
const COMFORTABLE_TARGET = 44;
/** Least space, in CSS pixels, between two small targets. */
const MIN_GAP = 8;
/** A control that undoes work must be at least this far from its neighbours. */
const RISKY_GAP = 16;

/** Spread of a trembling tap around its aim point: standard deviation in CSS pixels. An assumption of the model. */
const TREMOR_SPREAD = 10;
const TAPS = 20;
const MISS_RATE_LIMIT = 0.25;
const MISS_RATE_SEVERE = 0.5;

const NATIVE =
  "a[href], button, input, select, textarea, summary, [role='button'], [role='link'], [tabindex]";
const DISABLED = ":disabled, [aria-disabled='true']";
const UNDOES = /^(remove|delete|cancel|clear|discard|×|x)$/i;

type Target = { element: Element; rect: DOMRect };

/** Everything on the page a shopper can press, in document order. */
function targets(): Target[] {
  const found: Element[] = [];
  const add = (element: Element) => {
    if (isIgnored(element) || element.matches(DISABLED) || !isVisible(element)) return;
    if ((element as HTMLInputElement).type === "hidden") return;
    if (found.some((other) => other.contains(element))) return;
    found.push(element);
  };

  document.querySelectorAll(NATIVE).forEach(add);
  // Things that only look pressable: a pointer cursor, set on this element and not inherited.
  for (const element of document.body.querySelectorAll("*")) {
    if (element.tagName === "LABEL" || element.closest(NATIVE)) continue;
    if (getComputedStyle(element).cursor !== "pointer") continue;
    if (element.parentElement && getComputedStyle(element.parentElement).cursor === "pointer")
      continue;
    add(element);
  }

  return found
    .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    .map((element) => ({ element, rect: element.getBoundingClientRect() }));
}

/** Distance between the edges of two boxes. Zero if they touch or overlap. */
function gap(a: DOMRect, b: DOMRect): number {
  const dx = Math.max(0, a.left - b.right, b.left - a.right);
  const dy = Math.max(0, a.top - b.bottom, b.top - a.bottom);
  return Math.hypot(dx, dy);
}

/** The box grown, around its centre, to at least `size` in each direction. */
function grown(rect: DOMRect, size: number): DOMRect {
  const width = Math.max(rect.width, size);
  const height = Math.max(rect.height, size);
  return new DOMRect(
    rect.left + rect.width / 2 - width / 2,
    rect.top + rect.height / 2 - height / 2,
    width,
    height,
  );
}

function isSmall(rect: DOMRect, size: number): boolean {
  return rect.width < size || rect.height < size;
}

function nearest(target: Target, all: Target[]): { other: Target; distance: number } | null {
  let best: { other: Target; distance: number } | null = null;
  for (const other of all) {
    if (other === target) continue;
    const distance = gap(target.rect, other.rect);
    if (!best || distance < best.distance) best = { other, distance };
  }
  return best;
}

function located(
  target: Target,
  context: CheckContext,
  finding: Omit<Located, "element" | "selector" | "label" | "onPath">,
): Located {
  return {
    ...finding,
    element: target.element,
    selector: cssPath(target.element),
    label: describe(target.element),
    onPath: isOnPath(target.element, context),
  };
}

const px = (value: number) => Math.round(value * 10) / 10;

const ENLARGE: Fix = {
  summary: `Make it at least ${COMFORTABLE_TARGET} by ${COMFORTABLE_TARGET} pixels`,
  css: [
    {
      target: "element",
      declarations: {
        "min-width": `${COMFORTABLE_TARGET}px`,
        "min-height": `${COMFORTABLE_TARGET}px`,
      },
    },
  ],
  source: "rule",
};

function sizeCheck(all: Target[], context: CheckContext): CheckResult {
  const findings: Located[] = [];
  for (const target of all) {
    if (!isSmall(target.rect, MIN_TARGET)) continue;
    // A small target still passes if nothing else is close enough to be hit by mistake.
    const zone = grown(target.rect, MIN_TARGET);
    const crowded = all.some(
      (other) => other !== target && gap(zone, grown(other.rect, MIN_TARGET)) === 0,
    );
    if (!crowded) continue;
    const tiny = Math.min(target.rect.width, target.rect.height) <= TINY_TARGET;
    findings.push(
      located(target, context, {
        check: "tobin.target-size",
        severity: tiny ? "blocker" : "major",
        measured: `Target is ${px(target.rect.width)} by ${px(target.rect.height)} pixels, needs at least ${MIN_TARGET} by ${MIN_TARGET}`,
        fix: ENLARGE,
      }),
    );
  }
  return {
    check: "tobin.target-size",
    title: "Buttons and links are big enough to press",
    weight: "blocker",
    findings: keepWorst(findings),
  };
}

function spacingCheck(all: Target[], context: CheckContext): CheckResult {
  const findings: Located[] = [];
  for (const target of all) {
    if (!isSmall(target.rect, COMFORTABLE_TARGET)) continue;
    const closest = nearest(target, all);
    if (!closest || closest.distance >= MIN_GAP) continue;
    if (!isSmall(closest.other.rect, COMFORTABLE_TARGET)) continue;
    findings.push(
      located(target, context, {
        check: "tobin.spacing",
        severity: "major",
        measured: `Only ${px(closest.distance)} pixels from the ${describe(closest.other.element)}, needs at least ${MIN_GAP}`,
        fix: {
          summary: `Leave ${MIN_GAP} pixels of space after it`,
          css: [{ target: "element", declarations: { "margin-right": `${MIN_GAP}px` } }],
          source: "rule",
        },
      }),
    );
  }
  return {
    check: "tobin.spacing",
    title: "Small controls have room between them",
    weight: "major",
    findings: keepWorst(findings),
  };
}

function riskyNeighbourCheck(all: Target[], context: CheckContext): CheckResult {
  const findings: Located[] = [];
  for (const target of all) {
    const name = textOf(target.element) || target.element.getAttribute("aria-label") || "";
    if (!UNDOES.test(name.trim())) continue;
    const closest = nearest(target, all);
    if (!closest || closest.distance >= RISKY_GAP) continue;
    findings.push(
      located(target, context, {
        check: "tobin.risky-neighbour",
        severity: "major",
        measured: `This undoes the shopper's work and sits ${px(closest.distance)} pixels from the ${describe(closest.other.element)}, needs at least ${RISKY_GAP}`,
        fix: {
          summary: "Move it 24 pixels away from its neighbour",
          css: [{ target: "element", declarations: { "margin-left": "24px" } }],
          source: "rule",
        },
      }),
    );
  }
  return {
    check: "tobin.risky-neighbour",
    title: "Nothing destructive sits beside a needed control",
    weight: "major",
    findings: keepWorst(findings),
  };
}

/** A small repeatable random number generator (mulberry32). */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index++) {
    value = Math.imul(value ^ text.charCodeAt(index), 16777619);
  }
  return value >>> 0;
}

/** A normally distributed offset with the tremor's spread (Box-Muller). */
function tremor(next: () => number): number {
  const u = Math.max(next(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next()) * TREMOR_SPREAD;
}

function missRateCheck(all: Target[], context: CheckContext): CheckResult {
  const findings: Located[] = [];
  // Only the things Tobin has to press are tried.
  for (const target of all.filter((entry) => isOnPath(entry.element, context))) {
    const selector = cssPath(target.element);
    const next = random(context.seed ^ hash(selector));
    const centreX = target.rect.left + target.rect.width / 2;
    const centreY = target.rect.top + target.rect.height / 2;

    const taps: { x: number; y: number; hit: boolean }[] = [];
    let missed = 0;
    let wrong = 0;
    for (let tap = 0; tap < TAPS; tap++) {
      const x = centreX + tremor(next);
      const y = centreY + tremor(next);
      const inside = (rect: DOMRect) =>
        x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      const hit = inside(target.rect);
      if (!hit) {
        missed += 1;
        if (all.some((other) => other !== target && inside(other.rect))) wrong += 1;
      }
      taps.push({ x, y, hit });
    }

    const rate = missed / TAPS;
    if (rate <= MISS_RATE_LIMIT) continue;
    const severity: Severity = rate > MISS_RATE_SEVERE ? "blocker" : "major";
    findings.push({
      ...located(target, context, {
        check: "tobin.miss-rate",
        severity,
        measured:
          `${missed} of ${TAPS} simulated shaky taps missed` +
          (wrong > 0 ? `, and ${wrong} landed on a neighbour` : "") +
          `. No more than ${Math.round(MISS_RATE_LIMIT * TAPS)} should`,
        fix: ENLARGE,
      }),
      taps,
    });
  }
  return {
    check: "tobin.miss-rate",
    title: "A shaky hand can hit what it needs to press",
    weight: "blocker",
    findings: keepWorst(findings),
  };
}

function precisionCheck(all: Target[], context: CheckContext): CheckResult {
  const findings: Located[] = [];
  for (const target of all) {
    if (!target.element.matches("input[type='range']")) continue;
    findings.push(
      located(target, context, {
        check: "tobin.precision",
        severity: "minor",
        measured: "A slider, which has to be held steady and dragged",
      }),
    );
  }
  return {
    check: "tobin.precision",
    title: "Nothing needs a steady drag",
    weight: "minor",
    findings: keepWorst(findings),
  };
}

export function runTobinChecks(context: CheckContext): CheckResult[] {
  const all = targets();
  return [
    sizeCheck(all, context),
    spacingCheck(all, context),
    riskyNeighbourCheck(all, context),
    missRateCheck(all, context),
    precisionCheck(all, context),
  ];
}
