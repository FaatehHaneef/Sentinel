"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CAST, type Character, type CharacterId } from "@/lib/cast";
import { writeStoreFixes } from "@/lib/store/variants";
import { Sprite } from "./Sprite";
import { UseCases } from "./UseCases";

type Stage = "circle" | "walking" | "line";

const ACCENT_TEXT: Record<Character["accent"], string> = {
  amber: "text-amber",
  ember: "text-ember",
  moss: "text-moss",
  mist: "text-mist",
  rose: "text-rose",
  parchment: "text-parchment",
};

/** Width and height of one character on screen, at its largest. */
const SPRITE_SCALE = 5;
const FIGURE_WIDTH = 16 * SPRITE_SCALE;
const FIGURE_HEIGHT = 24 * SPRITE_SCALE;
/** Width given to each character in the line, including its name and tick box. */
const SLOT_WIDTH = 150;
const SLOT_HEIGHT = 290;
const WALK_MS = 1300;
const TURN_SPEED = 0.12; // radians per second

type Layout = { width: number; height: number; columns: number };

/** Where each character stands in the line: in one row, or wrapped onto several on narrow screens. */
function linePosition(index: number, layout: Layout): { x: number; y: number } {
  const columns = layout.columns;
  const rows = Math.ceil(CAST.length / columns);
  const row = Math.floor(index / columns);
  const inRow = row === rows - 1 ? CAST.length - row * columns : columns;
  const column = index - row * columns;
  const span = Math.min(layout.width, columns * SLOT_WIDTH);
  const slot = span / columns;
  const start = (layout.width - inRow * slot) / 2;
  return { x: start + slot * column + slot / 2, y: 40 + row * SLOT_HEIGHT + FIGURE_HEIGHT };
}

/** Where each character stands in the circle, seen at an angle. Depth runs from 0 (back) to 1 (front). */
function circlePosition(index: number, turn: number, layout: Layout) {
  const angle = turn + (index / CAST.length) * Math.PI * 2;
  const radiusX = Math.min(layout.width * 0.38, 360);
  const radiusY = Math.min(radiusX * 0.22, 80);
  const depth = (Math.sin(angle) + 1) / 2;
  return {
    x: layout.width / 2 + Math.cos(angle) * radiusX,
    y: 70 + radiusY + FIGURE_HEIGHT + Math.sin(angle) * radiusY,
    depth,
  };
}

/** Starts a trial on the demo store with the chosen shoppers. */
async function startTrial(party: CharacterId[]): Promise<string> {
  const response = await fetch("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ party }),
  });
  const data = (await response.json()) as { startUrl?: string; error?: string };
  if (!response.ok || !data.startUrl) throw new Error(data.error ?? "The trial could not start.");
  return data.startUrl;
}

/**
 * The game lobby. The seven shoppers stand in a slowly turning circle, each
 * fidgeting. "Start your trial" walks them into a line, where each stands in
 * the open with a name, a line about who they are, and a tick box.
 */
export function GameLobby({ start = "circle" }: { start?: "circle" | "line" }) {
  const [stage, setStage] = useState<Stage>(start);
  const [layout, setLayout] = useState<Layout>({ width: 1100, height: 420, columns: 7 });
  const [party, setParty] = useState<CharacterId[]>(["iris"]);
  const [focus, setFocus] = useState<CharacterId>("iris");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [showCases, setShowCases] = useState(false);

  const field = useRef<HTMLDivElement>(null);
  const figures = useRef<(HTMLDivElement | null)[]>([]);
  const turn = useRef(0);
  const reduced = useRef(false);

  // Measure the space available, and choose how many characters fit in a row.
  useLayoutEffect(() => {
    const element = field.current;
    if (!element) return;
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const measure = () => {
      const width = element.clientWidth;
      const columns = width >= 7 * SLOT_WIDTH ? 7 : width >= 4 * SLOT_WIDTH ? 4 : 2;
      setLayout({ width, height: 0, columns });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // In the circle, the characters turn slowly. Their positions are written straight to the page each frame.
  useEffect(() => {
    if (stage !== "circle") return;
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      if (!reduced.current) turn.current += ((now - last) / 1000) * TURN_SPEED;
      last = now;
      CAST.forEach((_, index) => {
        const element = figures.current[index];
        if (!element) return;
        const spot = circlePosition(index, turn.current, layout);
        const scale = 0.68 + spot.depth * 0.32;
        element.style.transition = "none";
        element.style.transform = `translate(${spot.x - FIGURE_WIDTH / 2}px, ${spot.y - FIGURE_HEIGHT}px) scale(${scale})`;
        element.style.zIndex = String(Math.round(spot.depth * 100));
        element.style.filter = `brightness(${0.7 + spot.depth * 0.3})`;
      });
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [stage, layout]);

  // In the line, each character goes to its place, gliding there when the walk starts.
  useEffect(() => {
    if (stage === "circle") return;
    CAST.forEach((character, index) => {
      const element = figures.current[index];
      if (!element) return;
      const spot = linePosition(index, layout);
      const chosen = party.includes(character.id);
      const delay = stage === "walking" ? index * 70 : 0;
      element.style.transition = reduced.current
        ? "none"
        : `transform ${stage === "walking" ? WALK_MS : 200}ms cubic-bezier(.45,.05,.3,1) ${delay}ms, filter 200ms`;
      element.style.transform = `translate(${spot.x - FIGURE_WIDTH / 2}px, ${spot.y - FIGURE_HEIGHT - (chosen ? 10 : 0)}px) scale(1)`;
      element.style.zIndex = "10";
      element.style.filter = chosen
        ? "drop-shadow(0 0 10px rgba(255,179,71,.75))"
        : "brightness(.72) saturate(.8)";
    });
  }, [stage, layout, party]);

  const walkIntoLine = useCallback(() => {
    setStage("walking");
    window.setTimeout(() => setStage("line"), reduced.current ? 0 : WALK_MS + CAST.length * 70);
  }, []);

  function toggle(id: CharacterId) {
    setFocus(id);
    setParty((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  }

  async function beginTrial() {
    setStarting(true);
    setError("");
    try {
      const ordered = CAST.map((character) => character.id).filter((id) => party.includes(id));
      // A new trial always meets the demo store as it is, with no store fixes switched on.
      writeStoreFixes(window.localStorage, []);
      window.location.assign(await startTrial(ordered));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The trial could not start.");
      setStarting(false);
    }
  }

  const rows = Math.ceil(CAST.length / layout.columns);
  const fieldHeight =
    stage === "circle" ? 70 + FIGURE_HEIGHT + 2 * 80 + 40 : 40 + rows * SLOT_HEIGHT;
  const focused = CAST.find((character) => character.id === focus) ?? CAST[0];

  return (
    <div>
      {stage !== "circle" ? (
        <>
          <nav className="mb-6 flex flex-wrap gap-3" aria-label="Lobby">
            {start === "circle" ? (
              <button
                type="button"
                className="pixel-button quiet"
                onClick={() => setStage("circle")}
              >
                Back to the road
              </button>
            ) : (
              <Link href="/" className="pixel-button quiet">
                Back to the road
              </Link>
            )}
            <button
              type="button"
              className="pixel-button quiet"
              aria-expanded={showCases}
              onClick={() => setShowCases((open) => !open)}
            >
              Who it&apos;s for
            </button>
            <Link href="/ledger" className="pixel-button quiet">
              The ledger
            </Link>
            <Link href="/sites" className="pixel-button quiet">
              Try it on your own site
            </Link>
          </nav>
          {showCases ? <UseCases /> : null}
        </>
      ) : null}
      <div
        ref={field}
        className="relative w-full transition-[height] duration-700"
        style={{ height: fieldHeight }}
      >
        {/* The ground the circle stands on. */}
        {stage === "circle" ? (
          <div
            aria-hidden="true"
            className="absolute left-1/2 -translate-x-1/2 rounded-[50%] bg-night/70"
            style={{
              top: 70 + FIGURE_HEIGHT - 10,
              width: Math.min(layout.width * 0.86, 820),
              height: 2 * Math.min(Math.min(layout.width * 0.38, 360) * 0.22, 80) + 40,
              boxShadow: "0 0 60px 10px rgba(255,179,71,.12) inset",
            }}
          />
        ) : null}

        {CAST.map((character, index) => (
          <div
            key={character.id}
            ref={(element) => {
              figures.current[index] = element;
            }}
            className="absolute left-0 top-0"
            style={{ width: FIGURE_WIDTH, height: FIGURE_HEIGHT, transformOrigin: "50% 100%" }}
          >
            <Sprite
              id={character.id}
              scale={SPRITE_SCALE}
              mood={stage === "walking" ? "walk" : "idle"}
            />
            <span
              aria-hidden="true"
              className="absolute -bottom-1 left-1/2 h-3 w-16 -translate-x-1/2 rounded-[50%] bg-night/60"
              style={{ zIndex: -1 }}
            />
          </div>
        ))}

        {/* Names and tick boxes, under each character in the line. */}
        {stage === "line"
          ? CAST.map((character, index) => {
              const spot = linePosition(index, layout);
              const chosen = party.includes(character.id);
              return (
                <label
                  key={character.id}
                  className="absolute flex cursor-pointer flex-col items-center gap-1 text-center"
                  style={{
                    left: spot.x - SLOT_WIDTH / 2 + 6,
                    top: spot.y + 14,
                    width: SLOT_WIDTH - 12,
                  }}
                  onMouseEnter={() => setFocus(character.id)}
                >
                  <span
                    className={`font-display text-lg font-bold ${ACCENT_TEXT[character.accent]}`}
                  >
                    {character.name}
                  </span>
                  <span className="min-h-[2.6em] text-sm leading-snug text-parchment">
                    {character.represents}
                  </span>
                  <span className="mt-2 flex items-center gap-2 font-bold text-parchment">
                    <input
                      type="checkbox"
                      className="round-check"
                      checked={chosen}
                      onChange={() => toggle(character.id)}
                      onFocus={() => setFocus(character.id)}
                    />
                    {chosen ? "Going" : "Send"}
                  </span>
                </label>
              );
            })
          : null}
      </div>

      {stage === "circle" ? (
        <div className="relative z-[200] mt-2 flex flex-col items-center gap-4 text-center">
          <button type="button" onClick={walkIntoLine} className="pixel-button text-2xl">
            Start your trial
          </button>
          <p className="max-w-xl text-mist">
            Seven kinds of customer, waiting to walk through a store. Choose who goes.
          </p>
        </div>
      ) : null}

      {stage === "line" ? (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_auto]">
          <section className="pixel-panel" aria-live="polite" aria-label={`About ${focused.name}`}>
            <p className={`font-display text-2xl font-bold ${ACCENT_TEXT[focused.accent]}`}>
              {focused.name}
            </p>
            <p className="mt-1 italic text-mist">&ldquo;{focused.motto}&rdquo;</p>
            <p className="font-display mt-4 text-sm uppercase tracking-widest text-mist">
              What {focused.name.split(" ").pop()} checks
            </p>
            <ul className="mt-2 grid gap-x-6 gap-y-1 text-parchment sm:grid-cols-2">
              {focused.checks.map((check) => (
                <li key={check}>
                  <span className="text-amber" aria-hidden="true">
                    ▸{" "}
                  </span>
                  {check}
                </li>
              ))}
            </ul>
          </section>

          <section className="pixel-panel lit flex flex-col justify-between gap-4 lg:w-80">
            <div>
              <p className="font-display text-sm uppercase tracking-widest text-amber">Party</p>
              <p className="font-display text-3xl font-bold text-parchment">
                <span className="font-sans">{party.length}</span> /{" "}
                <span className="font-sans">{CAST.length}</span>
              </p>
              <p className="mt-1 text-mist">
                {party.length === 0
                  ? "Choose at least one shopper."
                  : "They will walk through Tallowmere, our demo store."}
              </p>
            </div>
            <button
              type="button"
              onClick={beginTrial}
              disabled={party.length === 0 || starting}
              className="pixel-button text-xl"
            >
              {starting ? "Opening the road…" : "Start the trial"}
            </button>
            <div className="flex flex-wrap gap-2 text-sm">
              <button
                type="button"
                className="pixel-button quiet"
                onClick={() => setParty(CAST.map((c) => c.id))}
              >
                Send everyone
              </button>
              <button type="button" className="pixel-button quiet" onClick={() => setParty([])}>
                Clear
              </button>
            </div>
            <p role="alert" className="font-bold text-rose">
              {error}
            </p>
          </section>
        </div>
      ) : null}
    </div>
  );
}
