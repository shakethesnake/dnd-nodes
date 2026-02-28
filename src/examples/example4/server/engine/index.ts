/**
 * Flow Execution Engine — Public API
 */

// Types
export type {
  NodeRunStatus,
  NodeExecutionState,
  NodeErrorInfo,
  FlowRunStatus,
  FlowExecutionState,
  FlowErrorStrategy,
  FlowExecutionOptions,
  FlowEvent,
  FlowEventListener,
  FlowRunHandle,
  FlowNodeData,
  FlowEdgeData,
  BuilderNodeKind,
  BuilderRuntimeErrorType,
} from "./flowTypes";

// Graph analysis
export {
  buildAdjacency,
  detectCycle,
  topologicalSort,
  filterConditionEdges,
  type AdjacencyInfo,
  type TopologicalLevels,
} from "./flowGraph";

// Node execution
export {
  runNodeInWorker,
  NodeExecutionError,
  type RunNodeOptions,
  type RunNodeResult,
  type RunNodeHandle,
} from "./nodeRunner";

// Flow orchestrator
export { runFlow } from "./flowEngine";
