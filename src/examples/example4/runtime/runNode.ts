import type { BuilderRuntimeErrorType } from "../types";

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

const DEFAULT_TIMEOUT_MS = 2_000;

function createRequestId(nodeId: string): string {
  return `${nodeId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function runNodeInWorker(options: RunNodeOptions): RunNodeHandle {
  const requestId = createRequestId(options.nodeId);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const worker = new Worker(new URL("./nodeRunner.worker.ts", import.meta.url), { type: "module" });

  let settled = false;
  let rejectPromise: ((error: NodeExecutionError) => void) | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const cleanup = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
  };

  const promise = new Promise<RunNodeResult>((resolve, reject) => {
    rejectPromise = reject;

    worker.onmessage = (event: MessageEvent<WorkerRunResponse>) => {
      const response = event.data;
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
    };

    worker.onerror = (event: ErrorEvent) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(
        new NodeExecutionError({
          nodeId: options.nodeId,
          type: "runtime",
          message: event.message || "Worker crashed during node execution.",
          details: event.error instanceof Error ? event.error.stack : undefined,
        }),
      );
    };

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
