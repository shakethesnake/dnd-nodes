import React, { useRef, useCallback, useEffect, useContext, type PropsWithChildren } from "react";
import { useGraph } from "../hooks/useGraph";
import { ZoomContext } from "../providers/ZoomProvider";
import type { NodeData, Vec2 } from "../types/types";

interface NodeShellProps extends PropsWithChildren {
    data?: {
        id: string;
        position: Vec2;
        label?: string;
    } & Partial<NodeData>;
    style?: React.CSSProperties;
}

export const NodeShell: React.FC<NodeShellProps> = (props) => {
    const graph = useGraph();
    const { isPanModeRef } = useContext(ZoomContext);
    const nodeRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = React.useState(false);
    const {
        data,
        children,
        style,
    } = props;
    const { id = '' } = data || {};

    const { selectedNodeId, selectedNodeIds } = graph.getState();
    const isSelected = selectedNodeIds?.includes(id) || selectedNodeId === id;
    const isPrimarySelected = selectedNodeId === id;

    /** === DRAG LOGIC (with click vs drag threshold) === */
    const DRAG_THRESHOLD = 3;

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
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
                graph.setState((s) => {
                    const prevSelected = s.selectedNodeIds && s.selectedNodeIds.length > 0
                        ? s.selectedNodeIds
                        : (s.selectedNodeId ? [s.selectedNodeId] : []);

                    if (shiftKey) {
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

        // Immediately select on pointerdown + clear edge selection
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
                ...style,
                zIndex: isDragging ? 999 : isPrimarySelected ? 202 : isSelected ? 201 : 200,
                cursor: isDragging ? "grabbing" : "grab",
            }}
            onPointerDown={handlePointerDown}
        >
            <div className="">
                {children}
            </div>
        </div>
    );
};
