# FlowForge React

Lightweight, zero-dependency\* library for building interactive node-based graphs in React + TypeScript.

> \* The only runtime dependency is `regl` (WebGL edge rendering). Core SVG rendering has zero deps beyond React.

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [Flow Modes](#flow-modes)
- [Graph API](#graph-api)
- [Components](#components)
- [Hooks](#hooks)
- [Providers & Context](#providers--context)
- [Custom Node Types](#custom-node-types)
- [Custom Edge Types](#custom-edge-types)
- [Ports & Connections](#ports--connections)
- [Viewport & Navigation](#viewport--navigation)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Serialization & Persistence](#serialization--persistence)
- [Undo / Redo](#undo--redo)
- [Performance](#performance)
- [Theming](#theming)
- [Types Reference](#types-reference)
- [Package Exports](#package-exports)
- [Examples](#examples)
- [Development](#development)

---

## Quick Start

```tsx
import { Flow, Graph } from "flowforge-react";

const graph = new Graph({
  nodes: [
    { id: "a", position: { x: 100, y: 80 }, label: "Start" },
    { id: "b", position: { x: 400, y: 200 }, label: "End" },
  ],
  edges: [
    { id: "e1", sourceNode: "a", targetNode: "b" },
  ],
});

export function App() {
  return <Flow graph={graph} />;
}
```

That's it. Nodes are draggable, edges update live, zoom/pan works out of the box.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  Flow (entry point)                                 │
│  ├─ GraphProvider        (Graph instance context)   │
│  ├─ RegistryProvider     (nodeTypes / edgeTypes)    │
│  ├─ ZoomProvider         (viewport state & actions) │
│  ├─ ConnectionProvider   (canConnect + events)      │
│  ├─ ContextMenuProvider  (right-click menus)        │
│  └─ FlowProvider         (nodes array context)      │
│       └─ FlowCanvas                                 │
│            ├─ GridBackground                         │
│            ├─ EdgesLayer (SVG or WebGL)              │
│            │    └─ Edge / AnimatedEdge / BreakableEdge│
│            ├─ Node / CustomNode / ExperimentalNode   │
│            │    └─ Port (input / output)             │
│            ├─ ZoomControls                           │
│            └─ ContextMenu                            │
└─────────────────────────────────────────────────────┘
```

**Data flow:** `Graph` owns a `Store<GraphState>`. React components subscribe to the store via `useStore()`. Mutations go through `graph.setState()`, which auto-tracks history. DOM references (node elements, SVG paths) are registered in `Graph.nodeRegistry` / `Graph.pathRegistry` for direct DOM manipulation during drag (no React re-render during drag).

---

## Flow Modes

### Uncontrolled (default)

Graph instance owns all state. Simplest setup.

```tsx
const graph = new Graph({
  nodes: [...],
  edges: [...],
});

<Flow graph={graph} />
```

### Controlled

You own the state. Flow just renders and reports changes.

```tsx
const [nodes, setNodes] = useState<NodeData[]>([...]);
const [edges, setEdges] = useState<EdgeData[]>([...]);

<Flow
  mode="controlled"
  nodes={nodes}
  edges={edges}
  onNodesChange={setNodes}
  onEdgesChange={setEdges}
/>
```

---

## Graph API

`Graph` is the core class — state management, DOM registry, coordinate math, history, serialization.

### Constructor

```ts
// Simple (old API — backward compatible)
const graph = new Graph({ nodes: [...], edges: [...] });

// Full config
const graph = new Graph({
  initialState: { nodes: [...], edges: [...] },
  history: { maxSize: 100, mergeInterval: 300 },
});

// Controlled mode
const graph = Graph.createControlled(externalStore);
```

### State

```ts
graph.getState(): GraphState           // current state snapshot
graph.setState(partial | updater)      // update state (auto-tracked in history)
graph.getStore(): Store<GraphState>    // raw store (for useStore subscription)
graph.batch(() => { ... })             // batch multiple updates into one notification
```

### Coordinate Conversion

```ts
graph.toCanvasSpace({ x, y }): Vec2   // screen px → canvas coords (accounts for zoom/pan)
graph.setViewportTransform(x, y, zoom) // called internally by ZoomProvider
```

### DOM Registry

```ts
graph.nodeRegistry: Map<string, HTMLElement>      // node id → DOM element
graph.edgeRegistry: Map<string, SVGPathElement>   // edge id → SVG path
graph.pathRegistry: EdgePathRegistry              // centralized path element cache
graph.routeCache: RouteCache                      // LRU cache for computed SVG path strings
```

### Edge Updates

```ts
graph.updateEdgesForNode(nodeId)       // incrementally update edges connected to a node (rAF batched)
graph.rebuildEdgeIndex()               // rebuild nodeId→edgeIds index after structural changes
graph.setEdgeRouter(router)            // set the active edge routing function
```

### Snap-to-Grid

```ts
graph.setSnapConfig(enabled, gridSize) // configure snap behavior
graph.snapPosition({ x, y }): Vec2    // snap a point to grid
```

### History (Undo / Redo)

```ts
graph.undo(): boolean                  // undo last action
graph.redo(): boolean                  // redo
graph.canUndo(): boolean
graph.canRedo(): boolean
graph.clearHistory(): void
graph.pushHistory(label?, force?)      // manually mark an undo boundary
graph.getHistoryInfo()                 // { pastSize, futureSize, canUndo, canRedo, maxSize, mergeInterval }
```

### Serialization

```ts
graph.toJSON(metadata?): SerializedGraph        // export to JSON
graph.loadJSON(json: SerializedGraph): void     // import from JSON (validates first)
Graph.fromJSON(json): Graph                     // create new Graph from JSON
Graph.validate(json): ValidationResult          // validate without importing
```

### Layers

```ts
graph.addLayer(name, element)          // register a DOM layer (edgeLayer, nodeLayer, etc.)
graph.getLayer(name): Element          // retrieve layer
```

---

## Components

### `<Flow>`

Top-level component. All props below:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `mode` | `'controlled' \| 'uncontrolled'` | `'uncontrolled'` | State ownership mode |
| `graph` | `Graph` | — | Graph instance (uncontrolled mode) |
| `nodes` | `NodeData[]` | — | Nodes array (controlled mode) |
| `edges` | `EdgeData[]` | — | Edges array (controlled mode) |
| `onNodesChange` | `(nodes) => void` | — | Node change callback (controlled) |
| `onEdgesChange` | `(edges) => void` | — | Edge change callback (controlled) |
| `onStateChange` | `(state) => void` | — | Any state change callback (controlled) |
| `graphCore` | `Graph` | auto-created | Optional Graph for controlled mode |
| `nodeTypes` | `Record<string, NodeRenderer>` | built-ins | Custom node component registry |
| `edgeTypes` | `Record<string, EdgeRenderer>` | built-ins | Custom edge component registry |
| `canConnect` | `CanConnectFn` | allow all | Connection validation function |
| `connectionEventHandlers` | `ConnectionEventHandlers` | — | Connection lifecycle callbacks |
| `edgeRouter` | `'bezier' \| 'smoothStep' \| EdgeRouter` | `'bezier'` | Edge path routing |
| `edgeLayerType` | `'svg' \| 'webgl'` | `'svg'` | Edge rendering engine |
| `viewportCulling` | `boolean` | `false` | Skip rendering off-screen nodes |
| `cullingPadding` | `number` | `0` | Extra px around viewport for culling |
| `estimatedNodeSize` | `{ width, height }` | — | Node size hint for culling |
| `enableHotkeys` | `boolean` | `false` | Enable keyboard shortcuts |
| `snapToGrid` | `boolean` | `false` | Snap node positions to grid |
| `gridSize` | `number` | `20` | Grid spacing in px |
| `showGrid` | `boolean` | `true` | Show background grid |
| `enablePan` | `boolean` | `true` | Enable Space+drag / middle-mouse panning |
| `enableSpatialOptimization` | `boolean` | `false` | Spatial index for >500 nodes |
| `edgeCulling` | `boolean` | `false` | Skip rendering off-screen edges |
| `edgeCullingPadding` | `number` | `0` | Extra px for edge culling |

### `<NodeShell>`

Reusable wrapper for custom nodes. Provides drag, select, and context menu behavior.

```tsx
interface NodeShellProps {
  data?: { id: string; position: Vec2; label?: string } & Partial<NodeData>;
  style?: React.CSSProperties;
  children: React.ReactNode;
}
```

Usage inside a custom node type:

```tsx
const MyNode: NodeRenderer = (node) => (
  <NodeShell data={node}>
    <div className="my-content">{node.label}</div>
    <Port type="input" portId="in" data={{ nodeId: node.id }} />
    <Port type="output" portId="out" data={{ nodeId: node.id }} />
  </NodeShell>
);
```

### `<Port>`

Connection port. Handles pointer events for creating connections.

```tsx
interface PortProps {
  type?: 'input' | 'output';   // default: 'input'
  portId?: string;              // unique ID within the node (default: 'in'/'out')
  className?: string;
  style?: React.CSSProperties;
  data: { nodeId: string };     // required: which node this port belongs to
}
```

### `<Edge>` / `<AnimatedEdge>` / `<BreakableEdge>`

Built-in edge types. All receive `EdgeData` as props:

```ts
interface EdgeData<T = Record<string, unknown>> {
  id: string;
  sourceNode: string;
  targetNode: string;
  sourcePortId?: string;
  targetPortId?: string;
  sourcePort?: Vec2;
  targetPort?: Vec2;
  label?: string;
  type?: string;
  data?: T;
}
```

- **Edge** — default edge with selection, LOD (level-of-detail at different zoom levels)
- **AnimatedEdge** — dashed animation + pulse effect
- **BreakableEdge** — edge with breakpoint visualization

### `<ZoomControls>`

Floating zoom buttons (+, -, reset, fit).

```tsx
interface ZoomControlsProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  showPercentage?: boolean;
}
```

### `<ContextMenu>`

Right-click context menu with submenus.

```tsx
interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}

interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;              // emoji or character
  shortcut?: string;          // display-only hint
  disabled?: boolean;
  separator?: boolean;        // renders a divider line
  onClick?: () => void;
  submenu?: ContextMenuItem[];
}
```

### `<GridBackground>`

Infinite grid or dots pattern. Rendered automatically by `FlowCanvas` when `showGrid` is true.

---

## Hooks

### `useGraph(): Graph`

Access the Graph instance from context (inside `<Flow>`).

```tsx
const graph = useGraph();
const state = graph.getState();
```

### `useStore<T>(store: Store<T>): T`

Subscribe to a store's state. Re-renders when state changes.

```tsx
const graph = useGraph();
const { nodes, edges } = useStore(graph.getStore());
```

### `useNode(id: string): NodeData | null`

Get a single node by ID. Subscribes to changes.

```tsx
const node = useNode("my-node-id");
```

### `useEdgesForNode(nodeId: string): EdgeData[]`

Get all edges connected to a node (source or target).

```tsx
const edges = useEdgesForNode("my-node-id");
```

### `useSelection()`

Multi-select state management.

```tsx
const {
  selectedNodeIds,    // string[]
  selectedEdgeIds,    // string[]
  setSelection,       // (nodeIds: string[]) => void
  setEdgeSelection,   // (edgeIds: string[]) => void
  clearSelection,     // () => void — clears both nodes and edges
  clearNodeSelection, // () => void
  clearEdgeSelection, // () => void
  getSelectionSnapshot, // () => { nodeIds: string[]; edgeIds: string[] }
} = useSelection();
```

### `useConnectionPreview()`

Track the current in-progress connection attempt.

```tsx
const { currentConnection, isConnecting } = useConnectionPreview();
```

### `useViewport(containerRef, options?)`

Viewport bounds and culling utilities.

```tsx
const {
  bounds,              // ViewportBounds | null
  isPointVisible,      // (point: Vec2) => boolean
  isNodeVisible,       // (node, width?, height?) => boolean
  filterVisibleNodes,  // (nodes, width?, height?) => nodes
  countVisibleNodes,   // (nodes, width?, height?) => number
  updateBounds,        // () => void
  getCanvasBounds,     // (nodes, buffer?) => ViewportBounds | null
  getFitViewTransform, // (nodes, containerW, containerH) => ViewportTransform | null
} = useViewport(containerRef, options);
```

### `useHistory()`

Undo/redo state and actions.

```tsx
const { canUndo, canRedo, undo, redo, clear, push } = useHistory();
```

### `useFlowIO()`

Import/export graph as JSON or file.

```tsx
const { exportToJSON, importFromJSON, exportToFile, importFromFile } = useFlowIO();

// Export
const json = exportToJSON();

// Download as .json file
exportToFile("my-flow.json");

// Import from file picker dialog
await importFromFile();
```

### `useHotkeys(graph, options?)`

Enable built-in keyboard shortcuts. Called internally when `enableHotkeys` is set.

---

## Providers & Context

All providers are nested automatically by `<Flow>`. You rarely need to use them directly.

| Provider | Context value | Purpose |
|----------|--------------|---------|
| `GraphProvider` | `Graph` instance | State management, DOM registry |
| `RegistryProvider` | `{ nodeTypes, edgeTypes }` | Component lookup by type string |
| `ZoomProvider` | viewport state + actions | Pan, zoom, transform |
| `ConnectionProvider` | `canConnect` + event handlers | Connection validation & lifecycle |
| `FlowProvider` | `{ nodes }` | Lightweight node array access |
| `ContextMenuProvider` | `showMenu()` / `hideMenu()` | Right-click menu portal |

Access via hooks:

```tsx
const graph = useGraph();          // GraphProvider
const { nodeTypes } = useRegistry(); // RegistryProvider
```

---

## Custom Node Types

Register custom components via the `nodeTypes` prop:

```tsx
// 1. Create your node component
const StatusNode: NodeRenderer<{ status: string; color: string }> = (node) => (
  <NodeShell data={node} style={{ borderColor: node.data?.color }}>
    <div className="node-header">
      <span className="node-title">{node.label}</span>
    </div>
    <div className="node-body">{node.data?.status}</div>
    <div className="ports">
      <Port type="input" portId="in" data={{ nodeId: node.id }} />
      <Port type="output" portId="out" data={{ nodeId: node.id }} />
    </div>
  </NodeShell>
);

// 2. Register it
<Flow
  graph={graph}
  nodeTypes={{ status: StatusNode }}
/>

// 3. Use it in node data
graph.setState({
  nodes: [
    { id: "s1", position: { x: 100, y: 100 }, type: "status", label: "Check",
      data: { status: "running", color: "#36d399" } },
  ],
});
```

Built-in node types: `default`, `custom`, `experimental`.

---

## Custom Edge Types

Same pattern as nodes:

```tsx
const GlowEdge: EdgeRenderer = (edge) => (
  <path
    data-edge-id={edge.id}
    d={makePath(edge.sourcePort!, edge.targetPort!)}
    stroke="#ff6b6b"
    strokeWidth={3}
    fill="none"
    filter="url(#glow)"
  />
);

<Flow
  graph={graph}
  edgeTypes={{ glow: GlowEdge }}
/>

// In edge data
{ id: "e1", sourceNode: "a", targetNode: "b", type: "glow" }
```

Built-in edge types: `default`, `animated`, `breakable`.

### Edge Routers

Control how edge paths are calculated:

```tsx
// Preset
<Flow edgeRouter="smoothStep" />

// Custom function
<Flow edgeRouter={(source: Vec2, target: Vec2, edge?: EdgeData) => {
  return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
}} />
```

Built-in routers: `bezierEdgeRouter`, `smoothStepEdgeRouter`.

---

## Ports & Connections

### Multi-Port Nodes

Nodes can have multiple input/output ports with unique IDs:

```tsx
const MultiPortNode: NodeRenderer = (node) => (
  <NodeShell data={node}>
    <div className="ports">
      <div className="port-group">
        <Port type="input" portId="data" data={{ nodeId: node.id }} />
        <Port type="input" portId="config" data={{ nodeId: node.id }} />
      </div>
      <div className="port-group">
        <Port type="output" portId="result" data={{ nodeId: node.id }} />
        <Port type="output" portId="error" data={{ nodeId: node.id }} />
      </div>
    </div>
  </NodeShell>
);
```

Edges reference specific ports via `sourcePortId` / `targetPortId`:

```ts
{ id: "e1", sourceNode: "a", sourcePortId: "result", targetNode: "b", targetPortId: "data" }
```

### Connection Validation

```tsx
<Flow
  canConnect={({ sourceNodeId, sourcePortId, targetNodeId, targetPortId, sourcePortType, targetPortType }) => {
    // Only allow output → input
    if (sourcePortType === targetPortType) {
      return { allowed: false, reason: "Cannot connect same port types" };
    }
    // Prevent self-connections
    if (sourceNodeId === targetNodeId) {
      return { allowed: false, reason: "Cannot connect to self" };
    }
    return { allowed: true };
  }}
/>
```

### Connection Lifecycle Events

```tsx
<Flow
  connectionEventHandlers={{
    onConnectStart: ({ sourceNodeId, sourcePortId, sourcePortType, sourcePosition }) => { ... },
    onConnectMove: ({ sourceNodeId, sourcePortId, currentPosition }) => { ... },
    onConnectEnd: ({ sourceNodeId, sourcePortId }) => { ... },
    onConnect: ({ sourceNodeId, targetNodeId, sourcePortId, targetPortId, edge }) => { ... },
    onConnectCancel: ({ sourceNodeId, sourcePortId, reason }) => { ... },
  }}
/>
```

---

## Viewport & Navigation

### Zoom & Pan

- **Mouse wheel** — zoom toward cursor
- **Space + drag** — pan canvas
- **Middle mouse drag** — pan canvas
- **ZoomControls widget** — +, -, reset, fit-to-view buttons

Zoom range: `0.1` – `3.0` (configurable via `ZoomConfig`).

### ZoomControls

```tsx
<Flow graph={graph}>
  {/* ZoomControls are rendered inside FlowCanvas */}
</Flow>
```

Positioning options: `top-left`, `top-right`, `bottom-left`, `bottom-right`.

### Programmatic Viewport Control

From `ZoomProvider` context:

```ts
interface ViewportActions {
  setZoom(zoom: number): void;
  zoomIn(delta?: number): void;
  zoomOut(delta?: number): void;
  zoomToFit(nodes: NodeData[]): void;
  pan(dx: number, dy: number): void;
  panTo(x: number, y: number): void;
  resetView(): void;
  getTransform(): string;
  zoomToPoint(clientX: number, clientY: number, delta: number): void;
}
```

---

## Keyboard Shortcuts

Enabled via `enableHotkeys` prop on `<Flow>`:

| Shortcut | Action |
|----------|--------|
| `Delete` / `Backspace` | Delete selected nodes and edges |
| `Ctrl+Z` / `Cmd+Z` | Undo |
| `Ctrl+Shift+Z` / `Cmd+Shift+Z` | Redo |
| `Ctrl+Y` / `Cmd+Y` | Redo (alternative) |

---

## Serialization & Persistence

### Export / Import via Graph

```ts
// Export
const json: SerializedGraph = graph.toJSON({ author: "me", version: "1.0" });
localStorage.setItem("flow", JSON.stringify(json));

// Import
const saved = JSON.parse(localStorage.getItem("flow")!);
graph.loadJSON(saved); // validates before applying

// Create new Graph from saved data
const newGraph = Graph.fromJSON(saved);

// Validate without importing
const result = Graph.validate(data);
if (!result.valid) console.error(result.errors);
```

### Export / Import via Hook

```ts
const { exportToJSON, importFromJSON, exportToFile, importFromFile } = useFlowIO();

exportToFile("my-flow.json"); // downloads a .json file
await importFromFile();        // opens file picker, loads & validates
```

### SerializedGraph Format

```ts
interface SerializedGraph {
  version: number;                    // schema version for migrations
  nodes: NodeData[];
  edges: EdgeData[];
  viewport?: ViewportState;           // { x, y, zoom }
  canvasView?: 'grid' | 'dots';
  metadata?: Record<string, unknown>; // arbitrary user metadata
}
```

---

## Undo / Redo

History is enabled by default in uncontrolled mode and disabled in controlled mode.

```ts
// Via Graph instance
graph.undo();
graph.redo();
graph.pushHistory("Added new node", true); // force new snapshot

// Via hook (inside <Flow>)
const { canUndo, canRedo, undo, redo, clear, push } = useHistory();
```

### History Configuration

```ts
const graph = new Graph({
  initialState: { nodes: [], edges: [] },
  history: {
    maxSize: 50,        // max snapshots (default: 50)
    mergeInterval: 300,  // ms — merge rapid changes (default: 300)
  },
});

// Disable history
const graph = new Graph({
  initialState: { ... },
  history: false,
});
```

---

## Performance

The library implements several optimization layers for large graphs:

### P1 — Incremental Edge Updates

Only edges connected to a moved node are updated during drag (`pathRegistry.getEdgeIdsForNode()`), not all edges.

### P2 — Edge Path Registry

`EdgePathRegistry` maps `edgeId → SVGPathElement[]` for O(1) DOM access. No `querySelectorAll` during drag.

### P3 — Route Cache

`RouteCache` is an LRU cache (max 2000 entries, 0.5px precision) for computed SVG path strings. Cache hits on stationary edge endpoints or snap-to-grid.

### P4 — Level of Detail (LOD)

Edge rendering adjusts based on zoom level:

| Zoom | Detail |
|------|--------|
| >= 0.5 | Full (glow, animation, thick stroke) |
| >= 0.25 | Reduced (no glow, no animation) |
| < 0.25 | Minimal (thin line only) |

### P5 — Edge Culling

`edgeCulling` skips rendering edges whose bounding box is outside the viewport + padding.

### Node Culling

`viewportCulling` filters out off-screen nodes before rendering. `enableSpatialOptimization` enables spatial index for graphs with >500 nodes.

### Direct DOM During Drag

Node position and edge paths are updated via direct DOM manipulation during drag (no React setState / re-render). State is committed once on `pointerup`.

---

## Theming

The library uses CSS custom properties with `--ff-` prefix. Override them to theme:

```css
:root {
  --ff-bg: #0f1220;                          /* canvas background */
  --ff-panel: #161a2e;                       /* panels (zoom controls, menus) */
  --ff-node: #20253f;                        /* node background */
  --ff-node-border: #2e355e;                 /* node and edge borders */
  --ff-accent: #7aa2ff;                      /* selection, input ports */
  --ff-accent-2: #36d399;                    /* output ports */
  --ff-text: #e8ecff;                        /* primary text */
  --ff-muted: #9aa3c7;                       /* secondary text */
  --ff-grid-color: rgba(27, 32, 56, 0.5);   /* grid lines/dots */
}
```

Each variable falls back to a non-prefixed alias (e.g., `--ff-bg: var(--bg, #0f1220)`), so you can also set `--bg` directly.

### Key CSS Classes

| Class | Element |
|-------|---------|
| `.node` | Node container |
| `.node.selected` | Selected node |
| `.node.dragging` | Node being dragged |
| `.port` | Port circle |
| `.port.input` / `.port.output` | Port types |
| `.edge-path` | Edge SVG path |
| `.edge-selected` | Selected edge |
| `.animated-edge` | Dash animation |
| `.animated-edge-pulse` | Pulse animation |
| `.grid-background` | Background grid |
| `.zoom-controls` | Zoom panel |
| `.context-menu` | Right-click menu |
| `.experimental-node` | ExperimentalNode variant |

---

## Types Reference

### Core Data

```ts
type Vec2 = { x: number; y: number };

interface NodeData<T = Record<string, unknown>> {
  id: string;
  position: Vec2;
  label?: string;
  type?: NodeType | string;   // maps to nodeTypes registry
  data?: T;                   // custom payload — your runtime & config data
  [key: string]: unknown;     // extensible
}

interface EdgeData<T = Record<string, unknown>> {
  id: string;
  sourceNode: string;
  targetNode: string;
  sourcePortId?: string;
  targetPortId?: string;
  sourcePort?: Vec2;          // computed port position (canvas coords)
  targetPort?: Vec2;
  label?: string;
  type?: EdgeType | string;   // maps to edgeTypes registry
  data?: T;
  [key: string]: unknown;
}

interface GraphState {
  nodes: NodeData[];
  edges: EdgeData[];
  draggingId?: string | null;
  selectedNodeId?: string | null;
  selectedNodeIds?: string[];
  selectedEdgeId?: string | null;
  selectedEdgeIds?: string[];
  canvasView?: 'grid' | 'dots';
  viewport?: ViewportState;    // { x, y, zoom }
}
```

### Handler Types

```ts
type NodeRenderer<T> = React.FC<NodeData<T>>;
type EdgeRenderer<T> = React.FC<EdgeData<T>>;
type EdgeRouter = (source: Vec2, target: Vec2, edge?: EdgeData) => string;

type CanConnectFn = (params: {
  sourceNodeId: string;
  sourcePortId?: string;
  targetNodeId: string;
  targetPortId?: string;
  sourcePortType: 'input' | 'output';
  targetPortType: 'input' | 'output';
}) => { allowed: true } | { allowed: false; reason?: string };
```

### Store

```ts
interface Store<T> {
  getState(): T;
  setState(partial: Partial<T> | ((prev: T) => Partial<T> | T)): void;
  subscribe(fn: () => void): () => void;
  getSnapshot(): T;
  batch<R>(fn: () => R): R;
}
```

### EventEmitter

```ts
class EventEmitter<TEvents extends object> {
  on<K>(event: K, listener: (payload: TEvents[K]) => void): () => void;
  on(event: "*", listener: (event: string, payload: any) => void): () => void;
  once<K>(event: K, listener: (payload: TEvents[K]) => void): () => void;
  off<K>(event: K, listener): void;
  emit<K>(event: K, payload: TEvents[K]): void;
}
```

---

## Package Exports

```json
{
  "flowforge-react"            : "Main entry — all components, hooks, core, types",
  "flowforge-react/core"       : "Graph, createStore, EventEmitter, LiveEdge, routers, etc.",
  "flowforge-react/components" : "Flow, Node, Edge, Port, NodeShell, ZoomControls, etc.",
  "flowforge-react/hooks"      : "useGraph, useStore, useNode, useSelection, etc.",
  "flowforge-react/providers"  : "GraphProvider, ZoomProvider, ConnectionProvider, etc.",
  "flowforge-react/types"      : "All TypeScript interfaces and type aliases",
  "flowforge-react/styles.css" : "Runtime CSS (auto-imported, or import manually)"
}
```

---

## Examples

Located in `src/examples/`:

| Example | File | Demonstrates |
|---------|------|-------------|
| Data Pipeline | `DataPipelineExample.tsx` | 5-stage animated data flow, custom colors, uncontrolled mode |
| Damage Pipeline | `example1/AdvancedDamagePipelineExample.tsx` | Multi-port nodes, computation simulation |
| Custom Registry | `example1/CustomRegistryExample.tsx` | Custom nodeTypes and edgeTypes |
| Multi-Port | `example1/MultiPortExample.tsx` | Nodes with 3+ ports per side |
| Conditional Connection | `example2/ConditionalConnectionExample.tsx` | `canConnect` validation, typed ports |
| Agent Flow | `example3/AgentFlowExample.tsx` | AI agent workflow, status display, settings modal |
| Infinite Canvas | `InfiniteCanvasExample.tsx` | Large graph performance test |

---

## Development

```bash
pnpm install          # install dependencies
pnpm dev              # start dev server (Vite)
pnpm build            # build library (types + Vite)
pnpm test             # run tests in watch mode (Vitest)
pnpm test:run         # run tests once
pnpm test:coverage    # run tests with coverage
pnpm lint             # ESLint
```

### Tech Stack

- **React** 18/19, **TypeScript** 5.9
- **Vite** 7 (dev + build)
- **Vitest** 4 + Testing Library (tests)
- **regl** (WebGL edge rendering)

### Project Structure

```
src/
├── core/                  # Non-React logic
│   ├── Graph.ts           # Central state + DOM registry
│   ├── createStore.ts     # Minimal state store
│   ├── EventEmitter.ts    # Typed pub/sub
│   ├── History.ts         # Undo/redo stack
│   ├── Serialization.ts   # JSON import/export/validate
│   ├── LiveEdge.ts        # Temporary connection path + makePath()
│   ├── EdgeRouters.ts     # bezier / smoothStep routers
│   ├── EdgePathRegistry.ts # SVG path element cache
│   ├── RouteCache.ts      # LRU path string cache
│   ├── EdgeCulling.ts     # Edge visibility helpers
│   ├── debounce.ts        # debounce / throttle / rafThrottle
│   └── defaultRegistries.ts # Built-in node/edge type maps
├── components/            # React components
│   ├── Flow.tsx           # Entry point (controlled + uncontrolled)
│   ├── Canvas.tsx         # Main canvas with zoom/pan
│   ├── Node.tsx           # Default node
│   ├── CustomNode.tsx     # Styled gradient node
│   ├── ExperimentalNode.tsx # External-port node
│   ├── NodeShell.tsx      # Reusable node wrapper
│   ├── Port.tsx           # Connection port
│   ├── Edge.tsx           # Default edge (LOD)
│   ├── AnimatedEdge.tsx   # Animated edge
│   ├── BreakableEdge.tsx  # Breakpoint edge
│   ├── EdgeLayer.tsx      # SVG/WebGL edge layer
│   ├── GridBackground.tsx # Infinite grid/dots
│   ├── ZoomControls.tsx   # Zoom buttons
│   └── ContextMenu.tsx    # Right-click menu
├── hooks/                 # React hooks
├── providers/             # React context providers
├── types/                 # TypeScript type definitions
├── styles/                # CSS
│   └── flowforge.css      # All library styles
└── examples/              # Usage examples
```
