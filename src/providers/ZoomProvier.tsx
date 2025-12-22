import React, { createContext} from "react";

export const ZoomContext = createContext({ zoom: 1, setZoom: (zoom: number) => {} });

export const ZoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [zoom, setZoom] = React.useState(1);
    const value = { zoom, setZoom };
    return <ZoomContext.Provider value={value}>{children}</ZoomContext.Provider>;
}