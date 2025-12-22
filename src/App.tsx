import './App.css'
import { Flow } from './components/Flow'
import { Graph } from './core/Graph';
import type { NodeData, EdgeData } from './types/types';

/**
 * Example demonstrating custom nodes and edges in FlowForge
 *
 * This demo showcases:
 * 1. Default nodes (standard gray nodes)
 * 2. Custom nodes (colorful gradient nodes with icons)
 * 3. Default edges (dashed gray lines)
 * 4. Animated edges (flowing particles with glow)
 * 5. Breakable edges (clickable edges that can be deleted)
 */

// Legacy utility for generating random nodes and edges (not used in main demo)
type Node = { id: string; position: { x: number; y: number }; label: string };
type Edge = { id: string; sourceNode: string; targetNode: string };

function generateRandomGraph(numNodes: number): { nodes: Node[]; edges: Edge[] } {
    // Generate nodes
    const nodes: Node[] = Array.from({ length: numNodes }, (_, i) => ({
        id: `node-${i}`,
        position: {
            x: Math.floor(Math.random() * document.body.clientWidth),
            y: Math.floor(Math.random() * document.body.clientHeight),
        },
        label: `Node ${i + 1}`,
    }));

    // Generate edges: connect nodes randomly, but only from output to input (no self-loops, no duplicate edges)
    const edges: Edge[] = [];
    const nodeIds = nodes.map(n => n.id);

    // Each node can be a source, and connect to a random other node as target
    for (let sourceIdx = 0; sourceIdx < numNodes; sourceIdx++) {
        // Randomly decide how many outgoing edges for this node (0 to numNodes-1)
        // const numConnections = Math.floor(Math.random() * (numNodes - 5)) + 1;
        const numConnections = 2;
        const targets = new Set<number>();

        while (targets.size < numConnections) {
            const targetIdx = Math.floor(Math.random() * numNodes);
            if (targetIdx !== sourceIdx && !targets.has(targetIdx)) {
                targets.add(targetIdx);
            }
        }

        for (const targetIdx of targets) {
            // Prevent duplicate edges
            if (!edges.some(e => e.sourceNode === nodeIds[sourceIdx] && e.targetNode === nodeIds[targetIdx])) {
                edges.push({
                    id: `edge-${edges.length}`,
                    sourceNode: nodeIds[sourceIdx], // output port
                    targetNode: nodeIds[targetIdx], // input port
                });
            }
        }
    }

    return { nodes, edges };
}

function createExampleGraph(): { nodes: NodeData[]; edges: EdgeData[] } {
    // Create a mix of default and custom nodes
    const nodes: NodeData[] = [
        // Custom nodes with different colors and icons
        {
            id: 'start',
            position: { x: 100, y: 100 },
            label: 'Start Process',
            type: 'custom',
            data: {
                icon: '🚀',
                color: 'purple',
                description: 'Initiates the workflow'
            }
        },
        {
            id: 'process-1',
            position: { x: 400, y: 100 },
            label: 'Data Transform',
            type: 'custom',
            data: {
                icon: '⚙️',
                color: 'blue',
                description: 'Transforms input data'
            }
        },
        {
            id: 'process-2',
            position: { x: 700, y: 100 },
            label: 'Validation',
            type: 'custom',
            data: {
                icon: '✓',
                color: 'green',
                description: 'Validates the output'
            }
        },
        {
            id: 'end',
            position: { x: 1000, y: 100 },
            label: 'Complete',
            type: 'custom',
            data: {
                icon: '🎯',
                color: 'purple',
                description: 'Workflow completed'
            }
        },

        // Default nodes for comparison
        {
            id: 'default-1',
            position: { x: 100, y: 300 },
            label: 'Default Node A',
            type: 'default'
        },
        {
            id: 'default-2',
            position: { x: 400, y: 300 },
            label: 'Default Node B',
            type: 'default'
        },
        {
            id: 'default-3',
            position: { x: 700, y: 300 },
            label: 'Default Node C',
            type: 'default'
        },

        // Additional custom nodes with different variations
        {
            id: 'error-handler',
            position: { x: 400, y: 500 },
            label: 'Error Handler',
            type: 'custom',
            data: {
                icon: '⚠️',
                color: 'red',
                description: 'Handles errors and exceptions'
            }
        },

        // Experimental nodes with external ports
        {
            id: 'exp-1',
            position: { x: 100, y: 700 },
            label: 'Data Input',
            type: 'experimental',
            data: {
                icon: '📥',
                subtitle: 'Source',
                variant: 'primary'
            }
        },
        {
            id: 'exp-2',
            position: { x: 400, y: 700 },
            label: 'Processing',
            type: 'experimental',
            data: {
                icon: '⚡',
                subtitle: 'Transform',
                variant: 'success'
            }
        },
        {
            id: 'exp-3',
            position: { x: 700, y: 700 },
            label: 'Analytics',
            type: 'experimental',
            data: {
                icon: '📊',
                subtitle: 'Analyze',
                variant: 'warning'
            }
        },
        {
            id: 'exp-4',
            position: { x: 1000, y: 700 },
            label: 'Output',
            type: 'experimental',
            data: {
                icon: '📤',
                subtitle: 'Destination',
                variant: 'danger'
            }
        },
    ];

    // Create edges with different types
    const edges: EdgeData[] = [
        // Animated edges (flowing particles) - connecting custom nodes
        {
            id: 'edge-1',
            sourceNode: 'start',
            targetNode: 'process-1',
            type: 'animated',
            data: {
                color: '#667eea',
                speed: 2
            }
        },
        {
            id: 'edge-2',
            sourceNode: 'process-1',
            targetNode: 'process-2',
            type: 'animated',
            data: {
                color: '#3b82f6',
                speed: 1.5
            }
        },
        {
            id: 'edge-3',
            sourceNode: 'process-2',
            targetNode: 'end',
            type: 'animated',
            data: {
                color: '#10b981',
                speed: 2.5
            }
        },

        // // Breakable edges (click to delete) - connecting default nodes
        {
            id: 'edge-4',
            sourceNode: 'default-1',
            targetNode: 'default-2',
            // type: 'breakable',
            type: 'default',
            label: 'Click to delete'
        },
        {
            id: 'edge-5',
            sourceNode: 'default-2',
            targetNode: 'default-3',
            type: 'default',
            // type: 'breakable',
            label: 'Click to delete'
        },

        // Default edges (standard dashed lines)
        {
            id: 'edge-6',
            sourceNode: 'process-1',
            targetNode: 'error-handler',
            type: 'default',
            label: 'Error path'
        },
        {
            id: 'edge-7',
            sourceNode: 'error-handler',
            targetNode: 'start',
            type: 'default',
            label: 'Retry'
        },

        // Mix: animated edge from default to custom node
        {
            id: 'edge-8',
            sourceNode: 'default-3',
            targetNode: 'end',
            type: 'animated',
            data: {
                color: '#ec4899',
                speed: 1
            }
        },

        // Experimental nodes connections - showing clean edge routing with external ports
        {
            id: 'edge-exp-1',
            sourceNode: 'exp-1',
            targetNode: 'exp-2',
            type: 'animated',
            data: {
                color: '#4f46e5',
                speed: 2
            }
        },
        {
            id: 'edge-exp-2',
            sourceNode: 'exp-2',
            targetNode: 'exp-3',
            type: 'animated',
            data: {
                color: '#10b981',
                speed: 1.5
            }
        },
        {
            id: 'edge-exp-3',
            sourceNode: 'exp-3',
            targetNode: 'exp-4',
            type: 'animated',
            data: {
                color: '#f59e0b',
                speed: 1.8
            }
        },
    ];

    return { nodes, edges };
}

/**
 * Usage example:
 *
 * Canvas View Options:
 * - canvasView: 'grid' - Shows a grid pattern background (default)
 * - canvasView: 'dots' - Shows a dotted pattern background
 */
export function App() {
    // Use the example graph with custom nodes and edges
    const { nodes, edges } = createExampleGraph();
    // const { nodes, edges } = generateRandomGraph(2   5);

    const graph = new Graph({
        nodes,
        edges,
        canvasView: 'grid', // Change to 'dots' for dotted background
    });

    return (
        <>
            <Flow graph={graph} />
        </>
    )
}
