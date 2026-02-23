// core/Flow.tsx
import React, { useMemo, useEffect, useRef } from "react";
import { ZoomProvider } from "../providers/ZoomProvider";
import { FlowProvider } from "../providers/FlowProvider";
import { RegistryProvider } from "../providers/RegistryProvider";
import { ConnectionProvider } from "../providers/ConnectionProvider";
import { ContextMenuProvider } from "../providers/ContextMenuProvider";
import { FlowCanvas } from "../components/Canvas";
import { GraphContext } from "../providers/GraphProvider";
import { Graph } from "../core/Graph";
import { createStore } from "../core/createStore";
import { useHotkeys } from "../hooks/useHotkeys";
import type { FlowProps, ControlledFlowProps, UncontrolledFlowProps, GraphState } from "../types/types";

/**
 * Flow Component
 * Main entry point for the flow graph
 * Supports both controlled and uncontrolled modes
 */
export const Flow: React.FC<FlowProps> = (props) => {
    const mode = 'mode' in props ? props.mode : 'uncontrolled';

    if (mode === 'controlled') {
        return <ControlledFlow {...(props as ControlledFlowProps)} />;
    }
    return <UncontrolledFlow {...(props as UncontrolledFlowProps)} />;
};

/**
 * Uncontrolled Flow - Graph owns the state (original behavior)
 */
const UncontrolledFlow: React.FC<UncontrolledFlowProps> = ({
    graph,
    nodeTypes,
    edgeTypes,
    canConnect,
    connectionEventHandlers,
    viewportCulling,
    cullingPadding,
    estimatedNodeSize,
    edgeRouter,
    edgeLayerType,
    enableHotkeys,
    snapToGrid,
    gridSize,
    showGrid,
    enableSpatialOptimization,
    enablePan,
    edgeCulling,
    edgeCullingPadding,
}) => {
    if (!graph) throw new Error("UncontrolledFlow requires a graph instance");
    useHotkeys(graph, { enabled: enableHotkeys ?? true });
    useEffect(() => {
        graph.setSnapConfig(snapToGrid ?? false, gridSize ?? 20);
    }, [graph, snapToGrid, gridSize]);

    return (
        <GraphContext.Provider value={graph}>
            <RegistryProvider nodeTypes={nodeTypes} edgeTypes={edgeTypes}>
                <ZoomProvider>
                    <ConnectionProvider canConnect={canConnect} eventHandlers={connectionEventHandlers}>
                        <ContextMenuProvider>
                            <FlowProvider>
                                <FlowCanvas
                                    viewportCulling={viewportCulling}
                                    cullingPadding={cullingPadding}
                                    estimatedNodeSize={estimatedNodeSize}
                                    edgeRouter={edgeRouter}
                                    edgeLayerType={edgeLayerType}
                                    showGrid={showGrid}
                                    gridSize={gridSize}
                                    enableSpatialOptimization={enableSpatialOptimization}
                                    enablePan={enablePan}
                                    edgeCulling={edgeCulling}
                                    edgeCullingPadding={edgeCullingPadding}
                                />
                            </FlowProvider>
                        </ContextMenuProvider>
                    </ConnectionProvider>
                </ZoomProvider>
            </RegistryProvider>
        </GraphContext.Provider>
    );
};

/**
 * Controlled Flow - External state management
 * Creates a controlled store that syncs with props
 */
const ControlledFlow: React.FC<ControlledFlowProps> = ({
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onStateChange,
    graphCore,
    nodeTypes,
    edgeTypes,
    canConnect,
    connectionEventHandlers,
    viewportCulling,
    cullingPadding,
    estimatedNodeSize,
    edgeRouter,
    edgeLayerType,
    enableHotkeys,
    snapToGrid,
    gridSize,
    showGrid,
    enableSpatialOptimization,
    enablePan,
    edgeCulling,
    edgeCullingPadding,
}) => {
    const callbacksRef = useRef({ onNodesChange, onEdgesChange, onStateChange });
    const syncingFromPropsRef = useRef(false);

    useEffect(() => {
        callbacksRef.current = { onNodesChange, onEdgesChange, onStateChange };
    }, [onNodesChange, onEdgesChange, onStateChange]);

    // Create controlled store that syncs with props
    const controlledStore = useMemo(() => {
        const store = createStore<GraphState>({
            nodes,
            edges,
            draggingId: null,
            selectedNodeId: null,
            selectedNodeIds: [],
            selectedEdgeId: null,
            selectedEdgeIds: [],
            canvasView: 'grid',
        });

        // Intercept setState to notify parent
        const originalSetState = store.setState.bind(store);
        store.setState = (updater) => {
            const prevState = store.getState();
            originalSetState(updater);
            const nextState = store.getState();

            if (syncingFromPropsRef.current) {
                return;
            }

            const {
                onNodesChange: onNodesChangeCurrent,
                onEdgesChange: onEdgesChangeCurrent,
                onStateChange: onStateChangeCurrent,
            } = callbacksRef.current;

            // Notify parent of changes
            if (nextState.nodes !== prevState.nodes && onNodesChangeCurrent) {
                onNodesChangeCurrent(nextState.nodes);
            }
            if (nextState.edges !== prevState.edges && onEdgesChangeCurrent) {
                onEdgesChangeCurrent(nextState.edges);
            }
            if (onStateChangeCurrent) {
                const changes: Partial<GraphState> = {};

                if (nextState.nodes !== prevState.nodes) {
                    changes.nodes = nextState.nodes;
                }
                if (nextState.edges !== prevState.edges) {
                    changes.edges = nextState.edges;
                }
                if (nextState.draggingId !== prevState.draggingId) {
                    changes.draggingId = nextState.draggingId;
                }
                if (nextState.selectedNodeId !== prevState.selectedNodeId) {
                    changes.selectedNodeId = nextState.selectedNodeId;
                }
                if (nextState.selectedNodeIds !== prevState.selectedNodeIds) {
                    changes.selectedNodeIds = nextState.selectedNodeIds;
                }
                if (nextState.selectedEdgeId !== prevState.selectedEdgeId) {
                    changes.selectedEdgeId = nextState.selectedEdgeId;
                }
                if (nextState.selectedEdgeIds !== prevState.selectedEdgeIds) {
                    changes.selectedEdgeIds = nextState.selectedEdgeIds;
                }
                if (nextState.canvasView !== prevState.canvasView) {
                    changes.canvasView = nextState.canvasView;
                }

                if (Object.keys(changes).length > 0) {
                    onStateChangeCurrent(changes);
                }
            }
        };

        return store;
    }, []); // Only create once

    // Sync props to store when they change
    useEffect(() => {
        const current = controlledStore.getState();
        if (current.nodes !== nodes || current.edges !== edges) {
            syncingFromPropsRef.current = true;
            controlledStore.setState((prev) => ({
                ...prev,
                nodes,
                edges,
            }));
            syncingFromPropsRef.current = false;
        }
    }, [nodes, edges, controlledStore]);

    // Create Graph instance with controlled store
    const graph = useMemo(() => {
        if (graphCore) return graphCore;
        return Graph.createControlled(controlledStore);
    }, [graphCore, controlledStore]);
    useHotkeys(graph, { enabled: enableHotkeys ?? true });
    useEffect(() => {
        graph.setSnapConfig(snapToGrid ?? false, gridSize ?? 20);
    }, [graph, snapToGrid, gridSize]);

    return (
        <GraphContext.Provider value={graph}>
            <RegistryProvider nodeTypes={nodeTypes} edgeTypes={edgeTypes}>
                <ZoomProvider>
                    <ConnectionProvider canConnect={canConnect} eventHandlers={connectionEventHandlers}>
                        <ContextMenuProvider>
                            <FlowProvider>
                                <FlowCanvas
                                    viewportCulling={viewportCulling}
                                    cullingPadding={cullingPadding}
                                    estimatedNodeSize={estimatedNodeSize}
                                    edgeRouter={edgeRouter}
                                    edgeLayerType={edgeLayerType}
                                    showGrid={showGrid}
                                    gridSize={gridSize}
                                    enableSpatialOptimization={enableSpatialOptimization}
                                    enablePan={enablePan}
                                    edgeCulling={edgeCulling}
                                    edgeCullingPadding={edgeCullingPadding}
                                />
                            </FlowProvider>
                        </ContextMenuProvider>
                    </ConnectionProvider>
                </ZoomProvider>
            </RegistryProvider>
        </GraphContext.Provider>
    );
};
