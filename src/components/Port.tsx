import { useCallback } from "react";
import { createLiveEdge, updateLiveEdge, removeLiveEdge } from "../core/LiveEdge";
import { useGraph } from "../hooks/useGraph";

export function Port(props) {
    const graph = useGraph();
    const {
        type = 'input',
        className,
        style = {},
        data,
        ...rest
    } = props;
    const classList = ['port', type, className].join(' ');
    const { nodeId } = data;

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

            if (type === "input" && targetNodeId && targetNodeId !== nodeId) {
                const tRect = targetEl.getBoundingClientRect();
                const targetPort = { x: tRect.x + tRect.width / 2, y: tRect.y + tRect.height / 2 };
                graph.setState((s) => ({
                    ...s,
                    edges: [
                        ...s.edges,
                        {
                            id: crypto.randomUUID(),
                            label: "Edge",
                            sourceNode: nodeId,
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
    }, [graph, nodeId]);

    return (
        <div
            className={classList}
            style={style}
            data-port-type="input"
            data-port-node={nodeId}
            onPointerDown={handlePortPointerDown}
            {...rest}
        ></div>
    );
}