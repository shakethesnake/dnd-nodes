// components/ContextMenu.tsx
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import type { ContextMenuItem } from '../types/types';

export interface ContextMenuProps {
    items: ContextMenuItem[];
    position: { x: number; y: number };
    onClose: () => void;
}

// Inline fallback styles ensure the menu is usable even without external CSS
const menuFallback: React.CSSProperties = {
    zIndex: 9999,
    minWidth: 180,
    maxWidth: 260,
    background: 'var(--ff-panel, #161a2e)',
    border: '1px solid var(--ff-node-border, #2e355e)',
    borderRadius: 6,
    boxShadow: '0 4px 16px rgba(0,0,0,0.45), 0 1px 4px rgba(0,0,0,0.3)',
    padding: '4px 0',
    fontSize: 13,
    userSelect: 'none',
};

const itemFallback: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    color: 'var(--ff-text, #e8ecff)',
    cursor: 'pointer',
    borderRadius: 4,
    margin: '1px 4px',
};

const itemDisabledExtra: React.CSSProperties = {
    color: 'var(--ff-muted, #9aa3c7)',
    cursor: 'default',
    pointerEvents: 'none',
    opacity: 0.5,
};

const itemFocusedExtra: React.CSSProperties = {
    background: 'var(--ff-node-border, #2e355e)',
};

const iconFallback: React.CSSProperties = {
    fontSize: 14,
    width: 18,
    textAlign: 'center',
    flexShrink: 0,
};

const labelFallback: React.CSSProperties = {
    flex: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
};

const shortcutFallback: React.CSSProperties = {
    fontSize: 11,
    color: 'var(--ff-muted, #9aa3c7)',
    marginLeft: 'auto',
    flexShrink: 0,
};

const arrowFallback: React.CSSProperties = {
    fontSize: 9,
    color: 'var(--ff-muted, #9aa3c7)',
    marginLeft: 4,
    flexShrink: 0,
};

const separatorFallback: React.CSSProperties = {
    height: 1,
    background: 'var(--ff-node-border, #2e355e)',
    margin: '4px 8px',
};

const submenuFallback: React.CSSProperties = {
    position: 'absolute',
    left: '100%',
    top: -4,
    minWidth: 160,
    background: 'var(--ff-panel, #161a2e)',
    border: '1px solid var(--ff-node-border, #2e355e)',
    borderRadius: 6,
    boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
    padding: '4px 0',
    zIndex: 10000,
};

/**
 * Generic context menu rendered as a portal on document.body.
 *
 * Features:
 * - Viewport boundary clamping (menu never leaves the screen)
 * - Click-outside and Escape to close
 * - Arrow-key + Enter keyboard navigation
 * - Hover-activated sub-menus
 * - Separator dividers and disabled items
 */
export const ContextMenu: React.FC<ContextMenuProps> = ({ items, position, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    // Start offscreen so we can measure before the user sees the menu
    const [pos, setPos] = useState<{ x: number; y: number }>({ x: -9999, y: -9999 });
    const [ready, setReady] = useState(false);

    // Focused item index (among non-separator, non-disabled items)
    const [focusedIndex, setFocusedIndex] = useState(-1);

    // Which item's sub-menu is open (by item id)
    const [activeSubmenuId, setActiveSubmenuId] = useState<string | null>(null);

    // Navigable items (skip separators and disabled entries)
    const navigable = items.filter((i) => !i.separator && !i.disabled);

    // After the first render, measure and clamp to viewport
    useLayoutEffect(() => {
        const menu = menuRef.current;
        if (!menu) return;

        const rect = menu.getBoundingClientRect();
        const { innerWidth, innerHeight } = window;

        let x = position.x;
        let y = position.y;

        if (x + rect.width > innerWidth) x = innerWidth - rect.width - 8;
        if (y + rect.height > innerHeight) y = innerHeight - rect.height - 8;
        x = Math.max(8, x);
        y = Math.max(8, y);

        setPos({ x, y });
        setReady(true);
    }, []); // only once after mount

    // Close when clicking outside the menu
    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [onClose]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setFocusedIndex((prev) => (prev + 1 < navigable.length ? prev + 1 : 0));
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setFocusedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : navigable.length - 1));
                return;
            }
            if (e.key === 'Enter' && focusedIndex >= 0) {
                const item = navigable[focusedIndex];
                if (item?.onClick) {
                    item.onClick();
                    onClose();
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [navigable, focusedIndex, onClose]);

    const handleItemClick = useCallback(
        (item: ContextMenuItem) => {
            if (item.disabled || item.submenu) return;
            item.onClick?.();
            onClose();
        },
        [onClose],
    );

    const content = (
        <div
            ref={menuRef}
            className="context-menu"
            style={{
                ...menuFallback,
                position: 'fixed',
                left: pos.x,
                top: pos.y,
                visibility: ready ? 'visible' : 'hidden',
            }}
            // Prevent the canvas contextmenu handler from firing again
            onContextMenu={(e) => e.stopPropagation()}
        >
            {items.map((item, idx) => {
                if (item.separator) {
                    return <div key={`sep-${idx}`} className="context-menu-separator" style={separatorFallback} />;
                }

                const navIdx = navigable.indexOf(item);
                const isFocused = navIdx === focusedIndex;
                const hasSubmenu = Array.isArray(item.submenu) && item.submenu.length > 0;

                const itemStyle: React.CSSProperties = {
                    ...itemFallback,
                    ...(item.disabled ? itemDisabledExtra : {}),
                    ...(isFocused ? itemFocusedExtra : {}),
                };

                return (
                    <div
                        key={item.id}
                        className={[
                            'context-menu-item',
                            item.disabled ? 'context-menu-item-disabled' : '',
                            isFocused ? 'context-menu-item-focused' : '',
                            hasSubmenu ? 'context-menu-item-has-submenu' : '',
                        ]
                            .filter(Boolean)
                            .join(' ')}
                        style={itemStyle}
                        onMouseEnter={() => {
                            setFocusedIndex(navIdx);
                            setActiveSubmenuId(hasSubmenu ? item.id : null);
                        }}
                        onMouseLeave={() => {
                            if (!hasSubmenu) setActiveSubmenuId(null);
                        }}
                        onClick={() => handleItemClick(item)}
                    >
                        {item.icon && (
                            <span className="context-menu-item-icon" style={iconFallback}>{item.icon}</span>
                        )}
                        <span className="context-menu-item-label" style={labelFallback}>{item.label}</span>
                        {item.shortcut && (
                            <span className="context-menu-item-shortcut" style={shortcutFallback}>{item.shortcut}</span>
                        )}
                        {hasSubmenu && (
                            <span className="context-menu-item-arrow" style={arrowFallback}>&#9658;</span>
                        )}

                        {/* Sub-menu panel */}
                        {hasSubmenu && activeSubmenuId === item.id && (
                            <div className="context-submenu" style={submenuFallback}>
                                {item.submenu!.map((sub) => {
                                    const subStyle: React.CSSProperties = {
                                        ...itemFallback,
                                        ...(sub.disabled ? itemDisabledExtra : {}),
                                    };
                                    return (
                                        <div
                                            key={sub.id}
                                            className={[
                                                'context-menu-item',
                                                sub.disabled ? 'context-menu-item-disabled' : '',
                                            ]
                                                .filter(Boolean)
                                                .join(' ')}
                                            style={subStyle}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (sub.disabled) return;
                                                sub.onClick?.();
                                                onClose();
                                            }}
                                        >
                                            {sub.icon && (
                                                <span className="context-menu-item-icon" style={iconFallback}>{sub.icon}</span>
                                            )}
                                            <span className="context-menu-item-label" style={labelFallback}>{sub.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );

    return ReactDOM.createPortal(content, document.body);
};
