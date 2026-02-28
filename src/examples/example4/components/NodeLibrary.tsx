import { useMemo, useState } from "react";
import type { NodeTemplate, BuilderNodeKind } from "../types";

interface NodeLibraryProps {
  templates: NodeTemplate[];
  onAddNode: (kind: BuilderNodeKind) => void;
}

export function NodeLibrary({ templates, onAddNode }: NodeLibraryProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return templates;
    return templates.filter((template) => {
      return (
        template.label.toLowerCase().includes(normalized)
        || template.description.toLowerCase().includes(normalized)
        || template.kind.toLowerCase().includes(normalized)
      );
    });
  }, [query, templates]);

  return (
    <aside className="builder-library">
      <div className="builder-panel-header">
        <h2>Node Library</h2>
        <p>Click to add a node or press A / Space</p>
      </div>

      <input
        className="builder-search"
        placeholder="Search nodes..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="builder-library-list">
        {filtered.length === 0 ? (
          <div className="builder-empty-state">
            <p>No nodes found.</p>
            <p>Try another search query.</p>
          </div>
        ) : (
          filtered.map((template) => (
            <button
              key={template.kind}
              className="builder-library-item"
              onClick={() => onAddNode(template.kind)}
              type="button"
            >
              <span className="builder-library-item-title">{template.label}</span>
              <span className="builder-library-item-description">{template.description}</span>
              <span className="builder-library-item-group">{template.group}</span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
