import { Flow } from '../components/Flow';
import { Graph } from '../core/Graph';
import type { NodeData, EdgeData } from '../types/types';

/**
 * Example: Infinite Canvas with Grid Background
 *
 * This example demonstrates Feature 1: Infinite Scroll for Grid
 * - Infinite repeating grid background
 * - Viewport-based node culling for performance
 * - Spatial optimization for large graphs
 * - Grid pattern follows canvas view setting (grid/dots)
 */

function generateLargeGraph(numNodes: number): { nodes: NodeData[]; edges: EdgeData[] } {
    const nodes: NodeData[] = [];
    const edges: EdgeData[] = [];

    // Generate nodes in a large area to demonstrate infinite canvas
    const gridCols = Math.ceil(Math.sqrt(numNodes));
    const spacing = 300; // Space between nodes

    for (let i = 0; i < numNodes; i++) {
        const col = i % gridCols;
        const row = Math.floor(i / gridCols);

        nodes.push({
            id: `node-${i}`,
            position: {
                x: col * spacing + 100,
                y: row * spacing + 100,
            },
            label: `Node ${i + 1}`,
            type: i % 3 === 0 ? 'custom' : 'default',
        });
    }

    // Generate some edges
    for (let i = 0; i < numNodes - 1; i++) {
        if (i % 2 === 0) {
            edges.push({
                id: `edge-${i}`,
                sourceNode: `node-${i}`,
                targetNode: `node-${i + 1}`,
                type: 'default',
            });
        }
    }

    return { nodes, edges };
}

export function InfiniteCanvasExample() {
    // Generate a large graph to demonstrate viewport culling
    const { nodes, edges } = generateLargeGraph(100);

    const graph = new Graph({
        nodes,
        edges,
        canvasView: 'grid', // Try 'dots' for dotted pattern
    });

    return (
        <div style={{ width: '100vw', height: '100vh' }}>
            <Flow
                graph={graph}
                // Feature 1: Infinite Grid Configuration
                showGrid={true}                    // Enable infinite grid background
                gridSize={20}                      // 20px grid size
                viewportCulling={true}             // Enable node culling (only render visible nodes)
                cullingPadding={300}               // Render 300px outside viewport for smooth scrolling
                enableSpatialOptimization={true}   // Use optimized culling for large graphs
            />

            {/* Info Panel */}
            <div style={{
                position: 'absolute',
                top: 20,
                left: 20,
                background: 'rgba(0, 0, 0, 0.8)',
                color: 'white',
                padding: '16px',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '12px',
                pointerEvents: 'none',
            }}>
                <h3 style={{ margin: '0 0 12px 0' }}>Infinite Canvas Demo</h3>
                <p style={{ margin: '4px 0' }}>Total Nodes: {nodes.length}</p>
                <p style={{ margin: '4px 0' }}>Grid Size: 20px</p>
                <p style={{ margin: '4px 0' }}>Viewport Culling: Enabled</p>
                <p style={{ margin: '4px 0' }}>Spatial Optimization: Enabled</p>
                <hr style={{ margin: '12px 0', borderColor: 'rgba(255,255,255,0.2)' }} />
                <p style={{ margin: '4px 0', fontSize: '10px', opacity: 0.7 }}>
                    Drag nodes around to see the infinite grid!
                </p>
                <p style={{ margin: '4px 0', fontSize: '10px', opacity: 0.7 }}>
                    Only visible nodes are rendered for performance.
                </p>
            </div>
        </div>
    );
}
