import type { Character } from "@/lib/cast";
import type { Sfx } from "../audio/sfx";
import type { Lens } from "../cast/types";
import type { Clock } from "../core/clock";
import { HUD_TAG, isIgnored } from "../core/dom";
import { chooseCorner, PANEL_MARGIN, panelBox, type Corner, type Weighted } from "./placement";
import { Stage } from "./stage";
import { HUD_STYLES } from "./styles";

export type FeedEntry = {
  kind: "pass" | "snag" | "info" | "good" | "bad";
  text: string;
  detail?: string;
  delta?: string;
  /** When set, the entry can be clicked to point at this element again. */
  selector?: string;
};

const MARK: Record<FeedEntry["kind"], string> = {
  pass: "✓",
  snag: "✗",
  info: "›",
  good: "★",
  bad: "✗",
};

/** The page's own content that the panel should avoid hiding. */
const CRUCIAL =
  "h1, h2, h3, label, input, select, textarea, button, a[href], [role='button'], img, [data-price], strong";

const SPEAKER_ON =
  '<svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="M2 6h3l4-3v10l-4-3H2z"/><path fill="currentColor" d="M11 5h1v1h1v4h-1v1h-1v-1h1V6h-1zM13 3h1v1h1v8h-1v1h-1v-1h1V4h-1z"/></svg>';
const SPEAKER_OFF =
  '<svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="M2 6h3l4-3v10l-4-3H2z"/><path fill="currentColor" d="M11 6h1v1h1V6h1v1h-1v1h1v1h-1v1h-1V9h-1v1h-1V9h1V8h-1V7h1z"/></svg>';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * The on-page display: the character's layer, a highlight around the element
 * being checked, and a card with the character, what they say, their coins,
 * patience and XP, a live feed, and controls. It is built inside a shadow
 * root so the page's styles and ours cannot affect each other.
 *
 * The card sits in whichever corner hides the least of what matters on the
 * page, and moves when that changes.
 */
export class Hud {
  readonly stage: Stage;
  private readonly host: HTMLElement;
  private readonly lens: HTMLElement;
  private readonly highlightBox: HTMLElement;
  private readonly nameText: HTMLElement;
  private readonly roleText: HTMLElement;
  private readonly sayText: HTMLElement;
  private readonly coinsText: HTMLElement;
  private readonly patienceBar: HTMLElement;
  private readonly patienceText: HTMLElement;
  private readonly xpText: HTMLElement;
  private readonly feedList: HTMLOListElement;
  private readonly summary: HTMLElement;
  private readonly controls: HTMLElement;
  private readonly lensButton: HTMLButtonElement;
  private readonly pauseButton: HTMLButtonElement;
  private readonly panel: HTMLElement;
  private corner: Corner = "top-right";
  private highlighted: Element | null = null;
  private tracking = 0;
  private placing = 0;
  private lastPlaced = 0;

  constructor(
    private readonly clock: Clock,
    private readonly sfx: Sfx,
    onStop: () => void,
  ) {
    document.querySelector(HUD_TAG)?.remove();
    this.host = document.createElement(HUD_TAG);
    const root = this.host.attachShadow({ mode: "open" });
    root.append(el("style", undefined, HUD_STYLES));

    this.lens = el("div", "lens");
    const canvas = el("canvas", "stage");
    canvas.setAttribute("aria-hidden", "true");
    this.highlightBox = el("div", "highlight");

    const panel = el("section", "panel");
    this.panel = panel;
    panel.dataset.corner = this.corner;
    panel.setAttribute("aria-label", "Sentinel trial");

    const who = el("div", "who");
    const portrait = el("canvas", "portrait");
    portrait.width = 64;
    portrait.height = 96;
    portrait.setAttribute("aria-hidden", "true");
    const whoText = el("div");
    this.nameText = el("h2", "name");
    this.roleText = el("p", "role");
    whoText.append(this.nameText, this.roleText);
    who.append(portrait, whoText);

    this.sayText = el("p", "say");

    const meters = el("dl", "meters");
    const [coins, coinsValue] = this.meter("Coins");
    const [patience, patienceValue, patienceBar] = this.meter("Patience", true);
    const [xp, xpValue] = this.meter("XP");
    this.coinsText = coinsValue;
    this.patienceText = patienceValue;
    this.patienceBar = patienceBar!;
    this.xpText = xpValue;
    meters.append(coins, patience, xp);

    this.feedList = el("ol", "feed");
    this.feedList.setAttribute("aria-live", "polite");
    this.feedList.setAttribute("aria-label", "What is happening");

    this.summary = el("div", "summary");

    // Two rows, each filled edge to edge. The first holds the two important controls.
    this.controls = el("div", "controls");
    const rowOne = el("div", "row primary");
    const rowTwo = el("div", "row");
    this.pauseButton = this.toggle("Pause", (on) => {
      this.clock.paused = on;
      this.pauseButton.textContent = on ? "Resume" : "Pause";
    });
    this.lensButton = this.toggle("See as them", (on) => this.lens.classList.toggle("on", on));
    rowOne.append(this.pauseButton, this.lensButton);

    // Sound starts on.
    const sound = el("button", "icon");
    sound.type = "button";
    const showSound = (on: boolean) => {
      sound.innerHTML = on ? SPEAKER_ON : SPEAKER_OFF;
      sound.setAttribute("aria-label", on ? "Sound on" : "Sound off");
      sound.setAttribute("aria-pressed", String(on));
      sound.title = on ? "Sound on" : "Sound off";
    };
    sound.addEventListener("click", () => {
      const on = !this.sfx.enabled;
      if (on) this.sfx.enable();
      else this.sfx.disable();
      showSound(on);
    });
    this.sfx.enable();
    showSound(true);

    const stop = el("button", "stop", "End trial");
    stop.type = "button";
    stop.addEventListener("click", onStop);
    rowTwo.append(sound, stop);
    this.controls.append(rowOne, rowTwo);

    panel.append(who, this.sayText, meters, this.feedList, this.summary, this.controls);
    root.append(this.lens, canvas, this.highlightBox, panel);
    document.documentElement.append(this.host);

    this.stage = new Stage(canvas, portrait, clock);
    this.tracking = requestAnimationFrame(this.track);
    window.addEventListener("scroll", this.schedulePlacement, { passive: true });
    window.addEventListener("resize", this.schedulePlacement);
    this.place();
  }

  private meter(label: string, withBar = false): [HTMLElement, HTMLElement, HTMLElement?] {
    const box = el("div", "meter");
    const value = el("dd", undefined, "0");
    box.append(el("dt", undefined, label), value);
    if (!withBar) return [box, value];
    const bar = el("div", "bar");
    const fill = el("i");
    bar.append(fill);
    box.append(bar);
    return [box, value, fill];
  }

  private toggle(label: string, onChange: (on: boolean) => void): HTMLButtonElement {
    const button = el("button", undefined, label);
    button.type = "button";
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      const on = button.getAttribute("aria-pressed") !== "true";
      button.setAttribute("aria-pressed", String(on));
      onChange(on);
    });
    return button;
  }

  setCharacter(character: Character, lens?: Lens): void {
    this.nameText.textContent = character.name;
    this.roleText.textContent = character.represents;
    // The lens is switched off between characters, and hidden for those without one.
    this.lens.className = `lens ${lens?.kind ?? ""}`;
    this.lensButton.setAttribute("aria-pressed", "false");
    this.lensButton.hidden = !lens;
    this.lensButton.textContent = lens?.label ?? "";
  }

  setMeters(meters: { coins: number; patience: number; xp: number }): void {
    this.coinsText.textContent = String(meters.coins);
    this.patienceText.textContent = `${Math.round(meters.patience)}%`;
    this.patienceBar.style.width = `${Math.max(0, Math.min(100, meters.patience))}%`;
    this.patienceBar.style.background =
      meters.patience > 50 ? "#ffb347" : meters.patience > 20 ? "#e8743b" : "#e05a6d";
    this.xpText.textContent = String(meters.xp);
  }

  say(line: string): void {
    this.sayText.textContent = line;
  }

  feed(entry: FeedEntry): void {
    const item = el("li", entry.kind);
    const mark = el("span", "mark", MARK[entry.kind]);
    mark.setAttribute("aria-hidden", "true");
    const body = el("span");
    if (entry.selector) {
      const jump = el("button", "jump", entry.text);
      jump.type = "button";
      const selector = entry.selector;
      jump.addEventListener("click", () => {
        const target = document.querySelector(selector);
        if (target) {
          target.scrollIntoView({ block: "center" });
          this.highlight(target, true);
        }
      });
      body.append(jump);
    } else {
      body.append(entry.text);
    }
    if (entry.detail) body.append(el("span", "detail", entry.detail));
    item.append(mark, body, el("span", "delta", entry.delta ?? ""));
    this.feedList.prepend(item);
    while (this.feedList.children.length > 40) this.feedList.lastElementChild?.remove();
  }

  /** Draws a box around an element and keeps it there as the page scrolls. */
  highlight(element: Element | null, bad = false): void {
    this.highlighted = element;
    this.highlightBox.classList.toggle("on", element !== null);
    this.highlightBox.classList.toggle("bad", bad);
    if (element) this.place();
  }

  private track = (): void => {
    if (this.highlighted) {
      if (!this.highlighted.isConnected) {
        this.highlight(null);
      } else {
        const rect = this.highlighted.getBoundingClientRect();
        const style = this.highlightBox.style;
        style.left = `${rect.left - 6}px`;
        style.top = `${rect.top - 6}px`;
        style.width = `${rect.width + 12}px`;
        style.height = `${rect.height + 12}px`;
      }
    }
    // A slow, steady check, for pages that change without scrolling.
    if (performance.now() - this.lastPlaced > 900) this.place();
    this.tracking = requestAnimationFrame(this.track);
  };

  private schedulePlacement = (): void => {
    cancelAnimationFrame(this.placing);
    this.placing = requestAnimationFrame(() => this.place());
  };

  /** What on the screen matters right now, weighted by how much it matters. */
  private crucial(): Weighted[] {
    const items: Weighted[] = [];
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const add = (
      rect: DOMRect | { left: number; top: number; right: number; bottom: number },
      weight: number,
    ) => {
      if (
        rect.right <= 0 ||
        rect.bottom <= 0 ||
        rect.left >= viewport.width ||
        rect.top >= viewport.height
      )
        return;
      items.push({
        box: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
        weight,
      });
    };
    if (this.highlighted?.isConnected) add(this.highlighted.getBoundingClientRect(), 12);
    const feet = this.stage.feet;
    add({ left: feet.x - 30, top: feet.y - 80, right: feet.x + 30, bottom: feet.y + 6 }, 6);
    const root = document.querySelector("main") ?? document.body;
    let counted = 0;
    for (const element of root.querySelectorAll(CRUCIAL)) {
      if (counted > 250) break;
      if (isIgnored(element)) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      counted += 1;
      add(rect, 1);
    }
    return items;
  }

  /** Moves the card to the corner where it hides least of what matters. */
  private place(): void {
    this.lastPlaced = performance.now();
    if (window.innerWidth <= 720) return;
    const rect = this.panel.getBoundingClientRect();
    if (rect.width === 0) return;
    const next = chooseCorner(
      this.corner,
      { width: rect.width, height: rect.height },
      { width: window.innerWidth, height: window.innerHeight },
      this.crucial(),
    );
    if (next !== this.corner) {
      this.corner = next;
      this.panel.dataset.corner = next;
    }
  }

  /** At the end of a trial: a compact card with the summary, which can be tucked away. */
  showSummary(
    title: string,
    text: string,
    link?: { href: string; label: string },
    achievements: string[] = [],
  ): void {
    this.summary.replaceChildren(el("h2", undefined, title), el("p", undefined, text));
    if (achievements.length > 0) {
      const list = el("ul", "earned");
      for (const name of achievements) list.append(el("li", undefined, `★ Achievement: ${name}`));
      this.summary.append(list);
    }
    if (link) {
      const anchor = el("a", undefined, link.label);
      anchor.href = link.href;
      this.summary.append(anchor);
    }
    const tuck = el("button", undefined, "Hide");
    tuck.type = "button";
    tuck.addEventListener("click", () => {
      const hidden = this.panel.classList.toggle("tucked");
      tuck.textContent = hidden ? "Show results" : "Hide";
      this.place();
    });
    const close = el("button", "stop", "Close");
    close.type = "button";
    close.addEventListener("click", () => this.destroy());
    const row = el("div", "row");
    row.append(tuck, close);
    this.controls.replaceChildren(row);
    this.summary.classList.add("on");
    this.panel.classList.add("finished");
    this.highlight(null);
    this.place();
  }

  /**
   * Space the card takes at the left and right at a given height on the
   * screen, so the character can avoid walking under it.
   */
  reservedAt(y: number): { left: number; right: number } {
    if (window.innerWidth <= 720) return { left: 0, right: 0 };
    const rect = this.panel.getBoundingClientRect();
    const box = panelBox(this.corner, rect.width, rect.height, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    if (y < box.top - 8 || y > box.bottom + 90) return { left: 0, right: 0 };
    const space = rect.width + PANEL_MARGIN * 2;
    return this.corner.endsWith("left") ? { left: space, right: 0 } : { left: 0, right: space };
  }

  destroy(): void {
    cancelAnimationFrame(this.tracking);
    cancelAnimationFrame(this.placing);
    window.removeEventListener("scroll", this.schedulePlacement);
    window.removeEventListener("resize", this.schedulePlacement);
    this.stage.destroy();
    this.sfx.destroy();
    this.host.remove();
  }
}
