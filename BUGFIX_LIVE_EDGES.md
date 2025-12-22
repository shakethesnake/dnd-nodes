# Bug Fix: Live Edge Recalculation During Node Drag

## Problem Description

Edges were not updating their paths in real-time when nodes were being dragged. The edges remained static until the drag operation completed.

## Root Cause

The `updateEdgesForNode()` method in [Graph.ts](src/core/Graph.ts) was only updating **one** path element per edge using the `edgeRegistry` Map:

```tsx
const el = this.edgeRegistry.get(e.id);  // Only gets ONE path
if (!el) continue;
el.setAttribute("d", makePath(s, t));    // Only updates ONE path
```

However, some edge types have **multiple** `<path>` elements:

### AnimatedEdge (3 paths)
1. Glow effect path
2. Main path
3. Animated dashed overlay path

### BreakableEdge (2-3 paths)
1. Invisible thick path (for easier clicking)
2. Glow effect path (when hovered)
3. Main path

### Edge (1 path)
1. Main path only

The `edgeRegistry.set(id, el)` could only store **one** path per edge ID, so when multiple paths existed, only the last registered path would be updated during drag.

## The Fix

Changed `updateEdgesForNode()` to query **ALL** path elements for each edge using `querySelectorAll`:

### Before (Broken)
```tsx
updateEdgesForNode = (nodeId: string) => {
    if (this.frameId) cancelAnimationFrame(this.frameId);
    this.frameId = requestAnimationFrame(() => {
        const { edges } = this.getState();
        const related = edges.filter(e => e.sourceNode === nodeId || e.targetNode === nodeId);

        for (const e of related) {
            const ports = this.getRelatedEdgePorts(e.id);
            if (!ports) continue;

            const el = this.edgeRegistry.get(e.id);  // ❌ Only ONE path
            if (!el) continue;

            const s = ports.sourceNodePort?.outputPort;
            const t = ports.targetNodePort?.inputPort;
            if (!s || !t) continue;

            el.setAttribute("d", makePath(s, t));     // ❌ Only updates ONE path
        }
    });
};
```

### After (Fixed)
```tsx
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

            // ✅ Update ALL path elements for this edge
            const pathEls = svg.querySelectorAll<SVGPathElement>(`path[data-edge-id="${e.id}"]`);
            pathEls.forEach((pathEl) => {
                pathEl.setAttribute("d", makePath(s, t));
            });
        }
    });
};
```

## Key Changes

1. **Added SVG Layer Access**: Get the SVG element to query paths
   ```tsx
   const svg = this.getLayer("edgeLayer") as SVGSVGElement;
   ```

2. **Query All Paths**: Use `querySelectorAll` to find all path elements with matching `data-edge-id`
   ```tsx
   const pathEls = svg.querySelectorAll<SVGPathElement>(`path[data-edge-id="${e.id}"]`);
   ```

3. **Update All Paths**: Loop through and update each path
   ```tsx
   pathEls.forEach((pathEl) => {
       pathEl.setAttribute("d", makePath(s, t));
   });
   ```

## How It Works Now

1. **User starts dragging a node**
   - `handlePointerDown` in Node component is triggered
   - Sets dragging state and adds pointer event listeners

2. **During drag (on `pointermove`)**
   - Node position updates with `transform: translate()`
   - `graph.updateEdgesForNode(id)` is called
   - Previous animation frame is cancelled (throttling)
   - New animation frame is scheduled

3. **Inside `requestAnimationFrame`**
   - Finds all edges connected to the dragged node
   - For each edge:
     - Gets current port positions from DOM
     - Queries ALL `<path>` elements with matching `data-edge-id`
     - Updates path `d` attribute for each path element
     - Paths update smoothly following the node

4. **User releases the node**
   - Final position is committed to state
   - Transform is cleared
   - Dragging state is reset

## Visual Flow

```
User drags node
  └─> handleMove (on pointermove)
      └─> graph.updateEdgesForNode(nodeId)
          └─> requestAnimationFrame(() => {
              └─> Find related edges
                  └─> For each edge:
                      ├─> Get current port positions (from DOM)
                      ├─> querySelectorAll: path[data-edge-id="..."]
                      └─> Update ALL paths with new curve
          })

Result: Edges follow node in real-time! ✨
```

## Performance

The fix maintains excellent performance through:

1. **requestAnimationFrame throttling**: Prevents excessive updates
2. **querySelectorAll efficiency**: Modern browsers optimize DOM queries
3. **Selective updates**: Only updates edges connected to the moving node
4. **No React re-renders**: Direct DOM manipulation for smooth 60fps animation

## Testing

Verified by:
1. Dragging default nodes - edges update smoothly ✅
2. Dragging custom nodes - all edge types update correctly ✅
3. Animated edges - all 3 paths update in sync ✅
4. Breakable edges - all paths update, hover indicator follows ✅
5. Multiple edges - all connected edges update simultaneously ✅

## Related Files

- [Graph.ts](src/core/Graph.ts#L72-L96) - Fixed `updateEdgesForNode()` method
- [Node.tsx](src/components/Node.tsx#L32) - Calls `updateEdgesForNode` during drag
- [CustomNode.tsx](src/components/CustomNode.tsx#L38) - Calls `updateEdgesForNode` during drag
- [Edge.tsx](src/components/Edge.tsx) - Single path edge
- [AnimatedEdge.tsx](src/components/AnimatedEdge.tsx) - Triple path edge
- [BreakableEdge.tsx](src/components/BreakableEdge.tsx) - Multiple path edge
- [EdgeLayer.tsx](src/components/EdgeLayer.tsx) - Manages edge rendering

## Additional Notes

The `edgeRegistry` is still used in `EdgeLayer.tsx` for initial path updates, but `updateEdgesForNode()` now bypasses it to ensure all paths are updated correctly.

## Date

2025-12-07
