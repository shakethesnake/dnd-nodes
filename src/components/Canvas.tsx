// components/Canvas.tsx
import React, { useMemo, useRef, useContext, useCallback, useState } from "react";
import { Node } from "./Node";
import { EdgesLayer } from "./EdgeLayer";
import { GridBackground } from "./GridBackground";
import { ZoomControls } from "./ZoomControls";
import { useGraph } from "../hooks/useGraph";
import { useStore } from "../hooks/useStore";
import { useRegistry } from "../providers/RegistryProvider";
import { useViewport } from "../hooks/useViewport";
import { useZoomControls } from "../hooks/useZoomControls";
import { usePanMode } from "../hooks/usePanMode";
import { ZoomContext } from "../providers/ZoomProvider";
import { ContextMenuContext } from "../providers/ContextMenuProvider";
import type { EdgeRouter, EdgeRouterPreset, ContextMenuItem } from "../types/types";

interface FlowCanvasProps {
    viewportCulling?: boolean;
    cullingPadding?: number;
    estimatedNodeSize?: { width: number; height: number };
    edgeRouter?: EdgeRouterPreset | EdgeRouter;
    edgeLayerType?: "svg" | "webgl";
    /** Enable infinite grid background (default: true) */
    showGrid?: boolean;
    /** Grid size in pixels (default: 20) */
    gridSize?: number;
    /** Enable spatial optimization for large graphs */
    enableSpatialOptimization?: boolean;
    /** Enable zoom controls (default: true) */
    enableZoom?: boolean;
    /** Show zoom control UI (default: true) */
    showZoomControls?: boolean;
    /** Enable Space+drag and middle-mouse canvas panning (default: true) */
    enablePan?: boolean;
    /** P5: Enable edge visibility culling for large graphs */
    edgeCulling?: boolean;
    /** P5: Extra padding around viewport for edge culling (px) */
    edgeCullingPadding?: number;
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
    showGrid = true,
    gridSize = 20,
    enableSpatialOptimization = false,
    enableZoom = true,
    showZoomControls = true,
    enablePan = true,
    edgeCulling = false,
    edgeCullingPadding = 100,
}) => {
    const graph = useGraph();
    const { nodes, canvasView } = useStore(graph.getStore());
    const { nodeTypes } = useRegistry();
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Local grid-visibility state (can be toggled via context menu)
    const [gridVisible, setGridVisible] = useState(showGrid ?? true);

    // Get viewport state from ZoomContext (including pan mode for cursor feedback)
    const { x, y, zoom, getTransform, containerRef: zoomContainerRef, isPanMode, isPanning, zoomToFit, resetView } = useContext(ZoomContext);

    // Context menu
    const { showMenu } = useContext(ContextMenuContext);

    const setContainerRef = useCallback((el: HTMLDivElement | null) => {
        containerRef.current = el;
        zoomContainerRef.current = el;
    }, [zoomContainerRef]);

    // Update Graph's viewport transform whenever zoom/pan changes
    React.useEffect(() => {
        graph.setViewportTransform(x, y, zoom);
    }, [graph, x, y, zoom]);

    // Use zoom controls hook for wheel zoom, keyboard shortcuts, and trackpad pan
    useZoomControls(containerRef, {
        enableWheel: enableZoom,
        enableKeyboard: enableZoom,
        enableTrackpadPan: enablePan,
    });

    // Use pan mode hook for double-click toggle and middle-mouse panning
    usePanMode(containerRef, {
        enableDoubleClickPan: enablePan,
        enableMiddleMousePan: enablePan,
    });

    // Click on empty canvas clears selection
    const handleCanvasPointerDown = useCallback(
        (e: React.PointerEvent) => {
            // Only clear on direct canvas clicks (not bubbled from nodes/ports)
            if (e.target === e.currentTarget || (e.target as HTMLElement).closest('[data-flow-root]') === e.currentTarget) {
                // Check it's not from a node or port
                if (!(e.target as HTMLElement).closest('.node') && !(e.target as HTMLElement).closest('.port')) {
                    graph.setState((s) => ({
                        ...s,
                        selectedNodeId: null,
                        selectedNodeIds: [],
                        selectedEdgeId: null,
                        selectedEdgeIds: [],
                    }));
                }
            }
        },
        [graph],
    );

    // Canvas right-click context menu
    const handleCanvasContextMenu = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const canvasItems: ContextMenuItem[] = [
                {
                    id: 'selectAll',
                    label: 'Select All',
                    shortcut: 'Ctrl+A',
                    onClick: () => {
                        graph.setState((s) => ({
                            ...s,
                            selectedNodeIds: s.nodes.map((n) => n.id),
                            selectedNodeId: s.nodes[s.nodes.length - 1]?.id ?? null,
                        }));
                    },
                },
                { id: 'sep1', label: '', separator: true },
                {
                    id: 'fitView',
                    label: 'Fit to Screen',
                    icon: '⊡',
                    onClick: () => zoomToFit(graph.getState().nodes),
                },
                {
                    id: 'resetZoom',
                    label: 'Reset Zoom',
                    icon: '⟲',
                    shortcut: 'Ctrl+0',
                    onClick: () => resetView(),
                },
                { id: 'sep2', label: '', separator: true },
                {
                    id: 'gridToggle',
                    label: gridVisible ? 'Hide Grid' : 'Show Grid',
                    icon: '⊞',
                    onClick: () => setGridVisible((v) => !v),
                },
            ];

            showMenu({ position: { x: e.clientX, y: e.clientY }, items: canvasItems });
        },
        [graph, showMenu, zoomToFit, resetView, gridVisible],
    );

    const viewportTransform = useMemo(() => ({ x, y, zoom }), [x, y, zoom]);

    const { filterVisibleNodes } = useViewport(containerRef, {
        padding: cullingPadding,
        useSpatialOptimization: enableSpatialOptimization,
        transform: viewportTransform,
    });

    // Determine grid variant from canvasView
    const gridVariant = canvasView === 'dots' ? 'dots' : 'grid';

    const renderedNodes = useMemo(() => {
        if (!viewportCulling) return nodes;
        return filterVisibleNodes(nodes, estimatedNodeSize.width, estimatedNodeSize.height);
    }, [nodes, viewportCulling, filterVisibleNodes, estimatedNodeSize.width, estimatedNodeSize.height]);

    return (
        <div
            ref={setContainerRef}
            data-flow-root
            className={[
                isPanMode ? 'canvas-pan-mode' : '',
                isPanning ? 'panning' : '',
            ].filter(Boolean).join(' ')}
            style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}
            onPointerDown={handleCanvasPointerDown}
            onContextMenu={handleCanvasContextMenu}
        >
            {/* Infinite grid background */}
            {gridVisible && (
                <GridBackground
                    variant={gridVariant}
                    gridSize={gridSize}
                    offset={{ x, y }}
                    zoom={zoom}
                />
            )}

            {/* Transform container for zoom/pan */}
            <div
                className="canvas-transform-container"
                style={{
                    transform: getTransform(),
                    transformOrigin: '0 0',
                    willChange: 'transform',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                }}
            >
                {/* Nodes layer */}
                {renderedNodes?.map((n) => {
                    // Get node component from registry, fallback to default Node
                    const NodeComponent = nodeTypes[n.type || 'default'] || nodeTypes['default'] || Node;
                    return <NodeComponent key={n.id} {...n} />;
                })}

                {/* Edges layer */}
                <EdgesLayer
                    type={edgeLayerType}
                    edgeRouter={edgeRouter}
                    edgeCulling={edgeCulling}
                    edgeCullingPadding={edgeCullingPadding}
                />
            </div>

            {/* Zoom controls UI */}
            {showZoomControls && enableZoom && <ZoomControls />}
        </div>
    );
};
