import type { AppliedFix, CssChange, Fix } from "./types";

/**
 * What a fix is allowed to do. A fix can come from stored data or from AI, so
 * it is never trusted: before anything touches a page it is reduced to this
 * short list of style properties, plain values, and a text label.
 */

export const ALLOWED_PROPERTIES = [
  "color",
  "background-color",
  "border",
  "border-color",
  "border-width",
  "border-style",
  "outline",
  "font-size",
  "font-weight",
  "text-decoration",
  "padding",
  "min-width",
  "min-height",
] as const;

const PROPERTY_SET = new Set<string>(ALLOWED_PROPERTIES);

/** Colours, sizes and keywords only. No url(), no var(), no quotes, no semicolons or braces. */
const SAFE_VALUE = /^[#a-z0-9 .,%-]+$/i;
const FUNCTION_CALL = /[a-z]\s*\(/i;
const MAX_VALUE_LENGTH = 60;
const MAX_LABEL_LENGTH = 80;
const MAX_SELECTOR_LENGTH = 400;

/** Matches only the selectors the engine itself produces: ids and child steps. */
const SAFE_SELECTOR = /^(body|#[\w\\-]+)( > ([a-z][a-z0-9]*(:nth-of-type\(\d+\))?|#[\w\\-]+))*$/;

export function isSafeSelector(selector: string): boolean {
  return selector.length <= MAX_SELECTOR_LENGTH && SAFE_SELECTOR.test(selector);
}

function cleanDeclarations(declarations: unknown): Record<string, string> {
  const clean: Record<string, string> = {};
  if (!declarations || typeof declarations !== "object") return clean;
  for (const [property, value] of Object.entries(declarations)) {
    if (!PROPERTY_SET.has(property) || typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_VALUE_LENGTH) continue;
    if (!SAFE_VALUE.test(trimmed) || FUNCTION_CALL.test(trimmed)) continue;
    clean[property] = trimmed;
  }
  return clean;
}

/** Reduces a fix to what is allowed. Returns null if nothing usable is left. */
export function sanitizeFix(fix: unknown): Fix | null {
  if (!fix || typeof fix !== "object") return null;
  const input = fix as Partial<Fix>;

  const css: CssChange[] = [];
  if (Array.isArray(input.css)) {
    for (const change of input.css) {
      if (change?.target !== "element" && change?.target !== "placeholder") continue;
      const declarations = cleanDeclarations(change.declarations);
      if (Object.keys(declarations).length > 0) css.push({ target: change.target, declarations });
    }
  }

  const label =
    typeof input.label === "string" && input.label.trim()
      ? input.label.trim().slice(0, MAX_LABEL_LENGTH)
      : undefined;

  if (css.length === 0 && !label) return null;
  return {
    summary: typeof input.summary === "string" ? input.summary.slice(0, 200) : "Suggested fix",
    css: css.length > 0 ? css : undefined,
    label,
    source: input.source === "ai" ? "ai" : "rule",
  };
}

export function sanitizeAppliedFix(applied: unknown): AppliedFix | null {
  if (!applied || typeof applied !== "object") return null;
  const input = applied as Partial<AppliedFix>;
  if (typeof input.selector !== "string" || !isSafeSelector(input.selector)) return null;
  const fix = sanitizeFix(input.fix);
  if (!fix) return null;
  return {
    check: typeof input.check === "string" ? input.check.slice(0, 60) : "",
    selector: input.selector,
    label: typeof input.label === "string" ? input.label.slice(0, 120) : "",
    fix,
  };
}

function rule(selector: string, change: CssChange, important: boolean): string {
  const target = change.target === "placeholder" ? `${selector}::placeholder` : selector;
  const body = Object.entries(change.declarations)
    .map(([property, value]) => `  ${property}: ${value}${important ? " !important" : ""};`)
    .join("\n");
  return `${target} {\n${body}\n}`;
}

/** The fix as a stylesheet. `important` is used when trying it live, so it wins over the page's own styles. */
export function fixToCss(selector: string, fix: Fix, important = false): string {
  return (fix.css ?? []).map((change) => rule(selector, change, important)).join("\n");
}

/** The fix as the code a developer would write, for showing on the results page. */
export function fixToSnippet(selector: string, fix: Fix): string {
  const parts: string[] = [];
  if (fix.label) {
    parts.push(
      `<!-- Add a visible label above the field -->\n<label for="field-id">${fix.label}</label>\n<input id="field-id" … />`,
    );
  }
  const css = fixToCss(selector, fix);
  if (css) parts.push(css);
  return parts.join("\n\n");
}
