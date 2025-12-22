import { useSyncExternalStore } from "react";

export function useStore(store: object) {
    if (!store) throw new Error('Store instance is required');

    const { getSnapshot, subscribe } = store;

    return useSyncExternalStore(subscribe, getSnapshot)
}