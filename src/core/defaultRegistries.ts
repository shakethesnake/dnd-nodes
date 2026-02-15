// core/defaultRegistries.ts
import { Node } from '../components/Node';
import { CustomNode } from '../components/CustomNode';
import { ExperimentalNode } from '../components/ExperimentalNode';
import { Edge } from '../components/Edge';
import { AnimatedEdge } from '../components/AnimatedEdge';
import { BreakableEdge } from '../components/BreakableEdge';
import type { NodeTypesRegistry, EdgeTypesRegistry } from '../types/types';

/**
 * Default node types registry
 * Maps built-in node type strings to their renderer components
 */
export const defaultNodeTypes: NodeTypesRegistry = {
  default: Node,
  custom: CustomNode,
  experimental: ExperimentalNode,
};

/**
 * Default edge types registry
 * Maps built-in edge type strings to their renderer components
 */
export const defaultEdgeTypes: EdgeTypesRegistry = {
  default: Edge,
  animated: AnimatedEdge,
  breakable: BreakableEdge,
};
