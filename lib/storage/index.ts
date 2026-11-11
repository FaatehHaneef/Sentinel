/**
 * A small key-value interface so the app can run with no database at all
 * (in memory, for local use and tests) or with a hosted store in production.
 */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | null>;
  /** ttlSeconds, when given, expires the key after that many seconds. */
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  /** Sets the key only if it does not exist. Returns true if it was set. */
  setIfAbsent<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean>;
  delete(key: string): Promise<void>;
  /** Appends to an ordered list and returns its new length. */
  append<T>(key: string, value: T): Promise<number>;
  list<T>(key: string): Promise<T[]>;
  /** Adds to a counter and returns the new value. */
  increment(key: string, by?: number, ttlSeconds?: number): Promise<number>;
}

export { MemoryStore } from "./memory";
