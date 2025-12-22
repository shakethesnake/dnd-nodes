import React from 'react';
import { makePath } from '../core/LiveEdge';

export type AnimatedEdgeProps = {
    id: string;
    sourceNode: string;
    targetNode: string;
    sourcePort?: { x: number, y: number };
    targetPort?: { x: number, y: number };
    label?: string;
    data?: Record<string, unknown>;
};

/**
 * AnimatedEdge - An edge with animated flowing particles
 *
 * Features:
 * - Animated dashed stroke flowing along the path
 * - Pulsing glow effect
 * - Custom color based on data
 */
export const AnimatedEdge: React.FC<AnimatedEdgeProps> = (edge) => {
    const s = edge.sourcePort;
    const t = edge.targetPort;

    // If ports are not defined, render a placeholder path (will be updated by EdgeLayer)
    const path = (s && t) ? makePath(s, t) : 'M0,0 L0,0';

    // Extract custom data
    const color = (edge.data?.color as string) || '#7aa2ff';
    const speed = (edge.data?.speed as number) || 2;

    return (
        <g>
            {/* Glow effect */}
            <path
                d={path}
                stroke={color}
                fill="none"
                strokeWidth={6}
                opacity={0.2}
                filter="blur(4px)"
                data-edge-id={edge.id}
            />
            {/* Main path */}
            <path
                d={path}
                stroke={color}
                fill="none"
                strokeWidth={2.5}
                opacity={0.6}
                data-edge-id={edge.id}
            />
            {/* Animated dashed overlay */}
            <path
                d={path}
                stroke={color}
                fill="none"
                strokeWidth={2.5}
                strokeDasharray="10 5"
                className="animated-edge"
                style={{
                    animation: `dash ${speed}s linear infinite`
                }}
                data-edge-id={edge.id}
            />
        </g>
    );
};
