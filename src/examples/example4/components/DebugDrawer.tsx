import { useMemo, useState } from "react";
import type { NodeData } from "flowforge-react/types";
import { getBuilderNodeData } from "../types";

export interface DebugLogEntry {
  id: string;
  timestamp: number;
  level: "info" | "error";
  nodeId?: string;
  message: string;
  details?: unknown;
}

interface DebugDrawerProps {
  selectedNode: NodeData | null;
  logs: DebugLogEntry[];
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

type DebugTab = "logs" | "output" | "validation";

function formatJson(value: unknown): string {
  if (value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function DebugDrawer({ selectedNode, logs, isCollapsed, onToggleCollapse }: DebugDrawerProps) {
  const [activeTab, setActiveTab] = useState<DebugTab>("logs");
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = isCollapsed ?? internalCollapsed;
  const selectedData = useMemo(
    () => (selectedNode ? getBuilderNodeData(selectedNode) : null),
    [selectedNode],
  );

  const sortedLogs = useMemo(() => [...logs].sort((a, b) => b.timestamp - a.timestamp), [logs]);
  const toggleCollapsed = onToggleCollapse ?? (() => setInternalCollapsed((prev) => !prev));

  return (
    <section className={`builder-debug-drawer ${collapsed ? "collapsed" : ""}`} aria-label="Debug drawer">
      <div className="builder-debug-header">
        <div className="builder-debug-title">
          <strong>Debug Drawer</strong>
          <span>{selectedNode ? `Node: ${selectedNode.label ?? selectedNode.id}` : "No node selected"}</span>
        </div>
        <button type="button" className="builder-btn" onClick={toggleCollapsed}>
          {collapsed ? "Open" : "Collapse"}
        </button>
      </div>

      {!collapsed && (
        <div className="builder-debug-content">
          <div className="builder-debug-tabs" role="tablist" aria-label="Debug tabs">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "logs"}
              className={activeTab === "logs" ? "active" : ""}
              onClick={() => setActiveTab("logs")}
            >
              Logs
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "output"}
              className={activeTab === "output" ? "active" : ""}
              onClick={() => setActiveTab("output")}
            >
              Node Output
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "validation"}
              className={activeTab === "validation" ? "active" : ""}
              onClick={() => setActiveTab("validation")}
            >
              Validation
            </button>
          </div>

          {activeTab === "logs" && (
            <div className="builder-debug-panel">
              {sortedLogs.length === 0 && <p className="builder-debug-empty">No logs yet.</p>}
              {sortedLogs.map((entry) => (
                <article key={entry.id} className={`builder-debug-log ${entry.level}`}>
                  <header>
                    <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                    <span>{entry.nodeId ? `Node ${entry.nodeId}` : "Global"}</span>
                  </header>
                  <p>{entry.message}</p>
                  {entry.details !== undefined && <pre>{formatJson(entry.details)}</pre>}
                </article>
              ))}
            </div>
          )}

          {activeTab === "output" && (
            <div className="builder-debug-panel">
              {!selectedNode || !selectedData ? (
                <p className="builder-debug-empty">Select one node to inspect output.</p>
              ) : (
                <>
                  <div className="builder-debug-meta">
                    <span>Last run</span>
                    <code>
                      {selectedData.test?.lastRunAt
                        ? new Date(selectedData.test.lastRunAt).toLocaleTimeString()
                        : "Not executed"}
                    </code>
                  </div>
                  <div className="builder-debug-meta">
                    <span>Execution time</span>
                    <code>
                      {selectedData.test?.lastDurationMs !== undefined
                        ? `${selectedData.test.lastDurationMs} ms`
                        : "N/A"}
                    </code>
                  </div>
                  <pre>{formatJson(selectedData.test?.lastOutput) || "No output captured yet."}</pre>
                  {selectedData.test?.lastError && <p className="builder-debug-error">{selectedData.test.lastError}</p>}
                </>
              )}
            </div>
          )}

          {activeTab === "validation" && (
            <div className="builder-debug-panel">
              {!selectedNode || !selectedData ? (
                <p className="builder-debug-empty">Select one node to inspect validation.</p>
              ) : (
                <>
                  <div className="builder-debug-meta">
                    <span>State</span>
                    <code>{selectedData.validation?.state ?? "idle"}</code>
                  </div>
                  <div className="builder-debug-meta">
                    <span>Type</span>
                    <code>{selectedData.validation?.type ?? "N/A"}</code>
                  </div>
                  <p>{selectedData.validation?.message ?? "Validation not run yet."}</p>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
