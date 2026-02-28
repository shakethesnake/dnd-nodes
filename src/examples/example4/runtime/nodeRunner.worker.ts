type RunnerErrorType = "syntax" | "runtime" | "timeout" | "contract";

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
    type: RunnerErrorType;
    message: string;
    line?: number;
    column?: number;
    stack?: string;
  };
}

type WorkerRunResponse = WorkerRunSuccessResponse | WorkerRunErrorResponse;

const DEFAULT_SYNTAX_MESSAGE = "Syntax error while compiling node code.";
const DEFAULT_RUNTIME_MESSAGE = "Runtime error while executing node code.";

function normalizeCodeForExecution(code: string): string {
  return code.replace(/export\s+default\s+/, "");
}

function extractPosition(stack?: string): { line?: number; column?: number } {
  if (!stack) return {};

  const match = stack.match(/<anonymous>:(\d+):(\d+)/);
  if (!match) return {};

  const [, lineRaw, columnRaw] = match;
  const line = Number(lineRaw);
  const column = Number(columnRaw);

  if (!Number.isFinite(line) || !Number.isFinite(column)) {
    return {};
  }

  return { line, column };
}

function normalizeExecutionError(
  error: unknown,
  fallbackType: RunnerErrorType,
  fallbackMessage: string,
): WorkerRunErrorResponse["error"] {
  if (error instanceof Error) {
    return {
      type: fallbackType,
      message: error.message || fallbackMessage,
      ...extractPosition(error.stack),
      stack: error.stack,
    };
  }

  return {
    type: fallbackType,
    message: fallbackMessage,
  };
}

function buildRunFunction(
  code: string,
): (input: unknown, ctx: Record<string, unknown>) => unknown | Promise<unknown> {
  const hasDefaultRunExport = /export\s+default\s+(async\s+)?function\s+run\s*\(/.test(code);
  if (!hasDefaultRunExport) {
    throw new Error("Expected `export default async function run(input, ctx)`.");
  }

  const normalizedCode = normalizeCodeForExecution(code);

  let runFactory: () => unknown;
  try {
    runFactory = new Function(
      `"use strict";\n${normalizedCode}\nif (typeof run !== "function") { throw new Error("Function run is not defined."); }\nreturn run;`,
    );
  } catch (error) {
    throw normalizeExecutionError(error, "syntax", DEFAULT_SYNTAX_MESSAGE);
  }

  const runCandidate = runFactory();
  if (typeof runCandidate !== "function") {
    throw new Error("Exported run is not callable.");
  }

  return runCandidate as (input: unknown, ctx: Record<string, unknown>) => unknown | Promise<unknown>;
}

self.onmessage = async (event: MessageEvent<WorkerRunRequest>) => {
  const request = event.data;
  const startedAt = performance.now();

  let runFunction: (input: unknown, ctx: Record<string, unknown>) => unknown | Promise<unknown>;
  try {
    runFunction = buildRunFunction(request.code);
  } catch (error) {
    const payload: WorkerRunErrorResponse = {
      id: request.id,
      ok: false,
      error:
        typeof error === "object" && error !== null && "type" in error
          ? (error as WorkerRunErrorResponse["error"])
          : normalizeExecutionError(error, "syntax", DEFAULT_SYNTAX_MESSAGE),
    };
    (self as DedicatedWorkerGlobalScope).postMessage(payload satisfies WorkerRunResponse);
    return;
  }

  try {
    const output = await Promise.resolve(runFunction(request.input, request.ctx));
    const payload: WorkerRunSuccessResponse = {
      id: request.id,
      ok: true,
      output,
      durationMs: Math.round(performance.now() - startedAt),
    };
    (self as DedicatedWorkerGlobalScope).postMessage(payload satisfies WorkerRunResponse);
  } catch (error) {
    const payload: WorkerRunErrorResponse = {
      id: request.id,
      ok: false,
      error: normalizeExecutionError(error, "runtime", DEFAULT_RUNTIME_MESSAGE),
    };
    (self as DedicatedWorkerGlobalScope).postMessage(payload satisfies WorkerRunResponse);
  }
};
