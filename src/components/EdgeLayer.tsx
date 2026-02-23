// components/EdgeLayer.tsx
import React, { useEffect, useLayoutEffect, useMemo, useRef, useContext, useCallback } from "react";
import { useGraph } from "../hooks/useGraph";
import { useStore } from "../hooks/useStore";
import { useRegistry } from "../providers/RegistryProvider";
import { bezierEdgeRouter, smoothStepEdgeRouter } from "../core/EdgeRouters";
import { ZoomContext } from "../providers/ZoomProvider";
import { viewportToCanvasAABB, isEdgeVisible, type AABB } from "../core/EdgeCulling";
import { Edge } from "./Edge";
import type { EdgeRouter, EdgeRouterPreset, EdgeData } from "../types/types";

/**
 * P4: LOD (Level of Detail) определяет уровень визуальной детализации edges.
 *
 * - 'full'    — все эффекты: glow, анимации, thick hit-area.
 * - 'reduced' — без glow, анимации упрощены.
 * - 'minimal' — тонкая линия без декораций.
 */
export type EdgeLOD = 'full' | 'reduced' | 'minimal';

/**
 * Определяет LOD на основе текущего zoom.
 * При zoom-out уменьшаем визуальную сложность.
 */
function getEdgeLOD(zoom: number): EdgeLOD {
  if (zoom >= 0.5) return 'full';
  if (zoom >= 0.25) return 'reduced';
  return 'minimal';
}

/** React context для передачи LOD в дочерние Edge-компоненты */
export const EdgeLODContext = React.createContext<EdgeLOD>('full');

/**
 * P5: Culling config
 */
interface CullingConfig {
  /** Включить visibility culling (default: false) */
  enabled: boolean;
  /** Дополнительный padding в screen-px вокруг viewport (default: 100) */
  padding: number;
  /** Расширение bbox для bezier кривых в canvas-px (default: 50) */
  bezierExpand: number;
}

const DEFAULT_CULLING: CullingConfig = {
  enabled: false,
  padding: 100,
  bezierExpand: 50,
};

/**
 * EdgesLayer Component
 * Renders all edges in the graph with performance optimizations:
 * - P1: Incremental updates via dirty set (in Graph.updateEdgesForNode)
 * - P2: Path element registry (avoids querySelectorAll)
 * - P3: Memoized routing cache (in Graph.routeCache)
 * - P4: LOD — reduced visual detail at low zoom
 * - P5: Visibility culling — skip rendering off-screen edges
 */
export const EdgesLayer: React.FC<{
  type?: "svg" | "webgl";
  edgeRouter?: EdgeRouterPreset | EdgeRouter;
  /** P5: Enable edge visibility culling */
  edgeCulling?: boolean;
  /** P5: Extra padding around viewport for culling (px) */
  edgeCullingPadding?: number;
}> = ({
  type = "svg",
  edgeRouter = "bezier",
  edgeCulling = false,
  edgeCullingPadding = 100,
}) => {
  const graph = useGraph();
  const { edges } = useStore(graph.getStore());
  const { edgeTypes } = useRegistry();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const renderMode = type === "webgl" ? "webgl" : "svg";

  // P4: LOD — получаем zoom из ZoomContext
  const { x: panX, y: panY, zoom, containerRef } = useContext(ZoomContext);
  const lod = useMemo(() => getEdgeLOD(zoom), [zoom]);

  const routeEdge = useMemo<EdgeRouter>(() => {
    if (typeof edgeRouter === "function") return edgeRouter;
    if (edgeRouter === "smoothStep") return smoothStepEdgeRouter;
    return bezierEdgeRouter;
  }, [edgeRouter]);

  // P3: Оборачиваем router в кеширующий слой
  const cachedRouteEdge = useCallback<EdgeRouter>((source, target, edge) => {
    const cached = graph.routeCache.get(source, target, edge);
    if (cached !== undefined) return cached;

    const path = routeEdge(source, target, edge);
    graph.routeCache.set(source, target, path, edge);
    return path;
  }, [routeEdge, graph.routeCache]);

  useEffect(() => {
    if (renderMode === "webgl") {
      console.warn("[FlowForge] EdgesLayer type=\"webgl\" is not implemented yet. Falling back to SVG.");
    }
  }, [renderMode]);

  useEffect(() => {
    graph.setEdgeRouter(cachedRouteEdge);
  }, [graph, cachedRouteEdge]);

  // P1: Перестраиваем nodeToEdge индекс при структурных изменениях
  useEffect(() => {
    graph.rebuildEdgeIndex();
  }, [edges, graph]);

  // P5: Вычисляем viewport AABB для culling
  const viewportAABB = useMemo<AABB | null>(() => {
    if (!edgeCulling) return null;
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return viewportToCanvasAABB(
      rect.width, rect.height,
      panX, panY, zoom,
      edgeCullingPadding
    );
  }, [edgeCulling, panX, panY, zoom, edgeCullingPadding, containerRef]);

  // P5: Фильтруем edges по visibility
  const visibleEdges = useMemo(() => {
    if (!edgeCulling || !viewportAABB) return edges;

    return edges.filter((e) => {
      // Если у edge есть координаты портов — используем их
      if (e.sourcePort && e.targetPort) {
        return isEdgeVisible(e.sourcePort, e.targetPort, viewportAABB);
      }
      // Fallback: используем позиции нод (грубая аппроксимация)
      const state = graph.getState();
      const sourceNode = state.nodes.find(n => n.id === e.sourceNode);
      const targetNode = state.nodes.find(n => n.id === e.targetNode);
      if (sourceNode && targetNode) {
        return isEdgeVisible(sourceNode.position, targetNode.position, viewportAABB, 150);
      }
      // Если не можем определить позицию — рендерим на всякий случай
      return true;
    });
  }, [edges, edgeCulling, viewportAABB, graph]);

  // Render edges using their specific component types
  const edgeElements = useMemo(() => {
    return visibleEdges.map((e) => {
      const EdgeComponent = edgeTypes[e.type || 'default'] || edgeTypes['default'] || Edge;
      return <EdgeComponent key={e.id} {...e} />;
    });
  }, [visibleEdges, edgeTypes]);

  // P2: Регистрация path-элементов + initial path calculation
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    for (const e of visibleEdges) {
      // P2: Находим path-элементы и регистрируем в pathRegistry
      const pathEls = svg.querySelectorAll<SVGPathElement>(`path[data-edge-id="${e.id}"]`);
      pathEls.forEach((pathEl) => {
        // Регистрируем в старом edgeRegistry (backward compat)
        graph.registerEdge(e.id, pathEl);
        // P2: Регистрируем в новом pathRegistry
        graph.pathRegistry.registerPath(e.id, pathEl);

        const ports = graph.getRelatedEdgePorts(e.id);
        const s = ports?.sourceNodePort?.outputPort;
        const t = ports?.targetNodePort?.inputPort;
        if (s && t) {
          // P3: Используем кеширующий router
          pathEl.setAttribute("d", cachedRouteEdge(s, t, e));
        }
      });
    }

    // Cleanup: unregister paths при unmount/re-render
    return () => {
      for (const e of visibleEdges) {
        graph.pathRegistry.unregisterAllPaths(e.id);
      }
    };
  }, [visibleEdges, graph, cachedRouteEdge]);

  return (
    <EdgeLODContext.Provider value={lod}>
      <svg
        ref={(el) => {
          svgRef.current = el;
          if (el) graph.addLayer("edgeLayer", el);
        }}
        className="edges-layer"
        data-edge-renderer={renderMode === "webgl" ? "svg-fallback" : "svg"}
        data-edge-lod={lod}
        overflow="visible"
        style={{ position: "absolute", width: "100%", height: "100%", overflow: "visible", pointerEvents: "none", inset: 0 }}
      >
        {edgeElements}
      </svg>
    </EdgeLODContext.Provider>
  );
};
