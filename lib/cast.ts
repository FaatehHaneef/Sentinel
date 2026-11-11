/**
 * The cast. Each character stands for a kind of customer and owns a set of
 * checks. This file is the single source for names and descriptions shown in
 * the lobby, the HUD and the results.
 */

export type CharacterId = "iris" | "tobin" | "pell" | "knock" | "echo" | "dash" | "cog";

export type Character = {
  id: CharacterId;
  name: string;
  /** Who this character stands for. */
  represents: string;
  /** One line in the character's own voice. */
  motto: string;
  /** What this character checks, in plain words. */
  checks: readonly string[];
  /** Accent colour token from the dusk palette. */
  accent: "amber" | "ember" | "moss" | "mist" | "rose" | "parchment";
};

export const CAST: readonly Character[] = [
  {
    id: "iris",
    name: "Grandma Iris",
    represents: "An older shopper with low vision",
    motto: "If I can't read it, dear, I can't buy it.",
    checks: [
      "Text contrast",
      "Text size",
      "Labels that vanish when you type",
      "Button legibility",
      "Meaning shown by colour alone",
    ],
    accent: "amber",
  },
  {
    id: "tobin",
    name: "Tobin",
    represents: "A shopper with a hand tremor",
    motto: "Steady mind. Unsteady hands.",
    checks: [
      "Button and link size",
      "Space between targets",
      "Miss rate with a shaky aim",
      "Risky buttons side by side",
      "Controls that need precision",
    ],
    accent: "moss",
  },
  {
    id: "pell",
    name: "Pell",
    represents: "A shopper on a slow rural connection",
    motto: "One bar. Long road.",
    checks: [
      "Page weight",
      "Projected wait on a slow connection",
      "Time until the main content shows",
      "Layout that jumps around",
      "Images that hold things up",
      "Feedback while waiting",
    ],
    accent: "mist",
  },
  {
    id: "knock",
    name: "Knock",
    represents: "A shopper who uses only a keyboard",
    motto: "Tab, tab, tab. Is anyone home?",
    checks: [
      "Everything reachable by keyboard",
      "Visible focus",
      "Sensible focus order",
      "A way to skip long menus",
      "Controls that answer to Enter and Space",
      "Dialogs that hold focus",
    ],
    accent: "parchment",
  },
  {
    id: "echo",
    name: "Echo",
    represents: "A shopper who uses a screen reader",
    motto: "Tell me what it is, and I'll find my way.",
    checks: [
      "Image descriptions",
      "Names for buttons, links and fields",
      "Heading structure",
      "Page landmarks",
      "Page language and title",
      "Errors that get announced",
    ],
    accent: "rose",
  },
  {
    id: "dash",
    name: "Dash",
    represents: "An impatient shopper on a cheap phone",
    motto: "Three seconds. Then I'm gone.",
    checks: [
      "Phone-sized layout",
      "Zoom and viewport setup",
      "Steps to reach checkout",
      "Popups in the way",
      "Keyboards and autofill that help",
      "Stalls while tapping",
    ],
    accent: "ember",
  },
  {
    id: "cog",
    name: "Cog",
    represents: "An AI shopping agent",
    motto: "Show me the data and I will do the rest.",
    checks: [
      "Product data a machine can read",
      "Price that matches the page",
      "A findable path to checkout",
      "Real buttons and links",
      "Placing a sandbox order",
    ],
    accent: "amber",
  },
];

export function getCharacter(id: CharacterId): Character {
  const character = CAST.find((entry) => entry.id === id);
  if (!character) throw new Error(`Unknown character: ${id}`);
  return character;
}
