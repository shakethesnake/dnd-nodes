// components/EdgeLayer.tsx
import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useGraph } from "../hooks/useGraph";
import { useStore } from "../hooks/useStore";
import { useRegistry } from "../providers/RegistryProvider";
import { bezierEdgeRouter, smoothStepEdgeRouter } from "../core/EdgeRouters";
import { Edge } from "./Edge";
import type { EdgeRouter, EdgeRouterPreset } from "../types/types";

/**
 * EdgesLayer Component
 * Renders all edges in the graph
 * Uses edge types from RegistryProvider context
 */
export const EdgesLayer: React.FC<{ type?: "svg" | "webgl"; edgeRouter?: EdgeRouterPreset | EdgeRouter }> = ({
  type = "svg",
  edgeRouter = "bezier",
}) => {
  const graph = useGraph();
  const { edges } = useStore(graph.getStore());
  const { edgeTypes } = useRegistry();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const renderMode = type === "webgl" ? "webgl" : "svg";

  const routeEdge = useMemo<EdgeRouter>(() => {
    if (typeof edgeRouter === "function") return edgeRouter;
    if (edgeRouter === "smoothStep") return smoothStepEdgeRouter;
    return bezierEdgeRouter;
  }, [edgeRouter]);

  useEffect(() => {
    if (renderMode === "webgl") {
      console.warn("[FlowForge] EdgesLayer type=\"webgl\" is not implemented yet. Falling back to SVG.");
    }
  }, [renderMode]);

  useEffect(() => {
    graph.setEdgeRouter(routeEdge);
  }, [graph, routeEdge]);

  // Render edges using their specific component types
  const edgeElements = useMemo(() => {
    return edges.map((e) => {
      // Get edge component from registry, fallback to default Edge
      const EdgeComponent = edgeTypes[e.type || 'default'] || edgeTypes['default'] || Edge;
      return <EdgeComponent key={e.id} {...e} />;
    });
  }, [edges, edgeTypes]);

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
          pathEl.setAttribute("d", routeEdge(s, t, e));
        }
      });
    }
  }, [edges, graph, routeEdge]);

  return (
    <svg
      ref={(el) => {
        svgRef.current = el;
        if (el) graph.addLayer("edgeLayer", el);
      }}
      className="edges-layer"
      data-edge-renderer={renderMode === "webgl" ? "svg-fallback" : "svg"}
      style={{ position: "absolute", width: "100%", height: "100%" }}
    >
      {edgeElements}
    </svg>
  );
};
