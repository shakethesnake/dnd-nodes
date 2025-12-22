import React, { createContext } from "react";
import { Graph } from "../core/Graph";

export const GraphContext = createContext<Graph | null>(null);

export const GraphProvider: React.FC<{ graph: Graph, children: React.ReactNode }> = ({ graph, children }) => {
    return <GraphContext.Provider value={graph}>{children}</GraphContext.Provider>;
}