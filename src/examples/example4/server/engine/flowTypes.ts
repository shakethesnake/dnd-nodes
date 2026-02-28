/**
 * Flow Execution Engine — Type Definitions
 *
 * All types for server-side flow execution.
 * Reuses BuilderRuntimeErrorType from the frontend types.
 */

// ── Re-export frontend types used by the engine ──────────────────────

export type BuilderRuntimeErrorType = "syntax" | "runtime" | "timeout" | "contract";

export type BuilderNodeKind = "input" | "agent" | "transform" | "condition" | "output" | "note";

// ── Node-level execution state ───────────────────────────────────────

export type NodeRunStatus =
  | "idle"
  | "pending"
  | "running"
  | "completed"
  | "error"
  | "skipped";

export interface NodeErrorInfo {
  type: BuilderRuntimeErrorType;
  message: string;
  line?: number;
  column?: number;
  stack?: string;
}

export interface NodeExecutionState {
  nodeId: string;
  status: NodeRunStatus;
  input?: unknown;
  output?: unknown;
  error?: NodeErrorInfo;
  durationMs?: number;
  startedAt?: number;
  completedAt?: number;
}

// ── Flow-level execution state ───────────────────────────────────────

export type FlowRunStatus =
  | "idle"
  | "running"
  | "completed"
  | "error"
  | "cancelled";

export interface FlowExecutionState {
  runId: string;
  status: FlowRunStatus;
  nodeStates: Map<string, NodeExecutionState>;
  startedAt: number;
  completedAt?: number;
  /** Collected outputs from all completed output-type nodes */
  outputs: Record<string, unknown>;
  /** All errors encountered during the run */
  errors: Array<{ nodeId: string; error: NodeErrorInfo }>;
}

// ── Configuration ────────────────────────────────────────────────────

export type FlowErrorStrategy =
  | "stop-on-first-error"
  | "continue-where-possible";

export interface FlowExecutionOptions {
  /** Override input data per input-node-id; falls back to node.inputExample */
  inputs?: Record<string, unknown>;
  /** Per-node timeout in ms (default: 2000) */
  nodeTimeoutMs?: number;
  /** Total flow timeout in ms (0 = no limit, default: 0) */
  flowTimeoutMs?: number;
  /** Error handling strategy (default: "stop-on-first-error") */
  errorStrategy?: FlowErrorStrategy;
}

// ── Events emitted during execution ──────────────────────────────────

export type FlowEvent =
  | { type: "node-started"; nodeId: string }
  | { type: "node-completed"; nodeId: string; output: unknown; durationMs: number }
  | { type: "node-error"; nodeId: string; error: NodeErrorInfo }
  | { type: "node-skipped"; nodeId: string; reason: string }
  | { type: "flow-completed"; outputs: Record<string, unknown>; durationMs: number }
  | { type: "flow-error"; errors: FlowExecutionState["errors"]; durationMs: number }
  | { type: "flow-cancelled" };

export type FlowEventListener = (event: FlowEvent) => void;

// ── Run handle returned to callers ───────────────────────────────────

export interface FlowRunHandle {
  /** Resolves when flow finishes (completed, error, or cancelled) */
  promise: Promise<FlowExecutionState>;
  /** Cancel the entire flow mid-execution */
  cancel: () => void;
  /** Subscribe to live execution events; returns unsubscribe function */
  on: (listener: FlowEventListener) => () => void;
  /** Get current snapshot of execution state */
  getState: () => FlowExecutionState;
}

// ── Minimal node/edge shapes (server doesn't need full frontend types) ──

export interface FlowNodeData {
  id: string;
  label?: string;
  data?: {
    kind?: BuilderNodeKind;
    code?: string;
    inputExample?: unknown;
    outputExample?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface FlowEdgeData {
  id: string;
  sourceNode: string;
  targetNode: string;
  sourcePortId?: string;
  targetPortId?: string;
  label?: string;
  [key: string]: unknown;
}
