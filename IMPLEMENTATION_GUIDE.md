# FlowForge React - Implementation Guide

## Overview

FlowForge is a custom-built React node graph visualization library with support for custom nodes and edges. This guide explains the implemented features and how to use them.

## Features Implemented

### ✅ 1. Draggable Nodes with Z-Index Layering

Nodes automatically come to the front when dragged, ensuring they're always visible above other nodes.

**Implementation Details:**
- Base `z-index: 1` for default nodes
- `z-index: 2` for custom nodes (always above default nodes)
- `z-index: 1000` when dragging (temporary top layer)
- Automatic class management with `.dragging` CSS class
- Cursor changes to `grabbing` during drag

**CSS:**
```css
.node {
    z-index: 1;
    cursor: grab;
}

.custom-node {
    z-index: 2;
}

.node.dragging {
    z-index: 1000 !important;
    cursor: grabbing;
}
```

### ✅ 2. Custom Node Types

Create custom nodes with different styling, icons, colors, and behaviors.

**Example: Create a Custom Node**

```tsx
import { NodeData } from './types/types';

const customNode: NodeData = {
    id: 'my-custom-node',
    position: { x: 100, y: 100 },
    label: 'AI Processor',
    type: 'custom',  // Important: specify 'custom' type
    data: {
        icon: '🤖',
        color: 'purple',  // Options: purple, blue, green, red
        description: 'Processes data with AI'
    }
};
```

**Available Custom Node Colors:**
- `purple` - Purple to violet gradient
- `blue` - Dark blue to bright blue gradient
- `green` - Dark green to bright green gradient
- `red` - Red to orange gradient

**Custom Node Features:**
- Custom icon display (emoji or text)
- Gradient backgrounds
- Multiple input/output ports
- Custom descriptions
- Enhanced visual effects (glow on hover)

### ✅ 3. Different Edge Types

Three edge types are available with different visual styles and behaviors.

#### a. Default Edge
Simple dashed gray line connecting nodes.

```tsx
const defaultEdge: EdgeData = {
    id: 'edge-1',
    sourceNode: 'node-1',
    targetNode: 'node-2',
    type: 'default'  // or omit type (defaults to 'default')
};
```

#### b. Animated Edge
Flowing animated edge with customizable color and speed.

```tsx
const animatedEdge: EdgeData = {
    id: 'edge-2',
    sourceNode: 'node-1',
    targetNode: 'node-2',
    type: 'animated',
    data: {
        color: '#7aa2ff',  // Custom color
        speed: 2           // Animation speed (lower = faster)
    }
};
```

**Features:**
- Animated dashed stroke flowing along the path
- Pulsing glow effect
- Customizable color and animation speed
- Triple-layer rendering (glow + base + animated overlay)

#### c. Breakable Edge
Interactive edge that can be deleted by clicking.

```tsx
const breakableEdge: EdgeData = {
    id: 'edge-3',
    sourceNode: 'node-1',
    targetNode: 'node-2',
    type: 'breakable'
};
```

**Features:**
- Click to delete the edge
- Hover effect (changes from orange to red)
- Visual break indicator (circle with X mark)
- Thick invisible hitbox for easier clicking

## Project Structure

```
flowforge-react/
├── src/
│   ├── components/
│   │   ├── Node.tsx              # Default node component
│   │   ├── CustomNode.tsx        # Custom node with styling
│   │   ├── Edge.tsx              # Default edge component
│   │   ├── AnimatedEdge.tsx      # Animated flowing edge
│   │   ├── BreakableEdge.tsx     # Clickable deletable edge
│   │   ├── EdgeLayer.tsx         # SVG layer that renders all edges
│   │   ├── Canvas.tsx            # Main canvas with node/edge registry
│   │   ├── Flow.tsx              # Root flow component
│   │   └── Port.tsx              # Port component
│   ├── core/
│   │   ├── Graph.ts              # Graph state management class
│   │   ├── LiveEdge.ts           # Live edge utilities (drag preview)
│   │   └── createStore.ts        # Simple pub/sub store
│   ├── hooks/
│   │   ├── useGraph.ts           # Access graph instance
│   │   └── useStore.ts           # Subscribe to store changes
│   ├── providers/
│   │   └── GraphContext.tsx      # Graph context provider
│   ├── types/
│   │   └── types.ts              # TypeScript type definitions
│   ├── App.tsx                   # Demo application
│   ├── App.css                   # Styling
│   └── main.tsx                  # Entry point
```

## Usage Examples

### Complete Example

See [App.tsx](src/App.tsx) for a comprehensive example that demonstrates:

1. **Multiple node types** - Mix of default and custom nodes
2. **All edge types** - Default, animated, and breakable edges
3. **Custom styling** - Different colors and icons
4. **Interactive features** - Drag, connect, and delete edges

### Creating a New Graph

```tsx
import { Graph } from './core/Graph';
import { NodeData, EdgeData } from './types/types';

// Define your nodes
const nodes: NodeData[] = [
    {
        id: 'start',
        position: { x: 100, y: 100 },
        label: 'Start',
        type: 'custom',
        data: {
            icon: '🚀',
            color: 'purple',
            description: 'Start node'
        }
    },
    {
        id: 'end',
        position: { x: 400, y: 100 },
        label: 'End',
        type: 'default'
    }
];

// Define your edges
const edges: EdgeData[] = [
    {
        id: 'edge-1',
        sourceNode: 'start',
        targetNode: 'end',
        type: 'animated',
        data: {
            color: '#7aa2ff',
            speed: 2
        }
    }
];

// Create the graph
const graph = new Graph({ nodes, edges });

// Render
<Flow graph={graph} />
```

### Adding Custom Node Types

To create your own node type:

1. Create a new component in `src/components/`
2. Follow the pattern from [CustomNode.tsx](src/components/CustomNode.tsx)
3. Register it in [Canvas.tsx](src/components/Canvas.tsx):

```tsx
const nodeTypes: Record<string, React.FC<NodeData>> = {
    default: Node,
    custom: CustomNode,
    myCustomType: MyCustomNode,  // Add your custom type
};
```

### Adding Custom Edge Types

To create your own edge type:

1. Create a new component in `src/components/`
2. Follow the pattern from [AnimatedEdge.tsx](src/components/AnimatedEdge.tsx) or [BreakableEdge.tsx](src/components/BreakableEdge.tsx)
3. Register it in [EdgeLayer.tsx](src/components/EdgeLayer.tsx):

```tsx
const edgeTypes = {
    default: Edge,
    animated: AnimatedEdge,
    breakable: BreakableEdge,
    myCustomType: MyCustomEdge,  // Add your custom type
};
```

## Key Features

### Node Features
- ✅ Drag and drop with smooth animations
- ✅ Z-index management (dragged nodes on top)
- ✅ Port-based connection system
- ✅ Custom styling and colors
- ✅ Icon support
- ✅ Multiple input/output ports
- ✅ Registry system for DOM references

### Edge Features
- ✅ SVG-based rendering (unlimited edges)
- ✅ Cubic Bezier curves for smooth paths
- ✅ Live edge preview while connecting
- ✅ Multiple edge types (default, animated, breakable)
- ✅ Custom colors and animations
- ✅ Interactive edges (hover, click)
- ✅ Auto-update when nodes move

### Performance Optimizations
- ✅ `requestAnimationFrame` throttling for drag updates
- ✅ `will-change: transform` for GPU acceleration
- ✅ Efficient state management with pub/sub pattern
- ✅ Registry pattern for direct DOM access
- ✅ Minimal re-renders with `useCallback` and `useMemo`

## TypeScript Types

```typescript
// Node types
interface NodeData {
    id: string;
    position: { x: number; y: number };
    label?: string;
    type?: string;  // 'default' | 'custom' | your custom types
    data?: Record<string, unknown>;
}

// Edge types
interface EdgeData {
    id: string;
    sourceNode: string;
    targetNode: string;
    sourcePort?: { x: number; y: number };
    targetPort?: { x: number; y: number };
    label?: string;
    type?: string;  // 'default' | 'animated' | 'breakable' | your custom types
    data?: Record<string, unknown>;
}

// Graph state
interface GraphState {
    nodes: NodeData[];
    edges: EdgeData[];
    draggingId?: string | null;
}
```

## Running the Project

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The demo will be available at `http://localhost:5174/` (or another port if 5174 is in use).

## Browser Support

- Modern browsers with ES2015+ support
- Chrome, Firefox, Safari, Edge (latest versions)
- Requires JavaScript enabled
- Requires CSS Grid support

## License

Private project

## Contributing

This is a custom implementation. Feel free to extend with your own node and edge types following the patterns demonstrated in the codebase.
