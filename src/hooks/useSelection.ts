import { useCallback, useMemo } from "react";
import { useGraph } from "./useGraph";
import { useStore } from "./useStore";

export function useSelection() {
  const graph = useGraph();
  const { selectedNodeIds, selectedNodeId } = useStore(graph.getStore());

  const resolvedSelection = useMemo(() => {
    if (selectedNodeIds && selectedNodeIds.length > 0) {
      return selectedNodeIds;
    }
    return selectedNodeId ? [selectedNodeId] : [];
  }, [selectedNodeIds, selectedNodeId]);

  const setSelection = useCallback((nodeIds: string[]) => {
    const unique = Array.from(new Set(nodeIds));
    graph.setState((state) => ({
      ...state,
      selectedNodeIds: unique,
      selectedNodeId: unique[0] ?? null,
    }));
  }, [graph]);

  const clearSelection = useCallback(() => {
    graph.setState((state) => ({
      ...state,
      selectedNodeIds: [],
      selectedNodeId: null,
    }));
  }, [graph]);

  return {
    selectedNodeIds: resolvedSelection,
    setSelection,
    clearSelection,
  };
}

