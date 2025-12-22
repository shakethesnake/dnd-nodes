// core/Flow.tsx
import React from "react";
import { ZoomProvider } from "../providers/ZoomProvier";
import { FlowProvider } from "../providers/FlowProvider";
import { FlowCanvas } from "../components/Canvas";
import { GraphContext } from "../providers/GraphProvider";
import type { Graph } from "../core/Graph";

export const Flow: React.FC<{ graph: Graph }> = ({ graph }) => {
    if (!graph) throw new Error("Flow requires a graph instance");

    return (
        <GraphContext.Provider value={graph}>
            <ZoomProvider>
                <FlowProvider>
                    <FlowCanvas />
                </FlowProvider>
            </ZoomProvider>
        </GraphContext.Provider>
    );
};
