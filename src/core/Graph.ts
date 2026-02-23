// core/Graph.ts
import type { GraphState, Vec2, SerializedGraph, ValidationResult, Store, EdgeRouter, EdgeData } from "../types/types";
import { createStore } from "./createStore";
import { makePath } from "./LiveEdge";
import { serializeGraph, deserializeGraph, validateGraph } from "./Serialization";
import { History, type HistoryConfig } from "./History";
import { EdgePathRegistry } from "./EdgePathRegistry";
import { RouteCache } from "./RouteCache";

type LayerName = "edgeLayer" | "nodeLayer" | string;

/**
 * Configuration options for Graph constructor
 */
export interface GraphConfig {
  /** Initial graph state (only used if externalStore is not provided) */
  initialState?: Partial<GraphState>;
  /** External store for controlled mode */
  externalStore?: Store<GraphState>;
  /** History configuration (or false to disable) */
  history?: HistoryConfig | false;
}

export class Graph {
    private store: Store<GraphState>;
    private frameId: number | null = null;
    private history: History | null = null;
    private isControlled: boolean;
    private edgeRouter: EdgeRouter = (source, target) => makePath(source, target);
    private snapToGrid = false;
    private gridSize = 20;
    private viewportTransform = { x: 0, y: 0, zoom: 1 };

    // регистры DOM-узлов (div.node) и edge-элементов (SVGPathElement)
    nodeRegistry = new Map<string, HTMLElement>();
    edgeRegistry = new Map<string, SVGPathElement>();

    // P2: Централизованный реестр path-элементов (вместо querySelectorAll)
    readonly pathRegistry = new EdgePathRegistry();

    // P3: LRU-кеш вычисленных SVG path-строк
    readonly routeCache = new RouteCache({ maxSize: 2000, precision: 0.5 });

    // P1: Предыдущий набор edgeId — для отслеживания структурных изменений
    private _prevEdgeIds: string[] = [];

    // слои и корневой контейнер Canvas
    private layers = new Map<LayerName, Element>();
    private rootEl: HTMLElement | null = null;

    constructor(config?: GraphConfig | Partial<GraphState>) {
        // Support both old API (Partial<GraphState>) and new API (GraphConfig)
        // This maintains backward compatibility
        const isOldAPI = config && ('nodes' in config || 'edges' in config || 'draggingId' in config);

        if (isOldAPI) {
            // Old API: constructor(initialState)
            this.store = createStore<GraphState>({
                nodes: [],
                edges: [],
                draggingId: null,
                selectedNodeId: null,
                selectedNodeIds: [],
                selectedEdgeId: null,
                selectedEdgeIds: [],
                canvasView: 'grid',
            });
            this.store.setState(config as Partial<GraphState>);
            this.isControlled = false;

            // Enable history by default for backward compatibility
            this.history = new History();
            this.history.push(this.getState(), 'Initial state');
        } else {
            // New API: constructor(config)
            const graphConfig = config as GraphConfig | undefined;

            // Use external store if provided (controlled mode)
            if (graphConfig?.externalStore) {
                this.store = graphConfig.externalStore;
                this.isControlled = true;
            } else {
                // Create internal store (uncontrolled mode)
                this.store = createStore<GraphState>({
                    nodes: [],
                    edges: [],
                    draggingId: null,
                    selectedNodeId: null,
                    selectedNodeIds: [],
                    selectedEdgeId: null,
                    selectedEdgeIds: [],
                    canvasView: 'grid',
                });
                this.isControlled = false;

                if (graphConfig?.initialState) {
                    this.store.setState(graphConfig.initialState);
                }
            }

            // Initialize history (enabled by default unless explicitly disabled)
            // Note: History is typically disabled in controlled mode
            if (graphConfig?.history !== false) {
                this.history = new History(
                    typeof graphConfig?.history === 'object' ? graphConfig.history : {}
                );
                this.history.push(this.getState(), 'Initial state');
            }
        }
    }

    /**
     * Create a Graph instance in controlled mode with external store
     * Convenience method for controlled mode setup
     * @param store - External store to use
     * @returns Graph instance using external store
     */
    static createControlled(store: Store<GraphState>): Graph {
        return new Graph({ externalStore: store, history: false });
    }

    /**
     * Check if Graph is in controlled mode
     * @returns true if using external store, false if internal
     */
    isControlledMode(): boolean {
        return this.isControlled;
    }

    /** === API совместимый с твоим кодом === */
    getState = () => this.store.getState();

    setState = (updater: Parameters<typeof this.store.setState>[0]) => {
        const prevState = this.getState();
        this.store.setState(updater);
        const nextState = this.getState();

        // Auto-track changes in history
        if (this.history && prevState !== nextState) {
            this.history.push(nextState);
        }
    };

    getStore = () => this.store;
    batch = <R>(fn: () => R): R => this.store.batch(fn);

    addLayer = (name: LayerName, layer: Element | null) => {
        if (!layer) return;
        this.layers.set(name, layer);
        if (!this.rootEl) {
            const flowRoot = layer.closest<HTMLElement>("[data-flow-root]");
            this.rootEl = flowRoot || layer.parentElement;
        }
    };
    getLayer = (name: LayerName) => this.layers.get(name);

    /** регистрируем path для обратной совместимости */
    registerEdge = (id: string, el: SVGPathElement) => {
        this.edgeRegistry.set(id, el);
    };

    /** Set active edge router used by drag updates */
    setEdgeRouter = (router: EdgeRouter) => {
        this.edgeRouter = router;
    };

    /** Configure snap-to-grid behavior for node dragging */
    setSnapConfig = (snapToGrid: boolean, gridSize = 20) => {
        this.snapToGrid = snapToGrid;
        this.gridSize = Math.max(1, gridSize);
    };

    /** Snap a canvas-space point to the configured grid */
    snapPosition = (position: Vec2): Vec2 => {
        if (!this.snapToGrid) return position;
        return {
            x: Math.round(position.x / this.gridSize) * this.gridSize,
            y: Math.round(position.y / this.gridSize) * this.gridSize,
        };
    };

    /**
     * Set the current viewport transform for coordinate conversion
     * This is needed to correctly convert screen coordinates to canvas coordinates
     * when zoom/pan is applied
     */
    setViewportTransform = (x: number, y: number, zoom: number) => {
        this.viewportTransform = { x, y, zoom };
    };

    /**
     * Returns the center coordinates of a specific port in canvas space
     * @param nodeId - ID of the node containing the port
     * @param portId - ID of the specific port (defaults to "out"/"in")
     * @param portType - Type of port ("input" or "output")
     * @returns Port position in canvas coordinates (accounts for zoom/pan transform)
     */
    private getNodePortCanvas(nodeId: string, portId: string = 'out', portType: 'input' | 'output' = 'output'): Vec2 | null {
        const nodeEl = this.nodeRegistry.get(nodeId);
        if (!nodeEl) return null;

        // Try to find port by portId first
        const portSelector = `.port.${portType}[data-port-id="${portId}"]`;
        let portEl = nodeEl.querySelector<HTMLElement>(portSelector);

        // Fallback to generic port if specific portId not found
        if (!portEl) {
            portEl = nodeEl.querySelector<HTMLElement>(`.port.${portType}`);
        }

        if (!portEl) return null;

        // Get screen position and convert to canvas coordinates
        const rect = portEl.getBoundingClientRect();
        const screenPos = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        return this.toCanvasSpace(screenPos);
    }

    /**
     * Legacy method: Returns center of default input/output ports in canvas space
     * @deprecated Use getNodePortCanvas() for multi-port support
     */
    private getNodePortsCanvas(nodeId: string) {
        return {
            outputPort: this.getNodePortCanvas(nodeId, 'out', 'output'),
            inputPort: this.getNodePortCanvas(nodeId, 'in', 'input'),
        };
    }

    /** Для edgeId находит текущие координаты портов-узлов в canvas space */
    getRelatedEdgePorts = (edgeId: string) => {
        const edge = this.getState().edges.find(e => e.id === edgeId);
        if (!edge) return null;

        const sourcePortId = edge.sourcePortId || 'out';
        const targetPortId = edge.targetPortId || 'in';

        const sourceOutputPort =
            this.getNodePortCanvas(edge.sourceNode, sourcePortId, 'output')
            || this.getNodePortCanvas(edge.sourceNode, 'out', 'output');

        const targetInputPort =
            this.getNodePortCanvas(edge.targetNode, targetPortId, 'input')
            || this.getNodePortCanvas(edge.targetNode, 'in', 'input');

        return {
            sourceNodePort: {
                ...this.getNodePortsCanvas(edge.sourceNode),
                outputPort: sourceOutputPort,
            },
            targetNodePort: {
                ...this.getNodePortsCanvas(edge.targetNode),
                inputPort: targetInputPort,
            },
        };
    };

    /**
     * P1+P2+P3: Оптимизированное обновление edge paths при drag ноды.
     *
     * P1 (Incremental): Обновляет только edges, связанные с данной нодой
     *     через индекс nodeId→edgeIds (вместо фильтрации всего массива edges).
     * P2 (Registry): Получает SVGPathElement из pathRegistry за O(1)
     *     (вместо querySelectorAll на каждый edge).
     * P3 (Cache): Проверяет routeCache перед вызовом router.
     *     При snap-to-grid или стационарном конце edge → cache hit.
     */
    updateEdgesForNode = (nodeId: string) => {
        if (this.frameId) cancelAnimationFrame(this.frameId);
        this.frameId = requestAnimationFrame(() => {
            const { edges } = this.getState();

            // P1: Получаем только edgeId, связанные с этой нодой, через индекс
            const dirtyEdgeIds = this.pathRegistry.getEdgeIdsForNode(nodeId);
            if (dirtyEdgeIds.size === 0) {
                // Fallback: если индекс ещё не построен, фильтруем вручную
                const related = edges.filter(e => e.sourceNode === nodeId || e.targetNode === nodeId);
                for (const e of related) {
                    this._updateSingleEdge(e);
                }
                return;
            }

            // Обновляем только грязные edges
            for (const edgeId of dirtyEdgeIds) {
                const edge = edges.find(e => e.id === edgeId);
                if (!edge) continue;
                this._updateSingleEdge(edge);
            }
        });
    };

    /**
     * Обновляет path-атрибуты для одного edge.
     * Использует pathRegistry (P2) и routeCache (P3).
     */
    private _updateSingleEdge(e: EdgeData): void {
        const sourcePortId = e.sourcePortId || 'out';
        const targetPortId = e.targetPortId || 'in';

        const s = this.getNodePortCanvas(e.sourceNode, sourcePortId, 'output');
        const t = this.getNodePortCanvas(e.targetNode, targetPortId, 'input');
        if (!s || !t) return;

        // P3: Пробуем получить path из кеша
        let pathStr = this.routeCache.get(s, t, e as EdgeData);
        if (pathStr === undefined) {
            // Cache miss — вычисляем и сохраняем
            pathStr = this.edgeRouter(s, t, e as EdgeData);
            this.routeCache.set(s, t, pathStr, e as EdgeData);
        }

        // P2: Получаем path-элементы из реестра (O(1))
        const pathEls = this.pathRegistry.getPathElements(e.id);
        if (pathEls.length > 0) {
            for (const pathEl of pathEls) {
                pathEl.setAttribute("d", pathStr);
            }
        } else {
            // Fallback: querySelectorAll (для случая когда реестр ещё не заполнен)
            const svg = this.getLayer("edgeLayer") as SVGSVGElement;
            if (!svg) return;
            const fallbackEls = svg.querySelectorAll<SVGPathElement>(`path[data-edge-id="${e.id}"]`);
            fallbackEls.forEach((pathEl) => {
                pathEl.setAttribute("d", pathStr!);
            });
        }
    }

    /**
     * P1: Обновляет nodeToEdge индекс при структурных изменениях.
     * Вызывается из EdgeLayer при изменении массива edges.
     */
    rebuildEdgeIndex = () => {
        const { edges } = this.getState();
        const currentIds = edges.map(e => e.id);

        // Пропускаем если структура не изменилась
        if (currentIds.length === this._prevEdgeIds.length &&
            currentIds.every((id, i) => id === this._prevEdgeIds[i])) {
            return;
        }

        this._prevEdgeIds = currentIds;
        this.pathRegistry.rebuildNodeIndex(edges);
        // P3: Инвалидируем кеш при структурных изменениях
        this.routeCache.clear();
    };

    /**
     * Convert screen coordinates to canvas coordinates
     * Accounts for container offset AND viewport transform (zoom/pan)
     *
     * Math explanation for transform: translate(-x, -y) scale(zoom)
     * CSS transforms are applied right-to-left: first scale, then translate
     * - A canvas point (cx, cy) transforms to screen: (cx * zoom - x, cy * zoom - y)
     * - To invert: given screen position (sx, sy), canvas is: ((sx + x) / zoom, (sy + y) / zoom)
     */
    toCanvasSpace = (p: Vec2): Vec2 => {
        if (!this.rootEl) return p;
        const r = this.rootEl.getBoundingClientRect();

        // Convert to container-relative coordinates
        const relX = p.x - r.left;
        const relY = p.y - r.top;

        // Apply inverse transform to get canvas coordinates
        const { x, y, zoom } = this.viewportTransform;
        return {
            x: (relX + x) / zoom,
            y: (relY + y) / zoom,
        };
    };

    /** === History API (Undo/Redo) === */

    /**
     * Undo last action
     * @returns true if undo was successful, false if nothing to undo
     */
    undo(): boolean {
        if (!this.history) return false;

        const prevState = this.history.undo(this.getState());
        if (prevState) {
            // Use store.setState directly to avoid history tracking
            this.store.setState(prevState);
            return true;
        }
        return false;
    }

    /**
     * Redo previously undone action
     * @returns true if redo was successful, false if nothing to redo
     */
    redo(): boolean {
        if (!this.history) return false;

        const nextState = this.history.redo(this.getState());
        if (nextState) {
            // Use store.setState directly to avoid history tracking
            this.store.setState(nextState);
            return true;
        }
        return false;
    }

    /**
     * Check if undo is available
     */
    canUndo(): boolean {
        return this.history?.canUndo() ?? false;
    }

    /**
     * Check if redo is available
     */
    canRedo(): boolean {
        return this.history?.canRedo() ?? false;
    }

    /**
     * Clear all history
     */
    clearHistory(): void {
        this.history?.clear();
    }

    /**
     * Manually push current state to history
     * Useful for marking logical action boundaries
     * @param label - Optional description of the action
     * @param force - Force new snapshot even if within merge interval
     */
    pushHistory(label?: string, force = false): void {
        this.history?.push(this.getState(), label, force);
    }

    /**
     * Get history info for debugging
     */
    getHistoryInfo() {
        return this.history?.getInfo() ?? null;
    }

    /** === Serialization API === */

    /**
     * Serialize graph to JSON format for persistence
     * @param metadata - Optional metadata to include (author, description, etc.)
     * @returns Serialized graph with version and metadata
     */
    toJSON(metadata?: Record<string, unknown>): SerializedGraph {
        return serializeGraph(this.getState(), metadata);
    }

    /**
     * Create a new Graph instance from serialized JSON data
     * @param json - Serialized graph data
     * @returns New Graph instance with the deserialized state
     * @throws Error if validation fails
     */
    static fromJSON(json: SerializedGraph): Graph {
        const validation = validateGraph(json);
        if (!validation.valid) {
            const errorMessages = validation.errors
                .map(e => `  ${e.field}: ${e.message}`)
                .join('\n');
            throw new Error(`Invalid graph data:\n${errorMessages}`);
        }

        const state = deserializeGraph(json);
        return new Graph(state);
    }

    /**
     * Load graph state from serialized JSON data
     * Updates current graph instead of creating new instance
     * @param json - Serialized graph data
     * @throws Error if validation fails
     */
    loadJSON(json: SerializedGraph): void {
        const validation = validateGraph(json);
        if (!validation.valid) {
            const errorMessages = validation.errors
                .map(e => `  ${e.field}: ${e.message}`)
                .join('\n');
            throw new Error(`Invalid graph data:\n${errorMessages}`);
        }

        const state = deserializeGraph(json);
        this.setState(state);
    }

    /**
     * Validate serialized graph data without deserializing
     * @param json - Data to validate
     * @returns Validation result with detailed errors if invalid
     */
    static validate(json: unknown): ValidationResult {
        return validateGraph(json);
    }
}

