import { describe, it, expect, beforeEach } from 'vitest';
import { Graph } from './Graph';

describe('Graph', () => {
  let graph: Graph;

  beforeEach(() => {
    graph = new Graph();
  });

  describe('initialization', () => {
    it('should create with default state', () => {
      const state = graph.getState();
      expect(state.nodes).toEqual([]);
      expect(state.edges).toEqual([]);
      expect(state.draggingId).toBeNull();
      expect(state.canvasView).toBe('grid');
    });

    it('should accept initial state', () => {
      const initialNodes = [{ id: 'node1', position: { x: 0, y: 0 } }];
      const customGraph = new Graph({ nodes: initialNodes });
      expect(customGraph.getState().nodes).toEqual(initialNodes);
    });
  });

  describe('state management', () => {
    it('should update state with partial object', () => {
      graph.setState({ canvasView: 'dots' });
      expect(graph.getState().canvasView).toBe('dots');
    });

    it('should update state with function updater', () => {
      graph.setState({ nodes: [{ id: 'node1', position: { x: 0, y: 0 } }] });
      graph.setState((s) => ({
        ...s,
        nodes: [...s.nodes, { id: 'node2', position: { x: 100, y: 100 } }],
      }));
      expect(graph.getState().nodes).toHaveLength(2);
    });

    it('should track dragging state', () => {
      graph.setState({ draggingId: 'node1' });
      expect(graph.getState().draggingId).toBe('node1');

      graph.setState({ draggingId: null });
      expect(graph.getState().draggingId).toBeNull();
    });
  });

  describe('node registry', () => {
    it('should register and retrieve nodes', () => {
      const mockElement = document.createElement('div');
      graph.nodeRegistry.set('node1', mockElement);
      expect(graph.nodeRegistry.get('node1')).toBe(mockElement);
    });

    it('should delete nodes from registry', () => {
      const mockElement = document.createElement('div');
      graph.nodeRegistry.set('node1', mockElement);
      graph.nodeRegistry.delete('node1');
      expect(graph.nodeRegistry.get('node1')).toBeUndefined();
    });
  });

  describe('edge registry', () => {
    it('should register edges', () => {
      const mockPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      graph.registerEdge('edge1', mockPath);
      expect(graph.edgeRegistry.get('edge1')).toBe(mockPath);
    });
  });

  describe('layer management', () => {
    it('should add and retrieve layers', () => {
      const mockLayer = document.createElement('div');
      graph.addLayer('testLayer', mockLayer);
      expect(graph.getLayer('testLayer')).toBe(mockLayer);
    });

    it('should handle null layer gracefully', () => {
      graph.addLayer('nullLayer', null);
      expect(graph.getLayer('nullLayer')).toBeUndefined();
    });
  });

  describe('coordinate transformation', () => {
    it('should return original point when no root element', () => {
      const point = { x: 100, y: 200 };
      const result = graph.toCanvasSpace(point);
      expect(result).toEqual(point);
    });
  });

  describe('getRelatedEdgePorts', () => {
    it('should return null for non-existent edge', () => {
      const result = graph.getRelatedEdgePorts('nonexistent');
      expect(result).toBeNull();
    });

    it('should return port information for existing edge', () => {
      graph.setState({
        edges: [
          {
            id: 'edge1',
            sourceNode: 'node1',
            targetNode: 'node2',
          },
        ],
      });

      const result = graph.getRelatedEdgePorts('edge1');
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('sourceNodePort');
      expect(result).toHaveProperty('targetNodePort');
    });
  });

  describe('store API', () => {
    it('should expose store via getStore()', () => {
      const store = graph.getStore();
      expect(store).toHaveProperty('getState');
      expect(store).toHaveProperty('setState');
      expect(store).toHaveProperty('subscribe');
      expect(store).toHaveProperty('getSnapshot');
    });
  });
});
