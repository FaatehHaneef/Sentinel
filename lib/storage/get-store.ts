import { MemoryStore, type KeyValueStore } from "./index";

const holder = globalThis as typeof globalThis & { __sentinelStore?: KeyValueStore };

/**
 * The app's store. In memory for now: data lives for the life of one server
 * instance. A hosted adapter replaces this where data must outlive a request.
 */
export function getStore(): KeyValueStore {
  holder.__sentinelStore ??= new MemoryStore();
  return holder.__sentinelStore;
}
