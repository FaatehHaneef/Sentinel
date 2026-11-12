import "server-only";
import { collectAiKeys } from "@/lib/env";

/**
 * A small client for the Gemini API that asks for JSON in a fixed shape.
 *
 * It expects trouble: a model may be overloaded and a key may have no quota,
 * so it works through the configured models and keys in turn, remembers which
 * keys were refused, and gives up cleanly when nothing answers in time. The
 * caller always has a non-AI answer to fall back on.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"];
const REQUEST_TIMEOUT_MS = 14_000;
const TOTAL_TIMEOUT_MS = 40_000;
const KEY_REST_MS = 10 * 60 * 1000;

export class AiUnavailableError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "AiUnavailableError";
  }
}

/** Keys that were refused recently, and when they may be tried again. */
const resting = new Map<string, number>();
let lastGoodKey: string | null = null;

function orderedKeys(now: number): string[] {
  const usable = collectAiKeys(process.env).filter((key) => (resting.get(key) ?? 0) <= now);
  if (lastGoodKey && usable.includes(lastGoodKey)) {
    return [lastGoodKey, ...usable.filter((key) => key !== lastGoodKey)];
  }
  return usable;
}

function models(): string[] {
  const configured = (process.env.GEMINI_MODELS ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  return configured.length > 0 ? configured : DEFAULT_MODELS;
}

type GenerateOptions<T> = {
  system: string;
  user: string;
  /** Response schema in the Gemini API's format. */
  schema: object;
  /** Turns the model's JSON into a trusted value, or returns null to reject it. */
  parse: (value: unknown) => T | null;
  maxOutputTokens?: number;
};

export async function generateJson<T>(
  options: GenerateOptions<T>,
): Promise<{ value: T; model: string }> {
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  let lastProblem = "No AI key is configured.";

  for (const model of models()) {
    let overloaded = 0;
    for (const key of orderedKeys(Date.now())) {
      const remaining = deadline - Date.now();
      if (remaining < 2_000) throw new AiUnavailableError("AI did not answer in time.");

      let response: Response;
      try {
        response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
          method: "POST",
          headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
          signal: AbortSignal.timeout(Math.min(REQUEST_TIMEOUT_MS, remaining)),
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: options.system }] },
            contents: [{ role: "user", parts: [{ text: options.user }] }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: options.schema,
              maxOutputTokens: options.maxOutputTokens ?? 4000,
              temperature: 0.6,
            },
          }),
        });
      } catch {
        lastProblem = `${model} did not answer in time.`;
        break; // Slow model: move on to the next model.
      }

      if (response.status === 429 || response.status === 401 || response.status === 403) {
        // This key has no quota or was refused. Rest it and try the next key.
        resting.set(key, Date.now() + KEY_REST_MS);
        lastProblem = `A key was refused with status ${response.status}.`;
        continue;
      }
      if (!response.ok) {
        lastProblem = `${model} answered with status ${response.status}.`;
        // A busy model often answers the next request: give it one more try
        // before moving on. A retired model (404) will not, so move on at once.
        if (response.status >= 500 && ++overloaded < 2) continue;
        break;
      }

      try {
        const body = (await response.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("");
        const value = options.parse(JSON.parse(text ?? ""));
        if (value !== null) {
          lastGoodKey = key;
          return { value, model };
        }
        lastProblem = `${model} answered in the wrong shape.`;
      } catch {
        lastProblem = `${model} answered with something unreadable.`;
      }
      break; // A bad answer will not improve with another key: try the next model.
    }
  }
  throw new AiUnavailableError(lastProblem);
}
