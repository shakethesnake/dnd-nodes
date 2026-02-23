import { useCallback, useMemo } from "react";
import { useGraph } from "./useGraph";
import { useStore } from "./useStore";

export function useSelection() {
  const graph = useGraph();
  const { selectedNodeIds, selectedNodeId, selectedEdgeIds, selectedEdgeId } = useStore(graph.getStore());

  const resolvedNodeSelection = useMemo(() => {
    if (selectedNodeIds && selectedNodeIds.length > 0) {
      return selectedNodeIds;
    }
    return selectedNodeId ? [selectedNodeId] : [];
  }, [selectedNodeIds, selectedNodeId]);

  const resolvedEdgeSelection = useMemo(() => {
    if (selectedEdgeIds && selectedEdgeIds.length > 0) {
      return selectedEdgeIds;
    }
    return selectedEdgeId ? [selectedEdgeId] : [];
  }, [selectedEdgeIds, selectedEdgeId]);

  const setSelection = useCallback((nodeIds: string[]) => {
    const unique = Array.from(new Set(nodeIds));
    graph.setState((state) => ({
      ...state,
      selectedNodeIds: unique,
      selectedNodeId: unique[0] ?? null,
    }));
  }, [graph]);

  const setEdgeSelection = useCallback((edgeIds: string[]) => {
    const unique = Array.from(new Set(edgeIds));
    graph.setState((state) => ({
      ...state,
      selectedEdgeIds: unique,
      selectedEdgeId: unique[0] ?? null,
    }));
  }, [graph]);

  const clearSelection = useCallback(() => {
    graph.setState((state) => ({
      ...state,
      selectedNodeIds: [],
      selectedNodeId: null,
      selectedEdgeIds: [],
      selectedEdgeId: null,
    }));
  }, [graph]);

  const clearNodeSelection = useCallback(() => {
    graph.setState((state) => ({
      ...state,
      selectedNodeIds: [],
      selectedNodeId: null,
    }));
  }, [graph]);

  const clearEdgeSelection = useCallback(() => {
    graph.setState((state) => ({
      ...state,
      selectedEdgeIds: [],
      selectedEdgeId: null,
    }));
  }, [graph]);

  /** Get a snapshot of all selected items (nodes + edges) */
  const getSelectionSnapshot = useCallback(() => ({
    nodeIds: resolvedNodeSelection,
    edgeIds: resolvedEdgeSelection,
  }), [resolvedNodeSelection, resolvedEdgeSelection]);

  return {
    selectedNodeIds: resolvedNodeSelection,
    selectedEdgeIds: resolvedEdgeSelection,
    setSelection,
    setEdgeSelection,
    clearSelection,
    clearNodeSelection,
    clearEdgeSelection,
    getSelectionSnapshot,
  };
}
