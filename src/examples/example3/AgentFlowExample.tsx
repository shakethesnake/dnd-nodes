import React, { useState, useCallback, useRef } from 'react';
import { Flow } from '../../components/Flow';
import { Graph } from '../../core/Graph';
import { AgentNode } from './AgentNode';
import type { AgentNodeData, FieldDef } from './AgentNode';
import type { NodeData, EdgeData } from '../../types/types';
import './agent-flow.css';

// ── Context for Run action ──────────────────────────────────────────────

export const AgentFlowContext = React.createContext<{
    onRun?: () => void;
    running: boolean;
}>({ running: false });

// ── Node definitions ────────────────────────────────────────────────────

const NODES: NodeData[] = [
    {
        id: 'llm-provider',
        position: { x: 60, y: 180 },
        label: 'LLM Provider',
        type: 'agent',
        data: {
            variant: 'llm',
            accentColor: '#8b5cf6',
            icon: '🧠',
            showRunButton: true,
            status: 'idle',
            fields: [
                { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-...' },
                { key: 'model', label: 'Model', type: 'select', options: ['gpt-4o', 'gpt-4o-mini', 'claude-sonnet-4-20250514', 'claude-opus-4-20250514'], defaultValue: 'gpt-4o' },
            ] as FieldDef[],
        } satisfies AgentNodeData,
    },
    {
        id: 'prompt-agent',
        position: { x: 460, y: 140 },
        label: 'Prompt Agent',
        type: 'agent',
        data: {
            variant: 'prompt',
            accentColor: '#3b82f6',
            icon: '💬',
            status: 'idle',
            fields: [
                { key: 'systemPrompt', label: 'System Prompt', type: 'textarea', placeholder: 'You are a helpful assistant...' },
                { key: 'userPrompt', label: 'User Prompt', type: 'text', placeholder: 'Analyze the latest metrics...' },
            ] as FieldDef[],
        } satisfies AgentNodeData,
    },
    {
        id: 'output',
        position: { x: 860, y: 180 },
        label: 'Output',
        type: 'agent',
        data: {
            variant: 'output',
            accentColor: '#10b981',
            icon: '📄',
            status: 'idle',
            outputText: '',
            fields: [],
        } satisfies AgentNodeData,
    },
];

// ── Edge definitions ────────────────────────────────────────────────────

const EDGE_DEFS = [
    { id: 'e-llm-prompt', src: 'llm-provider', tgt: 'prompt-agent', color: '#8b5cf6' },
    { id: 'e-prompt-output', src: 'prompt-agent', tgt: 'output', color: '#3b82f6' },
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
            color: activeSet.has(id) ? color : '#444',
        },
    }));
}

// ── Pipeline steps ──────────────────────────────────────────────────────

const SIMULATED_OUTPUT =
    'Based on the analysis, the data indicates a 23% improvement in response accuracy ' +
    'when using the optimized prompt template. Key findings:\n\n' +
    '• Latency reduced by 140ms on average\n' +
    '• Token usage decreased by 18%\n' +
    '• User satisfaction score: 4.7/5.0\n\n' +
    'Recommendation: deploy to production with A/B testing enabled.';

// ── Helper: update a single node's data ─────────────────────────────────

function updateNodeData(
    graph: Graph,
    nodeId: string,
    patch: Partial<AgentNodeData>,
) {
    graph.setState((s) => ({
        ...s,
        nodes: s.nodes.map((n) =>
            n.id === nodeId
                ? { ...n, data: { ...(n.data as Record<string, unknown>), ...patch } }
                : n,
        ),
    }));
}

// ── Helper: sleep ───────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── Component ───────────────────────────────────────────────────────────

export const AgentFlowExample: React.FC = () => {
    const [running, setRunning] = useState(false);
    const [status, setStatus] = useState('Ready');

    const graphRef = useRef<Graph | null>(null);
    if (!graphRef.current) {
        graphRef.current = new Graph({
            nodes: NODES,
            edges: buildEdges(new Set()),
            canvasView: 'dots',
        });
    }
    const graph = graphRef.current;

    // ── Run pipeline ────────────────────────────────────────────────────

    const runPipeline = useCallback(async () => {
        if (running) return;
        setRunning(true);

        // Reset all nodes
        updateNodeData(graph, 'llm-provider', { status: 'idle' });
        updateNodeData(graph, 'prompt-agent', { status: 'idle' });
        updateNodeData(graph, 'output', { status: 'idle', outputText: '' });

        // Step 1: LLM Provider → Prompt Agent
        setStatus('Authenticating & sending to Prompt Agent...');
        updateNodeData(graph, 'llm-provider', { status: 'processing' });
        graph.setState((s) => ({ ...s, edges: buildEdges(new Set(['e-llm-prompt'])) }));
        await sleep(2000);
        updateNodeData(graph, 'llm-provider', { status: 'complete' });

        // Step 2: Prompt Agent → Output
        setStatus('Generating response...');
        updateNodeData(graph, 'prompt-agent', { status: 'processing' });
        graph.setState((s) => ({ ...s, edges: buildEdges(new Set(['e-prompt-output'])) }));
        await sleep(1800);
        updateNodeData(graph, 'prompt-agent', { status: 'complete' });

        // Step 3: Stream output text
        setStatus('Streaming output...');
        updateNodeData(graph, 'output', { status: 'processing' });
        graph.setState((s) => ({ ...s, edges: buildEdges(new Set()) }));

        // Simulate streaming character by character (in chunks for perf)
        const chunkSize = 3;
        for (let i = 0; i <= SIMULATED_OUTPUT.length; i += chunkSize) {
            updateNodeData(graph, 'output', {
                outputText: SIMULATED_OUTPUT.slice(0, i),
            });
            await sleep(25);
        }
        updateNodeData(graph, 'output', { outputText: SIMULATED_OUTPUT, status: 'complete' });

        setStatus('Pipeline complete!');
        await sleep(3000);

        // Reset
        setStatus('Ready');
        updateNodeData(graph, 'llm-provider', { status: 'idle' });
        updateNodeData(graph, 'prompt-agent', { status: 'idle' });
        updateNodeData(graph, 'output', { status: 'idle', outputText: '' });
        graph.setState((s) => ({ ...s, edges: buildEdges(new Set()) }));
        setRunning(false);
    }, [running, graph]);

    return (
        <AgentFlowContext.Provider value={{ onRun: runPipeline, running }}>
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                {/* HUD */}
                <div className="lf-hud">
                    <div className="lf-hud-panel">
                        <span style={{
                            color: status === 'Ready' ? '#94a3b8'
                                : status === 'Pipeline complete!' ? '#34d399'
                                    : '#c4b5fd',
                            transition: 'color 0.3s',
                        }}>
                            {status}
                        </span>
                    </div>
                </div>

                <Flow
                    graph={graph}
                    nodeTypes={{ agent: AgentNode }}
                    showGrid={true}
                    gridSize={20}
                    viewportCulling={false}
                />
            </div>
        </AgentFlowContext.Provider>
    );
};
