import React from 'react';
import { makePath } from '../core/LiveEdge';

export type Edge = {
    id: string;
    sourceNode: string;
    targetNode: string;
    sourcePort?: { x: number, y: number };
    targetPort?: { x: number, y: number };
    label?: string;
};

export const Edge: React.FC<Edge> = (edge) => {
    const s = edge.sourcePort;
    const t = edge.targetPort;

    // If ports are not defined, render a placeholder path (will be updated by EdgeLayer)
    const path = (s && t) ? makePath(s, t) : 'M0,0 L0,0';

    return (
        <path
            data-edge-id={edge.id}
            d={path}
            stroke="#888"
            fill="none"
            strokeWidth={2}
            strokeDasharray={'6 3'}
        />
    );
};
