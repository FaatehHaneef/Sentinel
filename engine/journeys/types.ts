/** Who is shopping: the details they type at checkout and how many they want. */
export type Shopper = { name: string; email: string; quantity: number };

/** What a character can do on the page. Every action is paced, visible and logged. */
export type Actor = {
  /** Walks to an element and stands beside it. */
  goTo(element: Element): Promise<void>;
  click(element: HTMLElement, description: string): Promise<void>;
  type(field: HTMLInputElement, value: string, description: string): Promise<void>;
  waitFor<T>(probe: () => T | null | undefined | false, timeoutMs: number): Promise<T | null>;
  /** Says something in the character's voice. */
  say(line: string): void;
  /** Adds a line to the feed and the trial record. */
  note(text: string, kind?: "info" | "good" | "bad"): void;
  /** Waits for a length of trial time. */
  pause(ms: number): Promise<void>;
  shopper: Shopper;
  /** Address of the Sentinel app the trial was launched from. */
  apiBase: string;
};

/** One stretch of the road to a purchase. */
export type Scene = {
  id: string;
  /** Short name shown in the feed, for example "Your details". */
  name: string;
  /** How close to payment this is: 0.5 at the shop front, 1.5 at the pay step. */
  funnel: number;
  /** True when the page is currently showing this scene. */
  match(): boolean;
  /** The elements a shopper must use here to move on. */
  path(shopper: Shopper): Element[];
  /** Does what a shopper does to move on. */
  advance(actor: Actor): Promise<void>;
  /** True for the last scene: reaching it means the purchase is complete. */
  final?: boolean;
};

export type Journey = {
  /** Price of one of what the shopper sets out to buy, in cents. The purse is this times the quantity. */
  unitCents: number;
  scenes: Scene[];
  /** Clears anything left over from an earlier walk. */
  prepare(): void;
  /** Where a walk starts. */
  startPath: string;
  /** Reads the order id once the purchase is complete. */
  orderId(): string;
};
