import { z } from "zod";
import { getCharacter, type CharacterId } from "@/lib/cast";
import { contrastRatio, formatRatio, fromHex } from "./contrast";
import type { CharacterSummary } from "./scoring";
import type { Evidence, Fix } from "./types";

/**
 * Wick's verdict on one character's walk: a headline, a short story, and a
 * note for each snag. The same shape is produced by AI and by the built-in
 * notes below, so the product reads the same when AI is unavailable.
 */

const hex = z.string().regex(/^#[0-9a-f]{6}$/i);

export const verdictRequestSchema = z.object({
  character: z.enum(["iris", "tobin", "pell", "knock", "echo", "dash", "cog"]),
  outcome: z.enum(["purchased", "abandoned", "stopped", "running"]),
  /** Display name of the scene where the shopper gave up. */
  abandonedAt: z.string().max(60).optional(),
  purse: z.number().min(0).max(1_000_000),
  coinsLost: z.number().min(0).max(1_000_000),
  /** How many of the last trial's snags were gone this time. */
  fixedCount: z.number().int().min(0).max(200).default(0),
  snags: z
    .array(
      z.object({
        check: z.string().max(60),
        title: z.string().max(140),
        severity: z.enum(["minor", "major", "blocker"]),
        label: z.string().max(160),
        measured: z.string().max(240),
        onPath: z.boolean(),
        scene: z.string().max(60),
        /** The fix Sentinel will offer, so the written advice agrees with it. */
        plannedFix: z.string().max(240).optional(),
        evidence: z
          .object({
            foreground: hex.optional(),
            background: hex.optional(),
            ratio: z.number().optional(),
            required: z.number().optional(),
            fontSizePx: z.number().optional(),
          })
          .optional(),
      }),
    )
    .max(40),
});

export type VerdictRequest = z.infer<typeof verdictRequestSchema>;

export type VerdictNote = {
  /** Why this snag is hard for this person, and what to change. */
  why: string;
  /** A text colour suggested by AI. Only kept if it passes the contrast maths. */
  colour?: string;
};

export type Verdict = {
  source: "ai" | "built-in";
  headline: string;
  story: string;
  /** One note per snag, in the same order as the request. */
  notes: VerdictNote[];
};

export function buildVerdictRequest(
  summary: CharacterSummary,
  sceneNames: Record<string, string>,
  fixedCount: number,
): VerdictRequest {
  return {
    character: summary.character,
    outcome: summary.outcome,
    abandonedAt: summary.abandonedAt
      ? (sceneNames[summary.abandonedAt] ?? summary.abandonedAt)
      : undefined,
    purse: summary.coinsLeft + summary.coinsLost,
    coinsLost: summary.coinsLost,
    fixedCount,
    snags: summary.snags.map((snag) => ({
      check: snag.finding.check,
      title: snag.title,
      severity: snag.finding.severity,
      label: snag.finding.label,
      measured: snag.finding.measured,
      onPath: snag.finding.onPath,
      scene: sceneNames[snag.scene] ?? snag.scene,
      plannedFix: snag.finding.fix?.summary,
      evidence: snag.finding.evidence,
    })),
  };
}

const WHY: Record<string, string> = {
  "iris.contrast":
    "Faint text fades into the page for someone with low vision. Use a darker colour so the text reaches the contrast shown.",
  "iris.text-size":
    "Small text cannot be made out without zooming, and zooming breaks the flow of buying. Use a larger size.",
  "iris.labels":
    "A placeholder disappears as soon as typing starts, so the shopper loses track of what the box is for. Add a label that stays visible above the field.",
  "tobin.target-size":
    "A shaking hand cannot land on something this small. Make the control at least 44 pixels in each direction.",
  "tobin.spacing":
    "When controls sit this close together, a slip lands on the neighbour. Leave more room between them.",
  "tobin.risky-neighbour":
    "A control that removes or cancels sits right beside one the shopper needs, so a slip undoes their work. Move it further away.",
  "tobin.miss-rate":
    "Most attempts to press this miss, and every miss is a moment where the shopper may give up. A larger control fixes it.",
  "tobin.precision":
    "A slider has to be held steady and dragged, which a trembling hand cannot do. Offer buttons or a number box as well.",
  "knock.reachable":
    "This looks like a button but is not one, so the Tab key never lands on it and it cannot be pressed without a mouse. Make it a real button.",
  "knock.focus-visible":
    "Nothing shows when the keyboard is on this, so the shopper cannot tell where they are on the page. Show a clear outline on focus.",
  "knock.tab-order":
    "This forces itself to the front of the tab order, so focus jumps around the page. Let it follow the order it appears in.",
  "knock.skip-link":
    "Without a skip link, a keyboard user has to tab through the whole menu on every page. Add a link that jumps to the main content.",
  "echo.image-names":
    "A screen reader can only say that there is a picture here, not what it shows. Add a short description.",
  "echo.control-names":
    "A screen reader announces this without saying what it does, so the shopper has to guess. Give it a name that says where it goes or what it does.",
  "echo.headings":
    "Screen reader users move around a page by its headings. Gaps in the heading levels make that map hard to follow.",
  "echo.landmarks":
    "Without a marked main area, a screen reader user has to listen through everything to find the content.",
  "echo.page-basics":
    "The page does not say what language it is in or what it is called, so it may be read in the wrong voice or announced as nothing.",
  "pell.wait":
    "On a weak connection every kilobyte costs time, and most of this page's weight is one picture. Make it smaller and the page arrives in seconds rather than a quarter of a minute.",
  "pell.heavy-images":
    "This picture is far bigger than it needs to be for the space it fills. Export it at the size it is shown and compress it.",
  "pell.layout-shift":
    "Things move while the page loads, so a shopper who is reading or tapping finds the page has moved under them. Reserve space for what loads late.",
  "pell.lazy-images":
    "This picture loads before the shopper can see it, slowing down everything above it. Let it load when it is about to be seen.",
  "iris.button":
    "A button that barely differs from the page is easy to miss altogether. Give it a visible edge or a stronger colour.",
};

const DEFAULT_WHY =
  "This slows the shopper down. The measurement above shows by how much it falls short.";

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** Wick's standard notes, written from the measurements alone. */
export function builtInVerdict(request: VerdictRequest): Verdict {
  const { name } = getCharacter(request.character as CharacterId);
  const first = name.split(" ").pop() ?? name;
  const count = request.snags.length;
  const needed = request.snags.filter((snag) => snag.onPath).length;
  const fixed =
    request.fixedCount > 0
      ? ` ${plural(request.fixedCount, "snag")} from the last trial ${request.fixedCount === 1 ? "is" : "are"} gone.`
      : "";

  let headline: string;
  let story: string;
  if (request.outcome === "purchased") {
    headline =
      count === 0
        ? `${name} bought without a single snag`
        : `${name} bought, with ${plural(count, "snag")} on the way`;
    story =
      (count === 0
        ? `${first} walked the whole road and paid, and nothing got in the way.`
        : `${first} completed the purchase, but met ${plural(count, "snag")} first and lost ${request.coinsLost} of ${request.purse} coins to them. Each one is a place where a shopper with less patience would have left.`) +
      fixed;
  } else if (request.outcome === "abandoned") {
    const where = request.abandonedAt ? ` at "${request.abandonedAt}"` : "";
    headline = `${name} left${where} without buying`;
    story =
      `${first} set out to buy and gave up${where} after ${plural(count, "snag")}. ` +
      (needed > 0
        ? `${needed === count ? "All" : needed} of them ${needed === 1 ? "was" : "were"} on things a shopper has to use to pay, which is why patience ran out there. `
        : "") +
      `The whole purse of ${request.purse} coins was lost with the sale.` +
      fixed;
  } else {
    headline = `${name}'s trial ended early`;
    story =
      `The trial was stopped before ${first} finished, after ${plural(count, "snag")}.` + fixed;
  }

  return {
    source: "built-in",
    headline,
    story,
    notes: request.snags.map((snag) => ({ why: WHY[snag.check] ?? DEFAULT_WHY })),
  };
}

/** Margin above the requirement that a suggested colour must clear. */
const COLOUR_MARGIN = 0.1;

/**
 * Checks a colour suggested by AI against the measurement it is meant to fix.
 * Returns the contrast it achieves, or null if it is not a colour or does not
 * meet the requirement. AI proposes; this decides.
 */
export function checkSuggestedColour(
  colour: string | undefined,
  evidence?: Evidence,
): number | null {
  if (!colour || !evidence?.background || !evidence.required) return null;
  const text = fromHex(colour);
  const background = fromHex(evidence.background);
  if (!text || !background) return null;
  const ratio = contrastRatio(text, background);
  return ratio >= evidence.required + COLOUR_MARGIN ? ratio : null;
}

/**
 * Applies a verified AI colour to a colour fix. Any fix that is not a single
 * text-colour change, and any colour that fails the check, is left as it was.
 */
export function withSuggestedColour(
  fix: Fix | undefined,
  colour: string | undefined,
  evidence?: Evidence,
): Fix | undefined {
  if (!fix?.css || fix.css.length !== 1) return fix;
  const [change] = fix.css;
  const properties = Object.keys(change.declarations);
  if (properties.length !== 1 || properties[0] !== "color") return fix;
  const ratio = checkSuggestedColour(colour, evidence);
  if (ratio === null || !colour) return fix;
  const value = colour.toLowerCase();
  return {
    summary: `Use ${value}, a tone chosen to suit the shop, which gives ${formatRatio(ratio)}`,
    css: [{ target: change.target, declarations: { color: value } }],
    source: "ai",
  };
}
