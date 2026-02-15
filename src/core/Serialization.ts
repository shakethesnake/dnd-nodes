// core/Serialization.ts
import type { GraphState, NodeData, EdgeData, SerializedGraph, ValidationResult, ValidationError } from "../types/types";

export const CURRENT_VERSION = 1;

/**
 * Serialize graph state to JSON-compatible format
 * Removes runtime data (DOM references, dragging state, etc.)
 */
export function serializeGraph(
  state: GraphState,
  metadata?: Record<string, unknown>
): SerializedGraph {
  return {
    version: CURRENT_VERSION,
    nodes: state.nodes.map(cleanNode),
    edges: state.edges.map(cleanEdge),
    metadata: {
      createdAt: new Date().toISOString(),
      ...metadata,
    },
  };
}

/**
 * Deserialize JSON data back to GraphState
 * Applies migrations if needed
 */
export function deserializeGraph(serialized: SerializedGraph): GraphState {
  const migrated = migrate(serialized);

  return {
    nodes: migrated.nodes,
    edges: migrated.edges,
    draggingId: null,
    selectedNodeId: null,
    selectedNodeIds: [],
    canvasView: 'grid',
  };
}

/**
 * Validate graph data structure
 * Returns validation result with detailed errors
 */
export function validateGraph(data: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data || typeof data !== 'object') {
    errors.push({ field: 'root', message: 'Data must be an object' });
    return { valid: false, errors };
  }

  const graph = data as Partial<SerializedGraph>;

  // Validate version
  if (typeof graph.version !== 'number') {
    errors.push({
      field: 'version',
      message: 'Version must be a number',
      value: graph.version
    });
  }

  // Validate nodes
  if (!Array.isArray(graph.nodes)) {
    errors.push({
      field: 'nodes',
      message: 'Nodes must be an array',
      value: typeof graph.nodes
    });
  } else {
    graph.nodes.forEach((node, i) => {
      if (!node.id || typeof node.id !== 'string') {
        errors.push({
          field: `nodes[${i}].id`,
          message: 'Node id is required and must be a string',
          value: node.id
        });
      }
      if (!node.position || typeof node.position !== 'object') {
        errors.push({
          field: `nodes[${i}].position`,
          message: 'Node position is required',
          value: node.position
        });
      } else {
        if (typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
          errors.push({
            field: `nodes[${i}].position`,
            message: 'Position must have numeric x and y properties',
            value: node.position
          });
        }
      }
    });
  }

  // Validate edges
  if (!Array.isArray(graph.edges)) {
    errors.push({
      field: 'edges',
      message: 'Edges must be an array',
      value: typeof graph.edges
    });
  } else {
    graph.edges.forEach((edge, i) => {
      if (!edge.id || typeof edge.id !== 'string') {
        errors.push({
          field: `edges[${i}].id`,
          message: 'Edge id is required and must be a string',
          value: edge.id
        });
      }
      if (!edge.sourceNode || typeof edge.sourceNode !== 'string') {
        errors.push({
          field: `edges[${i}].sourceNode`,
          message: 'sourceNode is required and must be a string',
          value: edge.sourceNode
        });
      }
      if (!edge.targetNode || typeof edge.targetNode !== 'string') {
        errors.push({
          field: `edges[${i}].targetNode`,
          message: 'targetNode is required and must be a string',
          value: edge.targetNode
        });
      }
    });
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/**
 * Apply version migrations to older graph data
 * Future: handle v1 -> v2 -> v3 upgrades
 */
function migrate(graph: SerializedGraph): SerializedGraph {
  let migrated = graph;

  // Example future migration:
  // if (migrated.version === 1) {
  //   migrated = migrateV1toV2(migrated);
  // }

  return migrated;
}

/**
 * Clean node data - remove runtime properties
 * Only keeps serializable data
 */
function cleanNode(node: NodeData): NodeData {
  const { id, position, label, type, data } = node;
  return {
    id,
    position,
    ...(label && { label }),
    ...(type && { type }),
    ...(data && { data }),
  };
}

/**
 * Clean edge data - remove runtime properties (sourcePort/targetPort coords)
 * Only keeps serializable data
 */
function cleanEdge(edge: EdgeData): EdgeData {
  const { id, sourceNode, targetNode, sourcePortId, targetPortId, label, type, data } = edge;
  return {
    id,
    sourceNode,
    targetNode,
    ...(sourcePortId && { sourcePortId }),
    ...(targetPortId && { targetPortId }),
    ...(label && { label }),
    ...(type && { type }),
    ...(data && { data }),
  };
}
