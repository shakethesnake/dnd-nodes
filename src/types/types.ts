// core/types.ts
export type Vec2 = { x: number; y: number };

export type CanvasView = 'grid' | 'dots';

export interface NodeData {
  id: string;
  position: Vec2;        // координаты относительно Canvas
  label?: string;
  type?: string;         // Custom node type (default, custom, etc.)
  data?: Record<string, unknown>; // Custom data for the node
  // для будущего: width/height, payload и т.п.
  [key: string]: unknown;
}

export interface EdgeData {
  id: string;
  sourceNode: string;
  targetNode: string;
  sourcePort?: Vec2;
  targetPort?: Vec2;
  label?: string;
  type?: string;         // Edge type: default, animated, breakable, etc.
  data?: Record<string, unknown>; // Custom data for the edge
  [key: string]: unknown;
}

export interface GraphState {
  nodes: NodeData[];
  edges: EdgeData[];
  draggingId?: string | null;
  canvasView?: CanvasView;
}
