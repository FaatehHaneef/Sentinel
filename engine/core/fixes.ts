import { fixToCss, sanitizeAppliedFix } from "@/lib/trial/fixes";
import type { AppliedFix } from "@/lib/trial/types";
import { HUD_TAG } from "./dom";

/**
 * Tries fixes on the live page. Nothing here is permanent and nothing reaches
 * the site's server: styles go into one stylesheet the engine owns, and
 * labels are plain elements marked as ours. A reload removes all of it.
 *
 * Every fix is reduced to the allowed properties before it is used, whatever
 * its source.
 */

const STYLE_ATTRIBUTE = "data-sentinel-fixes";
const LABEL_ATTRIBUTE = "data-sentinel-label";
const KEYS_ATTRIBUTE = "data-sentinel-keys";

export class FixApplier {
  private readonly fixes: AppliedFix[];
  private observer: MutationObserver | null = null;
  private pending = 0;
  private counter = 0;

  constructor(fixes: readonly unknown[]) {
    this.fixes = fixes
      .map((fix) => sanitizeAppliedFix(fix))
      .filter((fix): fix is AppliedFix => fix !== null);
  }

  get count(): number {
    return this.fixes.length;
  }

  get applied(): AppliedFix[] {
    return this.fixes;
  }

  start(): void {
    if (this.fixes.length === 0) return;
    const css = this.fixes
      .map(({ selector, fix }) => fixToCss(selector, fix, true))
      .filter(Boolean)
      .join("\n");
    if (css) {
      document.querySelector(`style[${STYLE_ATTRIBUTE}]`)?.remove();
      const style = document.createElement("style");
      style.setAttribute(STYLE_ATTRIBUTE, "");
      style.textContent = css;
      document.head.append(style);
    }

    this.apply();
    // Pages change as the shopper moves through them, so labels are added again when fields appear.
    this.observer = new MutationObserver((mutations) => {
      if (mutations.every((mutation) => (mutation.target as Element).closest?.(HUD_TAG))) return;
      window.clearTimeout(this.pending);
      this.pending = window.setTimeout(() => this.apply(), 50);
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  /** Applies everything that is not a style rule now, without waiting for the observer. */
  apply(): void {
    for (const { selector, fix } of this.fixes) {
      let field: Element | null = null;
      try {
        field = document.querySelector(selector);
      } catch {
        continue;
      }
      if (!field) continue;

      for (const [name, value] of Object.entries(fix.attributes ?? {})) {
        if (field.getAttribute(name) !== value) field.setAttribute(name, value);
      }

      if (fix.keyboard && !field.hasAttribute(KEYS_ATTRIBUTE)) {
        // Enter and Space press it, as they would a real button.
        const control = field as HTMLElement;
        control.setAttribute(KEYS_ATTRIBUTE, "");
        control.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          control.click();
        });
      }

      if (!fix.label || field.previousElementSibling?.hasAttribute(LABEL_ATTRIBUTE)) continue;

      const label = document.createElement("label");
      label.setAttribute(LABEL_ATTRIBUTE, "");
      label.id = `sentinel-label-${++this.counter}`;
      label.textContent = fix.label;
      label.style.cssText = "display:block;font-weight:700;margin:0 0 -8px;cursor:pointer;";
      const target = field as HTMLElement;
      label.addEventListener("click", () => target.focus());
      // The label is tied to the field without changing the field's id, so the
      // selector that found the field in the last trial still finds it.
      field.setAttribute("aria-labelledby", label.id);
      field.before(label);
    }
  }

  stop(): void {
    this.observer?.disconnect();
    window.clearTimeout(this.pending);
  }
}
