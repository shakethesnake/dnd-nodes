// core/types.ts

/** 2D vector representing a point or offset */
export type Vec2 = { x: number; y: number };

/** Canvas background display mode */
export type CanvasView = 'grid' | 'dots';

/** Built-in node types */
export type NodeType = 'default' | 'custom' | 'experimental';

/** Built-in edge types */
export type EdgeType = 'default' | 'animated' | 'breakable';

/**
 * Node data structure with optional generic type for custom data
 * @template T - Type for custom node data
 */
export interface NodeData<T = Record<string, unknown>> {
  /** Unique identifier for the node */
  id: string;
  /** Position relative to canvas origin */
  position: Vec2;
  /** Display label for the node */
  label?: string;
  /** Node type - determines which component renders the node */
  type?: NodeType | string;
  /** Custom data payload for the node */
  data?: T;
  /** Allow additional properties for extensibility */
  [key: string]: unknown;
}

/**
 * Edge data structure with optional generic type for custom data
 * @template T - Type for custom edge data
 */
export interface EdgeData<T = Record<string, unknown>> {
  /** Unique identifier for the edge */
  id: string;
  /** ID of the source node */
  sourceNode: string;
  /** ID of the target node */
  targetNode: string;
  /** ID of the source port (for multi-port support) */
  sourcePortId?: string;
  /** ID of the target port (for multi-port support) */
  targetPortId?: string;
  /** Position of the source port (canvas coordinates) */
  sourcePort?: Vec2;
  /** Position of the target port (canvas coordinates) */
  targetPort?: Vec2;
  /** Display label for the edge */
  label?: string;
  /** Edge type - determines which component renders the edge */
  type?: EdgeType | string;
  /** Custom data payload for the edge */
  data?: T;
  /** Allow additional properties for extensibility */
  [key: string]: unknown;
}

/**
 * Complete graph state containing all nodes, edges, and UI state
 */
export interface GraphState {
  /** All nodes in the graph */
  nodes: NodeData[];
  /** All edges connecting nodes */
  edges: EdgeData[];
  /** ID of the node currently being dragged, or null */
  draggingId?: string | null;
  /** ID of the currently selected node, or null */
  selectedNodeId?: string | null;
  /** IDs of currently selected nodes (v1 selection model) */
  selectedNodeIds?: string[];
  /** Current canvas background display mode */
  canvasView?: CanvasView;
}

/** Event handler for node interactions */
export type NodeEventHandler<T = NodeData> = (node: T) => void;

/** Event handler for edge interactions */
export type EdgeEventHandler<T = EdgeData> = (edge: T) => void;

/** Event handler for node position changes */
export type NodeMoveHandler = (node: NodeData, newPosition: Vec2) => void;

/** Event handler for new connections */
export type ConnectionHandler = (connection: {
  sourceNode: string;
  targetNode: string;
  sourcePort: Vec2;
  targetPort: Vec2;
}) => void;

/** Event handler for graph state changes */
export type GraphChangeHandler = (state: GraphState) => void;

/** Store interface for state management */
export interface Store<T> {
  getState: () => T;
  setState: (partial: Partial<T> | ((prev: T) => Partial<T> | T)) => void;
  subscribe: (fn: () => void) => () => void;
  getSnapshot: () => T;
  /** Batch multiple updates into a single notification */
  batch: <R>(fn: () => R) => R;
}

/**
 * Node renderer component type
 * A component that receives node data and renders a node
 */
export type NodeRenderer<T = Record<string, unknown>> = React.FC<NodeData<T>>;

/**
 * Edge renderer component type
 * A component that receives edge data and renders an edge
 */
export type EdgeRenderer<T = Record<string, unknown>> = React.FC<EdgeData<T>>;

/** Edge path routing function */
export type EdgeRouter = (source: Vec2, target: Vec2, edge?: EdgeData) => string;

/** Built-in edge router presets */
export type EdgeRouterPreset = 'bezier' | 'smoothStep';

/**
 * Node types registry
 * Maps node type strings to their renderer components
 */
export type NodeTypesRegistry = Record<string, NodeRenderer>;

/**
 * Edge types registry
 * Maps edge type strings to their renderer components
 */
export type EdgeTypesRegistry = Record<string, EdgeRenderer>;

/**
 * Connection attempt information
 * Represents an active connection being created
 */
export interface ConnectionAttempt {
  /** ID of the source node */
  sourceNodeId: string;
  /** ID of the source port */
  sourcePortId?: string;
  /** Type of the source port */
  sourcePortType: 'input' | 'output';
  /** Screen coordinates of the source port */
  sourcePosition: Vec2;
  /** Current cursor position during connection */
  currentPosition: Vec2;
}

/**
 * Connection validation result
 * Returned by canConnect callback
 */
export type ConnectionValidation =
  | { allowed: true }
  | { allowed: false; reason?: string };

/**
 * Connection strategy callback
 * Validates whether two ports can be connected
 */
export type CanConnectFn = (params: {
  sourceNodeId: string;
  sourcePortId?: string;
  targetNodeId: string;
  targetPortId?: string;
  sourcePortType: 'input' | 'output';
  targetPortType: 'input' | 'output';
}) => ConnectionValidation;

/**
 * Connection lifecycle event payloads
 */
export interface ConnectionEventPayloads {
  /** Fired when user starts creating a connection from a port */
  connectStart: {
    sourceNodeId: string;
    sourcePortId?: string;
    sourcePortType: 'input' | 'output';
    sourcePosition: Vec2;
  };
  /** Fired as user moves cursor while creating a connection */
  connectMove: {
    sourceNodeId: string;
    sourcePortId?: string;
    currentPosition: Vec2;
  };
  /** Fired when connection ends (success or cancel) */
  connectEnd: {
    sourceNodeId: string;
    sourcePortId?: string;
  };
  /** Fired when a valid connection is successfully created */
  connect: {
    sourceNodeId: string;
    sourcePortId?: string;
    targetNodeId: string;
    targetPortId?: string;
    edge: EdgeData;
  };
  /** Fired when connection is cancelled without completing */
  connectCancel: {
    sourceNodeId: string;
    sourcePortId?: string;
    reason?: string;
  };
}

/**
 * Connection event handlers
 */
export interface ConnectionEventHandlers {
  onConnectStart?: (payload: ConnectionEventPayloads['connectStart']) => void;
  onConnectMove?: (payload: ConnectionEventPayloads['connectMove']) => void;
  onConnectEnd?: (payload: ConnectionEventPayloads['connectEnd']) => void;
  onConnect?: (payload: ConnectionEventPayloads['connect']) => void;
  onConnectCancel?: (payload: ConnectionEventPayloads['connectCancel']) => void;
}

/**
 * Serialized graph structure for persistence
 * Excludes runtime data like DOM references
 */
export interface SerializedGraph {
  /** Schema version for migrations */
  version: number;
  /** All nodes in the graph */
  nodes: NodeData[];
  /** All edges connecting nodes */
  edges: EdgeData[];
  /** Optional metadata (author, description, timestamps, etc.) */
  metadata?: Record<string, unknown>;
}

/**
 * Validation error details
 */
export interface ValidationError {
  /** Field path where error occurred */
  field: string;
  /** Human-readable error message */
  message: string;
  /** The invalid value (optional) */
  value?: unknown;
}

/**
 * Result of graph validation
 */
export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: ValidationError[] };

/**
 * Controlled Flow component props
 * External state management - props provide state, Flow only handles rendering/interaction
 */
export interface ControlledFlowProps {
  /** Flow mode - controlled means external state management */
  mode: 'controlled';
  /** Nodes array from external store */
  nodes: NodeData[];
  /** Edges array from external store */
  edges: EdgeData[];
  /** Callback when nodes change */
  onNodesChange?: (nodes: NodeData[]) => void;
  /** Callback when edges change */
  onEdgesChange?: (edges: EdgeData[]) => void;
  /** Callback when any state changes */
  onStateChange?: (state: Partial<GraphState>) => void;
  /** Optional Graph instance for DOM registry/coords (will be created if not provided) */
  graphCore?: Graph;
  /** Custom node type components */
  nodeTypes?: NodeTypesRegistry;
  /** Custom edge type components */
  edgeTypes?: EdgeTypesRegistry;
  /** Optional connection validation strategy */
  canConnect?: CanConnectFn;
  /** Optional connection lifecycle handlers */
  connectionEventHandlers?: ConnectionEventHandlers;
  /** Enable viewport-based node culling for large graphs */
  viewportCulling?: boolean;
  /** Extra culling area around viewport in px */
  cullingPadding?: number;
  /** Estimated node size used by culling calculations */
  estimatedNodeSize?: { width: number; height: number };
  /** Edge routing strategy or custom router function */
  edgeRouter?: EdgeRouterPreset | EdgeRouter;
  /** Edge rendering mode */
  edgeLayerType?: 'svg' | 'webgl';
  /** Enable built-in keyboard shortcuts (delete/undo/redo) */
  enableHotkeys?: boolean;
  /** Snap node positions to grid on drag end */
  snapToGrid?: boolean;
  /** Grid size in pixels for snap-to-grid */
  gridSize?: number;
}

/**
 * Uncontrolled Flow component props
 * Internal state management - Graph owns the state
 */
export interface UncontrolledFlowProps {
  /** Flow mode - uncontrolled (default) means Graph owns state */
  mode?: 'uncontrolled';
  /** Graph instance that owns the state */
  graph: Graph;
  /** Custom node type components */
  nodeTypes?: NodeTypesRegistry;
  /** Custom edge type components */
  edgeTypes?: EdgeTypesRegistry;
  /** Optional connection validation strategy */
  canConnect?: CanConnectFn;
  /** Optional connection lifecycle handlers */
  connectionEventHandlers?: ConnectionEventHandlers;
  /** Enable viewport-based node culling for large graphs */
  viewportCulling?: boolean;
  /** Extra culling area around viewport in px */
  cullingPadding?: number;
  /** Estimated node size used by culling calculations */
  estimatedNodeSize?: { width: number; height: number };
  /** Edge routing strategy or custom router function */
  edgeRouter?: EdgeRouterPreset | EdgeRouter;
  /** Edge rendering mode */
  edgeLayerType?: 'svg' | 'webgl';
  /** Enable built-in keyboard shortcuts (delete/undo/redo) */
  enableHotkeys?: boolean;
  /** Snap node positions to grid on drag end */
  snapToGrid?: boolean;
  /** Grid size in pixels for snap-to-grid */
  gridSize?: number;
}

/**
 * Flow component props - supports both controlled and uncontrolled modes
 */
export type FlowProps = ControlledFlowProps | UncontrolledFlowProps;

// Import Graph type for FlowProps (will be defined in Graph.ts)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Graph = any;
