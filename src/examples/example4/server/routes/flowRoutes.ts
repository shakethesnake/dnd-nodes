/**
 * Flow Routes — REST + SSE Endpoints
 *
 * POST   /api/flow/run              Start a new flow execution
 * GET    /api/flow/run/:runId       Get current execution state snapshot
 * GET    /api/flow/run/:runId/events  SSE stream of live execution events
 * POST   /api/flow/run/:runId/cancel  Cancel a running flow
 */

import { Router, type Request, type Response } from "express";
import type { FlowNodeData, FlowEdgeData, FlowExecutionOptions } from "../engine/flowTypes";
import { runFlow } from "../engine/flowEngine";
import type { RunStore } from "../store/runStore";

// ── Request body types ───────────────────────────────────────────────

interface RunFlowRequestBody {
  nodes: FlowNodeData[];
  edges: FlowEdgeData[];
  options?: FlowExecutionOptions;
}

// ── Serialization helper ─────────────────────────────────────────────

/**
 * Convert FlowExecutionState to a JSON-safe object.
 * (Maps are not JSON-serializable, so we convert nodeStates to a record.)
 */
function serializeFlowState(state: ReturnType<ReturnType<typeof runFlow>["getState"]>) {
  return {
    runId: state.runId,
    status: state.status,
    nodeStates: Object.fromEntries(state.nodeStates),
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    outputs: state.outputs,
    errors: state.errors,
  };
}

// ── Router factory ───────────────────────────────────────────────────

export function createFlowRoutes(store: RunStore): Router {
  const router = Router();

  // ── POST /api/flow/run ───────────────────────────────────────────
  router.post("/run", (req: Request, res: Response) => {
    const body = req.body as RunFlowRequestBody;

    // Validate request
    if (!body.nodes || !Array.isArray(body.nodes)) {
      res.status(400).json({ error: "Missing or invalid 'nodes' array" });
      return;
    }
    if (!body.edges || !Array.isArray(body.edges)) {
      res.status(400).json({ error: "Missing or invalid 'edges' array" });
      return;
    }
    if (body.nodes.length === 0) {
      res.status(400).json({ error: "Flow must have at least one node" });
      return;
    }

    // Check concurrent run limit
    if (!store.canAcceptRun()) {
      res.status(429).json({
        error: "Too many concurrent runs. Try again later.",
        activeCount: store.activeCount,
      });
      return;
    }

    // Start execution
    const handle = runFlow(body.nodes, body.edges, body.options);
    const state = handle.getState();
    const runId = state.runId;

    store.add(runId, handle, state);

    res.status(201).json({
      runId,
      status: state.status,
      message: "Flow execution started",
    });
  });

  // ── GET /api/flow/run/:runId ─────────────────────────────────────
  router.get("/run/:runId", (req: Request, res: Response) => {
    const { runId } = req.params;
    const entry = store.get(runId);

    if (!entry) {
      res.status(404).json({ error: `Run '${runId}' not found` });
      return;
    }

    res.json(serializeFlowState(entry.state));
  });

  // ── GET /api/flow/run/:runId/events (SSE) ────────────────────────
  router.get("/run/:runId/events", (req: Request, res: Response) => {
    const { runId } = req.params;

    const subscription = store.subscribe(runId, (event) => {
      // Write SSE event
      res.write(`data: ${JSON.stringify(event)}\n\n`);

      // Close the stream when flow finishes
      if (
        event.type === "flow-completed" ||
        event.type === "flow-error" ||
        event.type === "flow-cancelled"
      ) {
        res.write(`event: done\ndata: ${JSON.stringify({ type: event.type })}\n\n`);
        res.end();
      }
    });

    if (!subscription) {
      res.status(404).json({ error: `Run '${runId}' not found` });
      return;
    }

    // Set SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // Flush buffered events (events that happened before the SSE connection)
    for (const event of subscription.buffered) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    // Check if already finished (all events buffered)
    const entry = store.get(runId);
    if (
      entry &&
      (entry.state.status === "completed" ||
        entry.state.status === "error" ||
        entry.state.status === "cancelled")
    ) {
      res.write(
        `event: done\ndata: ${JSON.stringify({ type: `flow-${entry.state.status}` })}\n\n`,
      );
      res.end();
      subscription.unsubscribe();
      return;
    }

    // Clean up on client disconnect
    req.on("close", () => {
      subscription.unsubscribe();
    });
  });

  // ── POST /api/flow/run/:runId/cancel ─────────────────────────────
  router.post("/run/:runId/cancel", (req: Request, res: Response) => {
    const { runId } = req.params;
    const entry = store.get(runId);

    if (!entry) {
      res.status(404).json({ error: `Run '${runId}' not found` });
      return;
    }

    if (entry.state.status !== "running") {
      res.status(409).json({
        error: `Run '${runId}' is not running (status: ${entry.state.status})`,
      });
      return;
    }

    entry.handle.cancel();
    res.json({ runId, status: "cancelled", message: "Flow cancellation requested" });
  });

  return router;
}
