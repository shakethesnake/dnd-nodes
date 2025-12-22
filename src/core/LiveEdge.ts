// liveEdge.ts
let livePath: SVGPathElement | null = null;

export function createLiveEdge(svgRoot: SVGSVGElement, start: { x: number; y: number }) {
    if (livePath) removeLiveEdge();
    livePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    livePath.setAttribute('stroke', 'orange');
    livePath.setAttribute('stroke-width', '2');
    livePath.setAttribute('fill', 'none');
    livePath.setAttribute('stroke-dasharray', '6 3');
    svgRoot.appendChild(livePath);
    updateLiveEdge(start, start);
}

export function makePath(a: { x: number; y: number }, b: { x: number; y: number }) {
    const dx = Math.abs(b.x - a.x) * 0.5;
    return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
}

export function updateLiveEdge(start: { x: number; y: number }, end: { x: number; y: number }) {
    if (!livePath) return;
    const dx = Math.abs(end.x - start.x) * 0.5;
    const d = `M${start.x},${start.y} C${start.x + dx},${start.y} ${end.x - dx},${end.y} ${end.x},${end.y}`;
    livePath.setAttribute('d', d);
}

export function removeLiveEdge() {
    livePath?.remove();
    livePath = null;
}


