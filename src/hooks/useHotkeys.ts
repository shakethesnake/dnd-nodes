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
        const { selectedNodeIds, selectedNodeId } = graph.getState();
        const selected = selectedNodeIds && selectedNodeIds.length > 0
          ? selectedNodeIds
          : (selectedNodeId ? [selectedNodeId] : []);

        if (selected.length === 0) return;

        event.preventDefault();
        const selectedSet = new Set(selected);
        graph.setState((state) => ({
          ...state,
          nodes: state.nodes.filter((node) => !selectedSet.has(node.id)),
          edges: state.edges.filter(
            (edge) => !selectedSet.has(edge.sourceNode) && !selectedSet.has(edge.targetNode)
          ),
          selectedNodeId: null,
          selectedNodeIds: [],
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

