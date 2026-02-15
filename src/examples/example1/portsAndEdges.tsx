// portsAndEdges.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  createLiveEdge,
  updateLiveEdge,
  removeLiveEdge,
  makePath,
  type Vec2,
  useGraph,
  useStore,
  type Graph,
// } from "flowforge-react";
} from "../../index";

import type { DamageEdge, DamageNode } from "./damageEngine";

function portCenter(el: HTMLElement | null): Vec2 | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function getPortEl(graph: Graph, nodeId: string, portId: string, portType?: "input" | "output") {
  const nodeEl = graph.nodeRegistry.get(nodeId);
  if (!nodeEl) return null;
  const typeSel = portType ? `[data-port-type="${portType}"]` : "";
  return nodeEl.querySelector<HTMLElement>(`.port${typeSel}[data-port-id="${portId}"]`);
}

// rAF-batched update paths for edges connected to a given nodeId
export const rafUpdateEdgesForNode = (() => {
  const frames = new Map<string, number>();
  return (graph: Graph, nodeId: string) => {
    const prev = frames.get(nodeId);
    if (prev) cancelAnimationFrame(prev);

    const frame = requestAnimationFrame(() => {
      frames.delete(nodeId);
      const svg = graph.getLayer("edgeLayer");
      if (!(svg instanceof SVGSVGElement)) return;

      const { edges } = graph.getState();
      const related = (edges as DamageEdge[]).filter(
        (e) => e.sourceNode === nodeId || e.targetNode === nodeId
      );

      for (const e of related) {
        const fromPort = e.data?.fromPort ?? "out";
        const toPort = e.data?.toPort ?? "in";

        const sEl = getPortEl(graph, e.sourceNode, fromPort, "output");
        const tEl = getPortEl(graph, e.targetNode, toPort, "input");
        const s = portCenter(sEl);
        const t = portCenter(tEl);
        if (!s || !t) continue;

        const pathEls = svg.querySelectorAll<SVGPathElement>(`path[data-edge-id="${e.id}"]`);
        pathEls.forEach((p) => p.setAttribute("d", makePath(s, t)));
      }
    });

    frames.set(nodeId, frame);
  };
})();

export function TypedPort(props: {
  nodeId: string;
  portId: string;
  type: "input" | "output";
  style: React.CSSProperties;
}) {
  const { nodeId, portId, type, style } = props;
  const graph = useGraph();

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (type !== "output") return;
    e.stopPropagation();

    const el = e.currentTarget;
    const start = portCenter(el);
    const layer = graph.getLayer("edgeLayer");
    if (!start || !(layer instanceof SVGSVGElement)) return;

    createLiveEdge(layer, start);

    const handleMove = (ev: PointerEvent) => updateLiveEdge(start, { x: ev.clientX, y: ev.clientY });

    const handleUp = (ev: PointerEvent) => {
      const targetEl = ev.target as HTMLElement;
      const tType = targetEl.getAttribute("data-port-type");
      const tNodeId = targetEl.getAttribute("data-port-node");
      const tPortId = targetEl.getAttribute("data-port-id");

      if (tType === "input" && tNodeId && tPortId && tNodeId !== nodeId) {
        graph.setState((s) => ({
          ...s,
          edges: [
            ...s.edges,
            {
              id: crypto.randomUUID(),
              sourceNode: nodeId,
              targetNode: tNodeId,
              type: "default",
              data: { fromPort: portId, toPort: tPortId, color: "#7aa2ff", dataType: "dist" },
            } satisfies DamageEdge,
          ],
        }));
      }

      removeLiveEdge();
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  return (
    <div
      className={`port ${type}`}
      data-port-type={type}
      data-port-node={nodeId}
      data-port-id={portId}
      onPointerDown={onPointerDown}
      style={{
        width: 10,
        height: 10,
        borderRadius: 4,
        background: type === "output" ? "#7aa2ff" : "#9ca3af",
        border: "1px solid rgba(255,255,255,0.25)",
        ...style,
      }}
    />
  );
}

export function NodeShellMultiPort(props: { node: DamageNode; children: React.ReactNode; style?: React.CSSProperties }) {
  const { node, children, style } = props;
  const graph = useGraph();
  const ref = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (ref.current) graph.nodeRegistry.set(node.id, ref.current);
    return () => {
      graph.nodeRegistry.delete(node.id);
    };
  }, [graph, node.id]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const el = ref.current;
    if (!el) return;

    const startCanvas = graph.toCanvasSpace({ x: e.clientX, y: e.clientY });
    const startPos = graph.getState().nodes.find((n) => n.id === node.id)?.position;
    if (!startPos) return;

    setDragging(true);
    graph.setState((s) => ({ ...s, draggingId: node.id }));

    const handleMove = (ev: PointerEvent) => {
      const curCanvas = graph.toCanvasSpace({ x: ev.clientX, y: ev.clientY });
      const dx = curCanvas.x - startCanvas.x;
      const dy = curCanvas.y - startCanvas.y;
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      rafUpdateEdgesForNode(graph, node.id);
    };

    const handleUp = (ev: PointerEvent) => {
      const curCanvas = graph.toCanvasSpace({ x: ev.clientX, y: ev.clientY });
      const dx = curCanvas.x - startCanvas.x;
      const dy = curCanvas.y - startCanvas.y;

      graph.setState((s) => ({
        ...s,
        nodes: s.nodes.map((n) =>
          n.id === node.id ? { ...n, position: { x: startPos.x + dx, y: startPos.y + dy } } : n
        ),
        draggingId: null,
      }));

      el.style.left = `${startPos.x + dx}px`;
      el.style.top = `${startPos.y + dy}px`;
      el.style.transform = "";
      setDragging(false);

      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  return (
    <div
      ref={ref}
      className={`node ${dragging ? "dragging" : ""}`}
      onPointerDown={onPointerDown}
      style={{
        position: "absolute",
        left: node.position.x,
        top: node.position.y,
        width: 220,
        borderRadius: 10,
        background: "rgba(17,24,39,0.9)",
        border: "1px solid rgba(255,255,255,0.12)",
        color: "white",
        userSelect: "none",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function MultiPortEdgesLayer() {
  const graph = useGraph();
  const state = useStore(graph.getStore());
  const edges = state.edges as DamageEdge[];
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    for (const e of edges) {
      const fromPort = e.data?.fromPort ?? "out";
      const toPort = e.data?.toPort ?? "in";

      const sEl = getPortEl(graph, e.sourceNode, fromPort, "output");
      const tEl = getPortEl(graph, e.targetNode, toPort, "input");
      const s = portCenter(sEl);
      const t = portCenter(tEl);
      if (!s || !t) continue;

      const pathEls = svg.querySelectorAll<SVGPathElement>(`path[data-edge-id="${e.id}"]`);
      pathEls.forEach((p) => p.setAttribute("d", makePath(s, t)));
    }
  }, [edges, graph]);

  return (
    <svg
      ref={(el) => {
        svgRef.current = el;
        if (el) graph.addLayer("edgeLayer", el);
      }}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      {edges.map((e) => (
        <path
          key={e.id}
          data-edge-id={e.id}
          d="M0,0 L0,0"
          stroke={e.data?.color ?? "#94a3b8"}
          strokeWidth={2}
          fill="none"
          strokeDasharray="6 3"
        />
      ))}
    </svg>
  );
}
