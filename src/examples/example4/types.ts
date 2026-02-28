import type { NodeData } from "flowforge-react/types";

export type BuilderNodeKind = "input" | "agent" | "transform" | "condition" | "output" | "note";

export type BuilderValidationType = "syntax" | "runtime" | "timeout" | "contract";
export type BuilderRuntimeErrorType = "syntax" | "runtime" | "timeout" | "contract";

export interface BuilderValidationState extends Record<string, unknown> {
  state: "idle" | "success" | "error";
  type?: BuilderValidationType;
  message?: string;
  nodeId?: string;
  line?: number;
  column?: number;
  checkedAt?: number;
}

export interface BuilderNodeTestState extends Record<string, unknown> {
  lastInput?: unknown;
  lastOutput?: unknown;
  lastError?: string;
  lastErrorType?: BuilderRuntimeErrorType;
  lastDurationMs?: number;
  lastRunAt?: number;
}

export interface BuilderNodeData extends Record<string, unknown> {
  kind: BuilderNodeKind;
  description?: string;
  status?: "idle" | "draft" | "ready" | "error";
  code?: string;
  language?: "typescript" | "javascript";
  inputExample?: unknown;
  outputExample?: unknown;
  validation?: BuilderValidationState;
  test?: BuilderNodeTestState;
}

export interface NodeTemplate {
  kind: BuilderNodeKind;
  label: string;
  description: string;
  group: "Core" | "Logic" | "Utility";
}

export const NODE_TEMPLATES: NodeTemplate[] = [
  { kind: "input", label: "Input", description: "Entry point for external data", group: "Core" },
  { kind: "agent", label: "Agent", description: "LLM-powered step", group: "Core" },
  { kind: "transform", label: "Transform", description: "Transform or normalize payload", group: "Logic" },
  { kind: "condition", label: "Condition", description: "Branch based on runtime condition", group: "Logic" },
  { kind: "output", label: "Output", description: "Final result collector", group: "Core" },
  { kind: "note", label: "Note", description: "Canvas documentation helper", group: "Utility" },
];

export const getNodeDescription = (node: NodeData): string => {
  if (!node.data || typeof node.data !== "object") return "";
  const maybeData = node.data as BuilderNodeData;
  return maybeData.description ?? "";
};

export const getBuilderNodeData = (node: NodeData): BuilderNodeData => {
  if (!node.data || typeof node.data !== "object") {
    return {
      kind: "agent",
      description: "",
      status: "draft",
      language: "typescript",
      code: createNodeCodeTemplate("agent"),
      validation: { state: "idle" },
    };
  }

  const data = node.data as Partial<BuilderNodeData>;
  const kind = data.kind ?? "agent";
  return {
    kind,
    description: data.description ?? "",
    status: data.status ?? "draft",
    language: data.language ?? "typescript",
    code: data.code ?? createNodeCodeTemplate(kind),
    inputExample: data.inputExample,
    outputExample: data.outputExample,
    validation: data.validation ?? { state: "idle" },
    test: data.test ?? {},
  };
};

export const createNodeCodeTemplate = (kind: BuilderNodeKind): string => {
  if (kind === "condition") {
    return `export default async function run(input, ctx) {
  const ok = Boolean(input?.value);
  return { ok, input };
}`;
  }

  if (kind === "output") {
    return `export default async function run(input, ctx) {
  return { output: input };
}`;
  }

  if (kind === "note") {
    return `// Use Note node to document your flow.
export default async function run(input, ctx) {
  return input;
}`;
  }

  return `export default async function run(input, ctx) {
  return { result: input };
}`;
};
