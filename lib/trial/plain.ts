import type { Severity } from "./types";

/**
 * Plain words for every check, for everyone who is not a developer. The
 * technical measurement stays on the Problems and fixes screen; everywhere
 * else a problem is described with these.
 */
const PLAIN: Record<string, string> = {
  "iris.contrast": "Too pale to read",
  "iris.text-size": "Writing too small to read",
  "iris.labels": "The box forgets its name once you start typing",
  "iris.button": "The button blends into the page",

  "tobin.target-size": "Too small to tap with shaky hands",
  "tobin.spacing": "Squashed right up against the next button",
  "tobin.risky-neighbour": "One slip here empties the cart",
  "tobin.miss-rate": "Shaky hands keep missing it",
  "tobin.precision": "Needs a steady hand to drag",

  "pell.wait": "Takes far too long to load on a slow connection",
  "pell.heavy-images": "A picture far too big to download",
  "pell.layout-shift": "The page jumps around while it loads",
  "pell.lazy-images": "Loads pictures nobody can see yet",

  "knock.reachable": "Can't be reached without a mouse",
  "knock.focus-visible": "You can't see where the keyboard is",
  "knock.tab-order": "The keyboard jumps around out of order",
  "knock.skip-link": "No way to skip past the menu",

  "echo.image-names": "A picture with no description",
  "echo.control-names": "A screen reader can't say what this is",
  "echo.headings": "Muddled headings",
  "echo.landmarks": "The main part of the page isn't marked",
  "echo.page-basics": "The page doesn't say its language or name",

  "dash.overflow": "The page slides sideways on a phone",
  "dash.viewport": "Not set up for phones",
  "dash.popup": "A popup covers the phone screen",
  "dash.input-help": "No autofill or phone keyboard help",

  "cog.product-data": "AI shoppers can't read the product details",
  "cog.price-match": "The price and the price data disagree",
  "cog.real-controls": "AI shoppers can't tell this is a button",
};

export function plainProblem(check: string): string {
  return PLAIN[check] ?? "Something got in the way";
}

/** How bad a problem is, in plain words. */
export const PLAIN_SEVERITY: Record<Severity, string> = {
  blocker: "Can stop a sale",
  major: "Slows shoppers down",
  minor: "A small snag",
};
