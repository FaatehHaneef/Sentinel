/**
 * Reading the page. Everything here only looks: nothing in this file changes
 * the page except `setInputValue`, which types into a field the way a person
 * would.
 */

export const HUD_TAG = "sentinel-hud";

/**
 * Parts of a page the engine never looks inside: its own display, any frame,
 * and the payment provider's widget.
 */
const IGNORED = [
  HUD_TAG,
  "iframe",
  ".braintree-dropin",
  "[data-braintree-id]",
  "[data-sentinel-ignore]",
  "script",
  "style",
  "noscript",
  "template",
].join(",");

export function isIgnored(element: Element): boolean {
  return element.closest(IGNORED) !== null;
}

export function isVisible(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  // Anything two pixels or smaller is hidden from sight on purpose (for example screen-reader-only text).
  if (rect.width < 2 || rect.height < 2) return false;
  if (typeof element.checkVisibility === "function") {
    return element.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  }
  const style = getComputedStyle(element);
  return style.display !== "none" && style.visibility === "visible" && style.opacity !== "0";
}

export function textOf(element: Element): string {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}

function shorten(text: string, max = 40): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** The accessible name of a form field, if it has one. */
export function fieldLabel(field: Element): string {
  const aria = field.getAttribute("aria-label")?.trim();
  if (aria) return aria;
  const labelledBy = field.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => textOf(document.getElementById(id) ?? document.createElement("i")))
      .join(" ")
      .trim();
    if (text) return text;
  }
  const labels = (field as HTMLInputElement).labels;
  if (labels && labels.length > 0) {
    const text = textOf(labels[0]);
    if (text) return text;
  }
  return field.getAttribute("title")?.trim() ?? "";
}

/**
 * The label a sighted person can see for a field: a visible <label>, or
 * visible text the field points to. An `aria-label` or tooltip does not
 * count here, because it is not on the screen.
 */
export function visibleLabel(field: Element): string {
  const candidates: Element[] = Array.from((field as HTMLInputElement).labels ?? []);
  for (const id of (field.getAttribute("aria-labelledby") ?? "").split(/\s+/)) {
    const target = id ? document.getElementById(id) : null;
    if (target) candidates.push(target);
  }
  for (const candidate of candidates) {
    const text = textOf(candidate);
    if (text && isVisible(candidate)) return text;
  }
  return "";
}

/** A short description of an element, in words a shop owner would use. */
export function describe(element: Element): string {
  const tag = element.tagName.toLowerCase();
  if (tag === "img") {
    const alt = element.getAttribute("alt")?.trim();
    return alt ? `"${shorten(alt)}" picture` : "Picture";
  }
  if (tag === "input" || tag === "textarea" || tag === "select") {
    const type = (element.getAttribute("type") ?? "").toLowerCase();
    if (type === "submit" || type === "button") {
      return `"${shorten((element as HTMLInputElement).value)}" button`;
    }
    const name =
      fieldLabel(element) ||
      element.getAttribute("placeholder") ||
      element.getAttribute("name") ||
      "Unnamed";
    return `"${shorten(name)}" field`;
  }
  const text = shorten(textOf(element)) || "Unnamed";
  if (tag === "button" || element.getAttribute("role") === "button") return `"${text}" button`;
  if (tag === "a") return `"${text}" link`;
  return `"${text}" text`;
}

/** A CSS selector that finds this element again on the same page. */
export function cssPath(element: Element): string {
  const parts: string[] = [];
  let node: Element | null = element;
  while (node && node !== document.body && node !== document.documentElement) {
    if (node.id && document.querySelectorAll(`#${CSS.escape(node.id)}`).length === 1) {
      parts.unshift(`#${CSS.escape(node.id)}`);
      return parts.join(" > ");
    }
    const tag = node.tagName.toLowerCase();
    const parent: Element | null = node.parentElement;
    if (!parent) break;
    const sameTag = Array.from(parent.children).filter((child) => child.tagName === node!.tagName);
    parts.unshift(sameTag.length > 1 ? `${tag}:nth-of-type(${sameTag.indexOf(node) + 1})` : tag);
    node = parent;
  }
  return ["body", ...parts].join(" > ");
}

/** First visible element matching `selector` whose text matches `pattern`. */
export function findByText<T extends Element = HTMLElement>(
  selector: string,
  pattern: RegExp,
): T | null {
  for (const element of document.querySelectorAll<T>(selector)) {
    if (pattern.test(textOf(element)) && isVisible(element)) return element;
  }
  return null;
}

/** Sets a field's value so that the page's own code notices, as real typing would. */
export function setInputValue(field: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype =
    field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(field, value);
  else field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Resolves when the page has stopped changing for `quietMs`, or after `maxMs`. */
export function settle(quietMs = 250, maxMs = 4000): Promise<void> {
  return new Promise((resolve) => {
    let quiet = window.setTimeout(done, quietMs);
    const limit = window.setTimeout(done, maxMs);
    const observer = new MutationObserver(() => {
      window.clearTimeout(quiet);
      quiet = window.setTimeout(done, quietMs);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    function done() {
      window.clearTimeout(quiet);
      window.clearTimeout(limit);
      observer.disconnect();
      resolve();
    }
  });
}

/** Distance from the top of the document, for ordering things top to bottom. */
export function documentTop(element: Element): number {
  return element.getBoundingClientRect().top + window.scrollY;
}
