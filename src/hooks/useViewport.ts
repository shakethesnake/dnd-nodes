import { useState, useEffect, useCallback, useRef } from 'react';
import type { Vec2, NodeData } from '../types/types';

interface ViewportBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface ViewportTransform {
  x: number;
  y: number;
  zoom: number;
}

interface UseViewportOptions {
  /** Padding around the viewport to pre-render nodes slightly outside view */
  padding?: number;
  /** Throttle delay for scroll/resize events in ms */
  throttleMs?: number;
  /** Viewport transform (for zoom/pan support) - optional, will be integrated with Feature 2 */
  transform?: ViewportTransform;
  /** Enable spatial optimization for large graphs (>500 nodes) */
  useSpatialOptimization?: boolean;
}

/**
 * Hook for viewport-based rendering optimization.
 * Returns functions to determine which nodes are visible in the current viewport.
 */
export function useViewport(
  containerRef: React.RefObject<HTMLElement | null>,
  options: UseViewportOptions = {}
) {
  const {
    padding = 100,
    throttleMs = 16,
    transform,
    useSpatialOptimization = false,
  } = options;
  const [bounds, setBounds] = useState<ViewportBounds | null>(null);
  const throttleRef = useRef<number | null>(null);
  const updateBoundsRef = useRef<() => void>(() => {});

  const updateBounds = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();

    // If viewport transform is provided, calculate bounds in canvas space
    // Otherwise, use screen space (backward compatible)
    if (transform) {
      const { x, y, zoom } = transform;
      // Convert viewport rectangle from screen space to canvas space.
      // transform is: screen = canvas * zoom - pan
      setBounds({
        left: (x - padding) / zoom,
        top: (y - padding) / zoom,
        right: (x + rect.width + padding) / zoom,
        bottom: (y + rect.height + padding) / zoom,
        width: rect.width / zoom,
        height: rect.height / zoom,
      });
    } else {
      // Default behavior (screen space) - infinite canvas friendly
      setBounds({
        left: -padding,
        top: -padding,
        right: rect.width + padding,
        bottom: rect.height + padding,
        width: rect.width,
        height: rect.height,
      });
    }
  }, [containerRef, padding, transform]);

  useEffect(() => {
    updateBoundsRef.current = updateBounds;
  }, [updateBounds]);

  const throttledUpdateBounds = useCallback(() => {
    if (throttleRef.current) return;

    throttleRef.current = window.setTimeout(() => {
      updateBoundsRef.current();
      throttleRef.current = null;
    }, throttleMs);
  }, [throttleMs]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Use ResizeObserver for container size changes
    const resizeObserver = new ResizeObserver(throttledUpdateBounds);
    resizeObserver.observe(container);

    // Listen for scroll events on the container
    container.addEventListener('scroll', throttledUpdateBounds, { passive: true });

    // Listen for window resize
    window.addEventListener('resize', throttledUpdateBounds, { passive: true });

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener('scroll', throttledUpdateBounds);
      window.removeEventListener('resize', throttledUpdateBounds);
      if (throttleRef.current) {
        clearTimeout(throttleRef.current);
      }
    };
  }, [containerRef, throttledUpdateBounds]);

  useEffect(() => {
    updateBounds();
  }, [updateBounds]);

  /**
   * Check if a point is within the viewport bounds
   */
  const isPointVisible = useCallback(
    (point: Vec2): boolean => {
      if (!bounds) return true; // Default to visible if bounds not calculated
      return (
        point.x >= bounds.left &&
        point.x <= bounds.right &&
        point.y >= bounds.top &&
        point.y <= bounds.bottom
      );
    },
    [bounds]
  );

  /**
   * Check if a node is visible in the viewport (based on position)
   */
  const isNodeVisible = useCallback(
    (node: NodeData, nodeWidth = 200, nodeHeight = 100): boolean => {
      if (!bounds) return true;

      // Check if any corner of the node is visible
      const { x, y } = node.position;
      return !(
        x + nodeWidth < bounds.left ||
        x > bounds.right ||
        y + nodeHeight < bounds.top ||
        y > bounds.bottom
      );
    },
    [bounds]
  );

  /**
   * Filter nodes to only those visible in the viewport
   * Optimized for large graphs when spatial optimization is enabled
   */
  const filterVisibleNodes = useCallback(
    <T extends NodeData>(nodes: T[], nodeWidth = 200, nodeHeight = 100): T[] => {
      if (!bounds) return nodes;

      // For small graphs, simple filter is fastest
      if (!useSpatialOptimization || nodes.length < 500) {
        return nodes.filter((node) => isNodeVisible(node, nodeWidth, nodeHeight));
      }

      // For large graphs (>500 nodes), use optimized spatial culling
      // Pre-calculate bounds once
      const { left, right, top, bottom } = bounds;
      const visible: T[] = [];

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const { x, y } = node.position;

        // Quick rejection test - faster than full intersection
        if (x + nodeWidth >= left && x <= right && y + nodeHeight >= top && y <= bottom) {
          visible.push(node);
        }
      }

      return visible;
    },
    [bounds, isNodeVisible, useSpatialOptimization]
  );

  /**
   * Get the count of nodes that would be visible
   */
  const countVisibleNodes = useCallback(
    (nodes: NodeData[], nodeWidth = 200, nodeHeight = 100): number => {
      if (!bounds) return nodes.length;
      return nodes.filter((node) => isNodeVisible(node, nodeWidth, nodeHeight)).length;
    },
    [bounds, isNodeVisible]
  );

  /**
   * Get canvas bounds that encompass all nodes plus buffer
   * Useful for calculating "fit to screen" or determining infinite canvas size
   */
  const getCanvasBounds = useCallback(
    (nodes: NodeData[], buffer = 200): ViewportBounds | null => {
      if (nodes.length === 0) return null;

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const node of nodes) {
        const { x, y } = node.position;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }

      return {
        left: minX - buffer,
        top: minY - buffer,
        right: maxX + buffer,
        bottom: maxY + buffer,
        width: maxX - minX + buffer * 2,
        height: maxY - minY + buffer * 2,
      };
    },
    []
  );

  /**
   * Calculate optimal viewport transform to fit all nodes in view
   * Returns transform that will be used when zoom/pan is implemented
   */
  const getFitViewTransform = useCallback(
    (nodes: NodeData[], containerWidth: number, containerHeight: number): ViewportTransform | null => {
      const canvasBounds = getCanvasBounds(nodes, 50);
      if (!canvasBounds) return null;

      const scaleX = containerWidth / canvasBounds.width;
      const scaleY = containerHeight / canvasBounds.height;
      const zoom = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 1x
      const horizontalMargin = (containerWidth - canvasBounds.width * zoom) / 2;
      const verticalMargin = (containerHeight - canvasBounds.height * zoom) / 2;

      return {
        x: canvasBounds.left * zoom - horizontalMargin,
        y: canvasBounds.top * zoom - verticalMargin,
        zoom,
      };
    },
    [getCanvasBounds]
  );

  return {
    bounds,
    isPointVisible,
    isNodeVisible,
    filterVisibleNodes,
    countVisibleNodes,
    updateBounds,
    getCanvasBounds,
    getFitViewTransform,
  };
}
