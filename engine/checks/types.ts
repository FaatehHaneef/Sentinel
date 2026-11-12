import type { Finding, Severity } from "@/lib/trial/types";

/** A finding together with the element it was measured on. */
export type Located = Finding & {
  element: Element;
  /** Where simulated taps landed, in viewport coordinates, for showing on the page. */
  taps?: { x: number; y: number; hit: boolean }[];
};

export type CheckResult = {
  /** Check id, for example "iris.contrast". */
  check: string;
  /** What a pass means, in plain words. */
  title: string;
  /** How serious a failure of this check is, which sets the XP for passing it. */
  weight: Severity;
  findings: Located[];
};

export type CheckContext = {
  /** Elements the shopper has to use on this page to complete the purchase. */
  pathElements: Element[];
  /** The seed of the run, so anything simulated is repeatable. */
  seed: number;
};

export function isOnPath(element: Element, context: CheckContext): boolean {
  return context.pathElements.some((path) => path === element || path.contains(element));
}

const RANK: Record<Severity, number> = { blocker: 3, major: 2, minor: 1 };

/**
 * Keeps a page's feed readable: at most `limit` findings per check, choosing
 * those on the shopper's path first, then the most serious.
 */
export function keepWorst(findings: Located[], limit = 6): Located[] {
  if (findings.length <= limit) return findings;
  return [...findings]
    .sort((a, b) => Number(b.onPath) - Number(a.onPath) || RANK[b.severity] - RANK[a.severity])
    .slice(0, limit);
}
