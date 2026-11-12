import type { RunConfig } from "@/lib/trial/types";
import { runTrial } from "./core/run";
import { loadState, newState, saveState, TOKEN_KEY, type EngineState } from "./core/state";
import { observeJourney } from "./journeys/observe";
import { tallowmere } from "./journeys/tallowmere";

/**
 * Entry point of the engine. The loader fetches this file only when a trial
 * was launched for this page. Nothing happens unless the Sentinel server
 * confirms the launch token for this exact origin.
 */

type Boot = { apiBase: string; siteKey: string };

declare global {
  interface Window {
    __sentinelBoot?: Boot;
    __sentinelRunning?: boolean;
  }
}

async function handshake(apiBase: string, token: string): Promise<RunConfig | null> {
  try {
    const response = await fetch(`${apiBase}/api/runs/handshake`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) return null;
    const { config } = (await response.json()) as { config: RunConfig };
    return config.origin === window.location.origin ? config : null;
  } catch {
    return null;
  }
}

function takeToken(): string | null {
  try {
    const token = window.sessionStorage.getItem(TOKEN_KEY);
    window.sessionStorage.removeItem(TOKEN_KEY);
    return token;
  } catch {
    return null;
  }
}

async function start(boot: Boot): Promise<void> {
  if (window.__sentinelRunning || window.top !== window.self) return;
  window.__sentinelRunning = true;

  let state: EngineState | null = null;
  const token = takeToken();
  if (token) {
    const config = await handshake(boot.apiBase, token);
    if (config) {
      state = newState(config);
      saveState(state);
    }
  } else {
    state = loadState();
  }
  if (!state) {
    window.__sentinelRunning = false;
    return;
  }

  try {
    // Only Sentinel's own demo store is walked and bought from. Anywhere else, shoppers only observe.
    const journey = state.config.kind === "own" ? tallowmere : observeJourney();
    await runTrial(state, journey, boot.apiBase);
  } finally {
    window.__sentinelRunning = false;
  }
}

if (window.__sentinelBoot) void start(window.__sentinelBoot);
