import React, { createContext } from "react";

export const FlowContext = createContext({ nodes: [], setNodes: (nodes: any[]) => {} });

export const FlowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [nodes, setNodes] = React.useState<any[]>([]);
    const value = { nodes, setNodes };
    return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}