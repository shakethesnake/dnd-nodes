// components/Canvas.tsx
import React, { useMemo, useRef } from "react";
import { Node } from "./Node";
import { EdgesLayer } from "./EdgeLayer";
import { useGraph } from "../hooks/useGraph";
import { useStore } from "../hooks/useStore";
import { useRegistry } from "../providers/RegistryProvider";
import { useViewport } from "../hooks/useViewport";
import type { EdgeRouter, EdgeRouterPreset } from "../types/types";

interface FlowCanvasProps {
    viewportCulling?: boolean;
    cullingPadding?: number;
    estimatedNodeSize?: { width: number; height: number };
    edgeRouter?: EdgeRouterPreset | EdgeRouter;
    edgeLayerType?: "svg" | "webgl";
}

/**
 * FlowCanvas Component
 * Renders the main canvas with all nodes and edges
 * Uses node types from RegistryProvider context
 */
export const FlowCanvas: React.FC<FlowCanvasProps> = ({
    viewportCulling = false,
    cullingPadding = 100,
    estimatedNodeSize = { width: 200, height: 100 },
    edgeRouter = "bezier",
    edgeLayerType = "svg",
}) => {
    const graph = useGraph();
    const { nodes, canvasView } = useStore(graph.getStore());
    const { nodeTypes } = useRegistry();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const { filterVisibleNodes } = useViewport(containerRef, { padding: cullingPadding });

    // Determine canvas view class
    const canvasViewClass = canvasView === 'dots' ? 'canvas-view-dots' : 'canvas-view-grid';
    const renderedNodes = useMemo(() => {
        if (!viewportCulling) return nodes;
        return filterVisibleNodes(nodes, estimatedNodeSize.width, estimatedNodeSize.height);
    }, [nodes, viewportCulling, filterVisibleNodes, estimatedNodeSize.width, estimatedNodeSize.height]);

    return (
        <div
            ref={containerRef}
            data-flow-root
            className={canvasViewClass}
            style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}
        >
            {renderedNodes?.map((n) => {
                // Get node component from registry, fallback to default Node
                const NodeComponent = nodeTypes[n.type || 'default'] || nodeTypes['default'] || Node;
                return <NodeComponent key={n.id} {...n} />;
            })}
            <EdgesLayer type={edgeLayerType} edgeRouter={edgeRouter} />
        </div>
    );
};
