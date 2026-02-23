import React, { useContext } from 'react';
import { ZoomContext } from '../providers/ZoomProvider';
import { useGraph } from '../hooks/useGraph';
import { useStore } from '../hooks/useStore';

interface ZoomControlsProps {
  /** Position of controls (default: 'bottom-right') */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Show zoom percentage (default: true) */
  showPercentage?: boolean;
}

/**
 * Zoom controls component with buttons for zoom in, zoom out, fit view, and reset.
 * Must be used within a ZoomProvider.
 */
export const ZoomControls: React.FC<ZoomControlsProps> = ({
  position = 'bottom-right',
  showPercentage = true,
}) => {
  const { zoom, zoomIn, zoomOut, zoomToFit, resetView } = useContext(ZoomContext);
  const graph = useGraph();
  const { nodes } = useStore(graph.getStore());

  const positionStyles: Record<string, React.CSSProperties> = {
    'top-left': { top: 20, left: 20 },
    'top-right': { top: 20, right: 20 },
    'bottom-left': { bottom: 20, left: 20 },
    'bottom-right': { bottom: 20, right: 20 },
  };

  const handleFitView = () => {
    zoomToFit(nodes);
  };

  // Inline fallback styles ensure controls are usable even without external CSS
  const containerFallback: React.CSSProperties = {
    position: 'absolute',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    background: 'var(--ff-panel, #161a2e)',
    border: '1px solid var(--ff-node-border, #2e355e)',
    borderRadius: 8,
    padding: 8,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    zIndex: 1000,
    minWidth: 48,
    ...positionStyles[position],
  };

  const percentageFallback: React.CSSProperties = {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--ff-muted, #9aa3c7)',
    padding: '4px 8px',
    borderBottom: '1px solid var(--ff-node-border, #2e355e)',
    marginBottom: 4,
    letterSpacing: '0.3px',
  };

  const buttonFallback: React.CSSProperties = {
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--ff-node, #20253f)',
    color: 'var(--ff-text, #e8ecff)',
    border: '1px solid var(--ff-node-border, #2e355e)',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 18,
    fontWeight: 600,
    userSelect: 'none',
  };

  return (
    <div className="zoom-controls" style={containerFallback}>
      {showPercentage && (
        <div className="zoom-controls-percentage" style={percentageFallback}>
          {Math.round(zoom * 100)}%
        </div>
      )}
      <button
        className="zoom-controls-button"
        type="button"
        style={buttonFallback}
        onClick={() => zoomIn()}
        title="Zoom in (Ctrl/Cmd + +)"
        aria-label="Zoom in"
      >
        +
      </button>
      <button
        className="zoom-controls-button"
        type="button"
        style={buttonFallback}
        onClick={() => zoomOut()}
        title="Zoom out (Ctrl/Cmd + -)"
        aria-label="Zoom out"
      >
        -
      </button>
      <button
        className="zoom-controls-button"
        type="button"
        style={{ ...buttonFallback, fontSize: 11 }}
        onClick={handleFitView}
        title="Fit to screen"
        aria-label="Fit to screen"
      >
        Fit
      </button>
      <button
        className="zoom-controls-button"
        type="button"
        style={{ ...buttonFallback, fontSize: 11 }}
        onClick={resetView}
        title="Reset zoom (Ctrl/Cmd + 0)"
        aria-label="Reset zoom"
      >
        1:1
      </button>
    </div>
  );
};
