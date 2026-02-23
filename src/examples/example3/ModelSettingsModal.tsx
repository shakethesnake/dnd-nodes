import React, { useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';

export interface ModelSettings {
    temperature: number;
    maxTokens: number;
    topP: number;
}

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
    temperature: 0.7,
    maxTokens: 1024,
    topP: 0.9,
};

interface Props {
    isOpen: boolean;
    onClose: () => void;
    settings: ModelSettings;
    onSettingsChange: (settings: ModelSettings) => void;
    nodeLabel: string;
    accentColor: string;
}

export const ModelSettingsModal: React.FC<Props> = ({
    isOpen,
    onClose,
    settings,
    onSettingsChange,
    nodeLabel,
    accentColor,
}) => {
    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    const stopProp = useCallback((e: React.PointerEvent | React.MouseEvent) => {
        e.stopPropagation();
    }, []);

    if (!isOpen) return null;

    const update = (key: keyof ModelSettings, value: number) => {
        onSettingsChange({ ...settings, [key]: value });
    };

    const modal = (
        <div
            className="lf-modal-overlay"
            onPointerDown={(e) => {
                e.stopPropagation();
                if (e.target === e.currentTarget) onClose();
            }}
            onMouseDown={stopProp}
        >
            <div
                className="lf-modal"
                style={{ '--lf-accent': accentColor } as React.CSSProperties}
                onPointerDown={stopProp}
                onMouseDown={stopProp}
            >
                <div className="lf-modal-header">
                    <span className="lf-modal-title">{nodeLabel} — Settings</span>
                    <button className="lf-modal-close" onClick={onClose}>✕</button>
                </div>

                <div className="lf-modal-body">
                    {/* Temperature */}
                    <div className="lf-slider-group">
                        <div className="lf-slider-header">
                            <span className="lf-slider-label">Temperature</span>
                            <span className="lf-slider-value">{settings.temperature.toFixed(1)}</span>
                        </div>
                        <input
                            type="range"
                            className="lf-slider"
                            min={0}
                            max={2}
                            step={0.1}
                            value={settings.temperature}
                            onChange={(e) => update('temperature', parseFloat(e.target.value))}
                        />
                    </div>

                    {/* Max Tokens */}
                    <div className="lf-slider-group">
                        <div className="lf-slider-header">
                            <span className="lf-slider-label">Max Tokens</span>
                            <span className="lf-slider-value">{settings.maxTokens}</span>
                        </div>
                        <input
                            type="range"
                            className="lf-slider"
                            min={64}
                            max={4096}
                            step={64}
                            value={settings.maxTokens}
                            onChange={(e) => update('maxTokens', parseInt(e.target.value))}
                        />
                    </div>

                    {/* Top P */}
                    <div className="lf-slider-group">
                        <div className="lf-slider-header">
                            <span className="lf-slider-label">Top P</span>
                            <span className="lf-slider-value">{settings.topP.toFixed(2)}</span>
                        </div>
                        <input
                            type="range"
                            className="lf-slider"
                            min={0}
                            max={1}
                            step={0.05}
                            value={settings.topP}
                            onChange={(e) => update('topP', parseFloat(e.target.value))}
                        />
                    </div>
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modal, document.body);
};
