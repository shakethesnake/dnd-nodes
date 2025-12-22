# Canvas View Guide

## Overview

FlowForge React now supports customizable canvas background views. You can choose between a **grid** pattern or a **dots** pattern for your canvas background.

## Canvas View Types

### 1. Grid View (Default)
A classic grid pattern with intersecting horizontal and vertical lines.

```tsx
const graph = new Graph({
    nodes,
    edges,
    canvasView: 'grid'
});
```

**Visual:** Evenly spaced grid lines creating a traditional graph paper look.

### 2. Dots View
A modern dotted pattern that's less intrusive than the grid.

```tsx
const graph = new Graph({
    nodes,
    edges,
    canvasView: 'dots'
});
```

**Visual:** Evenly spaced dots creating a clean, minimal background.

## Usage

### Setting Canvas View in Graph Constructor

```tsx
import { Graph } from './core/Graph';

// Grid view (default)
const graph = new Graph({
    nodes: myNodes,
    edges: myEdges,
    canvasView: 'grid'
});

// Dots view
const graph = new Graph({
    nodes: myNodes,
    edges: myEdges,
    canvasView: 'dots'
});
```

### Changing Canvas View Dynamically

You can change the canvas view at runtime using the graph's `setState` method:

```tsx
// Switch to dots view
graph.setState((state) => ({
    ...state,
    canvasView: 'dots'
}));

// Switch to grid view
graph.setState((state) => ({
    ...state,
    canvasView: 'grid'
}));
```

### Example: Toggle Button

Here's how you could create a button to toggle between views:

```tsx
function MyFlowComponent() {
    const graph = useGraph();
    const { canvasView } = useStore(graph.getStore());

    const toggleView = () => {
        const newView = canvasView === 'grid' ? 'dots' : 'grid';
        graph.setState((state) => ({
            ...state,
            canvasView: newView
        }));
    };

    return (
        <div>
            <button onClick={toggleView}>
                Switch to {canvasView === 'grid' ? 'Dots' : 'Grid'} View
            </button>
            <Flow graph={graph} />
        </div>
    );
}
```

## Implementation Details

### Type Definition

The canvas view type is defined in [types.ts](src/types/types.ts):

```typescript
export type CanvasView = 'grid' | 'dots';

export interface GraphState {
    nodes: NodeData[];
    edges: EdgeData[];
    draggingId?: string | null;
    canvasView?: CanvasView;
}
```

### CSS Classes

The canvas background is controlled by CSS classes in [App.css](src/App.css):

**Grid View:**
```css
.canvas-view-grid {
    background-image: linear-gradient(90deg, var(--grid) 1px, transparent 1px),
        linear-gradient(0deg, var(--grid) 1px, transparent 1px);
    background-size: 24px 24px;
}
```

**Dots View:**
```css
.canvas-view-dots {
    background-image: radial-gradient(circle, var(--grid) 1.5px, transparent 1.5px);
    background-size: 24px 24px;
    background-position: 0 0;
}
```

### Canvas Component

The [Canvas.tsx](src/components/Canvas.tsx) component subscribes to the graph state and applies the appropriate CSS class:

```tsx
export const FlowCanvas: React.FC = () => {
    const graph = useGraph();
    const { nodes, canvasView } = useStore(graph.getStore());

    // Determine canvas view class
    const canvasViewClass = canvasView === 'dots' ? 'canvas-view-dots' : 'canvas-view-grid';

    return (
        <div
            data-flow-root
            className={canvasViewClass}
            style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}
        >
            {/* ... nodes and edges ... */}
        </div>
    );
};
```

## Customization

### Adjusting Grid/Dot Size

You can customize the spacing by modifying the `background-size` property in [App.css](src/App.css):

```css
/* Larger spacing (32px instead of 24px) */
.canvas-view-grid {
    background-size: 32px 32px;
}

.canvas-view-dots {
    background-size: 32px 32px;
}
```

### Adjusting Dot Size

Change the dot radius in the `radial-gradient`:

```css
/* Larger dots (2.5px instead of 1.5px) */
.canvas-view-dots {
    background-image: radial-gradient(circle, var(--grid) 2.5px, transparent 2.5px);
}
```

### Adjusting Grid Line Width

Change the line width in the `linear-gradient`:

```css
/* Thicker lines (2px instead of 1px) */
.canvas-view-grid {
    background-image: linear-gradient(90deg, var(--grid) 2px, transparent 2px),
        linear-gradient(0deg, var(--grid) 2px, transparent 2px);
}
```

### Custom Colors

The grid/dot color is controlled by the CSS variable `--grid`. You can override it:

```css
:root {
    --grid: #1b2038; /* Default dark blue-gray */
}

/* Or create a custom class */
.canvas-view-grid.custom-color {
    --grid: #2a4a5a; /* Custom teal color */
}
```

## Adding New Canvas Views

To add a new canvas view type:

1. **Update the type definition** in [types.ts](src/types/types.ts):
   ```typescript
   export type CanvasView = 'grid' | 'dots' | 'lines' | 'hexagon';
   ```

2. **Add CSS class** in [App.css](src/App.css):
   ```css
   .canvas-view-lines {
       background-image: linear-gradient(0deg, var(--grid) 1px, transparent 1px);
       background-size: 48px 48px;
   }
   ```

3. **Update Canvas component** in [Canvas.tsx](src/components/Canvas.tsx):
   ```tsx
   const canvasViewClass =
       canvasView === 'dots' ? 'canvas-view-dots' :
       canvasView === 'lines' ? 'canvas-view-lines' :
       'canvas-view-grid';
   ```

## Browser Compatibility

- ✅ Chrome, Edge, Firefox, Safari (latest versions)
- ✅ All modern browsers with CSS gradient support
- ✅ No JavaScript required for rendering (pure CSS)

## Performance

Both grid and dots views are implemented using CSS gradients, which are:
- **GPU accelerated** for smooth rendering
- **No performance impact** on drag operations
- **Efficient** even with large canvases

## Examples

### Example 1: Default Grid View
```tsx
const graph = new Graph({
    nodes: [],
    edges: [],
    canvasView: 'grid' // Default
});
```

### Example 2: Dots View
```tsx
const graph = new Graph({
    nodes: [],
    edges: [],
    canvasView: 'dots'
});
```

### Example 3: Omit canvasView (defaults to grid)
```tsx
const graph = new Graph({
    nodes: [],
    edges: []
    // canvasView defaults to 'grid'
});
```

## See Also

- [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) - Full implementation guide
- [App.tsx](src/App.tsx) - Example usage
- [Graph.ts](src/core/Graph.ts) - Graph class with canvas view support
- [Canvas.tsx](src/components/Canvas.tsx) - Canvas component implementation

## Date

2025-12-07
