// hooks/useHistory.ts
import { useCallback, useSyncExternalStore } from 'react';
import { useGraph } from './useGraph';

/**
 * React hook for undo/redo functionality
 * Provides canUndo/canRedo state and undo/redo actions
 *
 * @example
 * function Editor() {
 *   const { canUndo, canRedo, undo, redo, clear } = useHistory();
 *
 *   return (
 *     <div>
 *       <button onClick={undo} disabled={!canUndo}>Undo (Ctrl+Z)</button>
 *       <button onClick={redo} disabled={!canRedo}>Redo (Ctrl+Shift+Z)</button>
 *     </div>
 *   );
 * }
 */
export function useHistory() {
  const graph = useGraph();

  // Subscribe to store changes to update canUndo/canRedo
  const canUndo = useSyncExternalStore(
    (callback) => graph.getStore().subscribe(callback),
    () => graph.canUndo()
  );

  const canRedo = useSyncExternalStore(
    (callback) => graph.getStore().subscribe(callback),
    () => graph.canRedo()
  );

  const undo = useCallback(() => {
    return graph.undo();
  }, [graph]);

  const redo = useCallback(() => {
    return graph.redo();
  }, [graph]);

  const clear = useCallback(() => {
    graph.clearHistory();
  }, [graph]);

  const push = useCallback((label?: string, force = false) => {
    graph.pushHistory(label, force);
  }, [graph]);

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    clear,
    push,
  };
}
