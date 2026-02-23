import { useEffect, useContext, useCallback } from 'react';
import { ZoomContext } from '../providers/ZoomProvider';

interface UseZoomControlsOptions {
  /** Enable zoom via Ctrl+scroll / pinch gesture (default: true) */
  enableWheel?: boolean;
  /** Enable keyboard shortcuts (default: true) */
  enableKeyboard?: boolean;
  /** Prevent default wheel behavior to stop page scroll (default: true) */
  preventDefault?: boolean;
  /**
   * Enable two-finger trackpad scroll and plain mouse-wheel scroll to pan
   * (wheel events without ctrlKey). When true, ctrlKey+wheel and pinch still
   * zoom; bare scroll pans instead. (default: true)
   */
  enableTrackpadPan?: boolean;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    target.isContentEditable ||
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT'
  );
}

/**
 * Normalize WheelEvent deltas to pixel values.
 * Trackpad: deltaMode === 0 (DOM_DELTA_PIXEL) — values are already pixels.
 * Mouse wheel: deltaMode === 1 (DOM_DELTA_LINE) — multiply by approx line height.
 */
function toPixelDelta(e: WheelEvent): { dx: number; dy: number } {
  const LINE_HEIGHT = 16;
  const multiplier =
    e.deltaMode === 1 ? LINE_HEIGHT :
    e.deltaMode === 2 ? window.innerHeight :
    1;
  return { dx: e.deltaX * multiplier, dy: e.deltaY * multiplier };
}

/**
 * Hook for wheel-based zoom and trackpad pan.
 *
 * Gesture mapping (industry-standard — matches Figma, Excalidraw, Miro):
 *   Pinch (trackpad)      → ctrlKey wheel → zoom toward cursor
 *   Ctrl + mouse scroll   → ctrlKey wheel → zoom toward cursor
 *   Two-finger swipe      → bare wheel    → pan  (enableTrackpadPan)
 *   Plain mouse scroll    → bare wheel    → pan  (enableTrackpadPan)
 *   Ctrl/Cmd + +/-/0      → keyboard      → zoom in / zoom out / reset
 *
 * Must be used within a ZoomProvider.
 */
export function useZoomControls(
  containerRef: React.RefObject<HTMLElement | null>,
  options: UseZoomControlsOptions = {}
) {
  const {
    enableWheel = true,
    enableKeyboard = true,
    preventDefault = true,
    enableTrackpadPan = true,
  } = options;

  const { zoomToPoint, zoomIn, zoomOut, resetView, config, pan } = useContext(ZoomContext);

  /**
   * Unified wheel handler:
   *   ctrlKey → zoom toward cursor
   *   no ctrlKey → pan (trackpad two-finger scroll or mouse scroll)
   */
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      // Always prevent default so the page doesn't scroll / browser zoom doesn't fire
      if (preventDefault) e.preventDefault();

      if (e.ctrlKey) {
        // Pinch-to-zoom (trackpad) or Ctrl+scroll (mouse)
        if (!enableWheel) return;
        const rawDelta = -e.deltaY * config.wheelSensitivity;
        const delta = Math.max(-0.9, Math.min(0.9, rawDelta));
        if (delta === 0) return;
        zoomToPoint(e.clientX, e.clientY, delta);
      } else {
        // Two-finger swipe (trackpad) or plain scroll (mouse) → pan
        if (!enableTrackpadPan) return;
        const { dx, dy } = toPixelDelta(e);
        pan(dx, dy);
      }
    },
    [enableWheel, enableTrackpadPan, preventDefault, config.wheelSensitivity, zoomToPoint, pan]
  );

  /**
   * Keyboard shortcuts for zoom
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enableKeyboard) return;
      if (isEditableTarget(e.target)) return;

      // Ctrl/Cmd + Plus: Zoom in
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=' || e.key === 'Add')) {
        e.preventDefault();
        zoomIn();
      }
      // Ctrl/Cmd + Minus: Zoom out
      else if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === 'Subtract')) {
        e.preventDefault();
        zoomOut();
      }
      // Ctrl/Cmd + 0: Reset zoom
      else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        resetView();
      }
    },
    [enableKeyboard, zoomIn, zoomOut, resetView]
  );

  /**
   * Attach event listeners
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // wheel listener handles both zoom and trackpad pan — always attach if either is enabled
    if (enableWheel || enableTrackpadPan) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }

    if (enableKeyboard) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      if (enableWheel || enableTrackpadPan) {
        container.removeEventListener('wheel', handleWheel);
      }
      if (enableKeyboard) {
        window.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [containerRef, enableWheel, enableTrackpadPan, enableKeyboard, handleWheel, handleKeyDown]);

  return {
    zoomIn,
    zoomOut,
    resetView,
  };
}
