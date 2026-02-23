import React, { createContext, useState, useCallback, useMemo, useRef } from "react";
import type { ViewportState, ViewportActions, ZoomConfig, NodeData } from "../types/types";

interface ZoomContextValue extends ViewportState, ViewportActions {
  config: Required<ZoomConfig>;
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
  /** Whether pan mode is active (Space held or middle mouse ready) */
  isPanMode: boolean;
  /** Whether the user is actively dragging to pan */
  isPanning: boolean;
  /**
   * Ref for synchronous pan mode check (avoids React state batching lag).
   * Use this in event handlers that fire immediately (e.g., pointerdown on nodes).
   */
  isPanModeRef: React.MutableRefObject<boolean>;
  /** Internal: used by usePanMode hook to update pan mode state */
  _setIsPanMode: (v: boolean) => void;
  /** Internal: used by usePanMode hook to update panning state */
  _setIsPanning: (v: boolean) => void;
}

const DEFAULT_CONFIG: Required<ZoomConfig> = {
  minZoom: 0.1,
  maxZoom: 3.0,
  wheelSensitivity: 0.001,
  zoomStep: 0.2,
};

export const ZoomContext = createContext<ZoomContextValue>({
  x: 0,
  y: 0,
  zoom: 1,
  config: DEFAULT_CONFIG,
  containerRef: { current: null },
  isPanMode: false,
  isPanning: false,
  isPanModeRef: { current: false },
  _setIsPanMode: () => {},
  _setIsPanning: () => {},
  setZoom: () => {},
  zoomIn: () => {},
  zoomOut: () => {},
  zoomToFit: () => {},
  pan: () => {},
  panTo: () => {},
  resetView: () => {},
  getTransform: () => "",
  zoomToPoint: () => {},
});

interface ZoomProviderProps {
  children: React.ReactNode;
  config?: ZoomConfig;
  initialViewport?: Partial<ViewportState>;
}

export const ZoomProvider: React.FC<ZoomProviderProps> = ({
  children,
  config = {},
  initialViewport = { x: 0, y: 0, zoom: 1 }
}) => {
  const mergedConfig = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...config }),
    [config]
  );
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Pan mode state: isPanModeRef is always synchronous (avoids React batching lag)
  const isPanModeRef = useRef(false);
  const [isPanMode, setIsPanMode] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  const _setIsPanMode = useCallback((v: boolean) => {
    isPanModeRef.current = v;
    setIsPanMode(v);
  }, []);

  const _setIsPanning = useCallback((v: boolean) => {
    setIsPanning(v);
  }, []);

  const [viewport, setViewport] = useState<ViewportState>({
    x: initialViewport.x ?? 0,
    y: initialViewport.y ?? 0,
    zoom: initialViewport.zoom ?? 1,
  });

  const clampZoom = useCallback((zoom: number) => {
    return Math.max(mergedConfig.minZoom, Math.min(mergedConfig.maxZoom, zoom));
  }, [mergedConfig.minZoom, mergedConfig.maxZoom]);

  const setZoom = useCallback((zoom: number) => {
    setViewport((prev) => ({ ...prev, zoom: clampZoom(zoom) }));
  }, [clampZoom]);

  const zoomIn = useCallback((delta: number = mergedConfig.zoomStep) => {
    setViewport((prev) => ({ ...prev, zoom: clampZoom(prev.zoom + delta) }));
  }, [clampZoom, mergedConfig.zoomStep]);

  const zoomOut = useCallback((delta: number = mergedConfig.zoomStep) => {
    setViewport((prev) => ({ ...prev, zoom: clampZoom(prev.zoom - delta) }));
  }, [clampZoom, mergedConfig.zoomStep]);

  const zoomToFit = useCallback((nodes: NodeData[]) => {
    if (!containerRef.current || nodes.length === 0) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();

    // Calculate bounding box of all nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const nodeWidth = 200; // Estimated node width
    const nodeHeight = 100; // Estimated node height

    nodes.forEach((node) => {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + nodeWidth);
      maxY = Math.max(maxY, node.position.y + nodeHeight);
    });

    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;
    if (graphWidth <= 0 || graphHeight <= 0) return;

    // Add padding
    const padding = 50;
    const scaleX = (rect.width - padding * 2) / graphWidth;
    const scaleY = (rect.height - padding * 2) / graphHeight;
    const newZoom = clampZoom(Math.min(scaleX, scaleY, 1));

    // Center graph bounds in viewport for transform: screen = canvas * zoom - pan
    const graphCenterX = minX + graphWidth / 2;
    const graphCenterY = minY + graphHeight / 2;
    const centerX = graphCenterX * newZoom - rect.width / 2;
    const centerY = graphCenterY * newZoom - rect.height / 2;

    setViewport({ x: centerX, y: centerY, zoom: newZoom });
  }, [clampZoom]);

  const pan = useCallback((dx: number, dy: number) => {
    setViewport((prev) => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy,
    }));
  }, []);

  const panTo = useCallback((x: number, y: number) => {
    setViewport((prev) => ({ ...prev, x, y }));
  }, []);

  const resetView = useCallback(() => {
    setViewport({ x: 0, y: 0, zoom: 1 });
  }, []);

  const getTransform = useCallback(() => {
    return `translate(${-viewport.x}px, ${-viewport.y}px) scale(${viewport.zoom})`;
  }, [viewport.x, viewport.y, viewport.zoom]);

  const zoomToPoint = useCallback((clientX: number, clientY: number, delta: number) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    if (!Number.isFinite(delta)) return;

    setViewport((prev) => {
      // Calculate point in canvas space before zoom.
      const canvasX = (localX + prev.x) / prev.zoom;
      const canvasY = (localY + prev.y) / prev.zoom;

      // Apply zoom multiplicatively and keep the value clamped.
      const newZoom = clampZoom(prev.zoom * (1 + delta));
      if (newZoom === prev.zoom) return prev;

      // Adjust pan so the canvas point under the cursor stays fixed.
      const newX = canvasX * newZoom - localX;
      const newY = canvasY * newZoom - localY;

      return { x: newX, y: newY, zoom: newZoom };
    });
  }, [clampZoom]);

  const value: ZoomContextValue = {
    ...viewport,
    config: mergedConfig,
    containerRef,
    isPanMode,
    isPanning,
    isPanModeRef,
    _setIsPanMode,
    _setIsPanning,
    setZoom,
    zoomIn,
    zoomOut,
    zoomToFit,
    pan,
    panTo,
    resetView,
    getTransform,
    zoomToPoint,
  };

  return <ZoomContext.Provider value={value}>{children}</ZoomContext.Provider>;
};
