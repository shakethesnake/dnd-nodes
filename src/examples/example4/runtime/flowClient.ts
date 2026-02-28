/**
 * Flow Client — HTTP client for the backend flow execution API.
 *
 * Communicates with the Express server via REST + SSE.
 */

import type { FlowExecutionOptions } from "../server/engine/flowTypes";
import type { NodeData, EdgeData } from "flowforge-react/types";

// ── Types ────────────────────────────────────────────────────────────

export interface StartFlowResponse {
  runId: string;
  status: string;
  message: string;
}

export interface FlowStateSnapshot {
  runId: string;
  status: string;
  nodeStates: Record<string, {
    nodeId: string;
    status: string;
    input?: unknown;
    output?: unknown;
    error?: {
      type: string;
      message: string;
      line?: number;
      column?: number;
    };
    durationMs?: number;
    startedAt?: number;
    completedAt?: number;
  }>;
  startedAt: number;
  completedAt?: number;
  outputs: Record<string, unknown>;
  errors: Array<{ nodeId: string; error: { type: string; message: string } }>;
}

export interface FlowEventData {
  type: string;
  nodeId?: string;
  output?: unknown;
  durationMs?: number;
  error?: { type: string; message: string; line?: number; column?: number };
  reason?: string;
  outputs?: Record<string, unknown>;
  errors?: Array<{ nodeId: string; error: { type: string; message: string } }>;
}

// ── API base (uses Vite proxy in dev, same-origin in prod) ───────────

const API_BASE = "/api/flow";

// ── Client functions ─────────────────────────────────────────────────

/**
 * Start a new flow execution on the backend.
 */
export async function startFlowRun(
  nodes: NodeData[],
  edges: EdgeData[],
  options?: FlowExecutionOptions,
): Promise<StartFlowResponse> {
  const response = await fetch(`${API_BASE}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nodes, edges, options }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `Server error: ${response.status}`,
    );
  }

  return response.json() as Promise<StartFlowResponse>;
}

/**
 * Get the current execution state snapshot.
 */
export async function getFlowState(runId: string): Promise<FlowStateSnapshot> {
  const response = await fetch(`${API_BASE}/run/${runId}`);

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `Server error: ${response.status}`,
    );
  }

  return response.json() as Promise<FlowStateSnapshot>;
}

/**
 * Subscribe to live flow execution events via SSE.
 * Returns an unsubscribe function to close the connection.
 */
export function subscribeToFlowEvents(
  runId: string,
  onEvent: (event: FlowEventData) => void,
  onError?: (error: Error) => void,
  onDone?: () => void,
): () => void {
  const eventSource = new EventSource(`${API_BASE}/run/${runId}/events`);

  eventSource.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data) as FlowEventData;
      onEvent(data);
    } catch {
      // Ignore malformed messages
    }
  };

  eventSource.addEventListener("done", () => {
    eventSource.close();
    onDone?.();
  });

  eventSource.onerror = () => {
    // EventSource auto-reconnects, but if it's closed we report error
    if (eventSource.readyState === EventSource.CLOSED) {
      onError?.(new Error("SSE connection closed"));
      onDone?.();
    }
  };

  return () => {
    eventSource.close();
  };
}

/**
 * Cancel a running flow.
 */
export async function cancelFlowRun(runId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/run/${runId}/cancel`, {
    method: "POST",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `Server error: ${response.status}`,
    );
  }
}
