import { useCallback, useContext } from "react";
import { useGraph } from "./useGraph";
import { ZoomContext } from "../providers/ZoomProvider";
import { Graph } from "../core/Graph";
import type { SerializedGraph } from "../types/types";

export interface FlowIOActions {
  /** Export the current graph state as a SerializedGraph object */
  exportToJSON: () => SerializedGraph;
  /** Import graph state from a SerializedGraph object */
  importFromJSON: (json: SerializedGraph) => void;
  /** Download the current graph state as a .json file */
  exportToFile: (filename?: string) => void;
  /** Open a file picker dialog and import the selected .json file */
  importFromFile: () => Promise<void>;
}

/**
 * Hook providing import/export capabilities for the flow graph.
 * Must be used within a <Flow> component tree.
 *
 * @example
 * ```tsx
 * function Toolbar() {
 *   const { exportToJSON, importFromJSON, exportToFile, importFromFile } = useFlowIO();
 *
 *   return (
 *     <>
 *       <button onClick={() => exportToFile('my-flow.json')}>Save</button>
 *       <button onClick={() => importFromFile()}>Load</button>
 *     </>
 *   );
 * }
 * ```
 */
export function useFlowIO(): FlowIOActions {
  const graph = useGraph();
  const { x, y, zoom, panTo, setZoom } = useContext(ZoomContext);

  const exportToJSON = useCallback((): SerializedGraph => {
    // Ensure current viewport is captured in graph state before serializing
    graph.setViewportTransform(x, y, zoom);
    return graph.toJSON();
  }, [graph, x, y, zoom]);

  const importFromJSON = useCallback(
    (json: SerializedGraph): void => {
      const validation = Graph.validate(json);
      if (!validation.valid) {
        throw new Error(
          `Invalid graph data: ${validation.errors.map((e) => e.message).join(", ")}`
        );
      }

      graph.loadJSON(json);

      // Restore viewport if present in the imported data
      if (json.viewport) {
        panTo(json.viewport.x, json.viewport.y);
        setZoom(json.viewport.zoom);
      }
    },
    [graph, panTo, setZoom]
  );

  const exportToFile = useCallback(
    (filename?: string): void => {
      const data = exportToJSON();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename ?? "flowforge-graph.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [exportToJSON]
  );

  const importFromFile = useCallback((): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json";

      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
          resolve();
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          try {
            const json = JSON.parse(reader.result as string);
            importFromJSON(json);
            resolve();
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
      };

      // Handle cancel (user closes file dialog without selecting)
      input.oncancel = () => resolve();

      input.click();
    });
  }, [importFromJSON]);

  return { exportToJSON, importFromJSON, exportToFile, importFromFile };
}
