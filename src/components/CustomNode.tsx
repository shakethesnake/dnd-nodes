import React, { useEffect } from "react";
import { useGraph } from "../hooks/useGraph";
import { NodeShell } from "./NodeShell";
import type { NodeData } from "../types/types";
import { Port } from "./Port";

const gradientsByColor: Record<string, { start: string; end: string }> = {
    purple: {
        start: "var(--ff-custom-node-purple-start, #667eea)",
        end: "var(--ff-custom-node-purple-end, #764ba2)",
    },
    blue: {
        start: "var(--ff-custom-node-blue-start, #1e3a8a)",
        end: "var(--ff-custom-node-blue-end, #3b82f6)",
    },
    green: {
        start: "var(--ff-custom-node-green-start, #065f46)",
        end: "var(--ff-custom-node-green-end, #10b981)",
    },
    red: {
        start: "var(--ff-custom-node-red-start, #dc2626)",
        end: "var(--ff-custom-node-red-end, #f97316)",
    },
};

/**
 * CustomNode - Example of a custom node type with different styling and behavior
 */
export const CustomNode: React.FC<NodeData> = ({ id, position, label, data }) => {
    const graph = useGraph();

    useEffect(() => {
        return () => {
            graph.nodeRegistry.delete(id);
        };
    }, [id, graph]);

    const icon = (data?.icon as string) || "*";
    const description = (data?.description as string) || "";
    const color = (data?.color as string) || "purple";
    const palette = gradientsByColor[color] ?? gradientsByColor.purple;

    const customThemeVars = {
        "--ff-custom-node-gradient-start": palette.start,
        "--ff-custom-node-gradient-end": palette.end,
    } as React.CSSProperties;

    return (
        <NodeShell
            data={{ id, position, label, data }}
            style={{
                ...customThemeVars,
                position: "absolute",
                left: `${position.x}px`,
                top: `${position.y}px`,
                userSelect: "none",
                willChange: "transform",
                background:
                    "linear-gradient(135deg, var(--ff-custom-node-gradient-start) 0%, var(--ff-custom-node-gradient-end) 100%)",
                border: "2px solid var(--ff-custom-node-border)",
                minWidth: "180px",
            }}
        >
            <div style={{ position: "relative" }}>
                <div
                    className="node-header"
                    style={{
                        background: "var(--ff-custom-node-header-overlay)",
                        borderBottom: "1px solid var(--ff-node-header-border)",
                    }}
                >
                    <div style={{ fontSize: "20px" }}>{icon}</div>
                    <div className="node-title" style={{ flex: 1, fontWeight: 600, color: "var(--ff-custom-node-title)" }}>
                        {label ?? id}
                    </div>
                </div>

                <Port
                    type="input"
                    data={{ nodeId: id }}
                    style={{
                        position: "absolute",
                        left: -8,
                        top: "49%",
                        width: 10,
                        height: 10,
                        background: "var(--ff-custom-port-input-bg)",
                        borderRadius: 0,
                        border: "1px solid var(--ff-custom-port-input-border)",
                    }}
                />

                <Port
                    type="output"
                    data={{ nodeId: id }}
                    style={{
                        position: "absolute",
                        top: "50%",
                        right: -8,
                    }}
                />

                {description && (
                    <div
                        className="node-body"
                        style={{
                            fontSize: "11px",
                            color: "var(--ff-custom-node-body)",
                            padding: "8px 10px",
                        }}
                    >
                        {description}
                    </div>
                )}
            </div>
        </NodeShell>
    );
};
