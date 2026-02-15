import React, { useRef, useCallback, useEffect } from "react";
import { useGraph } from "../hooks/useGraph";
import type { NodeData } from "../types/types";
import { Port } from "./Port";

export const Node: React.FC<NodeData> = ({ id, position, label }) => {
    const graph = useGraph();
    const nodeRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = React.useState(false);

    /** === DRAG LOGIC === */
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        e.stopPropagation();
        const nodeEl = nodeRef.current;
        if (!nodeEl) return;

        const startCanvas = graph.toCanvasSpace({ x: e.clientX, y: e.clientY });
        const nodeData = graph.getState().nodes.find((n) => n.id === id);
        if (!nodeData) return;
        const startPos = nodeData.position;

        // Bring node to front while dragging
        setIsDragging(true);

        graph.setState((s) => {
            const prevSelected = s.selectedNodeIds && s.selectedNodeIds.length > 0
                ? s.selectedNodeIds
                : (s.selectedNodeId ? [s.selectedNodeId] : []);

            const selectedNodeIds = e.shiftKey
                ? Array.from(new Set([...prevSelected, id]))
                : [id];

            return {
                ...s,
                draggingId: id,
                selectedNodeId: id,
                selectedNodeIds,
            };
        });

        const handleMove = (ev: PointerEvent) => {
            const curCanvas = graph.toCanvasSpace({ x: ev.clientX, y: ev.clientY });
            const dx = curCanvas.x - startCanvas.x;
            const dy = curCanvas.y - startCanvas.y;
            nodeEl.style.transform = `translate(${dx}px, ${dy}px)`;
            graph.updateEdgesForNode(id);
        };

        const handleUp = (ev: PointerEvent) => {
            const curCanvas = graph.toCanvasSpace({ x: ev.clientX, y: ev.clientY });
            // const rect = nodeEl!.getBoundingClientRect();
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

            // nodeEl.style.top = `${rect.top}px`;
            // nodeEl.style.left = `${rect.left}px`;
            nodeEl.style.top = `${nextPosition.y}px`;
            nodeEl.style.left = `${nextPosition.x}px`;
            nodeEl.style.transform = '';
            // Reset dragging state
            setIsDragging(false);

            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", handleUp);
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
    }, [graph, id, setIsDragging]);

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
            className={`node ${isDragging ? 'dragging' : ''}`}
            style={{
                position: "absolute",
                left: `${position.x}px`,
                top: `${position.y}px`,
                userSelect: "none",
                willChange: "transform",
            }}
            onPointerDown={handlePointerDown}
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
