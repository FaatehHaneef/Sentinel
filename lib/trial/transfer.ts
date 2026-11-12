import type { RunRecord } from "./types";

/**
 * Carries a trial record from an owner's site back to Sentinel in the
 * address's fragment, the part after "#", which browsers never send to a
 * server. A trial on another site keeps its record in that site's storage,
 * which Sentinel's pages cannot read; this hands it over without a database.
 */

export const RECORD_FRAGMENT = "record=";

/** Above this, a record is not accepted from an address. */
const MAX_ENCODED = 1_500_000;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function encodeRecord(record: RunRecord): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(record)));
}

/**
 * Reads a record from an address fragment. Returns null unless it is a
 * well-formed record for the expected trial. The record is data to display:
 * any fixes in it are reduced to the allowed list before they are ever used.
 */
export function decodeRecord(fragment: string, expectedRunId: string): RunRecord | null {
  const start = fragment.indexOf(RECORD_FRAGMENT);
  if (start < 0) return null;
  const encoded = fragment.slice(start + RECORD_FRAGMENT.length).split("&")[0];
  if (!encoded || encoded.length > MAX_ENCODED) return null;
  try {
    const record = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded))) as RunRecord;
    if (record?.config?.runId !== expectedRunId) return null;
    if (!Array.isArray(record.events) || typeof record.startedAt !== "string") return null;
    return record;
  } catch {
    return null;
  }
}
