import {
  FIXES_STORAGE_KEY,
  RUN_STORAGE_PREFIX,
  type AppliedFix,
  type PendingFixes,
  type RunConfig,
  type RunRecord,
  type Severity,
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

/** A snag from the previous trial, kept so this trial can tell what has been fixed. */
export type PreviousSnag = {
  character: string;
  scene: string;
  check: string;
  selector: string;
  label: string;
  severity: Severity;
  coins: number;
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
  /** Fixes being tried in this run. Unchecked data: the applier reduces it to what is allowed. */
  fixes: AppliedFix[];
  /** Snags found by the trial this one follows. */
  previous: PreviousSnag[];
};

function readJson<T>(storage: Storage, key: string): T | null {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function newState(config: RunConfig): EngineState {
  const state: EngineState = {
    config,
    startedAt: Date.now(),
    index: 0,
    progress: null,
    events: [],
    finished: false,
    fixes: [],
    previous: [],
  };
  if (!config.previousRunId) return state;

  // A re-run: pick up the fixes chosen on the results page and what the last trial found.
  const pending = readJson<PendingFixes>(window.localStorage, FIXES_STORAGE_KEY);
  if (pending?.fromRun === config.previousRunId && Array.isArray(pending.fixes)) {
    state.fixes = pending.fixes;
  }
  const before = readJson<RunRecord>(
    window.localStorage,
    RUN_STORAGE_PREFIX + config.previousRunId,
  );
  for (const event of before?.events ?? []) {
    if (event.type !== "snag") continue;
    state.previous.push({
      character: event.character,
      scene: event.scene,
      check: event.finding.check,
      selector: event.finding.selector,
      label: event.finding.label,
      severity: event.finding.severity,
      coins: event.coins,
    });
  }
  return state;
}

export function loadState(): EngineState | null {
  const state = readJson<EngineState>(window.sessionStorage, STATE_KEY);
  if (!state) return null;
  if (state.finished || Date.now() - state.startedAt > MAX_AGE_MS) {
    clearState();
    return null;
  }
  // A run only ever continues on the origin it was issued for.
  if (state.config.origin !== window.location.origin) return null;
  return state;
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
export function saveRecord(state: EngineState, finished: boolean, fixes: AppliedFix[]): RunRecord {
  const record: RunRecord = {
    config: state.config,
    startedAt: new Date(state.startedAt).toISOString(),
    finishedAt: finished ? new Date().toISOString() : undefined,
    events: state.events,
    fixes: fixes.length > 0 ? fixes : undefined,
  };
  try {
    window.localStorage.setItem(RUN_STORAGE_PREFIX + state.config.runId, JSON.stringify(record));
    window.localStorage.setItem(`${RUN_STORAGE_PREFIX}latest`, state.config.runId);
  } catch {
    // The results page will say it has no record.
  }
  return record;
}
