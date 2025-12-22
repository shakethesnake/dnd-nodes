// components/Canvas.tsx
import React from "react";
import { Node } from "./Node";
import { CustomNode } from "./CustomNode";
import { ExperimentalNode } from "./ExperimentalNode";
import { EdgesLayer } from "./EdgeLayer";
import { useGraph } from "../hooks/useGraph";
import { useStore } from "../hooks/useStore";
import type { NodeData } from "../types/types";

// Node type registry - map node types to their components
const nodeTypes: Record<string, React.FC<NodeData>> = {
    default: Node,
    custom: CustomNode,
    experimental: ExperimentalNode,
};

export const FlowCanvas: React.FC = () => {
    const graph = useGraph();
    const { nodes, canvasView } = useStore(graph.getStore());

    // Determine canvas view class
    const canvasViewClass = canvasView === 'dots' ? 'canvas-view-dots' : 'canvas-view-grid';

    return (
        <div
            data-flow-root
            className={canvasViewClass}
            style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}
        >
            {nodes?.map((n) => {
                const NodeComponent = nodeTypes[n.type || 'default'] || Node;
                return <NodeComponent key={n.id} {...n} />;
            })}
            <EdgesLayer type="svg" />
        </div>
    );
};
