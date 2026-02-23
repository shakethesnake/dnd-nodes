// components/Edge.tsx
import React, { useCallback, useContext, useMemo } from 'react';
import { makePath } from '../core/LiveEdge';
import { useGraph } from '../hooks/useGraph';
import { useStore } from '../hooks/useStore';
import { ContextMenuContext } from '../providers/ContextMenuProvider';
import { EdgeLODContext } from './EdgeLayer';
import type { EdgeData, ContextMenuItem } from '../types/types';

export type Edge = {
    id: string;
    sourceNode: string;
    targetNode: string;
    sourcePort?: { x: number, y: number };
    targetPort?: { x: number, y: number };
    label?: string;
    type?: string;
};

export const Edge: React.FC<EdgeData> = (edge) => {
    const { id, sourcePort, targetPort, type } = edge;
    const graph = useGraph();
    const { showMenu } = useContext(ContextMenuContext);
    const { selectedEdgeIds, selectedEdgeId } = useStore(graph.getStore());

    const s = sourcePort;
    const t = targetPort;

    // If ports are not defined, render a placeholder path (will be updated by EdgeLayer)
    const path = (s && t) ? makePath(s, t) : 'M0,0 L0,0';

    const isSelected = useMemo(() => {
        if (selectedEdgeIds && selectedEdgeIds.length > 0) {
            return selectedEdgeIds.includes(id);
        }
        return selectedEdgeId === id;
    }, [selectedEdgeIds, selectedEdgeId, id]);

    // Click handler for edge selection
    const handleClick = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();

            const shiftKey = e.shiftKey;

            graph.setState((state) => {
                // Clear node selection when clicking an edge (avoid dual active objects)
                const baseUpdate = {
                    selectedNodeId: null as string | null,
                    selectedNodeIds: [] as string[],
                };

                if (shiftKey) {
                    // Shift+click: toggle edge in multi-selection
                    const currentIds = state.selectedEdgeIds ?? [];
                    const isAlreadySelected = currentIds.includes(id);
                    const newIds = isAlreadySelected
                        ? currentIds.filter((eid) => eid !== id)
                        : [...currentIds, id];
                    return {
                        ...state,
                        ...baseUpdate,
                        selectedEdgeIds: newIds,
                        selectedEdgeId: newIds[0] ?? null,
                    };
                }

                // Regular click: select only this edge
                return {
                    ...state,
                    ...baseUpdate,
                    selectedEdgeIds: [id],
                    selectedEdgeId: id,
                };
            });
        },
        [graph, id],
    );

    // Build context menu items with bulk support
    const handleContextMenu = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            // If this edge is not selected, select it first
            const state = graph.getState();
            const currentSelectedEdges = state.selectedEdgeIds ?? [];
            const isThisSelected = currentSelectedEdges.includes(id);

            if (!isThisSelected) {
                graph.setState((s) => ({
                    ...s,
                    selectedEdgeIds: [id],
                    selectedEdgeId: id,
                    selectedNodeId: null,
                    selectedNodeIds: [],
                }));
            }

            // Target edge IDs for bulk operations
            const targetIds = isThisSelected && currentSelectedEdges.length > 1
                ? currentSelectedEdges
                : [id];

            const isBulk = targetIds.length > 1;
            const bulkLabel = isBulk ? ` (${targetIds.length} edges)` : '';

            const edgeMenuItems: ContextMenuItem[] = [
                {
                    id: 'delete',
                    label: `Delete Edge${bulkLabel}`,
                    icon: '\u{1F5D1}',
                    shortcut: 'Del',
                    onClick: () => {
                        const targetSet = new Set(targetIds);
                        graph.setState((s) => ({
                            ...s,
                            edges: s.edges.filter((ed) => !targetSet.has(ed.id)),
                            selectedEdgeId: null,
                            selectedEdgeIds: [],
                        }));
                    },
                },
                { id: 'sep1', label: '', separator: true },
                {
                    id: 'changeType',
                    label: 'Change Type',
                    submenu: [
                        {
                            id: 'type-default',
                            label: 'Default',
                            disabled: !isBulk && (!type || type === 'default'),
                            onClick: () => {
                                const targetSet = new Set(targetIds);
                                graph.setState((s) => ({
                                    ...s,
                                    edges: s.edges.map((ed) =>
                                        targetSet.has(ed.id) ? { ...ed, type: 'default' } : ed,
                                    ),
                                }));
                            },
                        },
                        {
                            id: 'type-animated',
                            label: 'Animated',
                            disabled: !isBulk && type === 'animated',
                            onClick: () => {
                                const targetSet = new Set(targetIds);
                                graph.setState((s) => ({
                                    ...s,
                                    edges: s.edges.map((ed) =>
                                        targetSet.has(ed.id) ? { ...ed, type: 'animated' } : ed,
                                    ),
                                }));
                            },
                        },
                        {
                            id: 'type-breakable',
                            label: 'Breakable',
                            disabled: !isBulk && type === 'breakable',
                            onClick: () => {
                                const targetSet = new Set(targetIds);
                                graph.setState((s) => ({
                                    ...s,
                                    edges: s.edges.map((ed) =>
                                        targetSet.has(ed.id) ? { ...ed, type: 'breakable' } : ed,
                                    ),
                                }));
                            },
                        },
                    ],
                },
                { id: 'sep2', label: '', separator: true },
                {
                    id: 'animation',
                    label: 'Animation',
                    submenu: [
                        {
                            id: 'anim-enable',
                            label: 'Enable Animation',
                            onClick: () => {
                                const targetSet = new Set(targetIds);
                                graph.setState((s) => ({
                                    ...s,
                                    edges: s.edges.map((ed) =>
                                        targetSet.has(ed.id)
                                            ? { ...ed, data: { ...(ed.data ?? {}), animated: true } }
                                            : ed,
                                    ),
                                }));
                            },
                        },
                        {
                            id: 'anim-disable',
                            label: 'Disable Animation',
                            onClick: () => {
                                const targetSet = new Set(targetIds);
                                graph.setState((s) => ({
                                    ...s,
                                    edges: s.edges.map((ed) =>
                                        targetSet.has(ed.id)
                                            ? { ...ed, data: { ...(ed.data ?? {}), animated: false } }
                                            : ed,
                                    ),
                                }));
                            },
                        },
                        { id: 'anim-sep', label: '', separator: true },
                        {
                            id: 'speed-slow',
                            label: 'Speed: Slow',
                            onClick: () => {
                                const targetSet = new Set(targetIds);
                                graph.setState((s) => ({
                                    ...s,
                                    edges: s.edges.map((ed) =>
                                        targetSet.has(ed.id)
                                            ? { ...ed, data: { ...(ed.data ?? {}), animated: true, animationSpeed: 4 } }
                                            : ed,
                                    ),
                                }));
                            },
                        },
                        {
                            id: 'speed-normal',
                            label: 'Speed: Normal',
                            onClick: () => {
                                const targetSet = new Set(targetIds);
                                graph.setState((s) => ({
                                    ...s,
                                    edges: s.edges.map((ed) =>
                                        targetSet.has(ed.id)
                                            ? { ...ed, data: { ...(ed.data ?? {}), animated: true, animationSpeed: 2 } }
                                            : ed,
                                    ),
                                }));
                            },
                        },
                        {
                            id: 'speed-fast',
                            label: 'Speed: Fast',
                            onClick: () => {
                                const targetSet = new Set(targetIds);
                                graph.setState((s) => ({
                                    ...s,
                                    edges: s.edges.map((ed) =>
                                        targetSet.has(ed.id)
                                            ? { ...ed, data: { ...(ed.data ?? {}), animated: true, animationSpeed: 0.8 } }
                                            : ed,
                                    ),
                                }));
                            },
                        },
                        { id: 'style-sep', label: '', separator: true },
                        {
                            id: 'style-dash',
                            label: 'Style: Dash',
                            onClick: () => {
                                const targetSet = new Set(targetIds);
                                graph.setState((s) => ({
                                    ...s,
                                    edges: s.edges.map((ed) =>
                                        targetSet.has(ed.id)
                                            ? { ...ed, data: { ...(ed.data ?? {}), animated: true, animationStyle: 'dash' } }
                                            : ed,
                                    ),
                                }));
                            },
                        },
                        {
                            id: 'style-pulse',
                            label: 'Style: Pulse',
                            onClick: () => {
                                const targetSet = new Set(targetIds);
                                graph.setState((s) => ({
                                    ...s,
                                    edges: s.edges.map((ed) =>
                                        targetSet.has(ed.id)
                                            ? { ...ed, data: { ...(ed.data ?? {}), animated: true, animationStyle: 'pulse' } }
                                            : ed,
                                    ),
                                }));
                            },
                        },
                    ],
                },
            ];

            showMenu({ position: { x: e.clientX, y: e.clientY }, items: edgeMenuItems });
        },
        [graph, id, type, showMenu],
    );

    // P4: LOD — определяем уровень детализации
    const lod = useContext(EdgeLODContext);

    // Determine rendering based on edge.data
    const animated = (edge.data?.animated as boolean) ?? false;
    const animationSpeed = (edge.data?.animationSpeed as number) ?? 2;
    const animationStyle = (edge.data?.animationStyle as string) ?? 'dash';
    const color = (edge.data?.color as string) ?? '#888';

    const strokeColor = isSelected ? 'var(--ff-accent, #7aa2ff)' : color;
    const strokeWidth = isSelected ? 3 : 2;

    // P4: LOD — на 'minimal' рендерим только тонкую линию
    if (lod === 'minimal') {
        return (
            <g>
                <path
                    data-edge-id={id}
                    d={path}
                    stroke="transparent"
                    fill="none"
                    strokeWidth={10}
                    style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                    onClick={handleClick}
                    onContextMenu={handleContextMenu}
                />
                <path
                    data-edge-id={id}
                    d={path}
                    stroke={strokeColor}
                    fill="none"
                    strokeWidth={1}
                    style={{ pointerEvents: 'none' }}
                />
            </g>
        );
    }

    // P4: LOD — на 'reduced' отключаем glow и анимации
    const showGlow = lod === 'full' && isSelected;
    const showAnimation = lod === 'full' && animated;

    return (
        <g>
            {/* Invisible wider path for easier pointer targeting */}
            <path
                data-edge-id={id}
                d={path}
                stroke="transparent"
                fill="none"
                strokeWidth={14}
                style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
            />
            {/* P4: Selected glow effect — only at 'full' LOD */}
            {showGlow && (
                <path
                    data-edge-id={id}
                    d={path}
                    stroke="var(--ff-accent, #7aa2ff)"
                    fill="none"
                    strokeWidth={8}
                    opacity={0.2}
                    style={{ pointerEvents: 'none' }}
                />
            )}
            {/* Visible path */}
            <path
                data-edge-id={id}
                d={path}
                stroke={strokeColor}
                fill="none"
                strokeWidth={strokeWidth}
                strokeDasharray={showAnimation ? undefined : '6 3'}
                className={[
                    isSelected ? 'edge-selected' : '',
                    showAnimation && animationStyle === 'dash' ? 'animated-edge' : '',
                    showAnimation && animationStyle === 'pulse' ? 'animated-edge-pulse' : '',
                ].filter(Boolean).join(' ') || undefined}
                style={{
                    pointerEvents: 'none',
                    ...(showAnimation && animationStyle === 'dash' ? { animation: `dash ${animationSpeed}s linear infinite`, strokeDasharray: '10 5' } : {}),
                    ...(showAnimation && animationStyle === 'pulse' ? { animation: `edgePulse ${animationSpeed}s ease-in-out infinite` } : {}),
                }}
            />
        </g>
    );
};
