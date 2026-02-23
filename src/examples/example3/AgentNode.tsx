import React, { useState, useCallback, useContext } from 'react';
import { NodeShell } from '../../components/NodeShell';
import { Port } from '../../components/Port';
import { ModelSettingsModal, DEFAULT_MODEL_SETTINGS } from './ModelSettingsModal';
import type { ModelSettings } from './ModelSettingsModal';
import type { NodeData } from '../../types/types';
import { AgentFlowContext } from './AgentFlowExample';

// ── Field definition ────────────────────────────────────────────────────

export interface FieldDef {
    key: string;
    label: string;
    type: 'text' | 'password' | 'select' | 'textarea';
    placeholder?: string;
    options?: string[];
    defaultValue?: string;
}

// ── Node data payload ───────────────────────────────────────────────────

export interface AgentNodeData {
    variant: 'llm' | 'prompt' | 'output';
    accentColor: string;
    icon: string;
    fields: FieldDef[];
    showRunButton?: boolean;
    status?: 'idle' | 'processing' | 'complete';
    outputText?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────

const stopProp = (e: React.PointerEvent | React.MouseEvent) => e.stopPropagation();

// ── Component ───────────────────────────────────────────────────────────

export const AgentNode: React.FC<NodeData> = ({ id, position, label, data }) => {
    const d = data as unknown as AgentNodeData | undefined;
    const variant = d?.variant ?? 'prompt';
    const accentColor = d?.accentColor ?? '#8b5cf6';
    const icon = d?.icon ?? '🤖';
    const fields = d?.fields ?? [];
    const showRunButton = d?.showRunButton ?? false;
    const status = d?.status ?? 'idle';
    const outputText = d?.outputText ?? '';

    const { onRun, running } = useContext(AgentFlowContext);

    // Local form state (visual only)
    const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
        const init: Record<string, string> = {};
        for (const f of fields) init[f.key] = f.defaultValue ?? '';
        return init;
    });

    const updateField = useCallback((key: string, value: string) => {
        setFieldValues((prev) => ({ ...prev, [key]: value }));
    }, []);

    // Settings modal
    const [showSettings, setShowSettings] = useState(false);
    const [modelSettings, setModelSettings] = useState<ModelSettings>(DEFAULT_MODEL_SETTINGS);

    // Status label
    const statusLabel =
        status === 'processing' ? 'Processing...'
            : status === 'complete' ? 'Done'
                : 'Idle';

    return (
        <>
            <NodeShell
                data={{ id, position, label, data }}
                style={{
                    position: 'absolute',
                    left: `${position.x}px`,
                    top: `${position.y}px`,
                    userSelect: 'none',
                    willChange: 'transform',
                }}
            >
                <div
                    className="lf-node"
                    style={{ '--lf-accent': accentColor } as React.CSSProperties}
                >
                    {/* ── Header ──────────────────────────────── */}
                    <div className="lf-node-header">
                        <span className="lf-node-icon">{icon}</span>
                        <span className="lf-node-title">{label ?? id}</span>
                        <button
                            className="lf-settings-btn"
                            title="Model settings"
                            onClick={() => setShowSettings(true)}
                            onPointerDown={stopProp}
                            onMouseDown={stopProp}
                        >
                            ⚙
                        </button>
                    </div>

                    {/* ── Body ────────────────────────────────── */}
                    <div className="lf-node-body">
                        {/* Form fields */}
                        {fields.map((f) => (
                            <div className="lf-field" key={f.key}>
                                <label className="lf-field-label">{f.label}</label>
                                {f.type === 'select' ? (
                                    <select
                                        className="lf-select"
                                        value={fieldValues[f.key] ?? ''}
                                        onChange={(e) => updateField(f.key, e.target.value)}
                                        onPointerDown={stopProp}
                                        onMouseDown={stopProp}
                                    >
                                        {f.options?.map((opt) => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                ) : f.type === 'textarea' ? (
                                    <textarea
                                        className="lf-textarea"
                                        rows={3}
                                        placeholder={f.placeholder}
                                        value={fieldValues[f.key] ?? ''}
                                        onChange={(e) => updateField(f.key, e.target.value)}
                                        onPointerDown={stopProp}
                                        onMouseDown={stopProp}
                                    />
                                ) : (
                                    <input
                                        className="lf-input"
                                        type={f.type}
                                        placeholder={f.placeholder}
                                        value={fieldValues[f.key] ?? ''}
                                        onChange={(e) => updateField(f.key, e.target.value)}
                                        onPointerDown={stopProp}
                                        onMouseDown={stopProp}
                                    />
                                )}
                            </div>
                        ))}

                        {/* Output area (output node only) */}
                        {variant === 'output' && (
                            <div className="lf-output-area">
                                {outputText || undefined}
                            </div>
                        )}

                        {/* Run button (first node only) */}
                        {showRunButton && (
                            <button
                                className="lf-run-btn"
                                disabled={running}
                                onClick={onRun}
                                onPointerDown={stopProp}
                                onMouseDown={stopProp}
                            >
                                {running ? '⏳  Running...' : '▶  Run Flow'}
                            </button>
                        )}
                    </div>

                    {/* ── Footer / Status ─────────────────────── */}
                    <div className="lf-node-footer">
                        <span className="lf-status-dot" data-status={status} />
                        <span className="lf-status-text">{statusLabel}</span>
                    </div>

                    {/* ── Ports ───────────────────────────────── */}
                    {variant !== 'llm' && (
                        <Port
                            type="input"
                            data={{ nodeId: id }}
                            style={{
                                position: 'absolute',
                                left: -8,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: 10,
                                height: 10,
                                background: '#7aa2ff',
                                borderRadius: '50%',
                                border: '2px solid #1a1a2e',
                            }}
                        />
                    )}
                    {variant !== 'output' && (
                        <Port
                            type="output"
                            data={{ nodeId: id }}
                            style={{
                                position: 'absolute',
                                right: -8,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: 10,
                                height: 10,
                                background: '#36d399',
                                borderRadius: '50%',
                                border: '2px solid #1a1a2e',
                            }}
                        />
                    )}
                </div>
            </NodeShell>

            {/* Settings modal (rendered via portal) */}
            <ModelSettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                settings={modelSettings}
                onSettingsChange={setModelSettings}
                nodeLabel={label ?? id}
                accentColor={accentColor}
            />
        </>
    );
};
