import React from "react";
import { NodeShell } from "../../components/NodeShell";
import { Port } from "../../components/Port";
import type { NodeData } from "../../types/types";

interface ConditionalNodeProps extends NodeData {
    errorPorts?: Set<string>;
}

/**
 * ConditionalNode - A custom node component that supports error highlighting on ports
 *
 * Features:
 * - Input and output ports
 * - Red highlight on ports when validation fails (0.5 second flash)
 * - Custom color per node
 * - Draggable via NodeShell
 */
export const ConditionalNode: React.FC<ConditionalNodeProps> = (node) => {
    const { id, label, data, errorPorts = new Set() } = node;
    const color = (data?.color as string) || "#3b82f6";

    // Check if ports have errors
    const inputPortHasError = errorPorts.has(`${id}-in`);
    const outputPortHasError = errorPorts.has(`${id}-out`);

    return (
        <NodeShell data={node}>
            <div
                style={{
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    minWidth: "180px",
                }}
            >
                {/* Node Header */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingBottom: "8px",
                        borderBottom: `2px solid ${color}`,
                    }}
                >
                    <div
                        style={{
                            width: "12px",
                            height: "12px",
                            borderRadius: "50%",
                            background: color,
                            boxShadow: `0 0 8px ${color}`,
                        }}
                    />
                    <span
                        style={{
                            fontSize: "14px",
                            fontWeight: "600",
                            color: "white",
                            flex: 1,
                            textAlign: "center",
                        }}
                    >
                        {label || id}
                    </span>
                    <div style={{ width: "12px" }} /> {/* Spacer for symmetry */}
                </div>

                {/* Ports Row */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0 8px",
                    }}
                >
                    {/* Input Port */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "4px",
                        }}
                    >
                        <Port
                            type="input"
                            portId="in"
                            data={{ nodeId: id }}
                            style={{
                                width: 14,
                                height: 14,
                                borderRadius: "50%",
                                background: inputPortHasError
                                    ? "#ef4444"
                                    : "#64748b",
                                border: "2px solid rgba(255,255,255,0.3)",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                boxShadow: inputPortHasError
                                    ? "0 0 12px rgba(239, 68, 68, 0.8)"
                                    : "none",
                            }}
                        />
                        <span
                            style={{
                                fontSize: "9px",
                                color: inputPortHasError ? "#ef4444" : "#94a3b8",
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                                fontWeight: inputPortHasError ? "600" : "400",
                            }}
                        >
                            IN
                        </span>
                    </div>

                    {/* Output Port */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "4px",
                        }}
                    >
                        <Port
                            type="output"
                            portId="out"
                            data={{ nodeId: id }}
                            style={{
                                width: 14,
                                height: 14,
                                borderRadius: "50%",
                                background: outputPortHasError
                                    ? "#ef4444"
                                    : color,
                                border: "2px solid rgba(255,255,255,0.3)",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                boxShadow: outputPortHasError
                                    ? "0 0 12px rgba(239, 68, 68, 0.8)"
                                    : `0 0 8px ${color}80`,
                            }}
                        />
                        <span
                            style={{
                                fontSize: "9px",
                                color: outputPortHasError ? "#ef4444" : color,
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                                fontWeight: outputPortHasError ? "600" : "400",
                            }}
                        >
                            OUT
                        </span>
                    </div>
                </div>

                {/* Node Info */}
                <div
                    style={{
                        fontSize: "10px",
                        color: "#94a3b8",
                        textAlign: "center",
                        paddingTop: "4px",
                        borderTop: "1px solid rgba(148, 163, 184, 0.1)",
                    }}
                >
                    ID: {id}
                </div>
            </div>
        </NodeShell>
    );
};
