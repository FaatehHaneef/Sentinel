import { isStoreFixId, STORE_FIX_ADVICE, STORE_FIX_ATTRIBUTE } from "@/lib/store/variants";
import type { Fix } from "@/lib/trial/types";
import { cssPath, describe, fieldLabel, isVisible, textOf } from "../core/dom";
import { isOnPath, keepWorst, type CheckContext, type CheckResult, type Located } from "./types";

/**
 * Dash's checks: what an impatient shopper on a cheap phone runs into.
 *
 * The page is loaded again in a phone-sized frame (390 by 844 pixels, a
 * common phone screen) next to the real one, and measured there. The frame
 * is the same site, so it is read directly. It is shown on screen as Dash's
 * phone.
 */

export const PHONE = { width: 390, height: 844 };
const PHONE_SCALE = 0.42;

/** A popup covering more than this share of the screen on arrival stops Dash. */
const POPUP_SHARE = 0.3;

let phone: { box: HTMLElement; frame: HTMLIFrameElement } | null = null;

function ensurePhone(): { box: HTMLElement; frame: HTMLIFrameElement } {
  if (phone?.box.isConnected) return phone;
  const box = document.createElement("div");
  box.setAttribute("data-sentinel-ignore", "");
  box.setAttribute("aria-hidden", "true");
  box.style.cssText = [
    "position:fixed",
    "left:12px",
    "bottom:12px",
    `width:${Math.round(PHONE.width * PHONE_SCALE)}px`,
    `height:${Math.round(PHONE.height * PHONE_SCALE)}px`,
    "overflow:hidden",
    "border:5px solid #12152a",
    "border-radius:18px",
    "box-shadow:0 10px 30px rgba(0,0,0,.45)",
    "background:#fff",
    "z-index:2147482999",
    "pointer-events:none",
  ].join(";");
  const frame = document.createElement("iframe");
  frame.title = "Dash's phone";
  frame.width = String(PHONE.width);
  frame.height = String(PHONE.height);
  frame.style.cssText = `border:0;transform:scale(${PHONE_SCALE});transform-origin:0 0;width:${PHONE.width}px;height:${PHONE.height}px;`;
  box.append(frame);
  document.body.append(box);
  phone = { box, frame };
  return phone;
}

/** Loads the current page into the phone and waits for it to settle. */
async function loadPhone(
  context: CheckContext,
): Promise<{ doc: Document; win: Window; box: HTMLElement } | null> {
  const { box, frame } = ensurePhone();
  const loaded = new Promise<boolean>((resolve) => {
    const timer = window.setTimeout(() => resolve(false), 15_000);
    frame.addEventListener(
      "load",
      () => {
        window.clearTimeout(timer);
        resolve(true);
      },
      { once: true },
    );
  });
  frame.src = window.location.pathname + window.location.search;
  if (!(await loaded)) return null;
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) return null;
  // Give the page's scripts a moment to put up anything they show on arrival.
  await new Promise((resolve) => setTimeout(resolve, 900));
  context.prepare?.(doc);
  await new Promise((resolve) => setTimeout(resolve, 150));
  return { doc, win, box };
}

function storeFixFor(element: Element): Fix | undefined {
  const id = element.getAttribute(STORE_FIX_ATTRIBUTE);
  if (!isStoreFixId(id)) return undefined;
  return { summary: STORE_FIX_ADVICE[id].summary, storeFix: id, source: "rule" };
}

/** What a field is for, from its name, label, placeholder or autocomplete hint. */
function purpose(field: HTMLInputElement): "email" | "name" | "tel" | null {
  const hints = [
    field.getAttribute("autocomplete"),
    field.name,
    field.id,
    field.placeholder,
    fieldLabel(field),
  ]
    .join(" ")
    .toLowerCase();
  if (/e-?mail/.test(hints)) return "email";
  if (/phone|tel/.test(hints)) return "tel";
  if (/name/.test(hints)) return "name";
  return null;
}

/** A name for a popup from its first line of text, for example: The "Join the candle club" popup. */
function popupName(element: Element): string {
  const heading = Array.from(element.querySelectorAll("h1, h2, h3, p")).find((node) =>
    textOf(node),
  );
  const text = heading ? textOf(heading) : "";
  return text ? `The "${text.slice(0, 40)}" popup` : "A popup";
}

export async function runDashChecks(context: CheckContext): Promise<CheckResult[]> {
  const overflow: CheckResult = {
    check: "dash.overflow",
    title: "The page fits a phone screen",
    weight: "major",
    findings: [],
  };
  const viewport: CheckResult = {
    check: "dash.viewport",
    title: "The page is set up for phones and can be zoomed",
    weight: "major",
    findings: [],
  };
  const popup: CheckResult = {
    check: "dash.popup",
    title: "Nothing covers the screen on arrival",
    weight: "blocker",
    findings: [],
  };
  const typing: CheckResult = {
    check: "dash.input-help",
    title: "Fields bring up the right keyboard and offer autofill",
    weight: "major",
    findings: [],
  };

  const view = await loadPhone(context);
  if (!view) {
    return [overflow, viewport, popup, typing].map((result) => ({ ...result, skipped: true }));
  }
  const { doc, win, box } = view;

  /** The same element on the real page, or the phone itself when it only exists on phones. */
  const onPage = (element: Element): Element => {
    try {
      const match = document.querySelector(cssPath(element));
      return match && isVisible(match) ? match : box;
    } catch {
      return box;
    }
  };
  const located = (
    element: Element,
    finding: Omit<Located, "element" | "selector" | "label" | "onPath">,
  ): Located => {
    const real = onPage(element);
    return {
      ...finding,
      element: real,
      selector: cssPath(element),
      label: describe(element),
      onPath: real !== box && isOnPath(real, context),
    };
  };

  // Sideways scrolling: find what forces the page wider than the screen. One
  // element that will not shrink stretches its neighbours with it, so the
  // causes are the elements that refuse to wrap or have a minimum width
  // beyond the screen, not everything that ends up wide.
  const width = win.innerWidth;
  if (doc.documentElement.scrollWidth > width + 1) {
    const wide = Array.from(doc.body.querySelectorAll("*")).filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.right > width + 1 && isVisible(element);
    });
    const refuses = (element: Element): boolean => {
      const style = win.getComputedStyle(element);
      return style.whiteSpace === "nowrap" || parseFloat(style.minWidth) > width;
    };
    const leaves = wide.filter(
      (element) => !wide.some((other) => other !== element && element.contains(other)),
    );
    const causes = wide.filter(refuses);
    const culprits = causes.length > 0 ? causes : leaves;
    for (const element of culprits.slice(0, 3)) {
      const rect = element.getBoundingClientRect();
      overflow.findings.push(
        located(element, {
          check: "dash.overflow",
          severity: "major",
          measured: `It is ${Math.round(rect.right)} pixels wide on a ${width} pixel screen, so the page scrolls sideways`,
          fix: {
            summary: "Let it wrap and fit the screen",
            css: [
              {
                target: "element",
                declarations: { "min-width": "0", "max-width": "100%", "white-space": "normal" },
              },
            ],
            source: "rule",
          },
        }),
      );
    }
  }
  overflow.findings = keepWorst(overflow.findings);

  const meta = doc.querySelector<HTMLMetaElement>('meta[name="viewport"]')?.content ?? "";
  const blocksZoom =
    /user-scalable\s*=\s*(no|0)/i.test(meta) || /maximum-scale\s*=\s*1(\.0)?\b/i.test(meta);
  if (!/width\s*=\s*device-width/i.test(meta) || blocksZoom) {
    const first = document.body.firstElementChild;
    if (first) {
      viewport.findings.push({
        ...located(first, {
          check: "dash.viewport",
          severity: "major",
          measured: blocksZoom
            ? "The page stops the shopper from zooming in"
            : "The page is not set up for phone screens, so it shows as a shrunken desktop page",
        }),
        element: document.body.firstElementChild ?? box,
        label: "The page",
      });
    }
  }

  // Anything fixed over the page that covers a large share of the screen.
  const area = win.innerWidth * win.innerHeight;
  for (const element of doc.body.querySelectorAll("*")) {
    const style = win.getComputedStyle(element);
    if (style.position !== "fixed" && style.position !== "sticky") continue;
    if (!isVisible(element)) continue;
    const rect = element.getBoundingClientRect();
    const covered =
      Math.max(0, Math.min(rect.right, win.innerWidth) - Math.max(rect.left, 0)) *
      Math.max(0, Math.min(rect.bottom, win.innerHeight) - Math.max(rect.top, 0));
    const share = covered / area;
    if (share < POPUP_SHARE) continue;
    if (popup.findings.some((finding) => finding.selector && element.closest(finding.selector)))
      continue;
    popup.findings.push({
      ...located(element, {
        check: "dash.popup",
        severity: "blocker",
        measured: `On arrival it covers ${Math.round(share * 100)}% of the phone screen`,
        stops: true,
        fix: storeFixFor(element),
      }),
      label: popupName(element),
      onPath: true,
      stopReason: `left at once: something covered ${Math.round(share * 100)}% of the phone screen on arrival`,
    });
  }

  for (const field of doc.querySelectorAll<HTMLInputElement>("input")) {
    const type = (field.getAttribute("type") ?? "text").toLowerCase();
    if (!["text", "email", "tel", ""].includes(type) || !isVisible(field)) continue;
    const kind = purpose(field);
    if (!kind) continue;
    const autocomplete = (field.getAttribute("autocomplete") ?? "").toLowerCase();
    const missing: string[] = [];
    const attributes: Record<string, string> = {};
    if (kind === "email" && type !== "email" && field.inputMode !== "email") {
      missing.push("no email keyboard");
      attributes.type = "email";
    }
    if (kind === "tel" && type !== "tel" && field.inputMode !== "tel") {
      missing.push("no number pad");
      attributes.type = "tel";
    }
    const wanted = kind === "name" ? ["name", "given-name", "family-name"] : [kind];
    if (!wanted.some((value) => autocomplete.includes(value))) {
      missing.push("no autofill");
      attributes.autocomplete = wanted[0];
    }
    if (missing.length === 0) continue;
    typing.findings.push(
      located(field, {
        check: "dash.input-help",
        severity: "major",
        measured: `On a phone this field offers ${missing.join(" and ")}, so everything is typed by hand`,
        fix: {
          summary: `Tell the phone what the field is for (${Object.entries(attributes)
            .map(([name, value]) => `${name}="${value}"`)
            .join(", ")})`,
          attributes,
          source: "rule",
        },
      }),
    );
  }
  typing.findings = keepWorst(typing.findings);

  return [overflow, viewport, popup, typing];
}
