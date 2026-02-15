# FlowForge React

A lightweight, performant node-based flow editor library for React. Build visual programming interfaces, workflow editors, and node graph applications with drag-and-drop connections.

---

## Project Structure

```
dnd-nodes/
├── src/
│   ├── components/                    # React UI components
│   │   ├── Flow.tsx                   # Root component wrapping all providers
│   │   ├── Canvas.tsx                 # Main canvas rendering nodes and edges
│   │   ├── Node.tsx                   # Default node implementation
│   │   ├── CustomNode.tsx             # Styled node with gradients and icons
│   │   ├── ExperimentalNode.tsx       # Node with external port positioning
│   │   ├── NodeShell.tsx              # Reusable drag/drop wrapper for nodes
│   │   ├── Port.tsx                   # Connection port component
│   │   ├── Edge.tsx                   # Default edge (bezier curve)
│   │   ├── AnimatedEdge.tsx           # Edge with flowing animation effect
│   │   ├── BreakableEdge.tsx          # Interactive deletable edge
│   │   ├── EdgeLayer.tsx              # SVG container managing all edges
│   │   └── index.ts                   # Component exports
│   │
│   ├── core/                          # Core business logic
│   │   ├── Graph.ts                   # Central graph state manager
│   │   ├── createStore.ts             # Custom state management (Zustand-like)
│   │   ├── EventEmitter.ts            # Pub/sub event system
│   │   ├── LiveEdge.ts                # Live edge preview & path generation
│   │   ├── debounce.ts                # Debounce/throttle utilities
│   │   ├── index.ts                   # Core exports
│   │   ├── Graph.test.ts              # Graph unit tests
│   │   ├── createStore.test.ts        # Store unit tests
│   │   └── LiveEdge.test.ts           # LiveEdge unit tests
│   │
│   ├── hooks/                         # React hooks
│   │   ├── useGraph.ts                # Access Graph instance from context
│   │   ├── useStore.ts                # React integration for store state
│   │   ├── useViewport.ts             # Viewport culling optimization
│   │   └── index.ts                   # Hooks exports
│   │
│   ├── providers/                     # React context providers
│   │   ├── GraphProvider.tsx          # Provides Graph instance via context
│   │   ├── FlowProvider.tsx           # Node state management
│   │   ├── ConnectionProvider.tsx     # Connection tracking
│   │   ├── ZoomProvider.tsx           # Zoom level management
│   │   └── index.ts                   # Provider exports
│   │
│   ├── types/                         # TypeScript type definitions
│   │   ├── types.ts                   # Core interfaces and types
│   │   └── index.ts                   # Type exports
│   │
│   ├── test/                          # Test configuration
│   │   └── setup.ts                   # Vitest setup
│   │
│   ├── App.tsx                        # Demo application
│   ├── main.tsx                       # React entry point
│   └── index.ts                       # Library entry point
│
├── package.json                       # Dependencies & scripts
├── tsconfig.json                      # TypeScript configuration
├── vite.config.ts                     # Vite build configuration
├── vitest.config.ts                   # Vitest test configuration
└── README.md
```

---

## Overview

FlowForge React provides everything you need to create interactive node-based editors:

- **Drag-and-drop nodes** on an infinite canvas
- **Connect nodes** by dragging between ports with live preview
- **Multiple node types** - Default, Custom (styled), Experimental (external ports)
- **Multiple edge types** - Default, Animated (flowing), Breakable (deletable)
- **Canvas features** - Pan, zoom, grid/dots background
- **Performance optimized** - Path memoization, RAF throttling, viewport culling
- **Lightweight** - No heavy dependencies, just React

### Use Cases

- Workflow automation builders
- Visual programming languages
- Data flow / pipeline editors
- Logic diagram tools
- Process mapping interfaces

---

## Installation

```bash
npm install
```

## Development

```bash
# Start development server
npm run dev

# Run tests
npm run test

# Build for production
npm run build
```

---

## Core Concepts

### Graph

The `Graph` class is the central state manager. It holds all nodes and edges, manages DOM registries, and provides coordinate transformations.

```typescript
import { Graph } from './core';

const graph = new Graph({
  nodes: [...],
  edges: [...],
  canvasView: 'grid'
});
```

### Nodes

Nodes are visual elements positioned on the canvas. Each node has:
- `id` - Unique identifier
- `position` - `{ x, y }` coordinates on canvas
- `label` - Display text
- `type` - Node type (`'default'`, `'custom'`, `'experimental'`)
- `data` - Custom data payload

### Edges

Edges are connections between nodes. Each edge has:
- `id` - Unique identifier
- `sourceNode` - Source node ID
- `targetNode` - Target node ID
- `sourcePort` / `targetPort` - Port positions
- `type` - Edge type (`'default'`, `'animated'`, `'breakable'`)
- `data` - Custom data payload

### Ports

Ports are connection points on nodes. Input ports accept incoming connections, output ports initiate outgoing connections.

---

## Basic Usage

### Minimal Setup

```tsx
import { Graph, Flow } from './';

// 1. Create a graph with initial state
const graph = new Graph({
  nodes: [
    { id: 'node-1', position: { x: 100, y: 100 }, label: 'Start' },
    { id: 'node-2', position: { x: 400, y: 100 }, label: 'End' }
  ],
  edges: [],
  canvasView: 'grid'
});

// 2. Render the Flow component
function App() {
  return <Flow graph={graph} />;
}
```

### Adding Nodes Programmatically

```typescript
const graph = useGraph();
const state = graph.getState();

// Add a new node
graph.setState({
  nodes: [
    ...state.nodes,
    {
      id: `node-${Date.now()}`,
      position: { x: 200, y: 200 },
      label: 'New Node',
      type: 'default'
    }
  ]
});
```

### Creating Connections

```typescript
const graph = useGraph();
const state = graph.getState();

// Add a new edge
graph.setState({
  edges: [
    ...state.edges,
    {
      id: `edge-${Date.now()}`,
      sourceNode: 'node-1',
      targetNode: 'node-2',
      type: 'default'
    }
  ]
});
```

### Removing Elements

```typescript
const graph = useGraph();
const state = graph.getState();

// Remove a node
graph.setState({
  nodes: state.nodes.filter(n => n.id !== 'node-to-remove')
});

// Remove an edge
graph.setState({
  edges: state.edges.filter(e => e.id !== 'edge-to-remove')
});
```

---

## Node Types

### Default Node

Basic gray box with input/output ports.

```tsx
<Node
  id="my-node"
  position={{ x: 100, y: 100 }}
  label="My Node"
/>
```

### Custom Node

Styled node with gradient background, icon, and description.

```tsx
<CustomNode
  id="styled-node"
  position={{ x: 100, y: 100 }}
  label="Styled Node"
  data={{
    icon: '🚀',
    color: 'purple',  // 'purple' | 'blue' | 'green' | 'red'
    description: 'A beautiful styled node'
  }}
/>
```

### Experimental Node

Node with ports positioned outside the node boundary.

```tsx
<ExperimentalNode
  id="ext-node"
  position={{ x: 100, y: 100 }}
  label="External Ports"
/>
```

### Creating Custom Node Types

Use `NodeShell` to create your own node types with drag-and-drop support:

```tsx
import { NodeShell, Port } from './components';

function MyCustomNode({ id, position, label, data }) {
  return (
    <NodeShell id={id} position={position}>
      <div className="my-custom-node">
        <Port id={id} type="input" position="left" />
        <h3>{label}</h3>
        <p>{data?.description}</p>
        <Port id={id} type="output" position="right" />
      </div>
    </NodeShell>
  );
}
```

---

## Edge Types

### Default Edge

Simple dashed bezier curve.

```typescript
{ id: 'e1', sourceNode: 'n1', targetNode: 'n2', type: 'default' }
```

### Animated Edge

Edge with flowing particle animation.

```typescript
{
  id: 'e2',
  sourceNode: 'n1',
  targetNode: 'n2',
  type: 'animated',
  data: {
    color: '#3b82f6',      // Custom color
    animationSpeed: '2s'   // Animation duration
  }
}
```

### Breakable Edge

Interactive edge with delete button on hover.

```typescript
{ id: 'e3', sourceNode: 'n1', targetNode: 'n2', type: 'breakable' }
```

---

## Hooks

### useGraph

Access the Graph instance from any component inside the Flow tree.

```tsx
import { useGraph } from './hooks';

function MyComponent() {
  const graph = useGraph();
  const state = graph.getState();

  return <div>Nodes: {state.nodes.length}</div>;
}
```

### useStore

Subscribe to store state changes with React integration.

```tsx
import { useGraph, useStore } from './hooks';

function NodeList() {
  const graph = useGraph();
  const { nodes, edges } = useStore(graph.getStore());

  return (
    <ul>
      {nodes.map(node => (
        <li key={node.id}>{node.label}</li>
      ))}
    </ul>
  );
}
```

### useViewport

Optimize rendering by filtering visible nodes.

```tsx
import { useViewport } from './hooks';

function OptimizedCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { filterVisibleNodes, isNodeVisible } = useViewport(containerRef, {
    padding: 100  // Include nodes 100px outside viewport
  });

  const graph = useGraph();
  const { nodes } = useStore(graph.getStore());
  const visibleNodes = filterVisibleNodes(nodes);

  return (
    <div ref={containerRef}>
      {visibleNodes.map(node => <Node key={node.id} {...node} />)}
    </div>
  );
}
```

---

## Complete Example

```tsx
import { Graph, Flow, useGraph, useStore } from './';

// Create graph with various node and edge types
const graph = new Graph({
  nodes: [
    { id: 'start', position: { x: 50, y: 150 }, label: 'Start', type: 'default' },
    {
      id: 'process',
      position: { x: 300, y: 50 },
      label: 'Process',
      type: 'custom',
      data: { icon: '⚙️', color: 'blue', description: 'Process data' }
    },
    {
      id: 'decision',
      position: { x: 300, y: 250 },
      label: 'Decision',
      type: 'custom',
      data: { icon: '🔀', color: 'purple', description: 'Branch logic' }
    },
    { id: 'end', position: { x: 550, y: 150 }, label: 'End', type: 'default' }
  ],
  edges: [
    { id: 'e1', sourceNode: 'start', targetNode: 'process', type: 'animated' },
    { id: 'e2', sourceNode: 'start', targetNode: 'decision', type: 'animated' },
    { id: 'e3', sourceNode: 'process', targetNode: 'end', type: 'breakable' },
    { id: 'e4', sourceNode: 'decision', targetNode: 'end', type: 'breakable' }
  ],
  canvasView: 'dots'
});

// Toolbar component to add nodes
function Toolbar() {
  const graph = useGraph();

  const addNode = () => {
    const state = graph.getState();
    graph.setState({
      nodes: [
        ...state.nodes,
        {
          id: `node-${Date.now()}`,
          position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 50 },
          label: `Node ${state.nodes.length + 1}`,
          type: 'custom',
          data: { icon: '📦', color: 'green' }
        }
      ]
    });
  };

  return (
    <button onClick={addNode}>Add Node</button>
  );
}

// Stats component showing current state
function Stats() {
  const graph = useGraph();
  const { nodes, edges } = useStore(graph.getStore());

  return (
    <div className="stats">
      <span>Nodes: {nodes.length}</span>
      <span>Edges: {edges.length}</span>
    </div>
  );
}

// Main app
function App() {
  return (
    <div className="app">
      <Flow graph={graph}>
        <Toolbar />
        <Stats />
      </Flow>
    </div>
  );
}

export default App;
```

---

## API Reference

### Graph Class

| Method | Description |
|--------|-------------|
| `getState()` | Returns current graph state |
| `setState(partial)` | Updates graph state (partial or function) |
| `getStore()` | Returns internal store for `useStore` hook |
| `subscribe(fn)` | Subscribe to state changes |
| `registerNode(id, element)` | Register DOM element for a node |
| `registerEdge(id, element)` | Register SVG path element for an edge |
| `updateEdgesForNode(nodeId)` | Trigger edge path updates for a node |
| `toCanvasSpace(point)` | Convert screen coordinates to canvas coordinates |

### Core Utilities

| Function | Description |
|----------|-------------|
| `createStore(initialState)` | Create a new store instance |
| `makePath(from, to)` | Generate SVG bezier path between two points |
| `createLiveEdge(graph, from)` | Create live edge preview during drag |
| `updateLiveEdge(graph, to)` | Update live edge preview position |
| `removeLiveEdge(graph)` | Remove live edge preview |
| `debounce(fn, wait)` | Debounce function calls |
| `throttle(fn, wait)` | Throttle function calls |
| `rafThrottle(fn)` | Throttle using requestAnimationFrame |

### Types

```typescript
type Vec2 = { x: number; y: number };
type CanvasView = 'grid' | 'dots';
type NodeType = 'default' | 'custom' | 'experimental';
type EdgeType = 'default' | 'animated' | 'breakable';

interface NodeData<T = Record<string, unknown>> {
  id: string;
  position: Vec2;
  label?: string;
  type?: NodeType | string;
  data?: T;
}

interface EdgeData<T = Record<string, unknown>> {
  id: string;
  sourceNode: string;
  targetNode: string;
  sourcePort?: Vec2;
  targetPort?: Vec2;
  label?: string;
  type?: EdgeType | string;
  data?: T;
}

interface GraphState {
  nodes: NodeData[];
  edges: EdgeData[];
  draggingId?: string | null;
  selectedNodeId?: string | null;
  canvasView?: CanvasView;
}
```

---

## Performance

FlowForge React is optimized for performance:

1. **Path Memoization** - Bezier path calculations are cached (LRU, 1000 entries)
2. **RAF Throttling** - Edge updates are batched at 60fps using `requestAnimationFrame`
3. **Viewport Culling** - Only render nodes visible in the viewport with `useViewport`
4. **External Store** - State changes don't trigger unnecessary React re-renders
5. **Passive Events** - Scroll and resize listeners are passive

---

## License

MIT
