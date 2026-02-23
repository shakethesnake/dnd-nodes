import React from "react";

interface GridBackgroundProps {
    /** Grid pattern type */
    variant?: 'grid' | 'dots';
    /** Grid size in pixels (default: 20) */
    gridSize?: number;
    /** Grid color (default: rgba(0, 0, 0, 0.05)) */
    color?: string;
    /** Viewport offset for panning - will be integrated when viewport system is ready */
    offset?: { x: number; y: number };
    /** Zoom level - will be integrated when viewport system is ready */
    zoom?: number;
}

/**
 * GridBackground Component
 * Renders an infinite repeating grid or dot pattern background
 * Supports both grid lines and dots pattern
 * Pattern automatically repeats infinitely via CSS
 */
export const GridBackground: React.FC<GridBackgroundProps> = ({
    variant = 'grid',
    gridSize = 20,
    color, // Will default to CSS variable if not provided
    offset = { x: 0, y: 0 },
    zoom = 1,
}) => {
    // Use CSS variable for color if not explicitly provided
    // This allows the grid to match the theme (light/dark)
    const gridColor = color || 'var(--grid-color, rgba(0, 0, 0, 0.05))';
    // Calculate adjusted grid size based on zoom
    const adjustedGridSize = gridSize * zoom;

    // Calculate background position based on offset (for panning)
    const backgroundPositionX = -offset.x % adjustedGridSize;
    const backgroundPositionY = -offset.y % adjustedGridSize;

    if (variant === 'dots') {
        // Dot pattern using radial gradient
        const dotSize = Math.max(1, 2 * zoom); // Dots scale with zoom, min 1px

        return (
            <div
                className="grid-background grid-background-dots"
                style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `radial-gradient(circle, ${gridColor} ${dotSize}px, transparent ${dotSize}px)`,
                    backgroundSize: `${adjustedGridSize}px ${adjustedGridSize}px`,
                    backgroundPosition: `${backgroundPositionX}px ${backgroundPositionY}px`,
                    pointerEvents: 'none',
                    zIndex: 0,
                }}
            />
        );
    }

    // Grid lines pattern using linear gradients
    return (
        <div
            className="grid-background grid-background-lines"
            style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `
                    linear-gradient(${gridColor} 1px, transparent 1px),
                    linear-gradient(90deg, ${gridColor} 1px, transparent 1px)
                `,
                backgroundSize: `${adjustedGridSize}px ${adjustedGridSize}px`,
                backgroundPosition: `${backgroundPositionX}px ${backgroundPositionY}px`,
                pointerEvents: 'none',
                zIndex: 0,
            }}
        />
    );
};
