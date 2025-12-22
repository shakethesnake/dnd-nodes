// components/EdgeLayer.tsx
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useGraph } from "../hooks/useGraph";
import { useStore } from "../hooks/useStore";
import type { EdgeData } from "../types/types";
import { makePath } from "../core/LiveEdge";
import { Edge } from "./Edge";
import { AnimatedEdge } from "./AnimatedEdge";
import { BreakableEdge } from "./BreakableEdge";

// Edge type registry - map edge types to their components
const edgeTypes = {
  default: Edge,
  animated: AnimatedEdge,
  breakable: BreakableEdge,
};

export const EdgesLayer: React.FC<{ type?: "svg" | "webgl" }> = ({ type = "svg" }) => {
  const graph = useGraph();
  const { edges } = useStore(graph.getStore());
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Render edges using their specific component types
  const edgeElements = useMemo(() => {
    return edges.map((e) => {
      const EdgeComponent = edgeTypes[e.type as keyof typeof edgeTypes] || Edge;
      return <EdgeComponent key={e.id} {...e} />;
    });
  }, [edges]);

  // Update edge paths and ports when edges change
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    // debugger
    for (const e of edges) {
      // Find all path elements for this edge (some custom edges may have multiple paths)
      const pathEls = svg.querySelectorAll<SVGPathElement>(`path[data-edge-id="${e.id}"]`);
      pathEls.forEach((pathEl) => {
        // Register for compatibility (updateEdgesForNode uses edgeRegistry)
        graph.registerEdge(e.id, pathEl);

        const ports = graph.getRelatedEdgePorts(e.id);
        const s = ports?.sourceNodePort?.outputPort;
        const t = ports?.targetNodePort?.inputPort;
        if (s && t) {
          pathEl.setAttribute("d", makePath(s, t));
        }
      });
    }
  }, [edges, graph]);

  return (
    <svg
      ref={(el) => {
        svgRef.current = el;
        if (el) graph.addLayer("edgeLayer", el);
      }}
      className="edges-layer"
      style={{ position: "absolute", width: "100%", height: "100%" }}
    >
      {edgeElements}
    </svg>
  );
};
