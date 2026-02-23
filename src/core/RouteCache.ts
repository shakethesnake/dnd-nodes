// core/RouteCache.ts
// P3: Memoized routing — кеш вычисленных path-строк по ключу входных параметров.
//
// Ключ: `sourceX,sourceY|targetX,targetY|mode|bendStrategy|cornerRadius|...`
// Инвалидация: при изменении любого входного параметра ключ меняется автоматически.
// Eviction: LRU-стиль — при превышении maxSize удаляются самые старые записи.

import type { Vec2, EdgeData } from "../types/types";

export interface RouteCacheConfig {
    /** Максимальное число записей (по умолчанию 2000) */
    maxSize?: number;
    /** Округление координат для повышения cache hit rate (по умолчанию 0.5) */
    precision?: number;
}

/**
 * RouteCache — LRU-кеш для вычисленных SVG path-строк.
 *
 * Зачем:
 * - При drag пересчитываются только «грязные» edges (P1), но даже для них
 *   если координаты не изменились (snap-to-grid, стационарный конец) — path берётся из кеша.
 * - При zoom/pan edges не двигаются в canvas-space → 100% cache hit.
 * - Снижает CPU-нагрузку на routing (особенно для smart/orthogonal роутеров).
 *
 * Precision:
 * - Координаты округляются до `precision` px для увеличения процента попаданий.
 * - По умолчанию 0.5px — субпиксельные различия не важны для SVG path.
 */
export class RouteCache {
    private cache = new Map<string, string>();
    private maxSize: number;
    private precision: number;

    constructor(config?: RouteCacheConfig) {
        this.maxSize = config?.maxSize ?? 2000;
        this.precision = config?.precision ?? 0.5;
    }

    /**
     * Строит ключ кеша из входных параметров роутинга.
     * Включает координаты + данные route-конфигурации из edge.data.
     */
    private buildKey(source: Vec2, target: Vec2, edge?: EdgeData): string {
        const p = this.precision;
        const sx = Math.round(source.x / p) * p;
        const sy = Math.round(source.y / p) * p;
        const tx = Math.round(target.x / p) * p;
        const ty = Math.round(target.y / p) * p;

        // Базовый ключ — координаты
        let key = `${sx},${sy}|${tx},${ty}`;

        // Добавляем route-конфигурацию из edge.data если есть
        if (edge?.data) {
            const route = edge.data.route as Record<string, unknown> | undefined;
            if (route) {
                key += `|${route.mode ?? ''}|${route.bendStrategy ?? ''}|${route.cornerRadius ?? ''}|${route.splitRatio ?? ''}|${route.firstSegment ?? ''}|${route.padding ?? ''}`;
            }
        }

        return key;
    }

    /**
     * Пытается получить закешированный path.
     * @returns path-строка или undefined при промахе.
     */
    get(source: Vec2, target: Vec2, edge?: EdgeData): string | undefined {
        const key = this.buildKey(source, target, edge);
        const cached = this.cache.get(key);

        if (cached !== undefined) {
            // LRU: перемещаем в конец (самый свежий)
            this.cache.delete(key);
            this.cache.set(key, cached);
        }

        return cached;
    }

    /**
     * Сохраняет результат роутинга в кеш.
     * При превышении maxSize удаляет самые старые записи.
     */
    set(source: Vec2, target: Vec2, path: string, edge?: EdgeData): void {
        const key = this.buildKey(source, target, edge);

        // Удаляем если уже есть (для LRU-порядка)
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }

        // Eviction: удаляем самые старые записи
        while (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) this.cache.delete(oldestKey);
        }

        this.cache.set(key, path);
    }

    /** Полная очистка кеша */
    clear(): void {
        this.cache.clear();
    }

    /** Текущий размер кеша */
    get size(): number {
        return this.cache.size;
    }

    /** Статистика для отладки */
    getStats(): { size: number; maxSize: number } {
        return { size: this.cache.size, maxSize: this.maxSize };
    }
}
