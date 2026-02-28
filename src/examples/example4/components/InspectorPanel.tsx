import { useEffect, useState } from "react";
import type { NodeData } from "flowforge-react/types";
import { MonacoCodeEditor } from "./MonacoCodeEditor";
import { createNodeCodeTemplate, getBuilderNodeData } from "../types";

interface InspectorPanelProps {
  selectedNodes: NodeData[];
  onUpdateNodeLabel: (nodeId: string, label: string) => void;
  onUpdateNodeDescription: (nodeId: string, description: string) => void;
  onUpdateNodeCode: (nodeId: string, code: string) => void;
  onUpdateNodeInputExample: (nodeId: string, value: unknown | undefined) => void;
  onUpdateNodeOutputExample: (nodeId: string, value: unknown | undefined) => void;
  onValidateNode: (nodeId: string) => Promise<void>;
  onRunNodeTest: (nodeId: string, testInput: unknown | undefined) => Promise<void>;
  onCancelNodeTest: (nodeId: string) => void;
  isNodeTestRunning: (nodeId: string) => boolean;
  editorTheme?: "vs" | "vs-dark";
  onDuplicateNode: (nodeId: string) => void;
  onDeleteSelected: () => void;
}

type InspectorTab = "overview" | "code" | "io" | "test";

function formatJsonValue(value: unknown): string {
  if (value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

function parseJsonValue(rawValue: string): { ok: true; value: unknown | undefined } | { ok: false; error: string } {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return { ok: true, value: undefined };
  }

  try {
    return { ok: true, value: JSON.parse(rawValue) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    return { ok: false, error: message };
  }
}

export function InspectorPanel({
  selectedNodes,
  onUpdateNodeLabel,
  onUpdateNodeDescription,
  onUpdateNodeCode,
  onUpdateNodeInputExample,
  onUpdateNodeOutputExample,
  onValidateNode,
  onRunNodeTest,
  onCancelNodeTest,
  isNodeTestRunning,
  editorTheme = "vs-dark",
  onDuplicateNode,
  onDeleteSelected,
}: InspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>("overview");
  const [inputExampleText, setInputExampleText] = useState("");
  const [outputExampleText, setOutputExampleText] = useState("");
  const [testInputText, setTestInputText] = useState("");
  const [inputExampleError, setInputExampleError] = useState<string | null>(null);
  const [outputExampleError, setOutputExampleError] = useState<string | null>(null);
  const [testInputError, setTestInputError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const node = selectedNodes.length === 1 ? selectedNodes[0] : null;
  const builderData = node ? getBuilderNodeData(node) : null;
  const selectedNodeId = selectedNodes[0]?.id ?? null;
  const currentNodeId = node?.id ?? null;
  const currentInputExample = builderData?.inputExample;
  const currentOutputExample = builderData?.outputExample;
  const currentTestInput = builderData?.test?.lastInput ?? builderData?.inputExample;
  const nodeTestRunning = node ? isNodeTestRunning(node.id) : false;

  useEffect(() => {
    setActiveTab("overview");
  }, [selectedNodes.length, selectedNodeId]);

  useEffect(() => {
    if (!currentNodeId) {
      setInputExampleText("");
      setOutputExampleText("");
      setTestInputText("");
      setInputExampleError(null);
      setOutputExampleError(null);
      setTestInputError(null);
      return;
    }

    setInputExampleText(formatJsonValue(currentInputExample));
    setOutputExampleText(formatJsonValue(currentOutputExample));
    setTestInputText(formatJsonValue(currentTestInput));
    setInputExampleError(null);
    setOutputExampleError(null);
    setTestInputError(null);
  }, [currentInputExample, currentNodeId, currentOutputExample, currentTestInput]);

  const handleInputExampleChange = (rawValue: string) => {
    if (!node) return;
    setInputExampleText(rawValue);
    const parsed = parseJsonValue(rawValue);
    if (!parsed.ok) {
      setInputExampleError(parsed.error);
      return;
    }

    setInputExampleError(null);
    onUpdateNodeInputExample(node.id, parsed.value);
  };

  const handleOutputExampleChange = (rawValue: string) => {
    if (!node) return;
    setOutputExampleText(rawValue);
    const parsed = parseJsonValue(rawValue);
    if (!parsed.ok) {
      setOutputExampleError(parsed.error);
      return;
    }

    setOutputExampleError(null);
    onUpdateNodeOutputExample(node.id, parsed.value);
  };

  const handleValidate = async () => {
    if (!node) return;
    setIsValidating(true);
    try {
      await onValidateNode(node.id);
    } finally {
      setIsValidating(false);
    }
  };

  const handleTestInputChange = (rawValue: string) => {
    setTestInputText(rawValue);
    const parsed = parseJsonValue(rawValue);
    if (!parsed.ok) {
      setTestInputError(parsed.error);
      return;
    }
    setTestInputError(null);
  };

  const handleRunNodeLocally = async () => {
    if (!node) return;
    const parsed = parseJsonValue(testInputText);
    if (!parsed.ok) {
      setTestInputError(parsed.error);
      return;
    }

    setTestInputError(null);
    await onRunNodeTest(node.id, parsed.value);
  };

  const handleCancelNodeTest = () => {
    if (!node) return;
    onCancelNodeTest(node.id);
  };

  if (selectedNodes.length === 0) {
    return (
      <aside className="builder-inspector">
        <div className="builder-panel-header">
          <h2>Inspector</h2>
          <p>Select a node to edit</p>
        </div>
        <div className="builder-empty-state">
          <p>No node selected.</p>
          <p>Tip: click any node on the canvas.</p>
        </div>
      </aside>
    );
  }

  if (selectedNodes.length > 1 || !node || !builderData) {
    return (
      <aside className="builder-inspector">
        <div className="builder-panel-header">
          <h2>Inspector</h2>
          <p>Multiple selection</p>
        </div>
        <div className="builder-empty-state">
          <p>{selectedNodes.length} nodes selected.</p>
          <button className="builder-danger-btn" onClick={onDeleteSelected} type="button">
            Delete Selected
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="builder-inspector">
      <div className="builder-panel-header">
        <h2>Inspector</h2>
        <p>{builderData.kind.toUpperCase()}</p>
      </div>

      <div className="builder-inspector-tabs" role="tablist" aria-label="Inspector tabs">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "overview"}
          className={activeTab === "overview" ? "active" : ""}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "code"}
          className={activeTab === "code" ? "active" : ""}
          onClick={() => setActiveTab("code")}
        >
          Code
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "io"}
          className={activeTab === "io" ? "active" : ""}
          onClick={() => setActiveTab("io")}
        >
          I/O
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "test"}
          className={activeTab === "test" ? "active" : ""}
          onClick={() => setActiveTab("test")}
        >
          Test
        </button>
      </div>

      {activeTab === "overview" && (
        <>
          <div className="builder-form-group">
            <label htmlFor="node-name">Node name</label>
            <input
              id="node-name"
              value={node.label ?? ""}
              onChange={(event) => onUpdateNodeLabel(node.id, event.target.value)}
            />
          </div>

          <div className="builder-form-group">
            <label htmlFor="node-description">Description</label>
            <textarea
              id="node-description"
              rows={6}
              value={builderData.description ?? ""}
              onChange={(event) => onUpdateNodeDescription(node.id, event.target.value)}
              placeholder="Describe what this node does..."
            />
          </div>

          <div className="builder-readonly">
            <span>ID</span>
            <code>{node.id}</code>
          </div>
          <div className="builder-readonly">
            <span>Position</span>
            <code>{`${Math.round(node.position.x)}, ${Math.round(node.position.y)}`}</code>
          </div>

          <div className="builder-inspector-actions">
            <button type="button" onClick={() => onDuplicateNode(node.id)}>
              Duplicate
            </button>
            <button type="button" className="builder-danger-btn" onClick={onDeleteSelected}>
              Delete
            </button>
          </div>
        </>
      )}

      {activeTab === "code" && (
        <div className="builder-code-tab">
          <div className="builder-code-header">
            <span>Function contract:</span>
            <code>run(input, ctx) =&gt; return object</code>
          </div>
          <div className={`builder-validation-banner ${builderData.validation?.state ?? "idle"}`}>
            {builderData.validation?.message ?? "Validation not run yet."}
          </div>
          <div className="builder-code-actions">
            <button type="button" onClick={handleValidate} disabled={isValidating}>
              {isValidating ? "Validating..." : "Validate"}
            </button>
          </div>
          <MonacoCodeEditor
            value={builderData.code ?? createNodeCodeTemplate(builderData.kind)}
            language={builderData.language ?? "typescript"}
            theme={editorTheme}
            onChange={(nextCode) => onUpdateNodeCode(node.id, nextCode)}
          />
        </div>
      )}

      {activeTab === "io" && (
        <div className="builder-io-tab">
          <div className="builder-form-group">
            <label htmlFor="node-input-example">Input example (JSON)</label>
            <textarea
              id="node-input-example"
              rows={8}
              value={inputExampleText}
              onChange={(event) => handleInputExampleChange(event.target.value)}
              placeholder='{"text":"hello"}'
            />
            {inputExampleError ? <p className="builder-field-error">{inputExampleError}</p> : null}
          </div>

          <div className="builder-form-group">
            <label htmlFor="node-output-example">Output example (JSON)</label>
            <textarea
              id="node-output-example"
              rows={8}
              value={outputExampleText}
              onChange={(event) => handleOutputExampleChange(event.target.value)}
              placeholder='{"result":"hello"}'
            />
            {outputExampleError ? <p className="builder-field-error">{outputExampleError}</p> : null}
          </div>

          <p className="builder-io-help">
            Validate uses these examples to run a basic contract check for the current node code.
          </p>
        </div>
      )}

      {activeTab === "test" && (
        <div className="builder-test-tab">
          <div className="builder-form-group">
            <label htmlFor="node-test-input">Test input (JSON)</label>
            <textarea
              id="node-test-input"
              rows={8}
              value={testInputText}
              onChange={(event) => handleTestInputChange(event.target.value)}
              placeholder='{"text":"hello"}'
            />
            {testInputError ? <p className="builder-field-error">{testInputError}</p> : null}
          </div>

          <div className="builder-code-actions">
            <button type="button" onClick={handleRunNodeLocally} disabled={nodeTestRunning}>
              {nodeTestRunning ? "Running..." : "Run Node Locally"}
            </button>
            <button type="button" onClick={handleCancelNodeTest} disabled={!nodeTestRunning}>
              Cancel
            </button>
          </div>

          <div className="builder-test-meta">
            <span>Execution time</span>
            <code>
              {builderData.test?.lastDurationMs !== undefined ? `${builderData.test.lastDurationMs} ms` : "N/A"}
            </code>
          </div>
          <div className="builder-test-output">
            <span>Output</span>
            <pre>{formatJsonValue(builderData.test?.lastOutput) || "No output yet."}</pre>
          </div>
          {builderData.test?.lastError ? <p className="builder-test-error">{builderData.test.lastError}</p> : null}
        </div>
      )}
    </aside>
  );
}
