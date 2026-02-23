import React, { useRef, useCallback, useEffect, useContext } from "react";
import { useGraph } from "../hooks/useGraph";
import { ZoomContext } from "../providers/ZoomProvider";
import type { NodeData } from "../types/types";
import { Port } from "./Port";

/**
 * ExperimentalNode - Node with ports positioned on the sides (external)
 *
 * This node demonstrates:
 * - Ports positioned outside the node boundaries (left and right sides)
 * - Cleaner edge connections that don't go under the node
 * - Modern card-style design with better visual hierarchy
 */
export const ExperimentalNode: React.FC<NodeData> = ({ id, position, label, data }) => {
    const graph = useGraph();
    const { isPanModeRef } = useContext(ZoomContext);
    const nodeRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = React.useState(false);

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
    },  [id, graph]);

    // Extract custom data
    const icon = (data?.icon as string) || '🔬';
    const subtitle = (data?.subtitle as string) || 'Experimental';
    const variant = (data?.variant as string) || 'default';

    return (
        <div
            ref={registerRef}
            className={`node experimental-node experimental-node-${variant} ${isDragging ? 'dragging' : ''} ${isSelected ? 'selected' : ''}`}
            style={{
                position: "absolute",
                left: `${position.x}px`,
                top: `${position.y}px`,
                userSelect: "none",
                zIndex: isDragging ? 999 : isPrimarySelected ? 202 : isSelected ? 201 : 200,
                cursor: isDragging ? "grabbing" : "grab",
                willChange: "transform",
            }}
            onPointerDown={handlePointerDown}
        >
            {/* Left side input port */}
            <div className="experimental-port-container left">
                <Port
                    className="experimental-port"
                    type="input"
                    data={{ nodeId: id }}
                    style={{ cursor: "default" }}
                />
            </div>

            {/* Node content */}
            <div className="experimental-node-content">
                <div className="experimental-node-icon">{icon}</div>
                <div className="experimental-node-text">
                    <div className="experimental-node-title">{label ?? id}</div>
                    <div className="experimental-node-subtitle">{subtitle}</div>
                </div>
            </div>

            {/* Right side output port */}
            <div className="experimental-port-container right">
                <Port className="experimental-port" type="output" data={{ nodeId: id }} />
            </div>
        </div>
    );
};
