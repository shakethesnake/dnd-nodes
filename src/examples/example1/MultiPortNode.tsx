import React from "react";
import { Port, type NodeData } from "../../index";

/**
 * Example of a node with multiple input and output ports
 * Demonstrates the multi-port feature implemented in Point 3 of flexebility.md
 */
export const MultiPortNode: React.FC<NodeData> = (props) => {
    const { id, label = "Multi Port Node" } = props;

    return (
        <div
            style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                border: "2px solid #4c51bf",
                borderRadius: "8px",
                padding: "16px",
                minWidth: "200px",
                color: "white",
            }}
        >
            <h3 style={{ margin: "0 0 12px 0", fontSize: "14px" }}>{label}</h3>

            {/* Multiple Input Ports */}
            <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "12px", marginBottom: "6px", opacity: 0.8 }}>
                    Inputs:
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Port
                            type="input"
                            portId="in-data"
                            data={{ nodeId: id }}
                            style={{
                                width: "14px",
                                height: "14px",
                                borderRadius: "50%",
                                background: "#48bb78",
                                border: "2px solid white",
                                cursor: "pointer",
                            }}
                        />
                        <span style={{ fontSize: "11px" }}>Data Input</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Port
                            type="input"
                            portId="in-config"
                            data={{ nodeId: id }}
                            style={{
                                width: "14px",
                                height: "14px",
                                borderRadius: "50%",
                                background: "#4299e1",
                                border: "2px solid white",
                                cursor: "pointer",
                            }}
                        />
                        <span style={{ fontSize: "11px" }}>Config Input</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Port
                            type="input"
                            portId="in-trigger"
                            data={{ nodeId: id }}
                            style={{
                                width: "14px",
                                height: "14px",
                                borderRadius: "50%",
                                background: "#ed8936",
                                border: "2px solid white",
                                cursor: "pointer",
                            }}
                        />
                        <span style={{ fontSize: "11px" }}>Trigger Input</span>
                    </div>
                </div>
            </div>

            {/* Multiple Output Ports */}
            <div>
                <div style={{ fontSize: "12px", marginBottom: "6px", opacity: 0.8 }}>
                    Outputs:
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            gap: "8px",
                        }}
                    >
                        <span style={{ fontSize: "11px" }}>Result Output</span>
                        <Port
                            type="output"
                            portId="out-result"
                            data={{ nodeId: id }}
                            style={{
                                width: "14px",
                                height: "14px",
                                borderRadius: "50%",
                                background: "#9f7aea",
                                border: "2px solid white",
                                cursor: "pointer",
                            }}
                        />
                    </div>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            gap: "8px",
                        }}
                    >
                        <span style={{ fontSize: "11px" }}>Error Output</span>
                        <Port
                            type="output"
                            portId="out-error"
                            data={{ nodeId: id }}
                            style={{
                                width: "14px",
                                height: "14px",
                                borderRadius: "50%",
                                background: "#f56565",
                                border: "2px solid white",
                                cursor: "pointer",
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
