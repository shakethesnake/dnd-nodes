import { useMemo } from "react";
import type { EdgeData } from "../types/types";
import { useGraph } from "./useGraph";
import { useStore } from "./useStore";

export function useEdgesForNode(nodeId: string): EdgeData[] {
  const graph = useGraph();
  const { edges } = useStore(graph.getStore());

  return useMemo(
    () => edges.filter((edge) => edge.sourceNode === nodeId || edge.targetNode === nodeId),
    [edges, nodeId]
  );
}

