import React, { useState } from 'react';
import { makePath } from '../core/LiveEdge';
import { useGraph } from '../hooks/useGraph';

export type BreakableEdgeProps = {
    id: string;
    sourceNode: string;
    targetNode: string;
    sourcePort?: { x: number, y: number };
    targetPort?: { x: number, y: number };
    label?: string;
    data?: Record<string, unknown>;
};

/**
 * BreakableEdge - An edge that can be broken/deleted by clicking on it
 *
 * Features:
 * - Click to delete the edge
 * - Hover effect showing it's interactive
 * - Visual feedback with color change
 * - Optional "break point" indicator in the middle
 */
export const BreakableEdge: React.FC<BreakableEdgeProps> = (edge) => {
    const graph = useGraph();
    const [isHovered, setIsHovered] = useState(false);

    const s = edge.sourcePort;
    const t = edge.targetPort;

    // If ports are not defined, render a placeholder path (will be updated by EdgeLayer)
    const path = (s && t) ? makePath(s, t) : 'M0,0 L0,0';

    // Calculate midpoint for the break indicator
    const midX = s && t ? (s.x + t.x) / 2 : 0;
    const midY = s && t ? (s.y + t.y) / 2 : 0;

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        // Remove this edge from the graph
        graph.setState((state) => ({
            ...state,
            edges: state.edges.filter((e) => e.id !== edge.id),
        }));
    };

    const color = isHovered ? '#ef4444' : '#f59e0b';
    const strokeWidth = isHovered ? 3 : 2;

    return (
        <g
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            // onClick={handleClick}
            style={{ cursor: 'pointer' }}
        >
            {/* Invisible thick path for easier clicking */}
            <path
                d={path}
                stroke="transparent"
                fill="none"
                strokeWidth={12}
                pointerEvents="stroke"
                data-edge-id={edge.id}
            />

            {/* Glow effect when hovered */}
            {isHovered && (
                <path
                    d={path}
                    stroke={color}
                    fill="none"
                    strokeWidth={8}
                    opacity={0.3}
                    filter="blur(4px)"
                    pointerEvents="none"
                    data-edge-id={edge.id}
                />
            )}

            {/* Main path */}
            <path
                d={path}
                stroke={color}
                fill="none"
                strokeWidth={strokeWidth}
                strokeDasharray={isHovered ? "8 4" : "6 3"}
                pointerEvents="none"
                data-edge-id={edge.id}
            />

            {/* Break indicator in the middle */}
            <g pointerEvents="none">
                <circle
                    cx={midX}
                    cy={midY}
                    r={isHovered ? 8 : 6}
                    fill={color}
                    stroke="#fff"
                    strokeWidth={2}
                    opacity={isHovered ? 1 : 0.7}
                />
                {/* X mark inside circle */}
                {isHovered && (
                    <>
                        <line
                            x1={midX - 3}
                            y1={midY - 3}
                            x2={midX + 3}
                            y2={midY + 3}
                            stroke="#fff"
                            strokeWidth={2}
                            strokeLinecap="round"
                        />
                        <line
                            x1={midX + 3}
                            y1={midY - 3}
                            x2={midX - 3}
                            y2={midY + 3}
                            stroke="#fff"
                            strokeWidth={2}
                            strokeLinecap="round"
                        />
                    </>
                )}
            </g>
        </g>
    );
};
