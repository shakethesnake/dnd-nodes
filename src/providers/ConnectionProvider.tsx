import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import type {
    EdgeData,
    ConnectionAttempt,
    ConnectionEventHandlers,
    CanConnectFn,
} from "../types/types";

interface ConnectionContextValue {
    /** Current active connection attempt, or null if not connecting */
    currentConnection: ConnectionAttempt | null;
    /** Start a new connection from a port */
    startConnection: (attempt: ConnectionAttempt) => void;
    /** Update cursor position during connection */
    updateConnection: (position: { x: number; y: number }) => void;
    /** Complete connection to a target port */
    completeConnection: (params: {
        targetNodeId: string;
        targetPortId?: string;
        targetPortType: 'input' | 'output';
        edge: EdgeData;
    }) => boolean;
    /** Cancel current connection */
    cancelConnection: (reason?: string) => void;
    /** Validate if a connection is allowed */
    canConnect: CanConnectFn;
}

export const ConnectionContext = createContext<ConnectionContextValue | null>(null);

interface ConnectionProviderProps {
    children: React.ReactNode;
    /** Callback to validate connection attempts */
    canConnect?: CanConnectFn;
    /** Connection lifecycle event handlers */
    eventHandlers?: ConnectionEventHandlers;
}

/**
 * Default connection validation - allows output->input connections,
 * prevents self-connections, and prevents input->input or output->output
 */
const defaultCanConnect: CanConnectFn = ({
    sourceNodeId,
    targetNodeId,
    sourcePortType,
    targetPortType,
}) => {
    // Prevent self-connection
    if (sourceNodeId === targetNodeId) {
        return { allowed: false, reason: 'Cannot connect node to itself' };
    }

    // Only allow output->input connections
    if (sourcePortType === 'output' && targetPortType === 'input') {
        return { allowed: true };
    }

    return {
        allowed: false,
        reason: `Invalid connection: ${sourcePortType} → ${targetPortType}`,
    };
};

export const ConnectionProvider: React.FC<ConnectionProviderProps> = ({
    children,
    canConnect = defaultCanConnect,
    eventHandlers = {},
}) => {
    const [currentConnection, setCurrentConnection] = useState<ConnectionAttempt | null>(null);

    const startConnection = useCallback(
        (attempt: ConnectionAttempt) => {
            setCurrentConnection(attempt);
            eventHandlers.onConnectStart?.({
                sourceNodeId: attempt.sourceNodeId,
                sourcePortId: attempt.sourcePortId,
                sourcePortType: attempt.sourcePortType,
                sourcePosition: attempt.sourcePosition,
            });
        },
        [eventHandlers]
    );

    const updateConnection = useCallback(
        (position: { x: number; y: number }) => {
            if (!currentConnection) return;

            setCurrentConnection((prev) =>
                prev ? { ...prev, currentPosition: position } : null
            );

            eventHandlers.onConnectMove?.({
                sourceNodeId: currentConnection.sourceNodeId,
                sourcePortId: currentConnection.sourcePortId,
                currentPosition: position,
            });
        },
        [currentConnection, eventHandlers]
    );

    const completeConnection = useCallback(
        (params: {
            targetNodeId: string;
            targetPortId?: string;
            targetPortType: 'input' | 'output';
            edge: EdgeData;
        }): boolean => {
            if (!currentConnection) return false;

            const validation = canConnect({
                sourceNodeId: currentConnection.sourceNodeId,
                sourcePortId: currentConnection.sourcePortId,
                targetNodeId: params.targetNodeId,
                targetPortId: params.targetPortId,
                sourcePortType: currentConnection.sourcePortType,
                targetPortType: params.targetPortType,
            });

            if (!validation.allowed) {
                cancelConnection(validation.reason);
                return false;
            }

            // Connection is valid - notify success
            eventHandlers.onConnect?.({
                sourceNodeId: currentConnection.sourceNodeId,
                sourcePortId: currentConnection.sourcePortId,
                targetNodeId: params.targetNodeId,
                targetPortId: params.targetPortId,
                edge: params.edge,
            });

            eventHandlers.onConnectEnd?.({
                sourceNodeId: currentConnection.sourceNodeId,
                sourcePortId: currentConnection.sourcePortId,
            });

            setCurrentConnection(null);
            return true;
        },
        [currentConnection, canConnect, eventHandlers]
    );

    const cancelConnection = useCallback(
        (reason?: string) => {
            if (!currentConnection) return;

            eventHandlers.onConnectCancel?.({
                sourceNodeId: currentConnection.sourceNodeId,
                sourcePortId: currentConnection.sourcePortId,
                reason,
            });

            eventHandlers.onConnectEnd?.({
                sourceNodeId: currentConnection.sourceNodeId,
                sourcePortId: currentConnection.sourcePortId,
            });

            setCurrentConnection(null);
        },
        [currentConnection, eventHandlers]
    );

    const value = useMemo<ConnectionContextValue>(
        () => ({
            currentConnection,
            startConnection,
            updateConnection,
            completeConnection,
            cancelConnection,
            canConnect,
        }),
        [
            currentConnection,
            startConnection,
            updateConnection,
            completeConnection,
            cancelConnection,
            canConnect,
        ]
    );

    return (
        <ConnectionContext.Provider value={value}>
            {children}
        </ConnectionContext.Provider>
    );
};

/**
 * Hook to access connection state and actions
 */
export const useConnection = () => {
    const context = useContext(ConnectionContext);
    if (!context) {
        throw new Error('useConnection must be used within ConnectionProvider');
    }
    return context;
};
