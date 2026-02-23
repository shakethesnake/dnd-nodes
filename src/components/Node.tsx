import React, { useRef, useCallback, useEffect, useContext } from "react";
import { useGraph } from "../hooks/useGraph";
import { ZoomContext } from "../providers/ZoomProvider";
import { ContextMenuContext } from "../providers/ContextMenuProvider";
import type { NodeData, ContextMenuItem } from "../types/types";
import { Port } from "./Port";

export const Node: React.FC<NodeData> = ({ id, position, label }) => {
    const graph = useGraph();
    const { isPanModeRef } = useContext(ZoomContext);
    const { showMenu } = useContext(ContextMenuContext);
    const nodeRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = React.useState(false);

    const { selectedNodeId, selectedNodeIds } = graph.getState();
    const isSelected = selectedNodeIds?.includes(id) || selectedNodeId === id;
    const isPrimarySelected = selectedNodeId === id;

    /** === DRAG LOGIC (with click vs drag threshold) === */
    const DRAG_THRESHOLD = 3; // px — movement below this is treated as a click

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        // Don't start node drag in pan mode — let the event bubble to the canvas
        if (isPanModeRef.current) return;
        e.stopPropagation();
        const nodeEl = nodeRef.current;
        if (!nodeEl) return;

        const startCanvas = graph.toCanvasSpace({ x: e.clientX, y: e.clientY });
        const nodeData = graph.getState().nodes.find((n) => n.id === id);
        if (!nodeData) return;
        const startPos = nodeData.position;
        const shiftKey = e.shiftKey;

        let dragStarted = false;

        const handleMove = (ev: PointerEvent) => {
            const curCanvas = graph.toCanvasSpace({ x: ev.clientX, y: ev.clientY });
            const dx = curCanvas.x - startCanvas.x;
            const dy = curCanvas.y - startCanvas.y;

            if (!dragStarted) {
                if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
                // Threshold exceeded — start drag
                dragStarted = true;
                setIsDragging(true);
                graph.setState((s) => ({
                    ...s,
                    draggingId: id,
                }));
            }

            nodeEl.style.transform = `translate(${dx}px, ${dy}px)`;
            graph.updateEdgesForNode(id);
        };

        const handleUp = (ev: PointerEvent) => {
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", handleUp);

            if (!dragStarted) {
                // No drag happened — this is a click → update selection
                graph.setState((s) => {
                    const prevSelected = s.selectedNodeIds && s.selectedNodeIds.length > 0
                        ? s.selectedNodeIds
                        : (s.selectedNodeId ? [s.selectedNodeId] : []);

                    if (shiftKey) {
                        // Toggle this node in multi-selection
                        const alreadySelected = prevSelected.includes(id);
                        const nextSelected = alreadySelected
                            ? prevSelected.filter((sid) => sid !== id)
                            : [...prevSelected, id];
                        return {
                            ...s,
                            selectedNodeIds: nextSelected,
                            selectedNodeId: nextSelected[nextSelected.length - 1] ?? null,
                        };
                    }
                    return {
                        ...s,
                        selectedNodeId: id,
                        selectedNodeIds: [id],
                    };
                });
                return;
            }

            // Drag ended — commit position, keep selection
            const curCanvas = graph.toCanvasSpace({ x: ev.clientX, y: ev.clientY });
            const dx = curCanvas.x - startCanvas.x;
            const dy = curCanvas.y - startCanvas.y;
            const nextPosition = graph.snapPosition({
                x: startPos.x + dx,
                y: startPos.y + dy,
            });

            graph.setState((s) => ({
                ...s,
                nodes: s.nodes.map((n) =>
                    n.id === id
                        ? { ...n, position: nextPosition }
                        : n
                ),
                draggingId: null,
            }));

            nodeEl.style.top = `${nextPosition.y}px`;
            nodeEl.style.left = `${nextPosition.x}px`;
            nodeEl.style.transform = '';
            setIsDragging(false);
        };

        // Immediately select on pointerdown so the node shows as selected during drag
        // Also clear edge selection to avoid dual active objects
        graph.setState((s) => {
            const prevSelected = s.selectedNodeIds && s.selectedNodeIds.length > 0
                ? s.selectedNodeIds
                : (s.selectedNodeId ? [s.selectedNodeId] : []);

            const nextSelected = shiftKey
                ? Array.from(new Set([...prevSelected, id]))
                : [id];

            return {
                ...s,
                selectedNodeId: id,
                selectedNodeIds: nextSelected,
                selectedEdgeId: null,
                selectedEdgeIds: [],
            };
        });

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
    }, [graph, id, setIsDragging, isPanModeRef]);

    /** === NODE CONTEXT MENU === */
    const handleContextMenu = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const nodeMenuItems: ContextMenuItem[] = [
                {
                    id: 'duplicate',
                    label: 'Duplicate',
                    icon: '⎘',
                    shortcut: 'Ctrl+D',
                    onClick: () => {
                        const state = graph.getState();
                        const original = state.nodes.find((n) => n.id === id);
                        if (!original) return;
                        const newId = `${id}-copy-${Date.now()}`;
                        graph.setState((s) => ({
                            ...s,
                            nodes: [
                                ...s.nodes,
                                {
                                    ...original,
                                    id: newId,
                                    position: { x: original.position.x + 40, y: original.position.y + 40 },
                                },
                            ],
                            selectedNodeId: newId,
                            selectedNodeIds: [newId],
                        }));
                    },
                },
                { id: 'sep1', label: '', separator: true },
                {
                    id: 'delete',
                    label: 'Delete',
                    icon: '🗑',
                    shortcut: 'Del',
                    onClick: () => {
                        graph.setState((s) => ({
                            ...s,
                            nodes: s.nodes.filter((n) => n.id !== id),
                            edges: s.edges.filter(
                                (e) => e.sourceNode !== id && e.targetNode !== id,
                            ),
                            selectedNodeId: null,
                            selectedNodeIds: s.selectedNodeIds?.filter((sid) => sid !== id) ?? [],
                        }));
                    },
                },
                { id: 'sep2', label: '', separator: true },
                {
                    id: 'bringFront',
                    label: 'Bring to Front',
                    onClick: () => {
                        graph.setState((s) => {
                            const others = s.nodes.filter((n) => n.id !== id);
                            const me = s.nodes.find((n) => n.id === id);
                            if (!me) return s;
                            return { ...s, nodes: [...others, me] };
                        });
                    },
                },
                {
                    id: 'sendBack',
                    label: 'Send to Back',
                    onClick: () => {
                        graph.setState((s) => {
                            const others = s.nodes.filter((n) => n.id !== id);
                            const me = s.nodes.find((n) => n.id === id);
                            if (!me) return s;
                            return { ...s, nodes: [me, ...others] };
                        });
                    },
                },
            ];

            showMenu({ position: { x: e.clientX, y: e.clientY }, items: nodeMenuItems });
        },
        [graph, id, showMenu],
    );

    /** === REGISTER NODE === */
    const registerRef = useCallback((el: HTMLDivElement | null) => {
        if (el) {
            nodeRef.current = el;
            graph.nodeRegistry.set(id, el);
        }
    }, [graph, id]);

    useEffect(() => {
        return () => {
            graph.nodeRegistry.delete(id);
        };
    }, [id, graph]);

    return (
        <div
            ref={registerRef}
            className={`node ${isDragging ? 'dragging' : ''} ${isSelected ? 'selected' : ''}`}
            style={{
                position: "absolute",
                left: `${position.x}px`,
                top: `${position.y}px`,
                userSelect: "none",
                willChange: "transform",
                zIndex: isDragging ? 999 : isPrimarySelected ? 202 : isSelected ? 201 : 200,
                cursor: isDragging ? "grabbing" : "grab",
            }}
            onPointerDown={handlePointerDown}
            onContextMenu={handleContextMenu}
        >
            <div className="node-header">
                <div className="node-title">{label ?? id}</div>
            </div>
            <div className="ports">
                <div className="port-group">
                    <Port type="input" data={{ nodeId: id }} />
                </div>
                <div className="port-group">
                    <Port type="output" data={{ nodeId: id }} />
                </div>
            </div>
        </div>
    );
};
