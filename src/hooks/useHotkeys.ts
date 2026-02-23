import { useEffect } from "react";
import { Graph } from "../core/Graph";

interface UseHotkeysOptions {
  enabled?: boolean;
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT"
    || target.tagName === "TEXTAREA"
    || target.isContentEditable
  );
};

export function useHotkeys(graph: Graph, options: UseHotkeysOptions = {}) {
  const { enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      const modifierPressed = event.ctrlKey || event.metaKey;
      const lowerKey = event.key.toLowerCase();

      if (event.key === "Delete" || event.key === "Backspace") {
        const { selectedNodeIds, selectedNodeId, selectedEdgeIds, selectedEdgeId } = graph.getState();

        // Collect selected nodes
        const selectedNodes = selectedNodeIds && selectedNodeIds.length > 0
          ? selectedNodeIds
          : (selectedNodeId ? [selectedNodeId] : []);

        // Collect selected edges
        const selectedEdges = selectedEdgeIds && selectedEdgeIds.length > 0
          ? selectedEdgeIds
          : (selectedEdgeId ? [selectedEdgeId] : []);

        if (selectedNodes.length === 0 && selectedEdges.length === 0) return;

        event.preventDefault();
        const nodeSet = new Set(selectedNodes);
        const edgeSet = new Set(selectedEdges);

        graph.setState((state) => ({
          ...state,
          // Remove selected nodes
          nodes: state.nodes.filter((node) => !nodeSet.has(node.id)),
          // Remove edges: those connected to deleted nodes OR explicitly selected
          edges: state.edges.filter(
            (edge) =>
              !nodeSet.has(edge.sourceNode) &&
              !nodeSet.has(edge.targetNode) &&
              !edgeSet.has(edge.id)
          ),
          selectedNodeId: null,
          selectedNodeIds: [],
          selectedEdgeId: null,
          selectedEdgeIds: [],
        }));
        return;
      }

      if (!modifierPressed) return;

      if (lowerKey === "z" && !event.shiftKey) {
        event.preventDefault();
        graph.undo();
        return;
      }

      if (lowerKey === "z" && event.shiftKey) {
        event.preventDefault();
        graph.redo();
        return;
      }

      if (lowerKey === "y") {
        event.preventDefault();
        graph.redo();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [graph, enabled]);
}

