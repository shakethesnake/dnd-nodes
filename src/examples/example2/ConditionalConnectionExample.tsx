import React, { useCallback, useMemo, useState } from "react";
import { Flow } from "../../components/Flow";
import { Graph } from "../../core/Graph";
import type {
    NodeData,
    EdgeData,
    CanConnectFn,
    ConnectionEventHandlers,
} from "../../types/types";
import { ConditionalNode } from "./ConditionalNode";
import "./styles.css";

const TOP_NODE_IDS = new Set(["node-1", "node-2", "node-3"]);

const hasConnection = (edges: EdgeData[], leftNodeId: string, rightNodeId: string): boolean =>
    edges.some(
        (edge) =>
            (edge.sourceNode === leftNodeId && edge.targetNode === rightNodeId) ||
            (edge.sourceNode === rightNodeId && edge.targetNode === leftNodeId)
    );

const isTopRowEdge = (edge: Pick<EdgeData, "sourceNode" | "targetNode">): boolean =>
    TOP_NODE_IDS.has(edge.sourceNode) && TOP_NODE_IDS.has(edge.targetNode);

const normalizeEdges = (edges: EdgeData[]): EdgeData[] =>
    edges.map((edge) => {
        if (!isTopRowEdge(edge)) {
            return edge;
        }

        return {
            ...edge,
            type: "animated",
            data: {
                ...(edge.data as Record<string, unknown> | undefined),
                color: "#7aa2ff",
                speed: 2,
            },
        };
    });

/**
 * Example 2:
 * - 3 nodes on top (1 -> 2 connected initially, 3rd disconnected)
 * - 2 nodes at bottom (disconnected initially)
 * - Top-row edges are animated
 * - node-4 <-> node-5 is allowed only if node-2 <-> node-3 is connected
 */
export const ConditionalConnectionExample: React.FC = () => {
    const [graph] = useState(() => new Graph());

    const initialNodes = useMemo<NodeData[]>(
        () => [
            { id: "node-1", type: "conditional", position: { x: 120, y: 110 }, label: "Node 1", data: { color: "#10b981" } },
            { id: "node-2", type: "conditional", position: { x: 390, y: 110 }, label: "Node 2", data: { color: "#3b82f6" } },
            { id: "node-3", type: "conditional", position: { x: 660, y: 110 }, label: "Node 3", data: { color: "#8b5cf6" } },
            { id: "node-4", type: "conditional", position: { x: 260, y: 330 }, label: "Node 4", data: { color: "#f59e0b" } },
            { id: "node-5", type: "conditional", position: { x: 540, y: 330 }, label: "Node 5", data: { color: "#ef4444" } },
        ],
        []
    );

    const initialEdges = useMemo<EdgeData[]>(
        () => [
            {
                id: "edge-1-2",
                sourceNode: "node-1",
                targetNode: "node-2",
                sourcePortId: "out",
                targetPortId: "in",
                type: "animated",
                data: { color: "#10b981", speed: 2 },
            },
        ],
        []
    );

    const [nodes] = useState<NodeData[]>(initialNodes);
    const [edges, setEdges] = useState<EdgeData[]>(() => normalizeEdges(initialEdges));
    const [log, setLog] = useState<string[]>([]);
    const [errorPorts, setErrorPorts] = useState<Set<string>>(new Set());

    const addLog = useCallback((message: string, isError = false) => {
        setLog((prev) => [
            ...prev.slice(-9),
            `[${new Date().toLocaleTimeString()}] ${isError ? "[X]" : "[OK]"} ${message}`,
        ]);
    }, []);

    const flashErrorPort = useCallback((nodeId: string, portId: string) => {
        const key = `${nodeId}-${portId}`;
        setErrorPorts((prev) => new Set(prev).add(key));

        setTimeout(() => {
            setErrorPorts((prev) => {
                const next = new Set(prev);
                next.delete(key);
                return next;
            });
        }, 500);
    }, []);

    /**
     * Pre-connection computation function (returns true/false).
     * If false, node-4 <-> node-5 connection must be blocked.
     */
    const canConnectBottomPair = useCallback(
        (currentEdges: EdgeData[]): boolean => hasConnection(currentEdges, "node-2", "node-3"),
        []
    );

    const canConnect: CanConnectFn = useCallback(
        ({ sourceNodeId, targetNodeId, targetPortId, sourcePortType, targetPortType }) => {
            if (sourceNodeId === targetNodeId) {
                return { allowed: false, reason: "Cannot connect node to itself" };
            }

            if (sourcePortType !== "output" || targetPortType !== "input") {
                return {
                    allowed: false,
                    reason: `Invalid port types: ${sourcePortType} -> ${targetPortType}`,
                };
            }

            const isBottomPair =
                (sourceNodeId === "node-4" && targetNodeId === "node-5") ||
                (sourceNodeId === "node-5" && targetNodeId === "node-4");

            if (isBottomPair && !canConnectBottomPair(edges)) {
                flashErrorPort(targetNodeId, targetPortId || "in");
                return {
                    allowed: false,
                    reason: "Connect node-2 and node-3 first",
                };
            }

            return { allowed: true };
        },
        [canConnectBottomPair, edges, flashErrorPort]
    );

    const eventHandlers: ConnectionEventHandlers = useMemo(
        () => ({
            onConnectStart: ({ sourceNodeId, sourcePortId }) => {
                addLog(`Start ${sourceNodeId}:${sourcePortId}`);
            },
            onConnect: ({ sourceNodeId, sourcePortId, targetNodeId, targetPortId }) => {
                addLog(`Connected ${sourceNodeId}:${sourcePortId} -> ${targetNodeId}:${targetPortId}`);

                // Port already writes a new edge to graph store.
                // Read that state and normalize to avoid creating duplicate edges.
                const graphEdges = graph.getState().edges as EdgeData[];
                setEdges(normalizeEdges(graphEdges));
            },
            onConnectCancel: ({ sourceNodeId, sourcePortId, reason }) => {
                addLog(`Cancelled ${sourceNodeId}:${sourcePortId} (${reason || "no target"})`, true);
            },
        }),
        [addLog, graph]
    );

    React.useEffect(() => {
        graph.setState({ nodes, edges });
    }, [graph, nodes, edges]);

    const isNode2And3Connected = hasConnection(edges, "node-2", "node-3");
    const isNode4And5Connected = hasConnection(edges, "node-4", "node-5");

    return (
        <div style={{ display: "flex", width: "100vw", height: "100vh" }}>
            <div style={{ flex: 1, position: "relative", background: "#0a0e1a" }}>
                <Flow
                    graph={graph}
                    nodeTypes={{
                        conditional: (nodeData) => <ConditionalNode {...nodeData} errorPorts={errorPorts} />,
                    }}
                    canConnect={canConnect}
                    connectionEventHandlers={eventHandlers}
                />

                <div className="info-panel">
                    <h3 style={{ margin: "0 0 12px 0", fontSize: "18px", color: "#60a5fa" }}>
                        Conditional Connection Example
                    </h3>
                    <div style={{ lineHeight: "1.6", fontSize: "13px" }}>
                        <p style={{ margin: "0 0 8px 0" }}>
                            <strong>Rule:</strong> node-4 {"<->"} node-5 can connect only after node-2 {"->"} node-3.
                        </p>
                        <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "12px" }}>
                            <li>Top row has 3 nodes.</li>
                            <li>Only node-1 {"->"} node-2 is connected initially.</li>
                            <li>Top-row connections are forced to animated edges.</li>
                            <li>Failed validation flashes target port red for 0.5s.</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="log-panel">
                <h3
                    style={{
                        margin: "0 0 12px 0",
                        fontSize: "14px",
                        color: "#60a5fa",
                        borderBottom: "1px solid rgba(96, 165, 250, 0.2)",
                        paddingBottom: "8px",
                    }}
                >
                    Connection Log
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {log.length === 0 ? (
                        <div style={{ opacity: 0.5, fontStyle: "italic", fontSize: "12px" }}>
                            No events yet. Start connecting nodes.
                        </div>
                    ) : (
                        log.map((entry, idx) => (
                            <div key={idx} className="log-entry">
                                {entry}
                            </div>
                        ))
                    )}
                </div>

                <div
                    style={{
                        marginTop: "20px",
                        paddingTop: "20px",
                        borderTop: "1px solid rgba(96, 165, 250, 0.2)",
                        fontSize: "11px",
                        lineHeight: "1.8",
                    }}
                >
                    <h4
                        style={{
                            margin: "0 0 8px 0",
                            fontSize: "12px",
                            color: "#60a5fa",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                        }}
                    >
                        Current Connections
                    </h4>
                    <div>
                        node-1 {"->"} node-2: <span style={{ color: "#10b981" }}>Connected</span>
                    </div>
                    <div>
                        node-2 {"->"} node-3:{" "}
                        <span style={{ color: isNode2And3Connected ? "#10b981" : "#64748b" }}>
                            {isNode2And3Connected ? "Connected" : "Not connected"}
                        </span>
                    </div>
                    <div>
                        node-4 {"<->"} node-5:{" "}
                        <span style={{ color: isNode4And5Connected ? "#10b981" : "#64748b" }}>
                            {isNode4And5Connected ? "Connected" : "Not connected"}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConditionalConnectionExample;
