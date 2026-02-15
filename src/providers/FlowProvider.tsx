import React, { createContext } from "react";
import type { NodeData } from "../types/types";

interface FlowContextValue {
    nodes: NodeData[];
    setNodes: (nodes: NodeData[]) => void;
}

export const FlowContext = createContext<FlowContextValue>({
    nodes: [],
    setNodes: () => {}
});

export const FlowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [nodes, setNodes] = React.useState<NodeData[]>([]);
    const value = { nodes, setNodes };
    return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
};
