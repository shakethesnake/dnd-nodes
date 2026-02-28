/**
 * Flow Engine — Core Orchestrator
 *
 * Executes an entire flow graph from input nodes to output nodes.
 *
 * Algorithm:
 * 1. Build adjacency map & detect cycles
 * 2. Topological sort into parallel levels (Kahn's)
 * 3. Execute level-by-level: nodes within a level run concurrently
 * 4. Pass data between nodes via edges
 * 5. Handle condition branching (prune dead edges)
 * 6. Collect outputs from output-type nodes
 */

import type {
  FlowNodeData,
  FlowEdgeData,
  FlowExecutionOptions,
  FlowExecutionState,
  FlowRunHandle,
  FlowEventListener,
  FlowEvent,
  NodeExecutionState,
  NodeErrorInfo,
  BuilderNodeKind,
} from "./flowTypes";
import {
  buildAdjacency,
  detectCycle,
  topologicalSort,
  filterConditionEdges,
  type AdjacencyInfo,
} from "./flowGraph";
import {
  runNodeInWorker,
  NodeExecutionError,
  type RunNodeHandle,
} from "./nodeRunner";

// ── Constants ────────────────────────────────────────────────────────

const DEFAULT_NODE_TIMEOUT_MS = 2_000;

// ── Helpers ──────────────────────────────────────────────────────────

function generateRunId(): string {
  return `flow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getNodeKind(node: FlowNodeData): BuilderNodeKind {
  return (node.data?.kind as BuilderNodeKind) ?? "agent";
}

function getNodeCode(node: FlowNodeData): string {
  return node.data?.code ?? "";
}

function getNodeInputExample(node: FlowNodeData): unknown {
  return node.data?.inputExample ?? {};
}

function toErrorInfo(err: unknown, fallbackNodeId: string): NodeErrorInfo {
  if (err instanceof NodeExecutionError) {
    return {
      type: err.type,
      message: err.message,
      line: err.line,
      column: err.column,
      stack: err.details,
    };
  }
  if (err instanceof Error) {
    return { type: "runtime", message: err.message, stack: err.stack };
  }
  return { type: "runtime", message: String(err) };
}

/**
 * Recursively mark downstream nodes as skipped when their
 * upstream edges are all dead.
 */
function markDownstreamSkipped(
  fromNodeId: string,
  adj: AdjacencyInfo,
  liveEdges: Set<string>,
  nodeStates: Map<string, NodeExecutionState>,
  emit: (event: FlowEvent) => void,
): void {
  for (const edge of adj.outgoing.get(fromNodeId) ?? []) {
    liveEdges.delete(edge.id);

    const targetState = nodeStates.get(edge.targetNode);
    if (!targetState || targetState.status !== "pending") continue;

    // Only skip if ALL incoming edges to the target are now dead
    const allIncoming = adj.incoming.get(edge.targetNode) ?? [];
    const hasLiveIncoming = allIncoming.some((e) => liveEdges.has(e.id));

    if (!hasLiveIncoming) {
      nodeStates.set(edge.targetNode, {
        ...targetState,
        status: "skipped",
        completedAt: Date.now(),
      });
      emit({
        type: "node-skipped",
        nodeId: edge.targetNode,
        reason: "All upstream paths pruned or failed",
      });
      // Recurse deeper
      markDownstreamSkipped(edge.targetNode, adj, liveEdges, nodeStates, emit);
    }
  }
}

// ── Main entry point ─────────────────────────────────────────────────

/**
 * Execute a full flow graph.
 *
 * @param nodes - All nodes in the graph
 * @param edges - All edges in the graph
 * @param options - Execution options (inputs, timeouts, error strategy)
 * @returns A FlowRunHandle with promise, cancel, event subscription, and state access
 */
export function runFlow(
  nodes: FlowNodeData[],
  edges: FlowEdgeData[],
  options: FlowExecutionOptions = {},
): FlowRunHandle {
  const {
    inputs = {},
    nodeTimeoutMs = DEFAULT_NODE_TIMEOUT_MS,
    flowTimeoutMs = 0,
    errorStrategy = "stop-on-first-error",
  } = options;

  const runId = generateRunId();
  const listeners = new Set<FlowEventListener>();
  const activeHandles = new Map<string, RunNodeHandle>();
  let cancelled = false;
  let flowTimerId: ReturnType<typeof setTimeout> | null = null;

  // ── State ────────────────────────────────────────────────────────
  const nodeStates = new Map<string, NodeExecutionState>();
  const flowState: FlowExecutionState = {
    runId,
    status: "running",
    nodeStates,
    startedAt: Date.now(),
    outputs: {},
    errors: [],
  };

  function emit(event: FlowEvent): void {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        /* swallow listener errors */
      }
    }
  }

  // ── Build graph ──────────────────────────────────────────────────
  const adj = buildAdjacency(nodes, edges);
  const cycle = detectCycle(adj);

  // ── Async execution loop ─────────────────────────────────────────
  const promise = (async (): Promise<FlowExecutionState> => {
    // Cycle check
    if (cycle) {
      flowState.status = "error";
      const cycleError: NodeErrorInfo = {
        type: "runtime",
        message: `Cycle detected: ${cycle.join(" → ")}`,
      };
      flowState.errors.push({ nodeId: cycle[0], error: cycleError });
      emit({ type: "flow-error", errors: flowState.errors, durationMs: 0 });
      return flowState;
    }

    // Topological sort (skip note nodes)
    const skipKinds = new Set<string>(["note"]);
    const { levels } = topologicalSort(adj, skipKinds);

    // Initialize all executable nodes as pending
    for (const level of levels) {
      for (const nodeId of level) {
        nodeStates.set(nodeId, { nodeId, status: "pending" });
      }
    }

    // Track which edges are alive (not pruned by condition branching)
    const liveEdges = new Set<string>(edges.map((e) => e.id));
    // Track node outputs for data passing
    const nodeOutputs = new Map<string, unknown>();

    // Optional total flow timeout
    if (flowTimeoutMs > 0) {
      flowTimerId = setTimeout(() => {
        cancelled = true;
        for (const [, handle] of activeHandles) {
          handle.cancel();
        }
      }, flowTimeoutMs);
    }

    // ── Execute level-by-level ───────────────────────────────────
    for (const level of levels) {
      if (cancelled) break;

      const executableNodeIds = level.filter((nodeId) => {
        const state = nodeStates.get(nodeId);
        return state?.status === "pending";
      });

      if (executableNodeIds.length === 0) continue;

      // Execute all nodes in this level concurrently
      await Promise.allSettled(
        executableNodeIds.map(async (nodeId) => {
          if (cancelled) return;

          const node = adj.nodeMap.get(nodeId)!;
          const kind = getNodeKind(node);

          // Check reachability via live edges
          const incomingEdges = adj.incoming.get(nodeId) ?? [];
          const hasLiveIncoming =
            incomingEdges.length === 0 ||
            incomingEdges.some((e) => liveEdges.has(e.id));

          if (!hasLiveIncoming) {
            nodeStates.set(nodeId, {
              nodeId,
              status: "skipped",
              completedAt: Date.now(),
            });
            emit({
              type: "node-skipped",
              nodeId,
              reason: "Upstream condition pruned this branch",
            });
            return;
          }

          // ── Gather input ─────────────────────────────────────
          let nodeInput: unknown;

          if (kind === "input") {
            // Input nodes: use provided inputs or the node's inputExample
            nodeInput = inputs[nodeId] ?? getNodeInputExample(node);
          } else {
            // Other nodes: merge outputs from live upstream parents
            const liveIncoming = incomingEdges.filter((e) =>
              liveEdges.has(e.id),
            );

            if (liveIncoming.length === 1) {
              nodeInput = nodeOutputs.get(liveIncoming[0].sourceNode);
            } else if (liveIncoming.length > 1) {
              const merged: Record<string, unknown> = {};
              for (const edge of liveIncoming) {
                const parentOutput = nodeOutputs.get(edge.sourceNode);
                if (
                  parentOutput != null &&
                  typeof parentOutput === "object" &&
                  !Array.isArray(parentOutput)
                ) {
                  Object.assign(merged, parentOutput);
                } else if (parentOutput !== undefined) {
                  merged[edge.sourceNode] = parentOutput;
                }
              }
              nodeInput = merged;
            } else {
              // No incoming (shouldn't happen after topo sort, but be safe)
              nodeInput = {};
            }
          }

          // ── Mark running ─────────────────────────────────────
          nodeStates.set(nodeId, {
            nodeId,
            status: "running",
            input: nodeInput,
            startedAt: Date.now(),
          });
          emit({ type: "node-started", nodeId });

          // ── Execute ──────────────────────────────────────────
          const code = getNodeCode(node);
          const handle = runNodeInWorker({
            nodeId,
            code,
            input: nodeInput,
            ctx: { nodeId, flowRunId: runId },
            timeoutMs: nodeTimeoutMs,
          });
          activeHandles.set(nodeId, handle);

          try {
            const result = await handle.promise;
            activeHandles.delete(nodeId);

            // Store output
            nodeOutputs.set(nodeId, result.output);
            nodeStates.set(nodeId, {
              nodeId,
              status: "completed",
              input: nodeInput,
              output: result.output,
              durationMs: result.durationMs,
              startedAt: nodeStates.get(nodeId)?.startedAt,
              completedAt: Date.now(),
            });
            emit({
              type: "node-completed",
              nodeId,
              output: result.output,
              durationMs: result.durationMs,
            });

            // ── Condition branching ────────────────────────────
            if (kind === "condition") {
              const condResult = result.output as { ok: boolean };
              const outEdges = adj.outgoing.get(nodeId) ?? [];
              const liveOutEdges = filterConditionEdges(outEdges, condResult);
              const liveOutIds = new Set(liveOutEdges.map((e) => e.id));

              // Kill dead-branch edges
              for (const edge of outEdges) {
                if (!liveOutIds.has(edge.id)) {
                  liveEdges.delete(edge.id);
                }
              }

              // Mark unreachable downstream nodes as skipped
              for (const edge of outEdges) {
                if (!liveOutIds.has(edge.id)) {
                  const targetState = nodeStates.get(edge.targetNode);
                  if (targetState && targetState.status === "pending") {
                    const allIncoming =
                      adj.incoming.get(edge.targetNode) ?? [];
                    const hasLive = allIncoming.some((e) =>
                      liveEdges.has(e.id),
                    );
                    if (!hasLive) {
                      nodeStates.set(edge.targetNode, {
                        ...targetState,
                        status: "skipped",
                        completedAt: Date.now(),
                      });
                      emit({
                        type: "node-skipped",
                        nodeId: edge.targetNode,
                        reason: `Condition ${nodeId} took ${condResult.ok ? "true" : "false"} branch`,
                      });
                      markDownstreamSkipped(
                        edge.targetNode,
                        adj,
                        liveEdges,
                        nodeStates,
                        emit,
                      );
                    }
                  }
                }
              }
            }
          } catch (err) {
            activeHandles.delete(nodeId);
            const errorInfo = toErrorInfo(err, nodeId);

            nodeStates.set(nodeId, {
              nodeId,
              status: "error",
              input: nodeInput,
              error: errorInfo,
              startedAt: nodeStates.get(nodeId)?.startedAt,
              completedAt: Date.now(),
            });
            emit({ type: "node-error", nodeId, error: errorInfo });
            flowState.errors.push({ nodeId, error: errorInfo });

            if (errorStrategy === "stop-on-first-error") {
              // Cancel all active workers
              for (const [, activeHandle] of activeHandles) {
                activeHandle.cancel();
              }
              // Mark all remaining pending nodes as skipped
              for (const [id, state] of nodeStates) {
                if (state.status === "pending") {
                  nodeStates.set(id, {
                    ...state,
                    status: "skipped",
                    completedAt: Date.now(),
                  });
                  emit({
                    type: "node-skipped",
                    nodeId: id,
                    reason: `Skipped due to error in ${nodeId}`,
                  });
                }
              }
              cancelled = true;
            } else {
              // continue-where-possible: only skip downstream of failed node
              markDownstreamSkipped(
                nodeId,
                adj,
                liveEdges,
                nodeStates,
                emit,
              );
            }
          }
        }),
      );
    }

    // ── Cleanup ────────────────────────────────────────────────────
    if (flowTimerId) {
      clearTimeout(flowTimerId);
      flowTimerId = null;
    }

    // Collect outputs from output-type nodes
    for (const [nodeId, node] of adj.nodeMap) {
      if (
        getNodeKind(node) === "output" &&
        nodeStates.get(nodeId)?.status === "completed"
      ) {
        flowState.outputs[nodeId] = nodeOutputs.get(nodeId);
      }
    }

    // Final status
    const durationMs = Date.now() - flowState.startedAt;

    if (cancelled && flowState.errors.length === 0) {
      flowState.status = "cancelled";
      flowState.completedAt = Date.now();
      emit({ type: "flow-cancelled" });
    } else if (flowState.errors.length > 0) {
      flowState.status = "error";
      flowState.completedAt = Date.now();
      emit({ type: "flow-error", errors: flowState.errors, durationMs });
    } else {
      flowState.status = "completed";
      flowState.completedAt = Date.now();
      emit({
        type: "flow-completed",
        outputs: flowState.outputs,
        durationMs,
      });
    }

    return flowState;
  })();

  // ── Return handle ────────────────────────────────────────────────
  return {
    promise,
    cancel: () => {
      cancelled = true;
      for (const [, handle] of activeHandles) {
        handle.cancel();
      }
      if (flowTimerId) {
        clearTimeout(flowTimerId);
        flowTimerId = null;
      }
    },
    on: (listener: FlowEventListener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getState: () => flowState,
  };
}
