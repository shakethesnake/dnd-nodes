// core/createStore.ts
export function createStore<T extends object>(initialState: T) {
  let state = initialState;
  const listeners = new Set<() => void>();

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

    listeners.forEach((fn) => fn());
  }

  function subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function getSnapshot(): T {
    return state;
  }

  return { getState, setState, subscribe, getSnapshot };
}
