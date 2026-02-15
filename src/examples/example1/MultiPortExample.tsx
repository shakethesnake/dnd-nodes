import React, { useState } from "react";
import { Flow, Graph } from "../../index";
import { MultiPortNode } from "./MultiPortNode";
import type { NodeData, EdgeData, CanConnectFn, ConnectionEventHandlers } from "../../index";

/**
 * Example demonstrating Multi-Port feature (Point 3 from flexebility.md)
 *
 * Features showcased:
 * 1. Nodes with multiple named input/output ports
 * 2. Connection validation via canConnect callback
 * 3. Connection lifecycle events (onConnectStart, onConnect, etc.)
 * 4. Type-safe port connections (e.g., data ports can only connect to data ports)
 */
export const MultiPortExample: React.FC = () => {
    const [graph] = useState(() => new Graph());

    // Define initial nodes with multi-port nodes
    const initialNodes: NodeData[] = [
        {
            id: "node-1",
            type: "multi-port",
            position: { x: 100, y: 100 },
            label: "Data Source",
        },
        {
            id: "node-2",
            type: "multi-port",
            position: { x: 400, y: 100 },
            label: "Processor",
        },
        {
            id: "node-3",
            type: "multi-port",
            position: { x: 700, y: 100 },
            label: "Output",
        },
    ];

    const [nodes] = useState<NodeData[]>(initialNodes);
    const [edges, setEdges] = useState<EdgeData[]>([]);
    const [log, setLog] = useState<string[]>([]);

    // Add log entry helper
    const addLog = (message: string) => {
        setLog((prev) => [...prev.slice(-9), `[${new Date().toLocaleTimeString()}] ${message}`]);
    };

    /**
     * Custom connection validation with port type checking
     * This demonstrates the connection strategy feature
     */
    const canConnect: CanConnectFn = ({
        sourceNodeId,
        sourcePortId,
        targetNodeId,
        targetPortId,
        sourcePortType,
        targetPortType,
    }) => {
        // Prevent self-connection
        if (sourceNodeId === targetNodeId) {
            return { allowed: false, reason: "Cannot connect node to itself" };
        }

        // Only allow output->input
        if (sourcePortType !== "output" || targetPortType !== "input") {
            return {
                allowed: false,
                reason: `Invalid: ${sourcePortType} → ${targetPortType}`,
            };
        }

        // Optional: Validate port type compatibility
        // Example: "data" ports can only connect to "data" ports
        if (sourcePortId && targetPortId) {
            const sourceType = sourcePortId.split("-")[1]; // e.g., "out-result" -> "result"
            const targetType = targetPortId.split("-")[1]; // e.g., "in-data" -> "data"

            // Allow any output to connect to "trigger" input
            if (targetType === "trigger") {
                return { allowed: true };
            }

            // Type-based validation (demo purpose)
            const compatibleTypes: Record<string, string[]> = {
                result: ["data", "config"],
                error: ["trigger"],
            };

            if (compatibleTypes[sourceType]?.includes(targetType)) {
                return { allowed: true };
            }

            return {
                allowed: false,
                reason: `Port types incompatible: ${sourceType} → ${targetType}`,
            };
        }

        return { allowed: true };
    };

    /**
     * Connection lifecycle event handlers
     * This demonstrates the event system feature
     */
    const eventHandlers: ConnectionEventHandlers = {
        onConnectStart: ({ sourceNodeId, sourcePortId }) => {
            addLog(`🔵 Started connection from ${sourceNodeId}:${sourcePortId}`);
        },
        onConnectMove: () => {},
        onConnect: ({ sourceNodeId, sourcePortId, targetNodeId, targetPortId, edge }) => {
            addLog(
                `✅ Connected ${sourceNodeId}:${sourcePortId} → ${targetNodeId}:${targetPortId}`
            );

            // Add the edge to state
            setEdges((prev) => [
                ...prev,
                {
                    ...edge,
                    label: `${sourcePortId} → ${targetPortId}`,
                },
            ]);
        },
        onConnectCancel: ({ sourceNodeId, sourcePortId, reason }) => {
            addLog(`❌ Cancelled from ${sourceNodeId}:${sourcePortId} - ${reason || "no target"}`);
        },
        onConnectEnd: ({ sourceNodeId }) => {
            addLog(`🔴 Connection ended for ${sourceNodeId}`);
        },
    };

    React.useEffect(() => {
        graph.setState({ nodes, edges });
    }, [graph, nodes, edges]);

    return (
        <div style={{ display: "flex", width: "100vw", height: "100vh" }}>
            {/* Main Canvas */}
            <div style={{ flex: 1, position: "relative" }}>
                <Flow
                    graph={graph}
                    nodeTypes={{
                        "multi-port": MultiPortNode,
                    }}
                    canConnect={canConnect}
                    connectionEventHandlers={eventHandlers}
                />

                {/* Info Overlay */}
                <div
                    style={{
                        position: "absolute",
                        top: "16px",
                        left: "16px",
                        background: "rgba(0, 0, 0, 0.8)",
                        color: "white",
                        padding: "16px",
                        borderRadius: "8px",
                        fontSize: "13px",
                        maxWidth: "350px",
                        backdropFilter: "blur(10px)",
                    }}
                >
                    <h3 style={{ margin: "0 0 12px 0", fontSize: "16px" }}>
                        🎯 Multi-Port Example
                    </h3>
                    <div style={{ lineHeight: "1.6" }}>
                        <p style={{ margin: "0 0 8px 0" }}>
                            <strong>Features:</strong>
                        </p>
                        <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "12px" }}>
                            <li>Multiple named ports per node</li>
                            <li>Port type validation (data/config/trigger)</li>
                            <li>Connection lifecycle events</li>
                            <li>Visual feedback during connection</li>
                        </ul>
                        <p style={{ margin: "12px 0 4px 0", fontSize: "11px", opacity: 0.7 }}>
                            Try connecting ports! Some connections are blocked by validation.
                        </p>
                    </div>
                </div>
            </div>

            {/* Event Log Sidebar */}
            <div
                style={{
                    width: "300px",
                    background: "#1a202c",
                    color: "#e2e8f0",
                    padding: "16px",
                    overflowY: "auto",
                    fontFamily: "monospace",
                    fontSize: "12px",
                }}
            >
                <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#63b3ed" }}>
                    📋 Event Log
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {log.length === 0 ? (
                        <div style={{ opacity: 0.5, fontStyle: "italic" }}>
                            No events yet. Start connecting ports!
                        </div>
                    ) : (
                        log.map((entry, idx) => (
                            <div
                                key={idx}
                                style={{
                                    padding: "6px 8px",
                                    background: "rgba(255, 255, 255, 0.05)",
                                    borderRadius: "4px",
                                    fontSize: "11px",
                                    lineHeight: "1.4",
                                }}
                            >
                                {entry}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default MultiPortExample;
