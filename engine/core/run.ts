import { getCharacter, type CharacterId } from "@/lib/cast";
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
import type { EngineCharacter } from "../cast/types";
import type { Located } from "../checks/types";
import { Hud } from "../hud/hud";
import { SPRITE_SCALE } from "../hud/stage";
import type { Actor, Journey, Scene } from "../journeys/types";
import { Clock, StopSignal } from "./clock";
import { documentTop, setInputValue, settle } from "./dom";
import {
  clearState,
  saveRecord,
  saveState,
  type CharacterProgress,
  type EngineState,
} from "./state";

const CHARACTERS: Partial<Record<CharacterId, EngineCharacter>> = { iris };

/** How long the character lingers on a snag, in trial time. */
const SNAG_PAUSE_MS = 1500;
const PASS_PAUSE_MS = 450;
const TYPING_MS = 55;

/** Distinct event bodies, without the fields the run adds. */
type EventInput = TrialEvent extends infer E
  ? E extends TrialEvent
    ? Omit<E, "t" | "character">
    : never
  : never;

export async function runTrial(
  state: EngineState,
  journey: Journey,
  apiBase: string,
): Promise<void> {
  const clock = new Clock(state.config.pace);
  const sfx = new Sfx();
  const hud = new Hud(clock, sfx, () => clock.stop());

  try {
    while (state.index < state.config.party.length) {
      const id = state.config.party[state.index];
      const character = CHARACTERS[id];
      if (!character) {
        state.index += 1;
        continue;
      }
      await walk(state, character, journey, hud, sfx, clock);
      state.index += 1;
      state.progress = null;
      saveState(state);
      saveRecord(state, false);
      if (state.index < state.config.party.length) {
        // The next shopper starts from the beginning with an empty cart.
        journey.prepare();
        window.location.assign(journey.startPath);
        return;
      }
    }
    finishRun(state, hud, apiBase, "Trial complete");
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
    finishRun(state, hud, apiBase, "Trial ended early");
  }
}

function finishRun(state: EngineState, hud: Hud, apiBase: string, title: string): void {
  state.finished = true;
  saveRecord(state, true);
  clearState();
  const snags = state.events.filter((event) => event.type === "snag").length;
  const purchases = state.events.filter((event) => event.type === "purchase").length;
  const shoppers = state.config.party.length;
  hud.showSummary(
    title,
    `${purchases} of ${shoppers} ${shoppers === 1 ? "shopper" : "shoppers"} completed a purchase. ` +
      `${snags} ${snags === 1 ? "snag" : "snags"} found.`,
    { href: `${apiBase}/runs/${state.config.runId}`, label: "See the full results" },
  );
}

async function walk(
  state: EngineState,
  character: EngineCharacter,
  journey: Journey,
  hud: Hud,
  sfx: Sfx,
  clock: Clock,
): Promise<void> {
  const meta = getCharacter(character.id);
  const stage = hud.stage;
  stage.setSprite(buildSprite(character.frames, character.palette));
  hud.setCharacter(meta, character.lensLabel);

  if (!state.progress) {
    journey.prepare();
    const purse = purseFor(journey.cartCents);
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
    const maxX = window.innerWidth - hud.reservedRight - half - 8;
    const x = Math.max(half + 8, Math.min(rect.left - half - 10, maxX));
    const y = Math.max(24 * SPRITE_SCALE + 8, Math.min(rect.bottom + 6, window.innerHeight - 12));
    return { x, y };
  };

  const goTo = async (element: Element): Promise<void> => {
    await clock.whenRunning();
    element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const spot = spotFor(element);
    await stage.walkTo(spot.x, spot.y);
    await clock.whenRunning();
  };

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

  let currentScene = "start";
  refresh();
  stage.enterFromLeft(Math.min(window.innerHeight - 40, 260));
  if (!progress.greeted) {
    progress.greeted = true;
    hud.say(character.greeting);
    await stage.walkTo(60, Math.min(window.innerHeight - 40, 260));
    await clock.sleep(900);
  }

  const inspect = async (scene: Scene): Promise<void> => {
    await settle(200, 1500);
    const results = character.checks({ pathElements: scene.path() });

    // Furniture that repeats on every page (header, footer) is reported the first time only.
    const fresh: Located[] = [];
    const cleanChecks: typeof results = [];
    for (const result of results) {
      if (result.findings.length === 0) cleanChecks.push(result);
      for (const finding of result.findings) {
        const key = `${finding.check}|${finding.selector}`;
        if (progress.seen.includes(key)) continue;
        progress.seen.push(key);
        fresh.push(finding);
      }
    }
    fresh.sort((a, b) => documentTop(a.element) - documentTop(b.element));

    for (const located of fresh) {
      const { element, ...finding } = located;
      const result = results.find((entry) => entry.check === finding.check);
      if (element.isConnected) {
        await goTo(element);
        hud.highlight(element, true);
      }
      stage.setAnimation(character.reactions[finding.check] ?? "squint");

      const coins = coinCost(progress.purse, progress.coins, finding, scene.funnel);
      const patience = patienceCost(finding);
      progress.coins -= coins;
      progress.patience = Math.max(0, progress.patience - patience);
      const line = character.lines[finding.check] ?? "";

      emit({
        type: "snag",
        scene: scene.id,
        finding: finding satisfies Finding,
        title: result?.title ?? finding.check,
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
    }
    hud.highlight(null);

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
    stage.setAnimation("squint");
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

    if (!progress.checked.includes(scene.id)) {
      emit({ type: "scene", scene: scene.id, path: window.location.pathname, title: scene.name });
      hud.feed({ kind: "info", text: `Arrives at: ${scene.name}` });
      await inspect(scene);
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

    if (progress.patience <= 0) {
      await abandon(scene.id, `ran out of patience at "${scene.name}"`);
      return;
    }

    await scene.advance(actor);
    await settle();
  }
}
