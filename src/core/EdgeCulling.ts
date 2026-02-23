// core/EdgeCulling.ts
// P5: Visibility culling для edges — рендерим только edges, чей bbox пересекает viewport.
//
// Для каждого edge bbox определяется по координатам source/target портов.
// Если bbox + padding не пересекается с viewport → edge не рендерится.

import type { Vec2 } from "../types/types";

/** Axis-aligned bounding box */
export interface AABB {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

/** Viewport rectangle in canvas space */
export interface ViewportRect {
    /** Left edge in canvas coordinates */
    x: number;
    /** Top edge in canvas coordinates */
    y: number;
    /** Width in canvas coordinates */
    width: number;
    /** Height in canvas coordinates */
    height: number;
}

/**
 * Вычисляет AABB для edge по координатам портов.
 * Для bezier-кривых контрольные точки расширяют bbox,
 * поэтому добавляем bezierExpand.
 */
export function getEdgeBBox(source: Vec2, target: Vec2, bezierExpand = 50): AABB {
    const minX = Math.min(source.x, target.x) - bezierExpand;
    const minY = Math.min(source.y, target.y) - bezierExpand;
    const maxX = Math.max(source.x, target.x) + bezierExpand;
    const maxY = Math.max(source.y, target.y) + bezierExpand;
    return { minX, minY, maxX, maxY };
}

/**
 * Проверяет пересечение двух AABB.
 */
export function aabbIntersects(a: AABB, b: AABB): boolean {
    return a.minX <= b.maxX && a.maxX >= b.minX &&
           a.minY <= b.maxY && a.maxY >= b.minY;
}

/**
 * Преобразует viewport (в screen-координатах) в canvas-space AABB.
 *
 * Формула: CSS transform = translate(-panX, -panY) scale(zoom)
 *   canvasX = (screenX + panX) / zoom
 */
export function viewportToCanvasAABB(
    containerWidth: number,
    containerHeight: number,
    panX: number,
    panY: number,
    zoom: number,
    padding = 100
): AABB {
    const invZoom = 1 / zoom;
    return {
        minX: (panX - padding) * invZoom,
        minY: (panY - padding) * invZoom,
        maxX: (containerWidth + panX + padding) * invZoom,
        maxY: (containerHeight + panY + padding) * invZoom,
    };
}

/**
 * Проверяет, видим ли edge в текущем viewport.
 * @param source - координаты source порта в canvas space
 * @param target - координаты target порта в canvas space
 * @param viewportAABB - viewport в canvas space (из viewportToCanvasAABB)
 * @param bezierExpand - расширение bbox для кривых (px в canvas space)
 */
export function isEdgeVisible(
    source: Vec2,
    target: Vec2,
    viewportAABB: AABB,
    bezierExpand = 50,
): boolean {
    const edgeBBox = getEdgeBBox(source, target, bezierExpand);
    return aabbIntersects(edgeBBox, viewportAABB);
}
