import { cssPath, describe, isIgnored, isVisible, textOf } from "../core/dom";
import { accessibleName, spokenRole } from "../core/names";
import { isOnPath, keepWorst, type CheckContext, type CheckResult, type Located } from "./types";

/**
 * Echo's checks: what a shopper using a screen reader runs into. Each one
 * asks what the page would say out loud, worked out from the same attributes
 * a screen reader uses.
 */

const CONTROLS =
  "a[href], button, input, select, textarea, [role='button'], [role='link'], [role='checkbox']";
const DISABLED = ":disabled, [aria-disabled='true']";

/** Names that say nothing about what a control does. */
const GENERIC =
  /^(click here|here|more|read more|learn more|link|button|go|ok|\d+|[^\p{L}\p{N}]+)$/iu;

/** A picture smaller than this inside text is treated as decoration. */
const MIN_PICTURE = 24;

function usable(element: Element): boolean {
  return !isIgnored(element) && !element.matches(DISABLED) && isVisible(element);
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

function heard(element: Element, name: string): string {
  return `I hear: "${spokenRole(element)}${name ? `, ${name}` : ""}". That tells me nothing.`;
}

/** A plain name for something, taken from the nearest heading or the page title. */
function nearbyName(element: Element): string {
  for (let node: Element | null = element.parentElement; node; node = node.parentElement) {
    const heading = node.querySelector("h1, h2, h3");
    if (heading && textOf(heading)) return textOf(heading).slice(0, 80);
  }
  return document.title.slice(0, 80) || "Picture";
}

function pictureCheck(context: CheckContext): CheckResult {
  const findings: Located[] = [];
  for (const picture of document.querySelectorAll("img, svg")) {
    if (!usable(picture) || picture.closest("[aria-hidden='true']")) continue;
    // A picture inside a link or button is that control's business: its name is checked there.
    if (picture.closest(CONTROLS)) continue;
    const role = picture.getAttribute("role");
    if (role === "presentation" || role === "none") continue;
    const rect = picture.getBoundingClientRect();
    if (rect.width < MIN_PICTURE || rect.height < MIN_PICTURE) continue;

    const isImg = picture.tagName === "IMG";
    // An <img> with an empty alt is marked as decoration on purpose, which is allowed.
    if (isImg && picture.hasAttribute("alt")) continue;
    if (!isImg && accessibleName(picture).name) continue;

    const suggestion = nearbyName(picture);
    findings.push({
      ...located(picture, context, {
        check: "echo.image-names",
        severity: "major",
        measured:
          "A picture with no description. A screen reader can only say that an image is here",
        fix: {
          summary: `Describe the picture, for example "${suggestion}"`,
          attributes: isImg ? { alt: suggestion } : { role: "img", "aria-label": suggestion },
          source: "rule",
        },
      }),
      label: "Picture with no description",
      line: 'I hear: "image". An image of what?',
    });
  }
  return {
    check: "echo.image-names",
    title: "Pictures have descriptions",
    weight: "major",
    findings: keepWorst(findings),
  };
}

/** A name for a link, from where it goes: "/store/cart" becomes "Cart". */
function nameFromLink(element: Element): string {
  const href = element.getAttribute("href") ?? "";
  const last = href.split(/[?#]/)[0].split("/").filter(Boolean).pop() ?? "";
  const words = last.replace(/[-_]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "";
}

function controlNameCheck(context: CheckContext): CheckResult {
  const findings: Located[] = [];
  for (const control of document.querySelectorAll(CONTROLS)) {
    if (!usable(control) || (control as HTMLInputElement).type === "hidden") continue;
    const { name, source } = accessibleName(control);
    const onPath = isOnPath(control, context);

    if (!name || GENERIC.test(name)) {
      const suggestion = nameFromLink(control);
      findings.push({
        ...located(control, context, {
          check: "echo.control-names",
          severity: !name && onPath ? "blocker" : "major",
          measured: name
            ? `It is announced as "${spokenRole(control)}, ${name}", which does not say what it does`
            : `It is announced as "${spokenRole(control)}" with no name at all`,
          stops: !name && onPath,
          fix: suggestion
            ? {
                summary: `Give it a name that says where it goes: "${suggestion}"`,
                attributes: { "aria-label": suggestion },
                source: "rule",
              }
            : undefined,
        }),
        line: heard(control, name),
      });
    } else if (source === "placeholder") {
      findings.push({
        ...located(control, context, {
          check: "echo.control-names",
          severity: "minor",
          measured: "Its only name is its placeholder, which some screen readers do not announce",
          fix: {
            summary: `Give it a proper name: "${name}"`,
            attributes: { "aria-label": name },
            source: "rule",
          },
        }),
        line: 'On some screen readers I would hear only "edit text" here.',
      });
    }
  }
  return {
    check: "echo.control-names",
    title: "Buttons, links and fields say what they are",
    weight: "blocker",
    findings: keepWorst(findings),
  };
}

function headingCheck(context: CheckContext): CheckResult {
  const findings: Located[] = [];
  const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).filter(usable);
  const tops = headings.filter((heading) => heading.tagName === "H1");
  if (headings.length > 0 && tops.length !== 1) {
    findings.push(
      located(tops[1] ?? headings[0], context, {
        check: "echo.headings",
        severity: "major",
        measured:
          tops.length === 0
            ? "The page has no main heading"
            : `The page has ${tops.length} main headings, and should have one`,
      }),
    );
  }
  let previous = 0;
  for (const heading of headings) {
    const level = Number(heading.tagName[1]);
    if (previous > 0 && level > previous + 1) {
      findings.push(
        located(heading, context, {
          check: "echo.headings",
          severity: "minor",
          measured: `A level ${level} heading follows a level ${previous} heading, skipping a level`,
        }),
      );
    }
    previous = level;
  }
  return {
    check: "echo.headings",
    title: "Headings make a map of the page",
    weight: "major",
    findings: keepWorst(findings),
  };
}

function landmarkCheck(context: CheckContext): CheckResult {
  const findings: Located[] = [];
  if (!document.querySelector("main, [role='main']")) {
    const first = document.body.firstElementChild;
    if (first) {
      findings.push({
        ...located(first, context, {
          check: "echo.landmarks",
          severity: "major",
          measured: "The page does not mark its main content",
        }),
        label: "The page",
      });
    }
  }
  return {
    check: "echo.landmarks",
    title: "The main content is marked",
    weight: "major",
    findings,
  };
}

function pageBasicsCheck(context: CheckContext): CheckResult {
  const findings: Located[] = [];
  const first = document.body.firstElementChild;
  if (first) {
    const missing: string[] = [];
    if (!document.documentElement.lang.trim()) missing.push("the language it is written in");
    if (!document.title.trim()) missing.push("a title");
    if (missing.length > 0) {
      findings.push({
        ...located(first, context, {
          check: "echo.page-basics",
          severity: "major",
          measured: `The page does not state ${missing.join(" or ")}`,
        }),
        label: "The page",
      });
    }
  }
  return {
    check: "echo.page-basics",
    title: "The page states its language and title",
    weight: "major",
    findings,
  };
}

export function runEchoChecks(context: CheckContext): CheckResult[] {
  return [
    pictureCheck(context),
    controlNameCheck(context),
    headingCheck(context),
    landmarkCheck(context),
    pageBasicsCheck(context),
  ];
}
