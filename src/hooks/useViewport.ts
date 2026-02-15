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

interface UseViewportOptions {
  /** Padding around the viewport to pre-render nodes slightly outside view */
  padding?: number;
  /** Throttle delay for scroll/resize events in ms */
  throttleMs?: number;
}

/**
 * Hook for viewport-based rendering optimization.
 * Returns functions to determine which nodes are visible in the current viewport.
 */
export function useViewport(
  containerRef: React.RefObject<HTMLElement | null>,
  options: UseViewportOptions = {}
) {
  const { padding = 100, throttleMs = 16 } = options;
  const [bounds, setBounds] = useState<ViewportBounds | null>(null);
  const throttleRef = useRef<number | null>(null);

  const updateBounds = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    setBounds({
      left: -padding,
      top: -padding,
      right: rect.width + padding,
      bottom: rect.height + padding,
      width: rect.width,
      height: rect.height,
    });
  }, [containerRef, padding]);

  const throttledUpdateBounds = useCallback(() => {
    if (throttleRef.current) return;

    throttleRef.current = window.setTimeout(() => {
      updateBounds();
      throttleRef.current = null;
    }, throttleMs);
  }, [updateBounds, throttleMs]);

  useEffect(() => {
    updateBounds();

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
  }, [containerRef, throttledUpdateBounds, updateBounds]);

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
   */
  const filterVisibleNodes = useCallback(
    <T extends NodeData>(nodes: T[], nodeWidth = 200, nodeHeight = 100): T[] => {
      if (!bounds) return nodes;
      return nodes.filter((node) => isNodeVisible(node, nodeWidth, nodeHeight));
    },
    [bounds, isNodeVisible]
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

  return {
    bounds,
    isPointVisible,
    isNodeVisible,
    filterVisibleNodes,
    countVisibleNodes,
    updateBounds,
  };
}
