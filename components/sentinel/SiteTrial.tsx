"use client";

import { useState, useSyncExternalStore } from "react";
import { CAST, type CharacterId } from "@/lib/cast";

type Site = { origin: string; siteKey: string; snippet: string };

const SAVED_KEY = "sentinel:site";

const noSubscription = () => () => {};

function readSaved(): string | null {
  try {
    return window.localStorage.getItem(SAVED_KEY);
  } catch {
    return null;
  }
}

function parseSite(raw: string | null): Site | null {
  try {
    return raw ? (JSON.parse(raw) as Site) : null;
  } catch {
    return null;
  }
}

/**
 * Registers an owner's site, shows the line to paste into it, and starts a
 * trial there. The trial only runs once that line is on the site.
 */
export function SiteTrial() {
  const [address, setAddress] = useState("");
  // The site registered last time in this browser, until a new one is registered.
  const saved = parseSite(useSyncExternalStore(noSubscription, readSaved, () => null));
  const [registered, setSite] = useState<Site | null>(null);
  const site = registered ?? saved;
  const [party, setParty] = useState<CharacterId[]>(["iris", "echo"]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function register(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = (await response.json()) as Site & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "That address could not be used.");
      setSite(data);
      try {
        window.localStorage.setItem(SAVED_KEY, JSON.stringify(data));
      } catch {
        // Remembering the site is only a convenience.
      }
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "That address could not be used.");
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    if (!site) return;
    setError("");
    setBusy(true);
    try {
      const ordered = CAST.map((character) => character.id).filter((id) => party.includes(id));
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ party: ordered, siteKey: site.siteKey }),
      });
      const data = (await response.json()) as { startUrl?: string; error?: string };
      if (!response.ok || !data.startUrl)
        throw new Error(data.error ?? "The trial could not start.");
      window.location.assign(data.startUrl);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The trial could not start.");
      setBusy(false);
    }
  }

  const field =
    "mt-1 w-full rounded border-2 border-slate bg-night px-3 py-2 text-lg text-parchment";

  return (
    <div className="space-y-8">
      <form onSubmit={register} className="pixel-panel">
        <h2 className="font-display text-2xl font-bold text-parchment">1. Your site</h2>
        <label className="mt-4 block text-parchment">
          Your site&apos;s address
          <input
            className={field}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="https://shop.example"
            inputMode="url"
            autoComplete="url"
            required
          />
        </label>
        <button type="submit" disabled={busy} className="pixel-button mt-4">
          Get my line of code
        </button>
      </form>

      {site ? (
        <section className="pixel-panel">
          <h2 className="font-display text-2xl font-bold text-parchment">2. Paste this into it</h2>
          <p className="mt-2 text-mist">
            Add this line to every page of <strong className="text-parchment">{site.origin}</strong>
            , just before the closing <code>&lt;/body&gt;</code> tag. For ordinary visitors it does
            nothing: no requests, no storage, no changes to the page.
          </p>
          <pre className="mt-3 overflow-x-auto rounded bg-night p-3 text-sm text-parchment">
            <code>{site.snippet}</code>
          </pre>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(site.snippet);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
            className="pixel-button quiet mt-3"
          >
            {copied ? "Copied" : "Copy the line"}
          </button>
        </section>
      ) : null}

      {site ? (
        <section className="pixel-panel">
          <h2 className="font-display text-2xl font-bold text-parchment">3. Send your shoppers</h2>
          <p className="mt-2 text-mist">
            On your own site the shoppers only look: they check the page they land on, react, and
            report. They never click, type, submit or pay.
          </p>
          <fieldset className="mt-4">
            <legend className="text-parchment">Shoppers</legend>
            <div className="mt-2 flex flex-wrap gap-4">
              {CAST.map((character) => (
                <label key={character.id} className="flex items-center gap-2 text-parchment">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-amber"
                    checked={party.includes(character.id)}
                    onChange={() =>
                      setParty((current) =>
                        current.includes(character.id)
                          ? current.filter((id) => id !== character.id)
                          : [...current, character.id],
                      )
                    }
                  />
                  {character.name}
                </label>
              ))}
            </div>
          </fieldset>
          <button
            type="button"
            onClick={start}
            disabled={busy || party.length === 0}
            className="pixel-button mt-5 text-lg"
          >
            Open my site and start the trial
          </button>
        </section>
      ) : null}

      <p role="alert" className="font-bold text-rose">
        {error}
      </p>
    </div>
  );
}
