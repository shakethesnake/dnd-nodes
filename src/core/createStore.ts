// core/createStore.ts
import type { Store } from "../types";

export function createStore<T extends object>(initialState: T): Store<T> {
  let state = initialState;
  const listeners = new Set<() => void>();
  let batchDepth = 0;

  function getState(): T {
    return state;
  }

  function setState(
    partial: Partial<T> | ((prev: T) => Partial<T> | T)
  ): void {
    const nextPartial =
      typeof partial === "function" ? (partial as (prev: T) => Partial<T> | T)(state) : partial;

    // поддерживаем как "частичное обновление", так и "полную замену"
    state =
      nextPartial && typeof nextPartial === "object" && !Array.isArray(nextPartial)
        ? { ...(state as object), ...(nextPartial as object) } as T
        : (nextPartial as T);

    // Don't notify if we're batching
    if (batchDepth > 0) return;

    listeners.forEach((fn) => fn());
  }

  function subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function getSnapshot(): T {
    return state;
  }

  function batch<R>(fn: () => R): R {
    batchDepth++;
    try {
      return fn();
    } finally {
      batchDepth--;
      if (batchDepth === 0) {
        listeners.forEach((fn) => fn());
      }
    }
  }

  return { getState, setState, subscribe, getSnapshot, batch };
}
