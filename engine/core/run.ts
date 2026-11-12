import { getCharacter, type CharacterId } from "@/lib/cast";
import { writeStoreFixes } from "@/lib/store/variants";
import {
  coinCost,
  passXp,
  patienceCost,
  PURCHASE_XP,
  purseFor,
  STARTING_PATIENCE,
} from "@/lib/trial/scoring";
import type { Finding, Outcome, TrialEvent } from "@/lib/trial/types";
import { buildSprite } from "../art/sprite";
import { Sfx } from "../audio/sfx";
import { iris } from "../cast/iris";
import { knock } from "../cast/knock";
import { pell } from "../cast/pell";
import { tobin } from "../cast/tobin";
import { echo } from "../cast/echo";
import type { EngineCharacter } from "../cast/types";
import type { Located } from "../checks/types";
import { Hud } from "../hud/hud";
import { SPRITE_SCALE } from "../hud/stage";
import type { Actor, Journey, Scene } from "../journeys/types";
import { Clock, StopSignal } from "./clock";
import { documentTop, setInputValue, settle } from "./dom";
import { FixApplier } from "./fixes";
import {
  clearState,
  saveRecord,
  saveState,
  type CharacterProgress,
  type EngineState,
  type PreviousSnag,
} from "./state";

const CHARACTERS: Partial<Record<CharacterId, EngineCharacter>> = {
  iris,
  tobin,
  pell,
  knock,
  echo,
};

/** How long the character lingers on a snag, in trial time. */
const SNAG_PAUSE_MS = 1500;
const FIXED_PAUSE_MS = 1100;
const PASS_PAUSE_MS = 450;
const TYPING_MS = 55;

/** Distinct event bodies, without the fields the run adds. */
type EventInput = TrialEvent extends infer E
  ? E extends TrialEvent
    ? Omit<E, "t" | "character">
    : never
  : never;

/** Something for the character to walk to on a page: a snag, or a snag from last time that is gone. */
type Stop =
  | { kind: "snag"; element: Element; located: Located }
  | { kind: "fixed"; element: Element; previous: PreviousSnag };

function find(selector: string): Element | null {
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}

export async function runTrial(
  state: EngineState,
  journey: Journey,
  apiBase: string,
): Promise<void> {
  const clock = new Clock(state.config.pace);
  const sfx = new Sfx();
  const hud = new Hud(clock, sfx, () => clock.stop());

  // On a re-run, the chosen fixes go onto the page before anything is measured.
  const applier = new FixApplier(state.fixes);
  applier.start();
  if (applier.count > 0 && state.events.length === 0) {
    hud.feed({
      kind: "info",
      text: `Trying ${applier.count} ${applier.count === 1 ? "fix" : "fixes"} from the last trial`,
    });
  }

  const finishRun = (title: string): void => {
    state.finished = true;
    saveRecord(state, true, applier.applied);
    clearState();
    applier.stop();
    // Store fixes last for one trial: afterwards the demo store goes back to how it was.
    if (state.config.kind === "own") writeStoreFixes(window.localStorage, []);
    const snags = state.events.filter((event) => event.type === "snag").length;
    const fixed = state.events.filter((event) => event.type === "fixed").length;
    const purchases = state.events.filter((event) => event.type === "purchase").length;
    const shoppers = state.config.party.length;
    hud.showSummary(
      title,
      `${purchases} of ${shoppers} ${shoppers === 1 ? "shopper" : "shoppers"} completed a purchase. ` +
        `${snags} ${snags === 1 ? "snag" : "snags"} found` +
        (fixed > 0 ? `, ${fixed} fixed since last time.` : "."),
      { href: `${apiBase}/runs/${state.config.runId}`, label: "See the full results" },
    );
  };

  try {
    while (state.index < state.config.party.length) {
      const id = state.config.party[state.index];
      const character = CHARACTERS[id];
      if (!character) {
        state.index += 1;
        continue;
      }
      await walk(state, character, journey, hud, sfx, clock, applier);
      state.index += 1;
      state.progress = null;
      saveState(state);
      saveRecord(state, false, applier.applied);
      if (state.index < state.config.party.length) {
        // The next shopper starts from the beginning with an empty cart.
        journey.prepare();
        window.location.assign(journey.startPath);
        return;
      }
    }
    finishRun("Trial complete");
  } catch (error) {
    if (!(error instanceof StopSignal)) throw error;
    const id = state.config.party[state.index];
    if (id && state.progress) {
      const progress = state.progress;
      state.events.push({
        t: Date.now() - state.startedAt,
        character: id,
        type: "finish",
        outcome: "stopped",
        coinsLeft: progress.coins,
        coinsLost: progress.purse - progress.coins,
        xp: progress.xp,
      });
    }
    finishRun("Trial ended early");
  }
}

async function walk(
  state: EngineState,
  character: EngineCharacter,
  journey: Journey,
  hud: Hud,
  sfx: Sfx,
  clock: Clock,
  applier: FixApplier,
): Promise<void> {
  const meta = getCharacter(character.id);
  const stage = hud.stage;
  stage.setSprite(buildSprite(character.frames, character.palette));
  hud.setCharacter(meta, character.lens);

  if (!state.progress) {
    journey.prepare();
    const purse = purseFor(journey.unitCents * character.shopper.quantity);
    state.progress = {
      purse,
      coins: purse,
      patience: STARTING_PATIENCE,
      xp: 0,
      checked: [],
      seen: [],
      greeted: false,
    };
  }
  const progress: CharacterProgress = state.progress;

  const emit = (event: EventInput): void => {
    state.events.push({
      ...event,
      t: Date.now() - state.startedAt,
      character: character.id,
    } as TrialEvent);
    saveState(state);
  };
  const refresh = (): void =>
    hud.setMeters({ coins: progress.coins, patience: progress.patience, xp: progress.xp });

  /** Where the character stands for an element: to its left, feet level with its lower edge. */
  const spotFor = (element: Element): { x: number; y: number } => {
    const rect = element.getBoundingClientRect();
    const half = 8 * SPRITE_SCALE;
    const reserved = hud.reserved;
    const minX = reserved.left + half + 8;
    const maxX = window.innerWidth - reserved.right - half - 8;
    const x = Math.max(minX, Math.min(rect.left - half - 10, maxX));
    const y = Math.max(24 * SPRITE_SCALE + 8, Math.min(rect.bottom + 6, window.innerHeight - 12));
    return { x, y };
  };
  stage.setSpotResolver(spotFor);

  const goTo = async (element: Element): Promise<void> => {
    await clock.whenRunning();
    element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const spot = spotFor(element);
    await stage.walkTo(spot.x, spot.y);
    await clock.whenRunning();
  };

  let currentScene = "start";

  const actor: Actor = {
    shopper: character.shopper,
    goTo,
    waitFor: (probe, timeoutMs) => clock.waitFor(probe, timeoutMs),
    async click(element, description) {
      await goTo(element);
      hud.highlight(element);
      await clock.sleep(450);
      hud.feed({ kind: "info", text: description });
      emit({ type: "action", scene: currentScene, text: description });
      hud.highlight(null);
      element.click();
    },
    async type(field, value, description) {
      await goTo(field);
      hud.highlight(field);
      field.focus();
      for (let length = 1; length <= value.length; length++) {
        setInputValue(field, value.slice(0, length));
        await clock.sleep(TYPING_MS);
      }
      hud.feed({ kind: "info", text: description });
      emit({ type: "action", scene: currentScene, text: description });
      hud.highlight(null);
    },
  };

  refresh();
  stage.enterFromLeft(Math.min(window.innerHeight - 40, 260));
  if (!progress.greeted) {
    progress.greeted = true;
    hud.say(character.greeting);
    await stage.walkTo(60, Math.min(window.innerHeight - 40, 260));
    await clock.sleep(900);
  }

  const reportSnag = async (scene: Scene, located: Located, title: string): Promise<void> => {
    const { element, taps, line: spoken, ...finding } = located;
    if (element.isConnected) {
      await goTo(element);
      hud.highlight(element, true);
    }
    stage.setAnimation(character.reactions[finding.check] ?? "worry");
    if (taps) stage.showTaps(taps);

    const coins = coinCost(progress.purse, progress.coins, finding, scene.funnel);
    const patience = patienceCost(finding);
    progress.coins -= coins;
    progress.patience = Math.max(0, progress.patience - patience);
    const line = spoken ?? character.lines[finding.check] ?? "";

    emit({
      type: "snag",
      scene: scene.id,
      funnel: scene.funnel,
      finding: finding satisfies Finding,
      title,
      line,
      coins,
      patience,
    });
    hud.say(line);
    hud.feed({
      kind: "snag",
      text: finding.label,
      detail: finding.measured,
      delta: `−${coins} coins`,
      selector: finding.selector,
    });
    stage.spillCoins(coins);
    sfx.play("snag");
    refresh();
    await clock.sleep(SNAG_PAUSE_MS);
    stage.setAnimation("idle");
    stage.releaseGhost(element);
  };

  const reportFixed = async (
    scene: Scene,
    element: Element,
    previous: PreviousSnag,
    title: string,
  ): Promise<void> => {
    await goTo(element);
    hud.highlight(element);
    stage.setAnimation("happy");
    const xp = passXp(previous.severity);
    progress.xp += xp;
    emit({
      type: "fixed",
      scene: scene.id,
      check: previous.check,
      selector: previous.selector,
      label: previous.label,
      coinsSaved: previous.coins,
      xp,
    });
    hud.say(character.onFixed);
    hud.feed({
      kind: "good",
      text: `Fixed: ${previous.label}`,
      detail: title,
      delta: `+${xp} XP`,
      selector: previous.selector,
    });
    stage.sparkle();
    stage.releaseGhost(element);
    sfx.play("pass");
    refresh();
    await clock.sleep(FIXED_PAUSE_MS);
    stage.setAnimation("idle");
  };

  /** Checks the page. Returns the description of an element this shopper cannot use at all, if there is one on their path. */
  const inspect = async (scene: Scene): Promise<string | null> => {
    await settle(200, 1500);
    applier.apply();
    let barrier: string | null = null;
    const results = await character.checks({
      pathElements: scene.path(character.shopper),
      seed: state.config.seed,
    });
    const titleOf = (check: string): string =>
      results.find((result) => result.check === check)?.title ?? check;

    const stops: Stop[] = [];
    const failing = new Set<string>();
    const cleanChecks: typeof results = [];
    for (const result of results) {
      if (result.findings.length === 0 && !result.skipped) cleanChecks.push(result);
      for (const located of result.findings) {
        const key = `${located.check}|${located.selector}`;
        failing.add(key);
        if (located.stops && located.onPath) {
          barrier ??= located.stopReason ?? `could not use the ${located.label}`;
        }
        // Furniture that repeats on every page (header, footer) is reported the first time only.
        if (progress.seen.includes(key)) continue;
        progress.seen.push(key);
        stops.push({ kind: "snag", element: located.element, located });
      }
    }

    // What the last trial found here: a ghost stands at each place, and
    // anything no longer failing counts as fixed.
    const before = state.previous.filter(
      (snag) => snag.character === character.id && snag.scene === scene.id,
    );
    const ghosts = new Set<Element>();
    for (const previous of before) {
      const element = find(previous.selector);
      if (!element) continue;
      ghosts.add(element);
      if (!failing.has(`${previous.check}|${previous.selector}`)) {
        stops.push({ kind: "fixed", element, previous });
      }
    }
    stage.setGhosts([...ghosts]);

    stops.sort((a, b) => documentTop(a.element) - documentTop(b.element));
    for (const stop of stops) {
      if (stop.kind === "snag") await reportSnag(scene, stop.located, titleOf(stop.located.check));
      else await reportFixed(scene, stop.element, stop.previous, titleOf(stop.previous.check));
    }
    hud.highlight(null);
    stage.setGhosts([]);

    for (const result of cleanChecks) {
      const xp = passXp(result.weight);
      progress.xp += xp;
      emit({ type: "pass", scene: scene.id, check: result.check, title: result.title, xp });
      hud.feed({ kind: "pass", text: result.title, delta: `+${xp} XP` });
      stage.sparkle();
      sfx.play("pass");
      refresh();
      await clock.sleep(PASS_PAUSE_MS);
    }
    return barrier;
  };

  const finish = (outcome: Outcome): void => {
    emit({
      type: "finish",
      outcome,
      coinsLeft: progress.coins,
      coinsLost: progress.purse - progress.coins,
      xp: progress.xp,
    });
  };

  const abandon = async (scene: string, reason: string): Promise<void> => {
    const coins = progress.coins;
    progress.coins = 0;
    emit({ type: "abandon", scene, reason, coins });
    hud.say(character.onAbandon);
    hud.feed({ kind: "bad", text: `Lost the sale: ${reason}`, delta: `−${coins} coins` });
    stage.setAnimation("worry");
    stage.spillCoins(coins);
    sfx.play("abandon");
    refresh();
    await clock.sleep(1800);
    finish("abandoned");
  };

  for (;;) {
    const scene = await clock.waitFor(
      () => journey.scenes.find((candidate) => candidate.match()),
      15000,
    );
    if (!scene) {
      await abandon(currentScene, "could not find the way forward");
      return;
    }
    currentScene = scene.id;
    let barrier: string | null = null;

    if (!progress.checked.includes(scene.id)) {
      emit({ type: "scene", scene: scene.id, path: window.location.pathname, title: scene.name });
      hud.feed({ kind: "info", text: `Arrives at: ${scene.name}` });
      barrier = await inspect(scene);
      progress.checked.push(scene.id);
      saveState(state);
    }

    if (scene.final) {
      progress.xp += PURCHASE_XP;
      emit({ type: "purchase", orderId: journey.orderId(), xp: PURCHASE_XP });
      hud.say(character.onPurchase);
      hud.feed({ kind: "good", text: "Purchase completed", delta: `+${PURCHASE_XP} XP` });
      stage.setAnimation("happy");
      stage.sparkle();
      sfx.play("purchase");
      refresh();
      await clock.sleep(1800);
      finish("purchased");
      return;
    }

    if (barrier) {
      await abandon(scene.id, barrier);
      return;
    }

    if (progress.patience <= 0) {
      await abandon(scene.id, `ran out of patience at "${scene.name}"`);
      return;
    }

    await scene.advance(actor);
    await settle();
  }
}
