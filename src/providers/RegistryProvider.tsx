// providers/RegistryProvider.tsx
import React, { createContext, useContext } from "react";
import type { NodeTypesRegistry, EdgeTypesRegistry } from "../types/types";
import { defaultNodeTypes, defaultEdgeTypes } from "../core/defaultRegistries";

interface RegistryContextType {
  nodeTypes: NodeTypesRegistry;
  edgeTypes: EdgeTypesRegistry;
}

export const RegistryContext = createContext<RegistryContextType>({
  nodeTypes: defaultNodeTypes,
  edgeTypes: defaultEdgeTypes,
});

interface RegistryProviderProps {
  children: React.ReactNode;
  nodeTypes?: NodeTypesRegistry;
  edgeTypes?: EdgeTypesRegistry;
}

/**
 * Registry Provider
 * Provides node and edge type registries to the component tree
 * Allows users to customize or extend the default node/edge renderers
 */
export const RegistryProvider: React.FC<RegistryProviderProps> = ({
  children,
  nodeTypes,
  edgeTypes,
}) => {
  // Merge user-provided types with defaults
  const mergedNodeTypes = nodeTypes
    ? { ...defaultNodeTypes, ...nodeTypes }
    : defaultNodeTypes;

  const mergedEdgeTypes = edgeTypes
    ? { ...defaultEdgeTypes, ...edgeTypes }
    : defaultEdgeTypes;

  const value = {
    nodeTypes: mergedNodeTypes,
    edgeTypes: mergedEdgeTypes,
  };

  return <RegistryContext.Provider value={value}>{children}</RegistryContext.Provider>;
};

/**
 * Hook to access the registry context
 * @returns Registry context with nodeTypes and edgeTypes
 */
export const useRegistry = (): RegistryContextType => {
  const context = useContext(RegistryContext);
  if (!context) {
    throw new Error("useRegistry() must be used within a <RegistryProvider>");
  }
  return context;
};
