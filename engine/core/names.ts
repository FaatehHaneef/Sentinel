import { textOf } from "./dom";

/**
 * What a screen reader would call an element: a simplified version of the
 * accessible name computation that covers the cases a shop page meets.
 */

export type NameSource =
  "labelled-by" | "aria-label" | "label" | "alt" | "content" | "placeholder" | "title" | "none";

export type AccessibleName = { name: string; source: NameSource };

function clean(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function isHidden(element: Element): boolean {
  return element.closest("[aria-hidden='true'], [hidden]") !== null;
}

/** Text a screen reader would read from inside an element, including the names of pictures in it. */
function contentName(element: Element): string {
  const parts: string[] = [];
  const visit = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.nodeValue ?? "");
      return;
    }
    if (!(node instanceof Element) || isHidden(node)) return;
    const tag = node.tagName.toLowerCase();
    if (tag === "img") {
      parts.push(node.getAttribute("alt") ?? "");
      return;
    }
    if (tag === "svg") {
      parts.push(
        node.getAttribute("aria-label") ?? clean(node.querySelector("title")?.textContent),
      );
      return;
    }
    const label = node.getAttribute("aria-label");
    if (label) {
      parts.push(label);
      return;
    }
    node.childNodes.forEach(visit);
  };
  element.childNodes.forEach(visit);
  return clean(parts.join(" "));
}

export function accessibleName(element: Element): AccessibleName {
  const labelledBy = clean(
    (element.getAttribute("aria-labelledby") ?? "")
      .split(/\s+/)
      .map((id) => (id ? textOf(document.getElementById(id) ?? document.createElement("i")) : ""))
      .join(" "),
  );
  if (labelledBy) return { name: labelledBy, source: "labelled-by" };

  const ariaLabel = clean(element.getAttribute("aria-label"));
  if (ariaLabel) return { name: ariaLabel, source: "aria-label" };

  const tag = element.tagName.toLowerCase();
  if (tag === "input" || tag === "select" || tag === "textarea") {
    const field = element as HTMLInputElement;
    const label = clean(field.labels?.[0]?.textContent);
    if (label) return { name: label, source: "label" };
    if (field.type === "submit" || field.type === "button") {
      const value = clean(field.value);
      if (value) return { name: value, source: "content" };
    }
    const placeholder = clean(field.getAttribute("placeholder"));
    if (placeholder) return { name: placeholder, source: "placeholder" };
  } else if (tag === "img") {
    const alt = clean(element.getAttribute("alt"));
    if (alt) return { name: alt, source: "alt" };
  } else if (tag === "svg") {
    const title = clean(element.querySelector("title")?.textContent);
    if (title) return { name: title, source: "content" };
  } else {
    const content = contentName(element);
    if (content) return { name: content, source: "content" };
  }

  const title = clean(element.getAttribute("title"));
  if (title) return { name: title, source: "title" };
  return { name: "", source: "none" };
}

/** The kind of thing a screen reader announces an element as. */
export function spokenRole(element: Element): string {
  const role = element.getAttribute("role");
  if (role === "button" || role === "link" || role === "img")
    return role === "img" ? "image" : role;
  const tag = element.tagName.toLowerCase();
  if (tag === "a") return "link";
  if (tag === "button") return "button";
  if (tag === "img" || tag === "svg") return "image";
  if (tag === "select") return "pop-up button";
  if (tag === "textarea") return "edit text";
  if (tag === "input") {
    const type = (element.getAttribute("type") ?? "text").toLowerCase();
    if (type === "submit" || type === "button") return "button";
    if (type === "checkbox") return "checkbox";
    if (type === "radio") return "radio button";
    return "edit text";
  }
  return "group";
}
