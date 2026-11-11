import {
  RUN_STORAGE_PREFIX,
  type RunConfig,
  type RunRecord,
  type TrialEvent,
} from "@/lib/trial/types";

/**
 * A run's state, kept in the tab's session storage so the trial carries on
 * when the page reloads or the shopper moves to another page.
 */

const STATE_KEY = "sentinel:state";
export const TOKEN_KEY = "sentinel:token";
const MAX_AGE_MS = 30 * 60 * 1000;

export type CharacterProgress = {
  /** Coins the character set out with. */
  purse: number;
  coins: number;
  patience: number;
  xp: number;
  /** Scenes already inspected. */
  checked: string[];
  /** Check-and-element pairs already reported, so shared page furniture is reported once. */
  seen: string[];
  greeted: boolean;
};

export type EngineState = {
  config: RunConfig;
  /** When the run started, as a timestamp. */
  startedAt: number;
  /** Index into the party of the character now walking. */
  index: number;
  progress: CharacterProgress | null;
  events: TrialEvent[];
  finished: boolean;
};

export function newState(config: RunConfig): EngineState {
  return { config, startedAt: Date.now(), index: 0, progress: null, events: [], finished: false };
}

export function loadState(): EngineState | null {
  try {
    const raw = window.sessionStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as EngineState;
    if (state.finished || Date.now() - state.startedAt > MAX_AGE_MS) {
      clearState();
      return null;
    }
    // A run only ever continues on the origin it was issued for.
    if (state.config.origin !== window.location.origin) return null;
    return state;
  } catch {
    return null;
  }
}

export function saveState(state: EngineState): void {
  try {
    window.sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // Without storage the run still works on this page; it just cannot survive a reload.
  }
}

export function clearState(): void {
  try {
    window.sessionStorage.removeItem(STATE_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** Saves the run where the results page can read it. */
export function saveRecord(state: EngineState, finished: boolean): void {
  const record: RunRecord = {
    config: state.config,
    startedAt: new Date(state.startedAt).toISOString(),
    finishedAt: finished ? new Date().toISOString() : undefined,
    events: state.events,
  };
  try {
    window.localStorage.setItem(RUN_STORAGE_PREFIX + state.config.runId, JSON.stringify(record));
    window.localStorage.setItem(`${RUN_STORAGE_PREFIX}latest`, state.config.runId);
  } catch {
    // The results page will say it has no record.
  }
}
