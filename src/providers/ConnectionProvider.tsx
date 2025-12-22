import React, { createContext } from "react";

export type ConnectionType = {
    from: string;
    to: string;
    label?: string;
}

export const ConnectionContext = createContext({
    connections: [],
    setConnections: (connections: ConnectionType[]) => { }
});

export const ConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [connections, setConnections] = React.useState<ConnectionType[]>([]);
    const value = { connections, setConnections };

    return <ConnectionContext.Provider value={value}>
        {children}
    </ConnectionContext.Provider>;
}