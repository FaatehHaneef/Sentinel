import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

const answer = (status: number, value: unknown = { ok: true }) =>
  new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] }),
    { status },
  );

async function generate() {
  vi.resetModules();
  const { generateJson } = await import("@/lib/ai/gemini");
  return generateJson({
    system: "s",
    user: "u",
    schema: {},
    parse: (value) => (value && typeof value === "object" ? value : null),
  });
}

describe("Gemini when a model is busy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("tries the busy model once more with another key before moving on", async () => {
    vi.stubEnv("GEMINI_API_KEYS", "key-a,key-b,key-c");
    vi.stubEnv("GEMINI_MODELS", "model-one,model-two");
    const fetch = vi.fn().mockResolvedValueOnce(answer(503)).mockResolvedValueOnce(answer(200));
    vi.stubGlobal("fetch", fetch);

    const result = await generate();
    expect(result.model).toBe("model-one");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("moves to the next model after two busy answers, and at once for a retired model", async () => {
    vi.stubEnv("GEMINI_API_KEYS", "key-a,key-b,key-c");
    vi.stubEnv("GEMINI_MODELS", "model-one,model-two,model-three");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(answer(503))
      .mockResolvedValueOnce(answer(503))
      .mockResolvedValueOnce(answer(404))
      .mockResolvedValueOnce(answer(200));
    vi.stubGlobal("fetch", fetch);

    const result = await generate();
    expect(result.model).toBe("model-three");
    const models = fetch.mock.calls.map(([url]) => String(url).match(/models\/([^:]+)/)?.[1]);
    expect(models).toEqual(["model-one", "model-one", "model-two", "model-three"]);
  });
});
