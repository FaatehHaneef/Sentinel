import { describe, expect, it } from "vitest";
import { MemoryStore } from "@/lib/storage";

describe("in-memory store", () => {
  it("stores copies, not references", async () => {
    const store = new MemoryStore();
    const value = { items: [1] };
    await store.set("k", value);
    value.items.push(2);
    expect(await store.get("k")).toEqual({ items: [1] });
  });

  it("expires keys after their time to live", async () => {
    let now = 0;
    const store = new MemoryStore(() => now);
    await store.set("k", "v", 10);
    now = 9_999;
    expect(await store.get("k")).toBe("v");
    now = 10_000;
    expect(await store.get("k")).toBeNull();
  });

  it("sets a key only once with setIfAbsent", async () => {
    const store = new MemoryStore();
    expect(await store.setIfAbsent("event:1", true)).toBe(true);
    expect(await store.setIfAbsent("event:1", true)).toBe(false);
  });

  it("keeps lists in order and counts up", async () => {
    const store = new MemoryStore();
    await store.append("log", "a");
    expect(await store.append("log", "b")).toBe(2);
    expect(await store.list("log")).toEqual(["a", "b"]);
    expect(await store.increment("n")).toBe(1);
    expect(await store.increment("n", 4)).toBe(5);
  });
});
