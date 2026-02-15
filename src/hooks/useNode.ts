import { useMemo } from "react";
import type { NodeData } from "../types/types";
import { useGraph } from "./useGraph";
import { useStore } from "./useStore";

export function useNode(id: string): NodeData | null {
  const graph = useGraph();
  const { nodes } = useStore(graph.getStore());

  return useMemo(
    () => nodes.find((node) => node.id === id) ?? null,
    [nodes, id]
  );
}

