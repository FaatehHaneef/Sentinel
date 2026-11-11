import type { KeyValueStore } from "./index";

type Entry = { value: unknown; expiresAt?: number };

/** In-memory store for local runs and tests. Data is lost when the process ends. */
export class MemoryStore implements KeyValueStore {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly now: () => number = Date.now) {}

  private read(key: string): Entry | undefined {
    const entry = this.entries.get(key);
    if (entry?.expiresAt !== undefined && entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }

  private expiry(ttlSeconds?: number): number | undefined {
    return ttlSeconds === undefined ? undefined : this.now() + ttlSeconds * 1000;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.read(key);
    return entry ? (structuredClone(entry.value) as T) : null;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    this.entries.set(key, { value: structuredClone(value), expiresAt: this.expiry(ttlSeconds) });
  }

  async setIfAbsent<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    if (this.read(key)) return false;
    await this.set(key, value, ttlSeconds);
    return true;
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async append<T>(key: string, value: T): Promise<number> {
    const entry = this.read(key);
    const items = Array.isArray(entry?.value) ? (entry.value as unknown[]) : [];
    items.push(structuredClone(value));
    this.entries.set(key, { value: items, expiresAt: entry?.expiresAt });
    return items.length;
  }

  async list<T>(key: string): Promise<T[]> {
    const entry = this.read(key);
    return Array.isArray(entry?.value) ? (structuredClone(entry.value) as T[]) : [];
  }

  async increment(key: string, by = 1, ttlSeconds?: number): Promise<number> {
    const entry = this.read(key);
    const next = (typeof entry?.value === "number" ? entry.value : 0) + by;
    this.entries.set(key, { value: next, expiresAt: entry?.expiresAt ?? this.expiry(ttlSeconds) });
    return next;
  }
}
