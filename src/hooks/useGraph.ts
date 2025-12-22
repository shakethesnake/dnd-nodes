// hooks/useGraph.ts
import { useContext } from "react";
import { GraphContext } from "../providers/GraphProvider";
import type { Graph } from "../core/Graph";

/**
 * React hook для доступа к активному экземпляру Graph через контекст.
 * Безопасно выбрасывает ошибку, если GraphContext отсутствует.
 */
export function useGraph(): Graph {
    const graph = useContext(GraphContext);
    if (!graph) {
        throw new Error("useGraph() must be used within a <GraphContext.Provider>");
    }
    return graph;
}
