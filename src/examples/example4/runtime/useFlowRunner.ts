/**
 * useFlowRunner — React hook for backend flow execution.
 *
 * Bridges the HTTP/SSE client with the AgentBuilder UI:
 * - Sends graph to backend via POST
 * - Subscribes to SSE events
 * - Updates node statuses, debug logs, and status bar in real time
 */

import { useCallback, useRef, useState } from "react";
import type { Graph } from "flowforge-react/core";
import type { DebugLogEntry } from "../components/DebugDrawer";
import type { BuilderNodeData } from "../types";
import type { FlowExecutionOptions } from "../server/engine/flowTypes";
import type { FlowEventData } from "./flowClient";
import {
  startFlowRun as apiStartFlow,
  subscribeToFlowEvents,
  cancelFlowRun as apiCancelFlow,
} from "./flowClient";

// ── Hook args ────────────────────────────────────────────────────────

interface UseFlowRunnerArgs {
  graph: Graph;
  patchNodeData: (
    nodeId: string,
    updater: (current: BuilderNodeData) => BuilderNodeData,
  ) => void;
  appendDebugLog: (entry: Omit<DebugLogEntry, "id" | "timestamp">) => void;
  setStatusText: (text: string) => void;
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useFlowRunner({
  graph,
  patchNodeData,
  appendDebugLog,
  setStatusText,
}: UseFlowRunnerArgs) {
  const [isFlowRunning, setIsFlowRunning] = useState(false);
  const runIdRef = useRef<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const handleFlowEvent = useCallback(
    (event: FlowEventData) => {
      switch (event.type) {
        case "node-started":
          if (event.nodeId) {
            patchNodeData(event.nodeId, (d) => ({
              ...d,
              status: "draft",
              test: { ...d.test, lastRunAt: Date.now() },
            }));
            setStatusText(`Flow: running ${event.nodeId}...`);
            appendDebugLog({
              level: "info",
              nodeId: event.nodeId,
              message: "Flow: node started",
            });
          }
          break;

        case "node-completed":
          if (event.nodeId) {
            patchNodeData(event.nodeId, (d) => ({
              ...d,
              status: "ready",
              test: {
                ...d.test,
                lastOutput: event.output,
                lastDurationMs: event.durationMs,
                lastError: undefined,
                lastErrorType: undefined,
                lastRunAt: Date.now(),
              },
            }));
            appendDebugLog({
              level: "info",
              nodeId: event.nodeId,
              message: `Flow: node completed in ${event.durationMs} ms`,
              details: event.output,
            });
          }
          break;

        case "node-error":
          if (event.nodeId) {
            patchNodeData(event.nodeId, (d) => ({
              ...d,
              status: "error",
              test: {
                ...d.test,
                lastError: event.error?.message,
                lastErrorType: event.error?.type as BuilderNodeData["test"] extends { lastErrorType?: infer T } ? T : never,
                lastRunAt: Date.now(),
              },
            }));
            appendDebugLog({
              level: "error",
              nodeId: event.nodeId,
              message: `Flow: node error — ${event.error?.message}`,
            });
          }
          break;

        case "node-skipped":
          if (event.nodeId) {
            patchNodeData(event.nodeId, (d) => ({
              ...d,
              status: "idle",
            }));
            appendDebugLog({
              level: "info",
              nodeId: event.nodeId,
              message: `Flow: node skipped — ${event.reason}`,
            });
          }
          break;

        case "flow-completed":
          setStatusText(`Flow completed in ${event.durationMs} ms`);
          appendDebugLog({
            level: "info",
            message: `Flow completed in ${event.durationMs} ms`,
            details: event.outputs,
          });
          break;

        case "flow-error":
          setStatusText(
            `Flow finished with ${event.errors?.length ?? 0} error(s)`,
          );
          appendDebugLog({
            level: "error",
            message: "Flow finished with errors",
            details: event.errors,
          });
          break;

        case "flow-cancelled":
          setStatusText("Flow cancelled");
          appendDebugLog({
            level: "info",
            message: "Flow cancelled by user",
          });
          break;
      }
    },
    [patchNodeData, appendDebugLog, setStatusText],
  );

  const startFlow = useCallback(
    async (options?: FlowExecutionOptions) => {
      if (isFlowRunning) {
        setStatusText("A flow is already running.");
        return;
      }

      const { nodes, edges } = graph.getState();

      setIsFlowRunning(true);
      setStatusText("Starting flow...");
      appendDebugLog({ level: "info", message: "Flow run requested" });

      try {
        const { runId } = await apiStartFlow(nodes, edges, options);
        runIdRef.current = runId;

        appendDebugLog({
          level: "info",
          message: `Flow run ${runId} started on server`,
        });

        // Subscribe to SSE events
        const unsub = subscribeToFlowEvents(
          runId,
          handleFlowEvent,
          (error) => {
            setStatusText(`SSE error: ${error.message}`);
            appendDebugLog({
              level: "error",
              message: `SSE connection error: ${error.message}`,
            });
          },
          () => {
            // SSE stream ended (flow finished)
            setIsFlowRunning(false);
            runIdRef.current = null;
            unsubRef.current = null;
          },
        );
        unsubRef.current = unsub;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        setStatusText(`Failed to start flow: ${message}`);
        appendDebugLog({
          level: "error",
          message: `Failed to start flow: ${message}`,
        });
        setIsFlowRunning(false);
      }
    },
    [graph, isFlowRunning, handleFlowEvent, appendDebugLog, setStatusText],
  );

  const cancelFlow = useCallback(async () => {
    const runId = runIdRef.current;
    if (!runId) return;

    try {
      await apiCancelFlow(runId);
      setStatusText("Flow cancellation requested...");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      setStatusText(`Cancel failed: ${message}`);
    }
  }, [setStatusText]);

  /** Cleanup — call on unmount */
  const dispose = useCallback(() => {
    unsubRef.current?.();
    unsubRef.current = null;
    runIdRef.current = null;
  }, []);

  return {
    startFlowRun: startFlow,
    cancelFlowRun: cancelFlow,
    isFlowRunning,
    dispose,
  };
}
