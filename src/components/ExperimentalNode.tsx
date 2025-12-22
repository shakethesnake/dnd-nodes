import React, { useRef, useCallback, useEffect } from "react";
import { useGraph } from "../hooks/useGraph";
import { createLiveEdge, updateLiveEdge, removeLiveEdge } from "../core/LiveEdge";
import type { NodeData } from "../types/types";

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
    const nodeRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = React.useState(false);

    const { selectedNodeId } = graph.getState();
    const isSelected = selectedNodeId === id;

    /** === DRAG LOGIC === */
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        e.stopPropagation();
        const nodeEl = nodeRef.current;
        if (!nodeEl) return;

        const startCanvas = graph.toCanvasSpace({ x: e.clientX, y: e.clientY });
        const startPos = graph.getState().nodes.find((n) => n.id === id)!.position;

        // Bring node to front while dragging
        setIsDragging(true);

        graph.setState((s) => ({ ...s, draggingId: id, selectedNodeId: id }));

        const handleMove = (ev: PointerEvent) => {
            const curCanvas = graph.toCanvasSpace({ x: ev.clientX, y: ev.clientY });
            const dx = curCanvas.x - startCanvas.x;
            const dy = curCanvas.y - startCanvas.y;
            nodeEl.style.transform = `translate(${dx}px, ${dy}px)`;
            graph.updateEdgesForNode(id);
        };

        const handleUp = (ev: PointerEvent) => {
            const curCanvas = graph.toCanvasSpace({ x: ev.clientX, y: ev.clientY });
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
                // Keep selectedNodeId so the node and its edges stay on top after drop
            }));

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
                willChange: "transform",
            }}
            onPointerDown={handlePointerDown}
        >
            {/* Left side input port */}
            <div className="experimental-port-container left">
                <div
                    className="port input experimental-port"
                    data-port-type="input"
                    data-port-node={id}
                    title="Input"
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
                <div
                    className="port output experimental-port"
                    data-port-type="output"
                    data-port-node={id}
                    onPointerDown={handlePortPointerDown}
                    title="Output"
                />
            </div>
        </div>
    );
};
