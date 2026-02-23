// core/EdgePathRegistry.ts
// P2: Map<edgeId, SVGPathElement[]> вместо querySelectorAll
// P1: Dirty set для incremental edge updates

/**
 * EdgePathRegistry — централизованный реестр SVG path-элементов для каждого edge.
 *
 * Зачем:
 * - Устраняет дорогие querySelectorAll на каждый кадр при drag (P2).
 * - Позволяет быстро находить path по edgeId за O(1) вместо DOM-поиска.
 * - Хранит обратную связь nodeId → Set<edgeId> для dirty-set оптимизации (P1).
 *
 * Жизненный цикл:
 * - mount edge → registerPath(edgeId, pathEl)
 * - unmount edge → unregisterPath(edgeId, pathEl)
 * - структурные изменения → rebuildNodeIndex(edges)
 */
export class EdgePathRegistry {
    /** edgeId → все SVGPathElement, принадлежащие этому edge */
    private paths = new Map<string, Set<SVGPathElement>>();

    /** nodeId → множество edgeId, связанных с этой нодой (source или target) */
    private nodeToEdges = new Map<string, Set<string>>();

    // ──── Path registration (P2) ────

    /**
     * Регистрирует SVG path элемент для данного edge.
     * Вызывается при mount каждого path[data-edge-id].
     */
    registerPath(edgeId: string, pathEl: SVGPathElement): void {
        let set = this.paths.get(edgeId);
        if (!set) {
            set = new Set();
            this.paths.set(edgeId, set);
        }
        set.add(pathEl);
    }

    /**
     * Удаляет SVG path элемент из реестра.
     * Вызывается при unmount edge-компонента.
     */
    unregisterPath(edgeId: string, pathEl: SVGPathElement): void {
        const set = this.paths.get(edgeId);
        if (!set) return;
        set.delete(pathEl);
        if (set.size === 0) {
            this.paths.delete(edgeId);
        }
    }

    /**
     * Удаляет все path для данного edge.
     */
    unregisterAllPaths(edgeId: string): void {
        this.paths.delete(edgeId);
    }

    /**
     * Возвращает все зарегистрированные path-элементы для edge.
     * O(1) вместо querySelectorAll.
     */
    getPathElements(edgeId: string): SVGPathElement[] {
        const set = this.paths.get(edgeId);
        return set ? Array.from(set) : [];
    }

    // ──── Node→Edge index (P1: dirty set) ────

    /**
     * Перестраивает индекс nodeId → edgeIds.
     * Вызывается при структурных изменениях графа (добавление/удаление edges).
     */
    rebuildNodeIndex(edges: ReadonlyArray<{ id: string; sourceNode: string; targetNode: string }>): void {
        this.nodeToEdges.clear();
        for (const e of edges) {
            this._addEdgeToNode(e.sourceNode, e.id);
            this._addEdgeToNode(e.targetNode, e.id);
        }
    }

    private _addEdgeToNode(nodeId: string, edgeId: string): void {
        let set = this.nodeToEdges.get(nodeId);
        if (!set) {
            set = new Set();
            this.nodeToEdges.set(nodeId, set);
        }
        set.add(edgeId);
    }

    /**
     * Возвращает Set edgeId, связанных с данной нодой.
     * Используется dirty-set логикой: при drag ноды обновляем только эти edges.
     */
    getEdgeIdsForNode(nodeId: string): Set<string> {
        return this.nodeToEdges.get(nodeId) || new Set();
    }

    /**
     * Возвращает все edgeId для набора «грязных» нод.
     * Объединяет множества для каждого nodeId.
     */
    getDirtyEdgeIds(dirtyNodeIds: Iterable<string>): Set<string> {
        const result = new Set<string>();
        for (const nodeId of dirtyNodeIds) {
            const edgeIds = this.nodeToEdges.get(nodeId);
            if (edgeIds) {
                for (const eid of edgeIds) {
                    result.add(eid);
                }
            }
        }
        return result;
    }

    /** Очистка всех данных */
    clear(): void {
        this.paths.clear();
        this.nodeToEdges.clear();
    }

    /** Количество зарегистрированных edges (для отладки) */
    get size(): number {
        return this.paths.size;
    }
}
