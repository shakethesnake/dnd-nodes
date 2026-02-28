/**
 * Node Runner — Server-side Orchestrator
 *
 * Spawns a worker_thread per node execution, handles timeout + cancellation.
 * Same public interface as the browser-side runNode.ts:
 *   runNodeInWorker(options) → { promise, cancel }
 */

import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { BuilderRuntimeErrorType } from "./flowTypes";

// ── Worker protocol types (mirrored in nodeWorker.ts) ────────────────

interface WorkerRunRequest {
  id: string;
  nodeId: string;
  code: string;
  input: unknown;
  ctx: Record<string, unknown>;
}

interface WorkerRunSuccessResponse {
  id: string;
  ok: true;
  output: unknown;
  durationMs: number;
}

interface WorkerRunErrorResponse {
  id: string;
  ok: false;
  error: {
    type: BuilderRuntimeErrorType;
    message: string;
    line?: number;
    column?: number;
    stack?: string;
  };
}

type WorkerRunResponse = WorkerRunSuccessResponse | WorkerRunErrorResponse;

// ── Public API ───────────────────────────────────────────────────────

export interface RunNodeOptions {
  nodeId: string;
  code: string;
  input: unknown;
  ctx?: Record<string, unknown>;
  timeoutMs?: number;
}

export interface RunNodeResult {
  output: unknown;
  durationMs: number;
}

export class NodeExecutionError extends Error {
  readonly type: BuilderRuntimeErrorType;
  readonly nodeId: string;
  readonly line?: number;
  readonly column?: number;
  readonly details?: string;

  constructor(args: {
    nodeId: string;
    type: BuilderRuntimeErrorType;
    message: string;
    line?: number;
    column?: number;
    details?: string;
  }) {
    super(args.message);
    this.name = "NodeExecutionError";
    this.type = args.type;
    this.nodeId = args.nodeId;
    this.line = args.line;
    this.column = args.column;
    this.details = args.details;
  }
}

export interface RunNodeHandle {
  promise: Promise<RunNodeResult>;
  cancel: () => void;
}

// ── Internals ────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 2_000;

const __filename_ = fileURLToPath(import.meta.url);
const __dirname_ = path.dirname(__filename_);
const WORKER_PATH = path.resolve(__dirname_, "nodeWorker.ts");

function createRequestId(nodeId: string): string {
  return `${nodeId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Execute a single node's code in an isolated worker_thread.
 * Returns a handle with a promise (resolves on success, rejects on error)
 * and a cancel() function.
 */
export function runNodeInWorker(options: RunNodeOptions): RunNodeHandle {
  const requestId = createRequestId(options.nodeId);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const worker = new Worker(WORKER_PATH, {
    // Use ts runner if available (tsx, ts-node), otherwise Node handles .ts natively in newer versions
    execArgv: [],
  });

  let settled = false;
  let rejectPromise: ((error: NodeExecutionError) => void) | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const cleanup = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    worker.removeAllListeners();
    void worker.terminate();
  };

  const promise = new Promise<RunNodeResult>((resolve, reject) => {
    rejectPromise = reject;

    worker.on("message", (response: WorkerRunResponse) => {
      if (response.id !== requestId || settled) return;
      settled = true;
      cleanup();

      if (response.ok) {
        resolve({ output: response.output, durationMs: response.durationMs });
        return;
      }

      reject(
        new NodeExecutionError({
          nodeId: options.nodeId,
          type: response.error.type,
          message: response.error.message,
          line: response.error.line,
          column: response.error.column,
          details: response.error.stack,
        }),
      );
    });

    worker.on("error", (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(
        new NodeExecutionError({
          nodeId: options.nodeId,
          type: "runtime",
          message: error.message || "Worker crashed during node execution.",
          details: error.stack,
        }),
      );
    });

    worker.on("exit", (code: number) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(
        new NodeExecutionError({
          nodeId: options.nodeId,
          type: "runtime",
          message: `Worker exited unexpectedly with code ${code}.`,
        }),
      );
    });

    // Timeout
    timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(
        new NodeExecutionError({
          nodeId: options.nodeId,
          type: "timeout",
          message: `Node execution exceeded timeout (${timeoutMs} ms).`,
        }),
      );
    }, timeoutMs);

    // Send work request
    const request: WorkerRunRequest = {
      id: requestId,
      nodeId: options.nodeId,
      code: options.code,
      input: options.input,
      ctx: options.ctx ?? {},
    };
    worker.postMessage(request);
  });

  const cancel = () => {
    if (settled) return;
    settled = true;
    cleanup();
    rejectPromise?.(
      new NodeExecutionError({
        nodeId: options.nodeId,
        type: "runtime",
        message: "Node execution cancelled.",
      }),
    );
  };

  return { promise, cancel };
}
