"use client";

import { useSyncExternalStore } from "react";
import { MAX_QUANTITY, type CartItem } from "@/lib/store/pricing";

/**
 * The shopper's cart, kept in the browser. It holds only product ids and
 * quantities. Prices are looked up for display and computed again on the
 * server when paying.
 */

const STORAGE_KEY = "tallowmere-cart";
const EMPTY: CartItem[] = [];

let cache: { raw: string | null; items: CartItem[] } = { raw: null, items: EMPTY };
const listeners = new Set<() => void>();

function parse(raw: string | null): CartItem[] {
  if (!raw) return EMPTY;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return EMPTY;
    return value.filter(
      (item): item is CartItem =>
        typeof item?.id === "string" && Number.isInteger(item?.quantity) && item.quantity > 0,
    );
  } catch {
    return EMPTY;
  }
}

function read(): CartItem[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private windows). The cart then lasts for the page only.
    return cache.items;
  }
  if (raw !== cache.raw) cache = { raw, items: parse(raw) };
  return cache.items;
}

function write(items: CartItem[]): void {
  const raw = JSON.stringify(items);
  cache = { raw, items };
  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Keep the in-memory copy.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function addToCart(id: string, quantity = 1): void {
  const items = read();
  const existing = items.find((item) => item.id === id);
  if (existing) {
    setQuantity(id, existing.quantity + quantity);
  } else {
    write([...items, { id, quantity: Math.min(quantity, MAX_QUANTITY) }]);
  }
}

export function setQuantity(id: string, quantity: number): void {
  const next = Math.min(Math.max(quantity, 0), MAX_QUANTITY);
  const items = read();
  write(
    next === 0
      ? items.filter((item) => item.id !== id)
      : items.map((item) => (item.id === id ? { ...item, quantity: next } : item)),
  );
}

export function clearCart(): void {
  write([]);
}

/** The cart's items. Empty during server rendering and until the browser has loaded. */
export function useCart(): CartItem[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
