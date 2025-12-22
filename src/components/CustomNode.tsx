import React, { useEffect } from "react";
import { useGraph } from "../hooks/useGraph";
import { NodeShell } from "./NodeShell";
import type { NodeData } from "../types/types";
import { Port } from "./Port";

/**
 * CustomNode - Example of a custom node type with different styling and behavior
 *
 * This node demonstrates:
 * - Custom styling (purple/pink gradient)
 * - Custom icon/emoji display
 * - Custom data handling
 * - Multiple input/output ports
 */
export const CustomNode: React.FC<NodeData> = ({ id, position, label, data }) => {
    const graph = useGraph();


    useEffect(() => {
        console.log(`Registering custom node ${id}`);
        return () => {
            graph.nodeRegistry.delete(id);
        };
    }, [id, graph]);

    // Extract custom data
    const icon = (data?.icon as string) || '⚡';
    const description = (data?.description as string) || '';
    const color = (data?.color as string) || 'purple';

    return (
        <NodeShell data={{ id, position, label, data }} style={{
            position: "absolute",
            left: `${position.x}px`,
            top: `${position.y}px`,
            userSelect: "none",
            willChange: "transform",
            background: color === 'purple'
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : color === 'blue'
                    ? 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)'
                    : color === 'green'
                        ? 'linear-gradient(135deg, #065f46 0%, #10b981 100%)'
                        : 'linear-gradient(135deg, #dc2626 0%, #f97316 100%)',
            border: '2px solid rgba(255, 255, 255, 0.2)',
            minWidth: '180px',
        }}>
            <div style={{
                position: 'relative'
            }}>
                <div className="node-header" style={{
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                    <div style={{ fontSize: '20px' }}>{icon}</div>
                    <div className="node-title" style={{ flex: 1, fontWeight: 600 }}>
                        {label ?? id}
                    </div>
                </div>
                <Port type='input' data={{ nodeId: id }} style={{
                    position: 'absolute',
                    left: -8,
                    top: '49%',
                    width: 10,
                    height: 10,
                    background: 'gray',
                    borderRadius: 0,
                    border: 'none',
                }} />
                <Port type='output' data={{ nodeId: id }} style={{
                    position: 'absolute',
                    top: '50%',
                    right: -8,

                }} />
                {description && (
                    <div className="node-body" style={{
                        fontSize: '11px',
                        color: 'rgba(255, 255, 255, 0.9)',
                        padding: '8px 10px'
                    }}>
                        {description}
                    </div>
                )}
            </div>

        </NodeShell>
    );
};

// import React, { useRef, useCallback, useEffect } from "react";
// import { useGraph } from "../hooks/useGraph";
// import { createLiveEdge, updateLiveEdge, removeLiveEdge } from "../core/LiveEdge";
// import type { NodeData } from "../types/types";

// /**
//  * CustomNode - Example of a custom node type with different styling and behavior
//  *
//  * This node demonstrates:
//  * - Custom styling (purple/pink gradient)
//  * - Custom icon/emoji display
//  * - Custom data handling
//  * - Multiple input/output ports
//  */
// export const CustomNode: React.FC<NodeData> = ({ id, position, label, data }) => {
//     const graph = useGraph();
//     const nodeRef = useRef<HTMLDivElement>(null);
//     const [isDragging, setIsDragging] = React.useState(false);

//     /** === DRAG LOGIC === */
//     const handlePointerDown = useCallback((e: React.PointerEvent) => {
//         e.stopPropagation();
//         const nodeEl = nodeRef.current;
//         if (!nodeEl) return;

//         const startCanvas = graph.toCanvasSpace({ x: e.clientX, y: e.clientY });
//         const startPos = graph.getState().nodes.find((n) => n.id === id)!.position;

//         // Bring node to front while dragging
//         setIsDragging(true);

//         graph.setState((s) => ({ ...s, draggingId: id }));

//         const handleMove = (ev: PointerEvent) => {
//             const curCanvas = graph.toCanvasSpace({ x: ev.clientX, y: ev.clientY });
//             const dx = curCanvas.x - startCanvas.x;
//             const dy = curCanvas.y - startCanvas.y;
//             nodeEl.style.transform = `translate(${dx}px, ${dy}px)`;
//             graph.updateEdgesForNode(id);
//         };

//         const handleUp = (ev: PointerEvent) => {
//             const curCanvas = graph.toCanvasSpace({ x: ev.clientX, y: ev.clientY });
//             const dx = curCanvas.x - startCanvas.x;
//             const dy = curCanvas.y - startCanvas.y;

//             graph.setState((s) => ({
//                 ...s,
//                 nodes: s.nodes.map((n) =>
//                     n.id === id
//                         ? { ...n, position: { x: startPos.x + dx, y: startPos.y + dy } }
//                         : n
//                 ),
//                 draggingId: null,
//             }));

//             nodeEl.style.top = `${startPos.y + dy}px`;
//             nodeEl.style.left = `${startPos.x + dx}px`;
//             nodeEl.style.transform = '';
//             // Reset dragging state
//             setIsDragging(false);

//             window.removeEventListener("pointermove", handleMove);
//             window.removeEventListener("pointerup", handleUp);
//         };

//         window.addEventListener("pointermove", handleMove);
//         window.addEventListener("pointerup", handleUp);
//     }, [graph, id, setIsDragging]);

//     /** === PORT CONNECTION LOGIC === */
//     const handlePortPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
//         e.stopPropagation();
//         const portEl = e.currentTarget;
//         const rect = portEl.getBoundingClientRect();
//         const start = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
//         createLiveEdge(graph.getLayer("edgeLayer") as SVGSVGElement, start);

//         const handleMove = (ev: PointerEvent) => {
//             updateLiveEdge(start, { x: ev.clientX, y: ev.clientY });
//         };

//         const handleUp = (ev: PointerEvent) => {
//             const targetEl = ev.target as HTMLElement;
//             const type = targetEl.getAttribute("data-port-type");
//             const targetNodeId = targetEl.getAttribute("data-port-node");

//             if (type === "input" && targetNodeId && targetNodeId !== id) {
//                 const tRect = targetEl.getBoundingClientRect();
//                 const targetPort = { x: tRect.x + tRect.width / 2, y: tRect.y + tRect.height / 2 };
//                 graph.setState((s) => ({
//                     ...s,
//                     edges: [
//                         ...s.edges,
//                         {
//                             id: crypto.randomUUID(),
//                             label: "Edge",
//                             sourceNode: id,
//                             targetNode: targetNodeId,
//                             sourcePort: graph.toCanvasSpace(start),
//                             targetPort: graph.toCanvasSpace(targetPort),
//                         },
//                     ],
//                 }));
//             }

//             removeLiveEdge();
//             window.removeEventListener("pointermove", handleMove);
//             window.removeEventListener("pointerup", handleUp);
//         };

//         window.addEventListener("pointermove", handleMove);
//         window.addEventListener("pointerup", handleUp);
//     }, [graph, id]);

//     /** === REGISTER NODE === */
//     const registerRef = useCallback((el: HTMLDivElement | null) => {
//         if (el) {
//             nodeRef.current = el;
//             console.log('node', id, el)
//             graph.nodeRegistry.set(id, el);
//         }
//     }, [graph, id]);

//     useEffect(() => {
//         console.log(`Registering custom node ${id}`);
//         return () => {
//             graph.nodeRegistry.delete(id);
//         };
//     },  [id, graph]);

//     // Extract custom data
//     const icon = (data?.icon as string) || '⚡';
//     const description = (data?.description as string) || '';
//     const color = (data?.color as string) || 'purple';

//     return (
//         <div
//             ref={registerRef}
//             className={`node custom-node ${isDragging ? 'dragging' : ''}`}
//             style={{
//                 position: "absolute",
//                 left: `${position.x}px`,
//                 top: `${position.y}px`,
//                 userSelect: "none",
//                 willChange: "transform",
//                 background: color === 'purple'
//                     ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
//                     : color === 'blue'
//                     ? 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)'
//                     : color === 'green'
//                     ? 'linear-gradient(135deg, #065f46 0%, #10b981 100%)'
//                     : 'linear-gradient(135deg, #dc2626 0%, #f97316 100%)',
//                 border: '2px solid rgba(255, 255, 255, 0.2)',
//                 minWidth: '180px',
//             }}
//             onPointerDown={handlePointerDown}
//         >
//             <div className="node-header" style={{
//                 background: 'rgba(0, 0, 0, 0.2)',
//                 borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
//             }}>
//                 <div style={{ fontSize: '20px' }}>{icon}</div>
//                 <div className="node-title" style={{ flex: 1, fontWeight: 600 }}>
//                     {label ?? id}
//                 </div>
//             </div>
//             {description && (
//                 <div className="node-body" style={{
//                     fontSize: '11px',
//                     color: 'rgba(255, 255, 255, 0.9)',
//                     padding: '8px 10px'
//                 }}>
//                     {description}
//                 </div>
//             )}
//             <div className="ports">
//                 <div className="port-group">
//                     {/* Multiple input ports */}
//                     <div
//                         className="port input"
//                         data-port-type="input"
//                         data-port-node={id}
//                         title="Input 1"
//                     />
//                 </div>
//                 <div className="port-group">
//                     {/* Multiple output ports */}
//                     <div
//                         className="port output"
//                         data-port-type="output"
//                         data-port-node={id}
//                         onPointerDown={handlePortPointerDown}
//                         title="Output 1"
//                     />
//                 </div>
//             </div>
//         </div>
//     );
// };
