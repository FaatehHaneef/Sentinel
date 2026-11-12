import type { Character } from "@/lib/cast";
import type { Sfx } from "../audio/sfx";
import type { Lens } from "../cast/types";
import type { Clock } from "../core/clock";
import { HUD_TAG } from "../core/dom";
import { Stage } from "./stage";
import { HUD_STYLES } from "./styles";

/** Width of the panel plus its margin. */
const PANEL_SPACE = 344;

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
 * being checked, and a panel with the character, what they say, their purse,
 * patience and XP, a live feed, and controls. It is built inside a shadow
 * root so the page's styles and ours cannot affect each other.
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
  private readonly panel: HTMLElement;
  private highlighted: Element | null = null;
  private tracking = 0;

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

    this.controls = el("div", "controls");
    const pause = this.toggle("Pause", (on) => {
      this.clock.paused = on;
      pause.textContent = on ? "Resume" : "Pause";
    });
    this.lensButton = this.toggle("See as them", (on) => this.lens.classList.toggle("on", on));
    const sound = this.toggle("Sound", (on) => (on ? this.sfx.enable() : this.sfx.disable()));
    const stop = el("button", undefined, "End trial");
    stop.type = "button";
    stop.addEventListener("click", onStop);
    this.controls.append(pause, this.lensButton, sound, stop);

    panel.append(who, this.sayText, meters, this.feedList, this.summary, this.controls);
    root.append(this.lens, canvas, this.highlightBox, panel);
    document.documentElement.append(this.host);

    this.stage = new Stage(canvas, portrait, clock);
    this.tracking = requestAnimationFrame(this.track);
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
    if (element) this.dodge(element);
    this.highlightBox.classList.toggle("on", element !== null);
    this.highlightBox.classList.toggle("bad", bad);
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
    this.tracking = requestAnimationFrame(this.track);
  };

  /** Replaces the controls with the end-of-trial card. */
  showSummary(title: string, text: string, link?: { href: string; label: string }): void {
    this.summary.replaceChildren(el("h2", undefined, title), el("p", undefined, text));
    if (link) {
      const anchor = el("a", undefined, link.label);
      anchor.href = link.href;
      this.summary.append(anchor);
    }
    const close = el("button", undefined, "Close");
    close.type = "button";
    close.addEventListener("click", () => this.destroy());
    this.controls.replaceChildren(close);
    this.summary.classList.add("on");
    this.highlight(null);
  }

  /**
   * Moves the panel to the other side of the screen when it would cover the
   * element being looked at.
   */
  private dodge(element: Element): void {
    if (window.innerWidth <= 720) return;
    const rect = element.getBoundingClientRect();
    const underRight = rect.right > window.innerWidth - PANEL_SPACE;
    const underLeft = rect.left < PANEL_SPACE;
    if (underRight && !underLeft) this.panel.classList.add("left");
    else if (underLeft && !underRight) this.panel.classList.remove("left");
  }

  /** Space the panel takes at each side, so the character can avoid walking under it. */
  get reserved(): { left: number; right: number } {
    if (window.innerWidth <= 720) return { left: 0, right: 0 };
    return this.panel.classList.contains("left")
      ? { left: PANEL_SPACE, right: 0 }
      : { left: 0, right: PANEL_SPACE };
  }

  destroy(): void {
    cancelAnimationFrame(this.tracking);
    this.stage.destroy();
    this.host.remove();
  }
}
