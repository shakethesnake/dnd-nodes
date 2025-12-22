import React, { useRef, useCallback, useEffect, type PropsWithChildren } from "react";
import { useGraph } from "../hooks/useGraph";
import { createLiveEdge, updateLiveEdge, removeLiveEdge } from "../core/LiveEdge";
// import type { NodeData } from "../types/types";

export const NodeShell: React.FC<PropsWithChildren> = (props) => {
    const graph = useGraph();
    const nodeRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLDivElement>(null);
    const outputRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = React.useState(false)
    debugger
    const {
        data = {},
        children,
        style,
        ...rest
    } = props;
    const { id, position, label } = data;

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
            style={style ?? {}}
            onPointerDown={handlePointerDown}
        >
            <div className="">
                {children}
            </div>
        </div>
    );
};
