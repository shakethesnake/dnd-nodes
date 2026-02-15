// liveEdge.ts
import type { Vec2 } from '../types/types';

let livePath: SVGPathElement | null = null;

// Memoization cache for makePath calculations
const pathCache = new Map<string, string>();
const MAX_CACHE_SIZE = 1000;

/**
 * Creates a cache key from two points
 */
function getCacheKey(a: Vec2, b: Vec2): string {
    return `${a.x},${a.y}-${b.x},${b.y}`;
}

/**
 * Creates a memoized cubic bezier path string between two points.
 * Uses LRU-style cache eviction when cache exceeds MAX_CACHE_SIZE.
 */
export function makePath(a: Vec2, b: Vec2): string {
    const key = getCacheKey(a, b);

    const cached = pathCache.get(key);
    if (cached !== undefined) {
        return cached;
    }

    // Calculate the path
    const dx = Math.abs(b.x - a.x) * 0.5;
    const path = `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;

    // Evict oldest entries if cache is too large
    if (pathCache.size >= MAX_CACHE_SIZE) {
        const firstKey = pathCache.keys().next().value;
        if (firstKey) pathCache.delete(firstKey);
    }

    pathCache.set(key, path);
    return path;
}

/**
 * Clears the path memoization cache.
 * Useful for testing or when memory needs to be freed.
 */
export function clearPathCache(): void {
    pathCache.clear();
}

export function createLiveEdge(svgRoot: SVGSVGElement, start: Vec2): void {
    if (livePath) removeLiveEdge();
    livePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    livePath.setAttribute('stroke', 'orange');
    livePath.setAttribute('stroke-width', '2');
    livePath.setAttribute('fill', 'none');
    livePath.setAttribute('stroke-dasharray', '6 3');
    svgRoot.appendChild(livePath);
    updateLiveEdge(start, start);
}

export function updateLiveEdge(start: Vec2, end: Vec2): void {
    if (!livePath) return;
    livePath.setAttribute('d', makePath(start, end));
}

export function removeLiveEdge(): void {
    livePath?.remove();
    livePath = null;
}
