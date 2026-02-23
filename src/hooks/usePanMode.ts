import { useEffect, useContext } from 'react';
import { ZoomContext } from '../providers/ZoomProvider';

interface UsePanModeOptions {
  /** Enable double-click+hold canvas panning (default: true) */
  enableDoubleClickPan?: boolean;
  /** Enable middle mouse button panning (default: true) */
  enableMiddleMousePan?: boolean;
}

/**
 * Hook for canvas panning via double-click+hold or middle mouse button.
 *
 * Double-click+hold state machine:
 *   click → click+hold → PANNING (cursor: grabbing)
 *   release           → IDLE    (cursor: default)
 *
 * The gesture fires on the SECOND pointerdown when it arrives within
 * DOUBLE_CLICK_DELAY_MS and DOUBLE_CLICK_DISTANCE_PX of the first one.
 * Pan mode is active ONLY while the mouse button is held — releasing
 * immediately returns to the normal mode. No toggle state.
 *
 * Middle mouse (transient, independent):
 *   hold middle button → PANNING
 *   release            → IDLE
 *
 * Must be used within a ZoomProvider.
 */
export function usePanMode(
  containerRef: React.RefObject<HTMLElement | null>,
  options: UsePanModeOptions = {}
) {
  const {
    enableDoubleClickPan = true,
    enableMiddleMousePan = true,
  } = options;

  const { pan, _setIsPanMode, _setIsPanning } = useContext(ZoomContext);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const DOUBLE_CLICK_DELAY_MS = 300;
    const DOUBLE_CLICK_DISTANCE_PX = 8;

    // Closure variable — no ref needed, scoped to this effect instance
    let lastPointerDown: { time: number; x: number; y: number } | null = null;

    const handlePointerDown = (e: PointerEvent) => {
      const isMiddle = enableMiddleMousePan && e.button === 1;
      const isLeft   = enableDoubleClickPan  && e.button === 0;

      if (!isMiddle && !isLeft) return;

      let shouldActivate = isMiddle; // middle mouse always activates

      if (isLeft) {
        const now = performance.now();
        const isDoubleClick =
          lastPointerDown !== null &&
          now - lastPointerDown.time <= DOUBLE_CLICK_DELAY_MS &&
          Math.hypot(e.clientX - lastPointerDown.x, e.clientY - lastPointerDown.y) <= DOUBLE_CLICK_DISTANCE_PX;

        // Always record this click so the next one can be compared against it
        lastPointerDown = { time: now, x: e.clientX, y: e.clientY };
        shouldActivate = isDoubleClick;
      }

      if (!shouldActivate) return;

      // Prevent text selection (double-click) and auto-scroll popup (middle mouse)
      e.preventDefault();

      // _setIsPanMode syncs isPanModeRef synchronously, so Node/Port handlers
      // that fire immediately after (via React synthetic events) will see it
      _setIsPanMode(true);
      _setIsPanning(true);

      let lastX = e.clientX;
      let lastY = e.clientY;

      const handleMove = (ev: PointerEvent) => {
        const dx = ev.clientX - lastX;
        const dy = ev.clientY - lastY;
        lastX = ev.clientX;
        lastY = ev.clientY;
        // Drag right (dx > 0) → content moves right → viewport.x decreases
        pan(-dx, -dy);
      };

      const handleUp = () => {
        // Release immediately deactivates pan mode — no toggle
        _setIsPanMode(false);
        _setIsPanning(false);
        // Reset tracking so only a fresh double-click gesture can re-activate,
        // not a single click that happens to follow the previous gesture quickly
        if (isLeft) lastPointerDown = null;
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
    };

    container.addEventListener('pointerdown', handlePointerDown);
    return () => {
      container.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [containerRef, enableDoubleClickPan, enableMiddleMousePan, pan, _setIsPanMode, _setIsPanning]);
}
