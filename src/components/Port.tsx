import React, { useCallback, useContext } from "react";
import { createLiveEdge, updateLiveEdge, removeLiveEdge } from "../core/LiveEdge";
import { useGraph } from "../hooks/useGraph";
import { useConnection } from "../providers/ConnectionProvider";
import { ZoomContext } from "../providers/ZoomProvider";

interface PortProps {
    type?: 'input' | 'output';
    /** Unique identifier for this port (defaults to "in" or "out" based on type) */
    portId?: string;
    className?: string;
    style?: React.CSSProperties;
    data: { nodeId: string };
}

export const Port: React.FC<PortProps> = (props) => {
    const graph = useGraph();
    const { isPanModeRef } = useContext(ZoomContext);

    // Optional: use ConnectionProvider if available for validation and events
    let connection: ReturnType<typeof useConnection> | null = null;
    try {
        connection = useConnection();
    } catch {
        // ConnectionProvider not available - continue without it
    }

    const {
        type = 'input',
        portId,
        className,
        style = {},
        data,
        ...rest
    } = props;
    const classList = ['port', type, className].filter(Boolean).join(' ');
    const { nodeId } = data;
    // Default portId based on type if not provided
    const effectivePortId = portId ?? (type === 'output' ? 'out' : 'in');

    /** === PORT CONNECTION LOGIC === */
    const handlePortPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        // Don't start connection in pan mode — let the event bubble to the canvas
        if (isPanModeRef.current) return;
        e.stopPropagation();
        const portEl = e.currentTarget;
        const rect = portEl.getBoundingClientRect();
        const startScreen = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };

        // Convert screen coordinates to canvas coordinates for live edge rendering
        const startCanvas = graph.toCanvasSpace(startScreen);

        const edgeLayer = graph.getLayer("edgeLayer");
        if (!(edgeLayer instanceof SVGSVGElement)) return;
        createLiveEdge(edgeLayer, startCanvas);

        // Notify ConnectionProvider if available (use screen coords for UI events)
        connection?.startConnection({
            sourceNodeId: nodeId,
            sourcePortId: effectivePortId,
            sourcePortType: type,
            sourcePosition: startScreen,
            currentPosition: startScreen,
        });

        const handleMove = (ev: PointerEvent) => {
            const currentPosScreen = { x: ev.clientX, y: ev.clientY };
            const currentPosCanvas = graph.toCanvasSpace(currentPosScreen);
            updateLiveEdge(startCanvas, currentPosCanvas);
            connection?.updateConnection(currentPosScreen);
        };

        const handleUp = (ev: PointerEvent) => {
            const targetEl = ev.target as HTMLElement;
            const portType = targetEl.getAttribute("data-port-type") as 'input' | 'output' | null;
            const targetNodeId = targetEl.getAttribute("data-port-node");
            const targetPortId = targetEl.getAttribute("data-port-id");

            let connected = false;

            if (portType === "input" && targetNodeId && targetNodeId !== nodeId) {
                // Validate connection if ConnectionProvider is available
                if (connection) {
                    const canConnect = connection.canConnect({
                        sourceNodeId: nodeId,
                        sourcePortId: effectivePortId,
                        targetNodeId: targetNodeId,
                        targetPortId: targetPortId || undefined,
                        sourcePortType: type,
                        targetPortType: portType,
                    });

                    if (!canConnect.allowed) {
                        connection.cancelConnection(canConnect.reason);
                        removeLiveEdge();
                        window.removeEventListener("pointermove", handleMove);
                        window.removeEventListener("pointerup", handleUp);
                        return;
                    }
                }

                const tRect = targetEl.getBoundingClientRect();
                const targetPort = { x: tRect.x + tRect.width / 2, y: tRect.y + tRect.height / 2 };

                const newEdge = {
                    id: crypto.randomUUID(),
                    label: "Edge",
                    sourceNode: nodeId,
                    sourcePortId: effectivePortId,
                    targetNode: targetNodeId,
                    targetPortId: targetPortId || undefined,
                    sourcePort: startCanvas,
                    targetPort: graph.toCanvasSpace(targetPort),
                };

                graph.setState((s) => ({
                    ...s,
                    edges: [...s.edges, newEdge],
                }));

                // Notify success if ConnectionProvider is available
                connection?.completeConnection({
                    targetNodeId: targetNodeId,
                    targetPortId: targetPortId || undefined,
                    targetPortType: portType,
                    edge: newEdge,
                });

                connected = true;
            }

            if (!connected) {
                connection?.cancelConnection('No valid target port');
            }

            removeLiveEdge();
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", handleUp);
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
    }, [graph, nodeId, effectivePortId, type, connection, isPanModeRef]);

    return (
        <div
            className={classList}
            style={style}
            data-port-type={type}
            data-port-node={nodeId}
            data-port-id={effectivePortId}
            onPointerDown={handlePortPointerDown}
            {...rest}
        />
    );
};
