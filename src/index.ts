// FlowForge React - Main library entry point

// Components
export {
  FlowCanvas,
  Flow,
  Node,
  CustomNode,
  ExperimentalNode,
  NodeShell,
  Edge,
  AnimatedEdge,
  BreakableEdge,
  EdgesLayer,
  Port
} from './components';

// Hooks
export {
  useGraph,
  useStore,
  useViewport,
  useHotkeys,
  useNode,
  useEdgesForNode,
  useSelection,
  useConnectionPreview
} from './hooks';

// Providers
export {
  GraphContext,
  GraphProvider,
  ConnectionContext,
  ConnectionProvider,
  FlowContext,
  FlowProvider,
  ZoomContext,
  ZoomProvider,
  RegistryContext,
  RegistryProvider,
  useRegistry
} from './providers';

// Core
export {
  Graph,
  createStore,
  EventEmitter,
  createLiveEdge,
  updateLiveEdge,
  removeLiveEdge,
  makePath,
  clearPathCache,
  debounce,
  throttle,
  rafThrottle,
  defaultNodeTypes,
  defaultEdgeTypes,
  bezierEdgeRouter,
  smoothStepEdgeRouter
} from './core';

// Types
export type {
  Vec2,
  CanvasView,
  NodeType,
  EdgeType,
  NodeData,
  EdgeData,
  GraphState,
  NodeEventHandler,
  EdgeEventHandler,
  NodeMoveHandler,
  ConnectionHandler,
  GraphChangeHandler,
  Store,
  NodeRenderer,
  EdgeRenderer,
  EdgeRouter,
  EdgeRouterPreset,
  NodeTypesRegistry,
  EdgeTypesRegistry,
  ConnectionAttempt,
  ConnectionValidation,
  CanConnectFn,
  ConnectionEventPayloads,
  ConnectionEventHandlers,
  FlowProps
} from './types';

// export type { ConnectionType } from './providers';
export type { EdgeProps, AnimatedEdgeProps, BreakableEdgeProps } from './components';
