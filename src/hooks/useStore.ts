import { useSyncExternalStore } from "react";
import type { Store } from "../types";

export function useStore<T>(store: Store<T>): T {
    if (!store) throw new Error('Store instance is required');

    const { getSnapshot, subscribe } = store;

    return useSyncExternalStore(subscribe, getSnapshot)
}