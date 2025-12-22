import React, { useRef, useCallback, useEffect } from "react";
import { useGraph } from "../hooks/useGraph";
import { createLiveEdge, updateLiveEdge, removeLiveEdge } from "../core/LiveEdge";
import type { NodeData } from "../types/types";

export const Node: React.FC<NodeData> = ({ id, position, label }) => {
    const graph = useGraph();
    const nodeRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLDivElement>(null);
    const outputRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = React.useState(false);

    /** === DRAG LOGIC === */
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        e.stopPropagation();
        const nodeEl = nodeRef.current;
        if (!nodeEl) return;

        const startCanvas = graph.toCanvasSpace({ x: e.clientX, y: e.clientY });
        const startPos = graph.getState().nodes.find((n) => n.id === id)!.position;

        // Bring node to front while dragging
        setIsDragging(true);

        graph.setState((s) => ({ ...s, draggingId: id }));

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

            graph.setState((s) => ({
                ...s,
                nodes: s.nodes.map((n) =>
                    n.id === id
                        ? { ...n, position: { x: startPos.x + dx, y: startPos.y + dy } }
                        : n
                ),
                draggingId: null,
            }));

            // nodeEl.style.top = `${rect.top}px`;
            // nodeEl.style.left = `${rect.left}px`;
            nodeEl.style.top = `${startPos.y + dy}px`;
            nodeEl.style.left = `${startPos.x + dx}px`;
            nodeEl.style.transform = '';
            // Reset dragging state
            setIsDragging(false);

            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", handleUp);
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
    }, [graph, id, setIsDragging]);

    /** === PORT CONNECTION LOGIC === */
    const handlePortPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        e.stopPropagation();
        const portEl = e.currentTarget;
        const rect = portEl.getBoundingClientRect();
        const start = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        createLiveEdge(graph.getLayer("edgeLayer") as SVGSVGElement, start);

        const handleMove = (ev: PointerEvent) => {
            updateLiveEdge(start, { x: ev.clientX, y: ev.clientY });
        };

        const handleUp = (ev: PointerEvent) => {
            const targetEl = ev.target as HTMLElement;
            const type = targetEl.getAttribute("data-port-type");
            const targetNodeId = targetEl.getAttribute("data-port-node");

            if (type === "input" && targetNodeId && targetNodeId !== id) {
                const tRect = targetEl.getBoundingClientRect();
                const targetPort = { x: tRect.x + tRect.width / 2, y: tRect.y + tRect.height / 2 };
                graph.setState((s) => ({
                    ...s,
                    edges: [
                        ...s.edges,
                        {
                            id: crypto.randomUUID(),
                            label: "Edge",
                            sourceNode: id,
                            targetNode: targetNodeId,
                            sourcePort: graph.toCanvasSpace(start),
                            targetPort: graph.toCanvasSpace(targetPort),
                        },
                    ],
                }));
            }

            removeLiveEdge();
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", handleUp);
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
    }, [graph, id]);

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
                    <div
                        className="port input"
                        data-port-type="input"
                        data-port-node={id}
                        ref={inputRef}
                    />
                </div>
                <div className="port-group">
                    <div
                        className="port output"
                        data-port-type="output"
                        data-port-node={id}
                        onPointerDown={handlePortPointerDown}
                        ref={outputRef}
                    />
                </div>
            </div>
        </div>
    );
};
