import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Flow } from '../components/Flow';
import { Graph } from '../core/Graph';
import type { NodeData, EdgeData } from '../types/types';

/**
 * DataPipelineExample — демонстрация FlowForge как фреймворка.
 *
 * Флоу из 5 нод:
 *   1. Data Input  — кнопка «Run Pipeline» запускает имитацию
 *   2. Validator    — проверка данных
 *   3. Transformer  — преобразование (параллельная ветка)
 *   4. Aggregator   — слияние двух веток
 *   5. Output       — вывод результата
 *
 * При запуске рёбра последовательно «загораются» анимацией,
 * имитируя асинхронный поток данных через граф.
 */

// ─── Nodes ──────────────────────────────────────────────────────────────────

const NODES: NodeData[] = [
    {
        id: 'input',
        position: { x: 80, y: 260 },
        label: 'Data Input',
        type: 'custom',
        data: { icon: '📥', color: 'purple', description: 'Source data entry point' },
    },
    {
        id: 'validator',
        position: { x: 400, y: 120 },
        label: 'Validator',
        type: 'custom',
        data: { icon: '✅', color: 'green', description: 'Schema & type validation' },
    },
    {
        id: 'transformer',
        position: { x: 400, y: 400 },
        label: 'Transformer',
        type: 'custom',
        data: { icon: '🔄', color: 'blue', description: 'Data normalization & mapping' },
    },
    {
        id: 'aggregator',
        position: { x: 740, y: 260 },
        label: 'Aggregator',
        type: 'custom',
        data: { icon: '🔀', color: 'blue', description: 'Merges validated & transformed streams' },
    },
    {
        id: 'output',
        position: { x: 1060, y: 260 },
        label: 'Output',
        type: 'custom',
        data: { icon: '📤', color: 'purple', description: 'Final result destination' },
    },
];

// ─── Edges (initially all static) ───────────────────────────────────────────

const EDGE_DEFS: { id: string; src: string; tgt: string; color: string }[] = [
    { id: 'e-input-validator',     src: 'input',       tgt: 'validator',    color: '#8b5cf6' },
    { id: 'e-input-transformer',   src: 'input',       tgt: 'transformer',  color: '#8b5cf6' },
    { id: 'e-validator-agg',       src: 'validator',    tgt: 'aggregator',   color: '#10b981' },
    { id: 'e-transformer-agg',     src: 'transformer',  tgt: 'aggregator',   color: '#3b82f6' },
    { id: 'e-agg-output',          src: 'aggregator',   tgt: 'output',       color: '#8b5cf6' },
];

function buildEdges(activeSet: Set<string>): EdgeData[] {
    return EDGE_DEFS.map(({ id, src, tgt, color }) => ({
        id,
        sourceNode: src,
        targetNode: tgt,
        type: 'default' as const,
        data: {
            animated: activeSet.has(id),
            animationSpeed: 0.8,
            animationStyle: 'dash',
            color: activeSet.has(id) ? color : '#555',
        },
    }));
}

// ─── Pipeline steps (which edges to light up at each stage) ─────────────────

const PIPELINE_STEPS: { edges: string[]; delay: number }[] = [
    { edges: ['e-input-validator', 'e-input-transformer'], delay: 1400 },   // fork
    { edges: ['e-validator-agg', 'e-transformer-agg'],     delay: 1800 },   // parallel processing
    { edges: ['e-agg-output'],                              delay: 1200 },   // aggregate & output
];

// ─── Component ──────────────────────────────────────────────────────────────

export const DataPipelineExample: React.FC = () => {
    const [running, setRunning] = useState(false);
    const [stepIdx, setStepIdx] = useState(-1);
    const [status, setStatus] = useState('Idle');
    const graphRef = useRef<Graph | null>(null);

    // Create graph once
    if (!graphRef.current) {
        graphRef.current = new Graph({
            nodes: NODES,
            edges: buildEdges(new Set()),
            canvasView: 'dots',
        });
    }
    const graph = graphRef.current;

    // Sync edges into graph when step changes
    useEffect(() => {
        const activeEdges = new Set<string>();
        if (stepIdx >= 0 && stepIdx < PIPELINE_STEPS.length) {
            for (const eid of PIPELINE_STEPS[stepIdx].edges) {
                activeEdges.add(eid);
            }
        }
        graph.setState((s) => ({ ...s, edges: buildEdges(activeEdges) }));
    }, [stepIdx, graph]);

    // Run pipeline
    const runPipeline = useCallback(async () => {
        if (running) return;
        setRunning(true);

        const labels = ['Forking data streams...', 'Processing in parallel...', 'Aggregating results...'];

        for (let i = 0; i < PIPELINE_STEPS.length; i++) {
            setStepIdx(i);
            setStatus(labels[i]);
            await new Promise((r) => setTimeout(r, PIPELINE_STEPS[i].delay));
        }

        setStatus('Pipeline complete!');
        setStepIdx(-1);

        // reset after a short pause
        await new Promise((r) => setTimeout(r, 1500));
        setStatus('Idle');
        setRunning(false);
    }, [running]);

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* HUD overlay */}
            <div style={{
                position: 'absolute',
                top: 16,
                left: 16,
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                pointerEvents: 'none',
            }}>
                <div style={{
                    background: 'rgba(15, 15, 25, 0.85)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: 12,
                    padding: '14px 20px',
                    color: '#e2e8f0',
                    fontSize: 13,
                    fontFamily: 'monospace',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    pointerEvents: 'auto',
                }}>
                    <button
                        onClick={runPipeline}
                        disabled={running}
                        style={{
                            padding: '8px 18px',
                            borderRadius: 8,
                            border: 'none',
                            background: running
                                ? 'rgba(100, 100, 140, 0.4)'
                                : 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: 13,
                            cursor: running ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        {running ? 'Running...' : '▶  Run Pipeline'}
                    </button>

                    <span style={{
                        color: status === 'Idle'
                            ? '#94a3b8'
                            : status === 'Pipeline complete!'
                                ? '#34d399'
                                : '#c4b5fd',
                        transition: 'color 0.3s',
                    }}>
                        {status}
                    </span>
                </div>
            </div>

            <Flow
                graph={graph}
                showGrid={true}
                gridSize={20}
                viewportCulling={false}
            />
        </div>
    );
};
