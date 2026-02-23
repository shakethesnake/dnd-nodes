// providers/ContextMenuProvider.tsx
import React, { createContext, useCallback, useState } from 'react';
import { ContextMenu } from '../components/ContextMenu';
import type { ContextMenuItem } from '../types/types';

// ─── Public API ──────────────────────────────────────────────────────────────

export interface ShowMenuParams {
    /** Viewport-space position where the menu should appear (e.g. from e.clientX/Y) */
    position: { x: number; y: number };
    /** Menu items to render */
    items: ContextMenuItem[];
}

export interface ContextMenuContextValue {
    /** Show a context menu at the given position */
    showMenu: (params: ShowMenuParams) => void;
    /** Hide the currently visible menu */
    hideMenu: () => void;
    /** Whether a menu is currently visible */
    isVisible: boolean;
}

// ─── Context ─────────────────────────────────────────────────────────────────

export const ContextMenuContext = createContext<ContextMenuContextValue>({
    showMenu: () => {},
    hideMenu: () => {},
    isVisible: false,
});

// ─── Provider ────────────────────────────────────────────────────────────────

/**
 * Provides a singleton context-menu overlay for the whole Flow tree.
 * Only one menu can be visible at a time.
 *
 * Usage:
 *   const { showMenu } = useContext(ContextMenuContext);
 *   showMenu({ position: { x: e.clientX, y: e.clientY }, items: [...] });
 */
export const ContextMenuProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<ShowMenuParams | null>(null);

    const showMenu = useCallback((params: ShowMenuParams) => {
        setState(params);
    }, []);

    const hideMenu = useCallback(() => {
        setState(null);
    }, []);

    return (
        <ContextMenuContext.Provider value={{ showMenu, hideMenu, isVisible: state !== null }}>
            {children}
            {state && (
                <ContextMenu
                    position={state.position}
                    items={state.items}
                    onClose={hideMenu}
                />
            )}
        </ContextMenuContext.Provider>
    );
};
