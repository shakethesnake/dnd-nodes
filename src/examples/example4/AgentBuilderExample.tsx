import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Flow } from "flowforge-react/components";
import { Graph } from "flowforge-react/core";
import { useStore } from "flowforge-react/hooks";
import type { EdgeData, NodeData, SerializedGraph } from "flowforge-react/types";
import { DebugDrawer, type DebugLogEntry } from "./components/DebugDrawer";
import { InspectorPanel } from "./components/InspectorPanel";
import { NodeLibrary } from "./components/NodeLibrary";
import { NodeExecutionError, runNodeInWorker } from "./runtime/runNode";
import { useFlowRunner } from "./runtime/useFlowRunner";
import type {
  BuilderNodeData,
  BuilderNodeKind,
  BuilderRuntimeErrorType,
  BuilderNodeTestState,
  BuilderValidationState,
} from "./types";
import { NODE_TEMPLATES, createNodeCodeTemplate, getBuilderNodeData } from "./types";
import "./agent-builder.css";

const STORAGE_KEY = "flowforge-agent-builder";
const THEME_STORAGE_KEY = "flowforge-agent-builder-theme";
const DEFAULT_NODE_TIMEOUT_MS = 2_000;
const MAX_DEBUG_LOGS = 100;
const AUTO_SAVE_DEBOUNCE_MS = 900;
const TOAST_TIMEOUT_MS = 2_600;
const LIBRARY_RAIL_WIDTH = 40;
const INSPECTOR_RAIL_WIDTH = 40;
const MIN_LIBRARY_WIDTH = 220;
const MIN_INSPECTOR_WIDTH = 280;
const MIN_DEBUG_HEIGHT = 170;

type BuilderThemeMode = "light" | "dark";
type BuilderToastType = "info" | "success" | "error";

interface BuilderToast {
  id: string;
  message: string;
  type: BuilderToastType;
}

type ResizeTarget = "library" | "inspector" | "debug";

interface ResizeState {
  target: ResizeTarget;
  startX: number;
  startY: number;
  startSize: number;
}

const INITIAL_NODES: NodeData<BuilderNodeData>[] = [
  {
    id: "input-1",
    label: "Input",
    type: "default",
    position: { x: 160, y: 200 },
    data: {
      kind: "input",
      description: "Start payload for the flow",
      status: "ready",
      language: "typescript",
      code: createNodeCodeTemplate("input"),
      inputExample: { text: "hello" },
      outputExample: { result: { text: "hello" } },
      validation: {
        state: "success",
        type: "contract",
        message: "Template is valid.",
        checkedAt: Date.now(),
      },
      test: {},
    },
  },
  {
    id: "agent-1",
    label: "Agent",
    type: "default",
    position: { x: 500, y: 200 },
    data: {
      kind: "agent",
      description: "Main processing node",
      status: "draft",
      language: "typescript",
      code: createNodeCodeTemplate("agent"),
      inputExample: { text: "hello" },
      outputExample: { result: { text: "hello" } },
      validation: { state: "idle" },
      test: {},
    },
  },
  {
    id: "output-1",
    label: "Output",
    type: "default",
    position: { x: 840, y: 200 },
    data: {
      kind: "output",
      description: "Final output node",
      status: "idle",
      language: "typescript",
      code: createNodeCodeTemplate("output"),
      inputExample: { result: "ok" },
      outputExample: { output: { result: "ok" } },
      validation: { state: "idle" },
      test: {},
    },
  },
];

const INITIAL_EDGES: EdgeData[] = [
  { id: "edge-input-agent", sourceNode: "input-1", targetNode: "agent-1" },
  { id: "edge-agent-output", sourceNode: "agent-1", targetNode: "output-1" },
];

const NODE_TYPE_BY_KIND: Record<BuilderNodeKind, NodeData["type"]> = {
  input: "default",
  agent: "default",
  transform: "custom",
  condition: "default",
  output: "default",
  note: "default",
};

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

function sanitizeFileName(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "agent-flow";
  return normalized.replace(/[^a-z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function extractFlowName(payload: SerializedGraph): string | null {
  const maybeName = payload.metadata?.flowName;
  if (typeof maybeName !== "string") return null;
  const normalized = maybeName.trim();
  return normalized.length > 0 ? normalized : null;
}

function getSelectedNodeIds(state: { selectedNodeIds?: string[]; selectedNodeId?: string | null }) {
  if (state.selectedNodeIds && state.selectedNodeIds.length > 0) return state.selectedNodeIds;
  return state.selectedNodeId ? [state.selectedNodeId] : [];
}

function makeUniqueNodeId(kind: BuilderNodeKind, nodes: NodeData[]): string {
  let index = 1;
  let id = `${kind}-${index}`;
  const existing = new Set(nodes.map((node) => node.id));
  while (existing.has(id)) {
    index += 1;
    id = `${kind}-${index}`;
  }
  return id;
}

function getNextNodePosition(nodes: NodeData[]) {
  const nodeIndex = nodes.length;
  return {
    x: 120 + (nodeIndex % 3) * 300,
    y: 120 + Math.floor(nodeIndex / 3) * 170,
  };
}

function getValueType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

interface NormalizedNodeError {
  type: BuilderRuntimeErrorType;
  message: string;
  nodeId: string;
  line?: number;
  column?: number;
  details?: string;
}

function createValidationState(
  state: BuilderValidationState["state"],
  message: string,
  type?: BuilderValidationState["type"],
  error?: Pick<NormalizedNodeError, "nodeId" | "line" | "column">,
): BuilderValidationState {
  return {
    state,
    type,
    message,
    nodeId: error?.nodeId,
    line: error?.line,
    column: error?.column,
    checkedAt: Date.now(),
  };
}

function compareContract(expected: unknown, actual: unknown, path = "output"): string | null {
  const expectedType = getValueType(expected);
  const actualType = getValueType(actual);

  if (expectedType !== actualType) {
    return `${path} expected ${expectedType}, got ${actualType}`;
  }

  if (expectedType === "array") {
    const expectedArray = expected as unknown[];
    const actualArray = actual as unknown[];
    if (expectedArray.length === 0 || actualArray.length === 0) {
      return null;
    }

    const sampleExpected = expectedArray[0];
    for (let index = 0; index < actualArray.length; index += 1) {
      const mismatch = compareContract(sampleExpected, actualArray[index], `${path}[${index}]`);
      if (mismatch) return mismatch;
    }
    return null;
  }

  if (expectedType === "object") {
    const expectedObject = expected as Record<string, unknown>;
    const actualObject = actual as Record<string, unknown>;

    for (const key of Object.keys(expectedObject)) {
      if (!(key in actualObject)) {
        return `${path}.${key} is missing`;
      }

      const mismatch = compareContract(expectedObject[key], actualObject[key], `${path}.${key}`);
      if (mismatch) return mismatch;
    }
  }

  return null;
}

function withPatchedTestState(
  previousData: BuilderNodeData,
  patch: Partial<BuilderNodeTestState>,
): BuilderNodeTestState {
  return {
    ...(previousData.test ?? {}),
    ...patch,
  };
}

function toNormalizedNodeError(
  nodeId: string,
  error: unknown,
  fallbackType: BuilderRuntimeErrorType = "runtime",
  fallbackMessage = "Node execution failed.",
): NormalizedNodeError {
  if (error instanceof NodeExecutionError) {
    return {
      type: error.type,
      nodeId: error.nodeId,
      message: error.message,
      line: error.line,
      column: error.column,
      details: error.details,
    };
  }

  if (typeof error === "object" && error !== null && "type" in error && "message" in error) {
    const candidate = error as {
      type?: BuilderRuntimeErrorType;
      message?: string;
      nodeId?: string;
      line?: number;
      column?: number;
      details?: string;
      stack?: string;
    };
    return {
      type: candidate.type ?? fallbackType,
      message: candidate.message ?? fallbackMessage,
      nodeId: candidate.nodeId ?? nodeId,
      line: candidate.line,
      column: candidate.column,
      details: candidate.details ?? candidate.stack,
    };
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  return {
    type: fallbackType,
    nodeId,
    message,
    details: error instanceof Error ? error.stack : undefined,
  };
}

function formatNodeErrorMessage(error: Pick<NormalizedNodeError, "message" | "line" | "column">): string {
  if (error.line === undefined) return error.message;
  return `${error.message} (line ${error.line}:${error.column ?? 1})`;
}

export function AgentBuilderExample() {
  const graphRef = useRef<Graph | null>(null);
  if (!graphRef.current) {
    graphRef.current = new Graph({
      nodes: INITIAL_NODES,
      edges: INITIAL_EDGES,
      canvasView: "grid",
    });
  }

  const graph = graphRef.current;
  const state = useStore(graph.getStore());
  const [flowName, setFlowName] = useState("Untitled Agent Flow");
  const [statusText, setStatusText] = useState("Ready");
  const [debugLogs, setDebugLogs] = useState<DebugLogEntry[]>([]);
  const [runningNodeId, setRunningNodeId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<BuilderToast[]>([]);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddQuery, setQuickAddQuery] = useState("");
  const [lastAutoSaveAt, setLastAutoSaveAt] = useState<number | null>(null);
  const [libraryWidth, setLibraryWidth] = useState(280);
  const [inspectorWidth, setInspectorWidth] = useState(380);
  const [debugHeight, setDebugHeight] = useState(260);
  const [isLibraryCollapsed, setIsLibraryCollapsed] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
  const [isDebugCollapsed, setIsDebugCollapsed] = useState(false);
  const runningHandleRef = useRef<{ nodeId: string; cancel: () => void } | null>(null);
  const draftHydratedRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const toastTimersRef = useRef<number[]>([]);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const resizeStateRef = useRef<ResizeState | null>(null);
  const [themeMode, setThemeMode] = useState<BuilderThemeMode>(() => {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (message: string, type: BuilderToastType = "info") => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((current) => [...current, { id, message, type }].slice(-4));
      const timerId = window.setTimeout(() => {
        removeToast(id);
        toastTimersRef.current = toastTimersRef.current.filter((candidate) => candidate !== timerId);
      }, TOAST_TIMEOUT_MS);
      toastTimersRef.current.push(timerId);
    },
    [removeToast],
  );

  const selectedIds = useMemo(() => getSelectedNodeIds(state), [state]);
  const selectedNodes = useMemo(
    () => state.nodes.filter((node) => selectedIds.includes(node.id)),
    [selectedIds, state.nodes],
  );
  const selectedSingleNode = useMemo(
    () => (selectedNodes.length === 1 ? selectedNodes[0] : null),
    [selectedNodes],
  );
  const runningNodeLabel = useMemo(() => {
    if (!runningNodeId) return null;
    const runningNode = state.nodes.find((node) => node.id === runningNodeId);
    return runningNode?.label ?? runningNodeId;
  }, [runningNodeId, state.nodes]);
  const quickAddTemplates = useMemo(() => {
    const normalized = quickAddQuery.trim().toLowerCase();
    if (!normalized) return NODE_TEMPLATES;
    return NODE_TEMPLATES.filter((template) => {
      return (
        template.label.toLowerCase().includes(normalized) ||
        template.description.toLowerCase().includes(normalized) ||
        template.kind.toLowerCase().includes(normalized)
      );
    });
  }, [quickAddQuery]);
  const layoutLibraryWidth = isLibraryCollapsed ? LIBRARY_RAIL_WIDTH : libraryWidth;
  const layoutInspectorWidth = isInspectorCollapsed ? INSPECTOR_RAIL_WIDTH : inspectorWidth;
  const shellStyle = useMemo(
    () =>
      ({
        "--builder-debug-row-height": `${isDebugCollapsed ? 48 : debugHeight}px`,
      }) as CSSProperties,
    [debugHeight, isDebugCollapsed],
  );
  const layoutStyle = useMemo(
    () =>
      ({
        "--builder-left-width": `${layoutLibraryWidth}px`,
        "--builder-right-width": `${layoutInspectorWidth}px`,
      }) as CSSProperties,
    [layoutInspectorWidth, layoutLibraryWidth],
  );
  const editorTheme = themeMode === "dark" ? "vs-dark" : "vs";

  const appendDebugLog = useCallback((entry: Omit<DebugLogEntry, "id" | "timestamp">) => {
    setDebugLogs((current) => {
      const nextLog: DebugLogEntry = {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        ...entry,
      };
      return [...current, nextLog].slice(-MAX_DEBUG_LOGS);
    });
  }, []);

  useEffect(() => {
    return () => {
      runningHandleRef.current?.cancel();
      runningHandleRef.current = null;
      disposeFlowRunner();
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      for (const timerId of toastTimersRef.current) {
        window.clearTimeout(timerId);
      }
      toastTimersRef.current = [];
      resizeStateRef.current = null;
      document.body.style.removeProperty("user-select");
      document.body.style.removeProperty("cursor");
    };
  }, []);

  useEffect(() => {
    const onPointerMove = (event: MouseEvent) => {
      const activeResize = resizeStateRef.current;
      if (!activeResize) return;

      if (activeResize.target === "library") {
        const rawWidth = activeResize.startSize + (event.clientX - activeResize.startX);
        const maxWidth = Math.max(MIN_LIBRARY_WIDTH, Math.round(window.innerWidth * 0.5));
        setLibraryWidth(Math.max(MIN_LIBRARY_WIDTH, Math.min(rawWidth, maxWidth)));
        return;
      }

      if (activeResize.target === "inspector") {
        const rawWidth = activeResize.startSize - (event.clientX - activeResize.startX);
        const maxWidth = Math.max(MIN_INSPECTOR_WIDTH, Math.round(window.innerWidth * 0.55));
        setInspectorWidth(Math.max(MIN_INSPECTOR_WIDTH, Math.min(rawWidth, maxWidth)));
        return;
      }

      const rawHeight = activeResize.startSize - (event.clientY - activeResize.startY);
      const maxHeight = Math.max(MIN_DEBUG_HEIGHT, Math.round(window.innerHeight * 0.72));
      setDebugHeight(Math.max(MIN_DEBUG_HEIGHT, Math.min(rawHeight, maxHeight)));
    };

    const onPointerUp = () => {
      if (!resizeStateRef.current) return;
      resizeStateRef.current = null;
      document.body.style.removeProperty("user-select");
      document.body.style.removeProperty("cursor");
    };

    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);
    return () => {
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
    };
  }, []);

  const patchNodeData = useCallback(
    (nodeId: string, updater: (current: BuilderNodeData) => BuilderNodeData) => {
      graph.setState((current) => ({
        ...current,
        nodes: current.nodes.map((node) => {
          if (node.id !== nodeId) return node;
          return {
            ...node,
            data: updater(getBuilderNodeData(node)),
          };
        }),
      }));
    },
    [graph],
  );

  const addNode = useCallback(
    (kind: BuilderNodeKind) => {
      const template = NODE_TEMPLATES.find((item) => item.kind === kind);
      if (!template) return;

      graph.setState((current) => {
        const selectedNodeId = getSelectedNodeIds(current).at(-1);
        const selectedNode = current.nodes.find((node) => node.id === selectedNodeId);
        const id = makeUniqueNodeId(kind, current.nodes);
        const basePosition = selectedNode
          ? { x: selectedNode.position.x + 260, y: selectedNode.position.y + 24 }
          : getNextNodePosition(current.nodes);

        const newNode: NodeData<BuilderNodeData> = {
          id,
          label: template.label,
          type: NODE_TYPE_BY_KIND[kind] ?? "default",
          position: basePosition,
          data: {
            kind,
            description: template.description,
            status: "draft",
            language: "typescript",
            code: createNodeCodeTemplate(kind),
            validation: { state: "idle" },
            test: {},
          },
        };

        const edges = [...current.edges];
        if (selectedNode) {
          edges.push({
            id: `edge-${selectedNode.id}-${newNode.id}-${Date.now()}`,
            sourceNode: selectedNode.id,
            targetNode: newNode.id,
          });
        }

        return {
          ...current,
          nodes: [...current.nodes, newNode],
          edges,
          selectedNodeId: newNode.id,
          selectedNodeIds: [newNode.id],
          selectedEdgeId: null,
          selectedEdgeIds: [],
        };
      });
      setStatusText(`Added node: ${kind}`);
    },
    [graph],
  );

  const closeQuickAddPalette = useCallback(() => {
    setIsQuickAddOpen(false);
    setQuickAddQuery("");
  }, []);

  const openQuickAddPalette = useCallback(() => {
    setIsQuickAddOpen(true);
    setQuickAddQuery("");
  }, []);

  const addFromQuickPalette = useCallback(
    (kind: BuilderNodeKind) => {
      addNode(kind);
      closeQuickAddPalette();
    },
    [addNode, closeQuickAddPalette],
  );

  const startResize = useCallback(
    (target: ResizeTarget, event: React.MouseEvent<HTMLDivElement>) => {
      if (target === "library" && isLibraryCollapsed) return;
      if (target === "inspector" && isInspectorCollapsed) return;
      if (target === "debug" && isDebugCollapsed) return;

      event.preventDefault();
      resizeStateRef.current = {
        target,
        startX: event.clientX,
        startY: event.clientY,
        startSize: target === "library" ? libraryWidth : target === "inspector" ? inspectorWidth : debugHeight,
      };
      document.body.style.userSelect = "none";
      document.body.style.cursor = target === "debug" ? "row-resize" : "col-resize";
    },
    [debugHeight, inspectorWidth, isDebugCollapsed, isInspectorCollapsed, isLibraryCollapsed, libraryWidth],
  );

  const updateNodeLabel = useCallback(
    (nodeId: string, label: string) => {
      graph.setState((current) => ({
        ...current,
        nodes: current.nodes.map((node) => (node.id === nodeId ? { ...node, label } : node)),
      }));
    },
    [graph],
  );

  const updateNodeDescription = useCallback(
    (nodeId: string, description: string) => {
      patchNodeData(nodeId, (prevData) => ({
        ...prevData,
        description,
        status: "draft",
        validation: { state: "idle" },
      }));
    },
    [patchNodeData],
  );

  const updateNodeCode = useCallback(
    (nodeId: string, code: string) => {
      patchNodeData(nodeId, (prevData) => ({
        ...prevData,
        language: "typescript",
        code,
        status: "draft",
        validation: { state: "idle" },
      }));
    },
    [patchNodeData],
  );

  const updateNodeInputExample = useCallback(
    (nodeId: string, inputExample: unknown | undefined) => {
      patchNodeData(nodeId, (prevData) => ({
        ...prevData,
        inputExample,
        status: "draft",
        validation: { state: "idle" },
      }));
    },
    [patchNodeData],
  );

  const updateNodeOutputExample = useCallback(
    (nodeId: string, outputExample: unknown | undefined) => {
      patchNodeData(nodeId, (prevData) => ({
        ...prevData,
        outputExample,
        status: "draft",
        validation: { state: "idle" },
      }));
    },
    [patchNodeData],
  );

  const validateNode = useCallback(
    async (nodeId: string) => {
      const node = graph.getState().nodes.find((candidate) => candidate.id === nodeId);
      if (!node) {
        setStatusText("Validation failed: node not found");
        return;
      }

      const nodeData = getBuilderNodeData(node);
      const nodeCode = nodeData.code ?? "";
      const runHandle = runNodeInWorker({
        nodeId,
        code: nodeCode,
        input: nodeData.inputExample,
        ctx: { nodeId, mode: "validate" },
        timeoutMs: DEFAULT_NODE_TIMEOUT_MS,
      });

      try {
        const result = await runHandle.promise;
        const output = result.output;
        if (output === undefined) {
          const contractError: NormalizedNodeError = {
            type: "contract",
            nodeId,
            message: "Contract error: run returned undefined.",
          };
          const message = formatNodeErrorMessage(contractError);
          patchNodeData(nodeId, (prevData) => ({
            ...prevData,
            status: "error",
            validation: createValidationState("error", message, contractError.type, contractError),
          }));
          setStatusText(message);
          appendDebugLog({ level: "error", nodeId, message, details: contractError });
          return;
        }

        const mismatch =
          nodeData.outputExample === undefined ? null : compareContract(nodeData.outputExample, output, "output");

        if (mismatch) {
          const contractError: NormalizedNodeError = {
            type: "contract",
            nodeId,
            message: `Contract mismatch: ${mismatch}`,
          };
          const message = formatNodeErrorMessage(contractError);
          patchNodeData(nodeId, (prevData) => ({
            ...prevData,
            status: "error",
            validation: createValidationState("error", message, contractError.type, contractError),
          }));
          setStatusText(message);
          appendDebugLog({ level: "error", nodeId, message, details: { error: contractError, output } });
          return;
        }

        const successMessage =
          nodeData.outputExample === undefined
            ? `Validation passed in ${result.durationMs} ms: syntax OK, contract check skipped (no outputExample).`
            : `Validation passed in ${result.durationMs} ms: syntax OK, output matches outputExample.`;

        patchNodeData(nodeId, (prevData) => ({
          ...prevData,
          status: "ready",
          validation: createValidationState("success", successMessage, "contract", { nodeId }),
        }));
        setStatusText(successMessage);
        appendDebugLog({ level: "info", nodeId, message: successMessage, details: { durationMs: result.durationMs } });
      } catch (error) {
        const executionError = toNormalizedNodeError(
          nodeId,
          error,
          "runtime",
          "Validation failed during execution.",
        );
        const message = formatNodeErrorMessage(executionError);
        patchNodeData(nodeId, (prevData) => ({
          ...prevData,
          status: "error",
          validation: createValidationState("error", message, executionError.type, executionError),
        }));
        setStatusText(message);
        appendDebugLog({ level: "error", nodeId, message, details: executionError });
      }
    },
    [appendDebugLog, graph, patchNodeData],
  );

  const runNodeTest = useCallback(
    async (nodeId: string, testInput: unknown | undefined) => {
      if (runningHandleRef.current && runningHandleRef.current.nodeId !== nodeId) {
        setStatusText("Another node test is already running. Stop it first.");
        return;
      }
      if (runningHandleRef.current && runningHandleRef.current.nodeId === nodeId) {
        return;
      }

      const node = graph.getState().nodes.find((candidate) => candidate.id === nodeId);
      if (!node) {
        setStatusText("Run failed: node not found");
        return;
      }

      const nodeData = getBuilderNodeData(node);
      const code = nodeData.code ?? "";
      const runHandle = runNodeInWorker({
        nodeId,
        code,
        input: testInput,
        ctx: { nodeId },
        timeoutMs: DEFAULT_NODE_TIMEOUT_MS,
      });

      runningHandleRef.current = { nodeId, cancel: runHandle.cancel };
      setRunningNodeId(nodeId);

      patchNodeData(nodeId, (previousData) => ({
        ...previousData,
        test: withPatchedTestState(previousData, {
          lastInput: testInput,
          lastOutput: undefined,
          lastError: undefined,
          lastErrorType: undefined,
          lastDurationMs: undefined,
          lastRunAt: Date.now(),
        }),
      }));
      setStatusText(`Running node test: ${node.label ?? nodeId}...`);
      appendDebugLog({ level: "info", nodeId, message: "Node test started." });

      try {
        const result = await runHandle.promise;
        patchNodeData(nodeId, (previousData) => ({
          ...previousData,
          status: "ready",
          test: withPatchedTestState(previousData, {
            lastInput: testInput,
            lastOutput: result.output,
            lastError: undefined,
            lastErrorType: undefined,
            lastDurationMs: result.durationMs,
            lastRunAt: Date.now(),
          }),
        }));

        const successMessage = `Node test passed in ${result.durationMs} ms.`;
        setStatusText(successMessage);
        appendDebugLog({ level: "info", nodeId, message: successMessage, details: result.output });
      } catch (error) {
        const executionError = toNormalizedNodeError(nodeId, error, "runtime", "Node test failed.");
        const errorMessage = formatNodeErrorMessage(executionError);

        patchNodeData(nodeId, (previousData) => ({
          ...previousData,
          status: "error",
          test: withPatchedTestState(previousData, {
            lastInput: testInput,
            lastOutput: undefined,
            lastError: errorMessage,
            lastErrorType: executionError.type,
            lastDurationMs: undefined,
            lastRunAt: Date.now(),
          }),
        }));
        setStatusText(errorMessage);
        appendDebugLog({
          level: "error",
          nodeId,
          message: errorMessage,
          details: executionError,
        });
      } finally {
        if (runningHandleRef.current?.nodeId === nodeId) {
          runningHandleRef.current = null;
          setRunningNodeId((current) => (current === nodeId ? null : current));
        }
      }
    },
    [appendDebugLog, graph, patchNodeData],
  );

  const cancelNodeTest = useCallback((nodeId: string) => {
    if (!runningHandleRef.current || runningHandleRef.current.nodeId !== nodeId) return;
    runningHandleRef.current.cancel();
  }, []);

  const isNodeTestRunning = useCallback(
    (nodeId: string) => runningNodeId === nodeId,
    [runningNodeId],
  );

  const runSelectedNode = useCallback(() => {
    if (!selectedSingleNode) {
      setStatusText("Select exactly one node to run.");
      return;
    }

    const selectedData = getBuilderNodeData(selectedSingleNode);
    const testInput = selectedData.test?.lastInput ?? selectedData.inputExample;
    void runNodeTest(selectedSingleNode.id, testInput);
  }, [runNodeTest, selectedSingleNode]);

  const { startFlowRun, cancelFlowRun, isFlowRunning, dispose: disposeFlowRunner } = useFlowRunner({
    graph,
    patchNodeData,
    appendDebugLog,
    setStatusText,
  });

  const cancelActiveRun = useCallback(() => {
    runningHandleRef.current?.cancel();
  }, []);

  const deleteSelected = useCallback(() => {
    graph.setState((current) => {
      const selectedNodeIds = new Set(getSelectedNodeIds(current));
      if (selectedNodeIds.size === 0) return current;

      return {
        ...current,
        nodes: current.nodes.filter((node) => !selectedNodeIds.has(node.id)),
        edges: current.edges.filter(
          (edge) => !selectedNodeIds.has(edge.sourceNode) && !selectedNodeIds.has(edge.targetNode),
        ),
        selectedNodeId: null,
        selectedNodeIds: [],
        selectedEdgeId: null,
        selectedEdgeIds: [],
      };
    });
    setStatusText("Deleted selected nodes");
  }, [graph]);

  const duplicateNode = useCallback(
    (nodeId: string) => {
      graph.setState((current) => {
        const source = current.nodes.find((node) => node.id === nodeId);
        if (!source) return current;

        const kind = (getBuilderNodeData(source).kind ?? "agent") as BuilderNodeKind;
        const duplicateId = makeUniqueNodeId(kind, current.nodes);
        const duplicate: NodeData = {
          ...source,
          id: duplicateId,
          label: `${source.label ?? source.id} Copy`,
          position: { x: source.position.x + 40, y: source.position.y + 40 },
          data: {
            ...(source.data as Record<string, unknown> | undefined),
            status: "draft",
            validation: { state: "idle" },
            test: {},
          },
        };

        return {
          ...current,
          nodes: [...current.nodes, duplicate],
          selectedNodeId: duplicateId,
          selectedNodeIds: [duplicateId],
          selectedEdgeId: null,
          selectedEdgeIds: [],
        };
      });
      setStatusText("Duplicated node");
    },
    [graph],
  );

  const saveLocal = useCallback(() => {
    try {
      const payload = graph.toJSON({
        flowName,
        source: "manual-save",
        savedAt: new Date().toISOString(),
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      setStatusText("Saved to local storage");
      pushToast("Saved to local storage", "success");
      setLastAutoSaveAt(Date.now());
    } catch {
      setStatusText("Failed to save local draft");
      pushToast("Failed to save local draft", "error");
    }
  }, [flowName, graph, pushToast]);

  const applySerializedGraph = useCallback(
    (payload: SerializedGraph, message: string) => {
      graph.loadJSON(payload);
      const loadedFlowName = extractFlowName(payload);
      if (loadedFlowName) {
        setFlowName(loadedFlowName);
      }
      setStatusText(message);
      pushToast(message, "success");
    },
    [graph, pushToast],
  );

  const loadLocal = useCallback(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setStatusText("No local draft found");
      pushToast("No local draft found", "info");
      return;
    }

    try {
      const payload = JSON.parse(raw) as SerializedGraph;
      applySerializedGraph(payload, "Draft restored");
    } catch {
      setStatusText("Failed to restore draft");
      pushToast("Failed to restore draft", "error");
    }
  }, [applySerializedGraph, pushToast]);

  const exportGraph = useCallback(() => {
    const payload = graph.toJSON({
      flowName,
      source: "export",
      exportedAt: new Date().toISOString(),
      includesNodeTestMetadata: true,
    });
    const data = JSON.stringify(payload, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const download = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    download.href = url;
    download.download = `${sanitizeFileName(flowName)}-${stamp}.json`;
    document.body.appendChild(download);
    download.click();
    download.remove();
    URL.revokeObjectURL(url);
    setStatusText("Graph exported");
    pushToast("Graph exported", "success");
  }, [flowName, graph, pushToast]);

  const triggerImport = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  const importGraph = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      try {
        const raw = await file.text();
        const payload = JSON.parse(raw) as SerializedGraph;
        applySerializedGraph(payload, `Imported graph: ${file.name}`);
      } catch {
        setStatusText(`Failed to import graph: ${file.name}`);
        pushToast(`Failed to import graph: ${file.name}`, "error");
      }
    },
    [applySerializedGraph, pushToast],
  );

  const switchTheme = useCallback((nextTheme: BuilderThemeMode) => {
    setThemeMode(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  }, []);

  useEffect(() => {
    if (draftHydratedRef.current) return;
    draftHydratedRef.current = true;

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const payload = JSON.parse(raw) as SerializedGraph;
      graph.loadJSON(payload);
      const loadedFlowName = extractFlowName(payload);
      if (loadedFlowName) {
        setFlowName(loadedFlowName);
      }
      setStatusText("Draft restored from local storage");
      pushToast("Draft restored from local storage", "success");
    } catch {
      setStatusText("Failed to restore local draft");
      pushToast("Failed to restore local draft", "error");
    }
  }, [graph, pushToast]);

  useEffect(() => {
    if (!draftHydratedRef.current) return;

    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = window.setTimeout(() => {
      try {
        const payload = graph.toJSON({
          flowName,
          source: "autosave",
          savedAt: new Date().toISOString(),
          includesNodeTestMetadata: true,
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        setLastAutoSaveAt(Date.now());
      } catch {
        setStatusText("Autosave failed");
      } finally {
        autosaveTimerRef.current = null;
      }
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [flowName, graph, state.edges, state.nodes]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if ((event.ctrlKey || event.metaKey) && key === "s") {
        event.preventDefault();
        saveLocal();
        return;
      }

      if (isEditableEventTarget(event.target)) {
        return;
      }

      if (event.key === "Escape" && isQuickAddOpen) {
        event.preventDefault();
        closeQuickAddPalette();
        return;
      }

      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) {
        return;
      }

      if (key === "a" || event.code === "Space") {
        event.preventDefault();
        openQuickAddPalette();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeQuickAddPalette, isQuickAddOpen, openQuickAddPalette, saveLocal]);

  return (
    <div
      className="builder-shell"
      data-color-mode={themeMode}
      data-light-theme="light"
      data-dark-theme="dark"
      style={shellStyle}
    >
      <header className="builder-topbar">
        <input
          className="builder-flow-name"
          value={flowName}
          onChange={(event) => setFlowName(event.target.value)}
          aria-label="Flow name"
        />
        <div className="builder-topbar-actions">
          <button type="button" className="builder-btn" onClick={openQuickAddPalette}>
            Quick Add
          </button>
          <button type="button" className="builder-btn" onClick={saveLocal}>
            Save local
          </button>
          <button type="button" className="builder-btn" onClick={loadLocal}>
            Load local
          </button>
          <button type="button" className="builder-btn" onClick={exportGraph}>
            Export
          </button>
          <button type="button" className="builder-btn" onClick={triggerImport}>
            Import
          </button>
          <button
            type="button"
            className="builder-btn builder-btn-primary"
            onClick={runSelectedNode}
            disabled={!selectedSingleNode || runningNodeId !== null || isFlowRunning}
          >
            {runningNodeId ? "Running..." : "Run Node"}
          </button>
          <button type="button" className="builder-btn" onClick={cancelActiveRun} disabled={runningNodeId === null}>
            Stop Node
          </button>
          <button
            type="button"
            className="builder-btn builder-btn-primary"
            onClick={() => void startFlowRun()}
            disabled={isFlowRunning || runningNodeId !== null}
          >
            {isFlowRunning ? "Flow Running..." : "Run Flow"}
          </button>
          <button
            type="button"
            className="builder-btn"
            onClick={() => void cancelFlowRun()}
            disabled={!isFlowRunning}
          >
            Stop Flow
          </button>
        </div>
        <div className="builder-theme-toggle" role="group" aria-label="Color mode">
          <button
            type="button"
            className={themeMode === "light" ? "active" : ""}
            onClick={() => switchTheme("light")}
            aria-pressed={themeMode === "light"}
          >
            Light
          </button>
          <button
            type="button"
            className={themeMode === "dark" ? "active" : ""}
            onClick={() => switchTheme("dark")}
            aria-pressed={themeMode === "dark"}
          >
            Dark
          </button>
        </div>
        <div className="builder-topbar-meta">
          <span className={`builder-run-indicator ${(runningNodeLabel || isFlowRunning) ? "" : "idle"}`}>
            <span className="builder-run-dot" />
            {isFlowRunning ? "Flow running..." : runningNodeLabel ? `Running: ${runningNodeLabel}` : "No active run"}
          </span>
          <span className="builder-status">{statusText}</span>
          <span className="builder-status builder-status-secondary">
            {lastAutoSaveAt ? `Autosaved ${new Date(lastAutoSaveAt).toLocaleTimeString()}` : "Autosave enabled"}
          </span>
        </div>
      </header>

      <div className="builder-layout" style={layoutStyle}>
        <section className={`builder-side-slot left ${isLibraryCollapsed ? "collapsed" : ""}`}>
          {isLibraryCollapsed ? (
            <button
              type="button"
              className="builder-side-rail-button"
              onClick={() => setIsLibraryCollapsed(false)}
              aria-label="Expand library panel"
              title="Expand library panel"
            >
              Library
            </button>
          ) : (
            <>
              <NodeLibrary templates={NODE_TEMPLATES} onAddNode={addNode} />
              <button
                type="button"
                className="builder-side-toggle left"
                onClick={() => setIsLibraryCollapsed(true)}
                aria-label="Collapse library panel"
              >
                <span aria-hidden>{"<"}</span>
              </button>
            </>
          )}
        </section>

        <div
          className={`builder-panel-resizer ${isLibraryCollapsed ? "disabled" : ""}`}
          onMouseDown={(event) => startResize("library", event)}
          role="separator"
          aria-label="Resize library panel"
        />

        <main className="builder-canvas">
          {state.nodes.length === 0 ? (
            <div className="builder-canvas-empty-state">
              <p>Canvas is empty.</p>
              <button type="button" className="builder-btn builder-btn-primary" onClick={openQuickAddPalette}>
                Add first node
              </button>
            </div>
          ) : null}
          <Flow graph={graph} showGrid gridSize={20} viewportCulling={false} />
        </main>

        <div
          className={`builder-panel-resizer ${isInspectorCollapsed ? "disabled" : ""}`}
          onMouseDown={(event) => startResize("inspector", event)}
          role="separator"
          aria-label="Resize inspector panel"
        />

        <section className={`builder-side-slot right ${isInspectorCollapsed ? "collapsed" : ""}`}>
          {isInspectorCollapsed ? (
            <button
              type="button"
              className="builder-side-rail-button"
              onClick={() => setIsInspectorCollapsed(false)}
              aria-label="Expand inspector panel"
              title="Expand inspector panel"
            >
              Inspector
            </button>
          ) : (
            <>
              <InspectorPanel
                selectedNodes={selectedNodes}
                onUpdateNodeLabel={updateNodeLabel}
                onUpdateNodeDescription={updateNodeDescription}
                onUpdateNodeCode={updateNodeCode}
                onUpdateNodeInputExample={updateNodeInputExample}
                onUpdateNodeOutputExample={updateNodeOutputExample}
                onValidateNode={validateNode}
                onRunNodeTest={runNodeTest}
                onCancelNodeTest={cancelNodeTest}
                isNodeTestRunning={isNodeTestRunning}
                editorTheme={editorTheme}
                onDuplicateNode={duplicateNode}
                onDeleteSelected={deleteSelected}
              />
              <button
                type="button"
                className="builder-side-toggle right"
                onClick={() => setIsInspectorCollapsed(true)}
                aria-label="Collapse inspector panel"
              >
                <span aria-hidden>{">"}</span>
              </button>
            </>
          )}
        </section>
      </div>

      <section className="builder-debug-region">
        {!isDebugCollapsed ? (
          <div
            className="builder-debug-resizer"
            onMouseDown={(event) => startResize("debug", event)}
            role="separator"
            aria-label="Resize debug panel"
          />
        ) : null}
        <DebugDrawer
          selectedNode={selectedSingleNode}
          logs={debugLogs}
          isCollapsed={isDebugCollapsed}
          onToggleCollapse={() => setIsDebugCollapsed((current) => !current)}
        />
      </section>

      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="builder-hidden-file-input"
        onChange={importGraph}
      />

      {isQuickAddOpen ? (
        <div className="builder-quick-add-backdrop" role="presentation" onClick={closeQuickAddPalette}>
          <section
            className="builder-quick-add"
            role="dialog"
            aria-modal="true"
            aria-label="Quick add node"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="builder-quick-add-header">
              <h2>Quick Add Node</h2>
              <p>Press Enter to add the first match.</p>
            </div>
            <input
              className="builder-search"
              autoFocus
              placeholder="Type a node name..."
              value={quickAddQuery}
              onChange={(event) => setQuickAddQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeQuickAddPalette();
                  return;
                }
                if (event.key === "Enter") {
                  const firstMatch = quickAddTemplates[0];
                  if (!firstMatch) return;
                  event.preventDefault();
                  addFromQuickPalette(firstMatch.kind);
                }
              }}
            />
            <div className="builder-quick-add-list">
              {quickAddTemplates.length === 0 ? (
                <p className="builder-quick-add-empty">No node types match this query.</p>
              ) : (
                quickAddTemplates.map((template) => (
                  <button
                    key={template.kind}
                    type="button"
                    className="builder-library-item"
                    onClick={() => addFromQuickPalette(template.kind)}
                  >
                    <span className="builder-library-item-title">{template.label}</span>
                    <span className="builder-library-item-description">{template.description}</span>
                    <span className="builder-library-item-group">{template.group}</span>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      ) : null}

      <div className="builder-toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <article key={toast.id} className={`builder-toast ${toast.type}`}>
            <p>{toast.message}</p>
            <button type="button" onClick={() => removeToast(toast.id)} aria-label="Dismiss notification">
              Dismiss
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
