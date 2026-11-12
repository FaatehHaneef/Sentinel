import { isStoreFixId, STORE_FIX_ADVICE, STORE_FIX_ATTRIBUTE } from "@/lib/store/variants";
import type { Fix, Severity } from "@/lib/trial/types";
import { cssPath, describe, isIgnored, isVisible } from "../core/dom";
import { isOnPath, keepWorst, type CheckContext, type CheckResult, type Located } from "./types";

/**
 * Pell's checks: what a shopper on a slow rural connection runs into.
 *
 * Sizes, request counts and layout shifts are measured by the browser on the
 * real page load. The wait is an estimate: those measurements projected onto
 * Pell's connection, using the profile below, and it is labelled as one.
 * Loading can only be measured once per page load, so after the shopper moves
 * on within the same page load those checks are skipped.
 */

/** Pell's connection. An assumption of the model, stated wherever the estimate appears. */
export const SLOW_PROFILE = { megabitsPerSecond: 1, roundTripMs: 300, parallel: 6 };

/** Wait thresholds for the estimate, in seconds. */
const WAIT_TARGET = 5;
const WAIT_MAJOR = 8;
const WAIT_GIVES_UP = 12;

const HEAVY_IMAGE = 300 * 1024;
const VERY_HEAVY_IMAGE = 1024 * 1024;
const LAZY_WORTH_IT = 50 * 1024;
const SHIFT_MINOR = 0.1;
const SHIFT_MAJOR = 0.25;

/** Requests that are Sentinel's own, not the shop's. */
const OURS = /\/v\.js|sentinel-engine\.js|\/api\/runs|\/api\/verdict/;

let measuredThisPageLoad = false;

/**
 * What a first-time visitor downloads for this entry. An entry with no body
 * size came from this browser's cache, perhaps after checking with the
 * server, and its transfer size is only headers: its real size is unknown
 * here (0), and is read from the file instead where that matters.
 */
function bytes(entry: PerformanceResourceTiming | PerformanceNavigationTiming): number {
  if (!entry.encodedBodySize) return 0;
  return Math.max(entry.transferSize || 0, entry.encodedBodySize);
}

/**
 * The size of a same-site file, read from this browser's cache where it can
 * be. Used for pictures the browser already had, which it reports as
 * weighing nothing. Returns 0 for other sites' files, which cannot be read.
 */
async function fileSize(url: string): Promise<number> {
  try {
    if (new URL(url, window.location.href).origin !== window.location.origin) return 0;
    const response = await fetch(url, { cache: "force-cache" });
    return response.ok ? (await response.blob()).size : 0;
  } catch {
    return 0;
  }
}

function size(value: number): string {
  return value >= 1024 * 1024
    ? `${(value / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(value / 1024))} KB`;
}

/** Estimated seconds to load this much over Pell's connection: setting up, round trips, then the bytes. */
export function projectedWait(totalBytes: number, requests: number): number {
  const { megabitsPerSecond, roundTripMs, parallel } = SLOW_PROFILE;
  const setup = 3 * roundTripMs;
  const trips = Math.ceil(requests / parallel) * roundTripMs;
  const transfer = ((totalBytes * 8) / (megabitsPerSecond * 1_000_000)) * 1000;
  return (setup + trips + transfer) / 1000;
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

/** The demo store's own fix for an element, if the store marked it as replaceable. */
function storeFixFor(element: Element | null): Fix | undefined {
  const id = element?.getAttribute(STORE_FIX_ATTRIBUTE);
  if (!isStoreFixId(id)) return undefined;
  return { summary: STORE_FIX_ADVICE[id].summary, storeFix: id, source: "rule" };
}

/** Waits until every picture on the page has finished loading, or until `limitMs`. */
async function picturesLoaded(limitMs: number): Promise<void> {
  const deadline = performance.now() + limitMs;
  while (performance.now() < deadline) {
    const pending = Array.from(document.images).some((image) => !image.complete);
    if (!pending) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

function layoutShifts(): Promise<{ score: number; source: Element | null }> {
  return new Promise((resolve) => {
    let score = 0;
    let largest = 0;
    let source: Element | null = null;
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
          sources?: { node?: Node }[];
        })[]) {
          if (entry.hadRecentInput) continue;
          score += entry.value;
          const node = entry.sources?.find((item) => item.node instanceof Element)?.node;
          if (entry.value > largest && node instanceof Element) {
            largest = entry.value;
            source = node;
          }
        }
      });
      observer.observe({ type: "layout-shift", buffered: true });
      setTimeout(() => {
        observer.disconnect();
        resolve({ score, source });
      }, 100);
    } catch {
      resolve({ score: 0, source: null });
    }
  });
}

export async function runPellChecks(context: CheckContext): Promise<CheckResult[]> {
  const wait: CheckResult = {
    check: "pell.wait",
    title: "The page loads quickly on a slow connection",
    weight: "blocker",
    findings: [],
  };
  const heavy: CheckResult = {
    check: "pell.heavy-images",
    title: "Pictures are no heavier than they need to be",
    weight: "major",
    findings: [],
  };
  const shift: CheckResult = {
    check: "pell.layout-shift",
    title: "Nothing jumps around while the page loads",
    weight: "major",
    findings: [],
  };
  const lazy: CheckResult = {
    check: "pell.lazy-images",
    title: "Pictures further down wait until they are needed",
    weight: "minor",
    findings: [],
  };

  // Pictures the shopper cannot see yet should not load straight away. This is
  // read from the page itself, so it is checked on every page.
  for (const image of Array.from(document.images)) {
    if (isIgnored(image) || !isVisible(image) || image.loading === "lazy") continue;
    const top = image.getBoundingClientRect().top + window.scrollY;
    if (top < window.innerHeight * 1.2) continue;
    const entry = performance.getEntriesByName(image.currentSrc)[0] as
      PerformanceResourceTiming | undefined;
    const weight = entry ? bytes(entry) : 0;
    if (weight < LAZY_WORTH_IT) continue;
    lazy.findings.push(
      located(image, context, {
        check: "pell.lazy-images",
        severity: "minor",
        measured: `A ${size(weight)} picture below the fold loads with the page instead of when it is reached`,
        fix: {
          summary: "Load it only when it is about to be seen",
          attributes: { loading: "lazy" },
          source: "rule",
        },
      }),
    );
  }
  lazy.findings = keepWorst(lazy.findings);

  if (measuredThisPageLoad) {
    // The shopper moved on within the same page load: nothing new was loaded to measure.
    return [
      { ...wait, skipped: true },
      { ...heavy, skipped: true },
      { ...shift, skipped: true },
      lazy,
    ];
  }
  measuredThisPageLoad = true;
  await picturesLoaded(15_000);

  const navigation = performance.getEntriesByType("navigation")[0] as
    PerformanceNavigationTiming | undefined;
  const resources = (
    performance.getEntriesByType("resource") as PerformanceResourceTiming[]
  ).filter(
    // Data fetched in the background (prefetching the next pages) is not needed to show this one.
    (entry) =>
      !OURS.test(entry.name) &&
      entry.initiatorType !== "fetch" &&
      entry.initiatorType !== "xmlhttprequest",
  );
  // The heaviest pictures, which are usually the cause. A picture this browser
  // already had may be reported as weighing nothing, so its size is read from
  // the file itself: Pell is a first-time visitor and downloads all of it.
  const pictures = (
    await Promise.all(
      Array.from(document.images)
        .filter((image) => !isIgnored(image) && isVisible(image) && image.currentSrc)
        .map(async (image) => {
          const entry = performance.getEntriesByName(image.currentSrc)[0] as
            PerformanceResourceTiming | undefined;
          const reported = entry ? bytes(entry) : 0;
          return {
            image,
            weight: reported || (await fileSize(image.currentSrc)),
            listed: Boolean(entry),
          };
        }),
    )
  ).sort((a, b) => b.weight - a.weight);

  const listedPictures = new Set(
    pictures.filter((picture) => picture.listed).map((p) => p.image.currentSrc),
  );
  const pictureWeight = new Map(
    pictures.map((picture) => [picture.image.currentSrc, picture.weight]),
  );
  const unlisted = pictures.filter((picture) => !listedPictures.has(picture.image.currentSrc));

  const total =
    (navigation ? bytes(navigation) : 0) +
    resources.reduce(
      (sum, entry) => sum + (bytes(entry) || pictureWeight.get(entry.name) || 0),
      0,
    ) +
    unlisted.reduce((sum, picture) => sum + picture.weight, 0);
  const requests = resources.length + unlisted.length + 1;
  const seconds = projectedWait(total, requests);

  for (const { image, weight } of pictures) {
    if (weight < HEAVY_IMAGE) continue;
    const shown = image.getBoundingClientRect();
    const oversized = image.naturalWidth > shown.width * 1.25;
    heavy.findings.push(
      located(image, context, {
        check: "pell.heavy-images",
        severity: weight >= VERY_HEAVY_IMAGE ? "blocker" : "major",
        measured:
          `This picture is ${size(weight)}` +
          (oversized
            ? `, ${image.naturalWidth} pixels wide but shown at ${Math.round(shown.width)}`
            : ""),
        fix: storeFixFor(image),
      }),
    );
  }
  heavy.findings = keepWorst(heavy.findings);

  if (seconds > WAIT_TARGET) {
    const page = document.querySelector("main") ?? document.body.firstElementChild;
    if (page) {
      const severity: Severity =
        seconds > WAIT_GIVES_UP ? "blocker" : seconds > WAIT_MAJOR ? "major" : "minor";
      const culprit = pictures[0]?.weight >= HEAVY_IMAGE ? pictures[0].image : null;
      wait.findings.push({
        ...located(page, context, {
          check: "pell.wait",
          severity,
          measured:
            `${size(total)} in ${requests} requests: about ${Math.round(seconds)} seconds on Pell's connection ` +
            `(estimate for ${SLOW_PROFILE.megabitsPerSecond} Mbps with ${SLOW_PROFILE.roundTripMs} ms round trips), ` +
            `aim for under ${WAIT_TARGET}`,
          stops: seconds > WAIT_GIVES_UP,
          fix: storeFixFor(culprit),
        }),
        label: "The whole page",
        onPath: true,
        stopReason: `gave up waiting: about ${Math.round(seconds)} seconds to load on a slow connection`,
      });
    }
  }

  const shifts = await layoutShifts();
  if (shifts.score > SHIFT_MINOR) {
    const element = shifts.source ?? document.querySelector("main") ?? document.body;
    shift.findings.push(
      located(element, context, {
        check: "pell.layout-shift",
        severity: shifts.score > SHIFT_MAJOR ? "major" : "minor",
        measured: `The layout shifted by ${shifts.score.toFixed(2)} while loading, should stay under ${SHIFT_MINOR}`,
      }),
    );
  }

  return [wait, heavy, shift, lazy];
}
