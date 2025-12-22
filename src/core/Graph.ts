// core/Graph.ts
import type { GraphState, Vec2 } from "../types/types";
import { createStore } from "./createStore";
import { makePath } from "./LiveEdge";

type LayerName = "edgeLayer" | "nodeLayer" | string;

export class Graph {
    private store = createStore<GraphState>({ nodes: [], edges: [], draggingId: null, canvasView: 'grid' });
    private frameId: number | null = null;

    // регистры DOM-узлов (div.node) и edge-элементов (SVGPathElement)
    nodeRegistry = new Map<string, HTMLElement>();
    edgeRegistry = new Map<string, SVGPathElement>();

    // слои и корневой контейнер Canvas
    private layers = new Map<LayerName, Element>();
    private rootEl: HTMLElement | null = null;

    constructor(initial?: Partial<GraphState>) {
        if (initial) this.store.setState(initial);
    }

    /** === API совместимый с твоим кодом === */
    getState = () => this.store.getState();
    setState = (updater: Parameters<typeof this.store.setState>[0]) => this.store.setState(updater);
    getStore = () => this.store;

    addLayer = (name: LayerName, layer: Element | null) => {
        if (!layer) return;
        this.layers.set(name, layer);
        if (!this.rootEl && layer instanceof HTMLElement) {
            // пытаемся найти общий root (родитель SVG/Canvas контейнера)
            this.rootEl = layer.closest<HTMLElement>("[data-flow-root]") || layer.parentElement as HTMLElement;
        }
    };
    getLayer = (name: LayerName) => this.layers.get(name);

    /** регистрируем path для обратной совместимости */
    registerEdge = (id: string, el: SVGPathElement) => {
        this.edgeRegistry.set(id, el);
    };

    /** Возвращает центр input/output портов узла в координатах экрана */
    private getNodePortsScreen(nodeId: string) {
        const nodeEl = this.nodeRegistry.get(nodeId);
        if (!nodeEl) return { inputPort: null, outputPort: null };

        const out = nodeEl.querySelector<HTMLElement>(".port.output")?.getBoundingClientRect();
        const inp = nodeEl.querySelector<HTMLElement>(".port.input")?.getBoundingClientRect();

        const toCenter = (r: DOMRect | undefined | null): Vec2 | null =>
            r ? ({ x: r.left + r.width / 2, y: r.top + r.height / 2 }) : null;

        return {
            outputPort: toCenter(out),
            inputPort: toCenter(inp),
        };
    }

    /** Для edgeId находит текущие координаты портов-узлов */
    getRelatedEdgePorts = (edgeId: string) => {
        const edge = this.getState().edges.find(e => e.id === edgeId);
        if (!edge) return null;
        
        return {
            sourceNodePort: this.getNodePortsScreen(edge.sourceNode),
            targetNodePort: this.getNodePortsScreen(edge.targetNode),
        };
    };

    /** Троттлим массовое обновление рёбер узла при перетаскивании */
    updateEdgesForNode = (nodeId: string) => {
        if (this.frameId) cancelAnimationFrame(this.frameId);
        this.frameId = requestAnimationFrame(() => {
            const { edges } = this.getState();
            const related = edges.filter(e => e.sourceNode === nodeId || e.targetNode === nodeId);

            const svg = this.getLayer("edgeLayer") as SVGSVGElement;
            if (!svg) return;

            for (const e of related) {
                const ports = this.getRelatedEdgePorts(e.id);
                if (!ports) continue;

                const s = ports.sourceNodePort?.outputPort;
                const t = ports.targetNodePort?.inputPort;
                if (!s || !t) continue;

                // Update ALL path elements for this edge (edges can have multiple paths)
                const pathEls = svg.querySelectorAll<SVGPathElement>(`path[data-edge-id="${e.id}"]`);
                pathEls.forEach((pathEl) => {
                    pathEl.setAttribute("d", makePath(s, t));
                });
            }
        });
    };

    /** Утилита: преобразует экранные координаты в координаты Canvas (относительные) */
    toCanvasSpace = (p: Vec2): Vec2 => {
        if (!this.rootEl) return p;
        const r = this.rootEl.getBoundingClientRect();
        return { x: p.x - r.left, y: p.y - r.top };
    };
}
