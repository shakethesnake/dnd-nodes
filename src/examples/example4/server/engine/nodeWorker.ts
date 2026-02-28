/**
 * Node Worker Thread — Server-side Code Sandbox
 *
 * Runs inside a Node.js worker_thread.
 * Receives user code + input via parentPort, executes it,
 * and posts back the result or error.
 *
 * Mirrors the browser-side nodeRunner.worker.ts contract.
 */

import { parentPort } from "node:worker_threads";

type RuntimeErrorType = "syntax" | "runtime" | "timeout" | "contract";

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
    type: RuntimeErrorType;
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
  const line = Number(match[1]);
  const column = Number(match[2]);
  if (!Number.isFinite(line) || !Number.isFinite(column)) return {};
  return { line, column };
}

function normalizeError(
  error: unknown,
  fallbackType: RuntimeErrorType,
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
  return { type: fallbackType, message: fallbackMessage };
}

function buildRunFunction(
  code: string,
): (input: unknown, ctx: Record<string, unknown>) => unknown | Promise<unknown> {
  const hasDefaultRunExport =
    /export\s+default\s+(async\s+)?function\s+run\s*\(/.test(code);
  if (!hasDefaultRunExport) {
    throw new Error("Expected `export default async function run(input, ctx)`.");
  }

  const normalizedCode = normalizeCodeForExecution(code);

  let runFactory: () => unknown;
  try {
    runFactory = new Function(
      `"use strict";\n${normalizedCode}\nif (typeof run !== "function") { throw new Error("Function run is not defined."); }\nreturn run;`,
    ) as () => unknown;
  } catch (error) {
    throw normalizeError(error, "syntax", DEFAULT_SYNTAX_MESSAGE);
  }

  const runCandidate = runFactory();
  if (typeof runCandidate !== "function") {
    throw new Error("Exported run is not callable.");
  }

  return runCandidate as (
    input: unknown,
    ctx: Record<string, unknown>,
  ) => unknown | Promise<unknown>;
}

if (!parentPort) {
  throw new Error("nodeWorker.ts must be run inside a worker_thread.");
}

parentPort.on("message", async (request: WorkerRunRequest) => {
  const startedAt = performance.now();

  let runFunction: ReturnType<typeof buildRunFunction>;
  try {
    runFunction = buildRunFunction(request.code);
  } catch (error) {
    const payload: WorkerRunErrorResponse = {
      id: request.id,
      ok: false,
      error:
        typeof error === "object" && error !== null && "type" in error
          ? (error as WorkerRunErrorResponse["error"])
          : normalizeError(error, "syntax", DEFAULT_SYNTAX_MESSAGE),
    };
    parentPort!.postMessage(payload);
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
    parentPort!.postMessage(payload);
  } catch (error) {
    const payload: WorkerRunErrorResponse = {
      id: request.id,
      ok: false,
      error: normalizeError(error, "runtime", DEFAULT_RUNTIME_MESSAGE),
    };
    parentPort!.postMessage(payload);
  }
});
