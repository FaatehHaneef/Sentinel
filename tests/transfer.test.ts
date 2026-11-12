import { describe, expect, it } from "vitest";
import { decodeRecord, encodeRecord, RECORD_FRAGMENT } from "@/lib/trial/transfer";
import type { RunRecord } from "@/lib/trial/types";

const record: RunRecord = {
  config: {
    runId: "11111111-2222-4333-8444-555555555555",
    party: ["iris"],
    seed: 1,
    pace: "fast",
    origin: "https://shop.example",
    kind: "verified",
  },
  startedAt: "2026-11-12T10:00:00.000Z",
  events: [
    {
      t: 1,
      character: "iris",
      type: "scene",
      scene: "page",
      path: "/",
      title: "Café ☕ — the page",
    },
  ],
};

describe("record transfer", () => {
  it("round-trips a record through an address fragment, including non-ASCII text", () => {
    const fragment = `#${RECORD_FRAGMENT}${encodeRecord(record)}`;
    expect(fragment).toMatch(/^#record=[A-Za-z0-9_-]+$/);
    expect(decodeRecord(fragment, record.config.runId)).toEqual(record);
  });

  it("refuses a record for a different trial, or anything malformed", () => {
    const fragment = `#${RECORD_FRAGMENT}${encodeRecord(record)}`;
    expect(decodeRecord(fragment, "another-run")).toBeNull();
    expect(decodeRecord("#record=not-base64-json", record.config.runId)).toBeNull();
    expect(decodeRecord("#something=else", record.config.runId)).toBeNull();
  });
});
