/**
 * Flow Graph Analysis — Pure Functions
 *
 * Adjacency map construction, cycle detection (DFS),
 * topological sort (Kahn's with parallel levels),
 * and condition-branch edge filtering.
 *
 * Zero side effects — operates on plain node/edge arrays.
 */

import type { FlowNodeData, FlowEdgeData, BuilderNodeKind } from "./flowTypes";

// ── Adjacency helpers ────────────────────────────────────────────────

export interface AdjacencyInfo {
  /** nodeId → outgoing edges */
  outgoing: Map<string, FlowEdgeData[]>;
  /** nodeId → incoming edges */
  incoming: Map<string, FlowEdgeData[]>;
  /** nodeId → node data */
  nodeMap: Map<string, FlowNodeData>;
}

export function buildAdjacency(
  nodes: FlowNodeData[],
  edges: FlowEdgeData[],
): AdjacencyInfo {
  const nodeMap = new Map<string, FlowNodeData>();
  const outgoing = new Map<string, FlowEdgeData[]>();
  const incoming = new Map<string, FlowEdgeData[]>();

  for (const node of nodes) {
    nodeMap.set(node.id, node);
    outgoing.set(node.id, []);
    incoming.set(node.id, []);
  }

  for (const edge of edges) {
    if (nodeMap.has(edge.sourceNode) && nodeMap.has(edge.targetNode)) {
      outgoing.get(edge.sourceNode)!.push(edge);
      incoming.get(edge.targetNode)!.push(edge);
    }
  }

  return { outgoing, incoming, nodeMap };
}

// ── Cycle detection (DFS white/gray/black) ───────────────────────────

/**
 * Returns the cycle path as an array of node IDs, or null if the graph is a DAG.
 */
export function detectCycle(adj: AdjacencyInfo): string[] | null {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;

  const color = new Map<string, number>();
  const parent = new Map<string, string | null>();

  for (const id of adj.nodeMap.keys()) {
    color.set(id, WHITE);
  }

  for (const startId of adj.nodeMap.keys()) {
    if (color.get(startId) !== WHITE) continue;

    // Iterative DFS
    const stack: Array<{ id: string; childIndex: number }> = [
      { id: startId, childIndex: 0 },
    ];
    color.set(startId, GRAY);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const outEdges = adj.outgoing.get(frame.id) ?? [];

      if (frame.childIndex < outEdges.length) {
        const targetId = outEdges[frame.childIndex].targetNode;
        frame.childIndex++;

        const targetColor = color.get(targetId);

        if (targetColor === GRAY) {
          // Found a back edge → reconstruct cycle
          const cycle: string[] = [targetId];
          for (let i = stack.length - 1; i >= 0; i--) {
            cycle.push(stack[i].id);
            if (stack[i].id === targetId) break;
          }
          return cycle.reverse();
        }

        if (targetColor === WHITE) {
          color.set(targetId, GRAY);
          parent.set(targetId, frame.id);
          stack.push({ id: targetId, childIndex: 0 });
        }
      } else {
        color.set(frame.id, BLACK);
        stack.pop();
      }
    }
  }

  return null;
}

// ── Topological sort with parallel levels (Kahn's) ──────────────────

export interface TopologicalLevels {
  /** Each element is a group of nodeIds that can execute concurrently */
  levels: string[][];
  /** Flat ordered list of all executable nodeIds */
  sorted: string[];
}

function getNodeKind(node: FlowNodeData): BuilderNodeKind {
  return (node.data?.kind as BuilderNodeKind) ?? "agent";
}

/**
 * Kahn's algorithm producing execution levels.
 * Nodes whose kind is in `skipKinds` are excluded from the result.
 */
export function topologicalSort(
  adj: AdjacencyInfo,
  skipKinds: ReadonlySet<string> = new Set(["note"]),
): TopologicalLevels {
  // Build in-degree map, excluding skip-kind nodes
  const inDegree = new Map<string, number>();

  for (const [id, node] of adj.nodeMap) {
    if (skipKinds.has(getNodeKind(node))) continue;

    const incomingEdges = (adj.incoming.get(id) ?? []).filter((edge) => {
      const srcNode = adj.nodeMap.get(edge.sourceNode);
      return srcNode != null && !skipKinds.has(getNodeKind(srcNode));
    });

    inDegree.set(id, incomingEdges.length);
  }

  const levels: string[][] = [];
  const sorted: string[] = [];

  // Seed: all nodes with in-degree 0
  let currentLevel = [...inDegree.entries()]
    .filter(([, deg]) => deg === 0)
    .map(([id]) => id);

  while (currentLevel.length > 0) {
    levels.push(currentLevel);
    sorted.push(...currentLevel);

    const nextLevel: string[] = [];

    for (const id of currentLevel) {
      for (const edge of adj.outgoing.get(id) ?? []) {
        const targetId = edge.targetNode;
        if (!inDegree.has(targetId)) continue;

        const newDeg = (inDegree.get(targetId) ?? 1) - 1;
        inDegree.set(targetId, newDeg);

        if (newDeg === 0) {
          nextLevel.push(targetId);
        }
      }
    }

    currentLevel = nextLevel;
  }

  return { levels, sorted };
}

// ── Condition branching edge filter ──────────────────────────────────

/**
 * Given a condition node's output and its outgoing edges,
 * return only the edges that should be followed.
 *
 * Convention:
 * - Edges with sourcePortId="true"  → truthy branch
 * - Edges with sourcePortId="false" → falsy branch
 * - Edges with no sourcePortId      → follow regardless (backward compat)
 *
 * If no edges are port-tagged, all edges are returned (legacy behavior).
 */
export function filterConditionEdges(
  outEdges: FlowEdgeData[],
  conditionResult: { ok: boolean },
): FlowEdgeData[] {
  const hasTaggedEdges = outEdges.some(
    (e) => e.sourcePortId === "true" || e.sourcePortId === "false",
  );

  if (!hasTaggedEdges) {
    // No port-tagged edges: follow all (legacy / non-branching condition)
    return outEdges;
  }

  const branch = conditionResult.ok ? "true" : "false";

  return outEdges.filter(
    (e) =>
      e.sourcePortId === branch ||
      (e.sourcePortId !== "true" && e.sourcePortId !== "false"),
  );
}
