# FlowForge React - Improvements & Refactoring Recommendations

This document outlines suggested improvements and refactoring opportunities for the FlowForge React node graph visualization library.

---

## 1. Code Organization & Architecture

### 1.1 Remove or Implement Empty Providers
**Priority: High**

The following providers are empty shells with no implementation:
- `src/providers/DragProvider.tsx`
- `src/providers/SelectionProvider.tsx`

**Recommendation**: Either implement these providers with actual functionality or remove them to reduce confusion and dead code.

### 1.2 Complete Hook Implementations
**Priority: High**

The hooks `useConnection.ts` and `useDrag.ts` have minimal implementations.

**Recommendation**:
- Fully implement these hooks with proper state management
- Or consolidate their functionality into existing hooks if redundant

### 1.3 Fix Typo in Provider Filename
**Priority: Medium**

`ZoomProvier.tsx` should be renamed to `ZoomProvider.tsx` (missing 'd').

### 1.4 Create Barrel Exports
**Priority: Medium**

Add `index.ts` files for cleaner imports:

```typescript
// src/components/index.ts
export { Canvas } from './Canvas';
export { Node } from './Node';
export { CustomNode } from './CustomNode';
// ... etc

// src/hooks/index.ts
export { useGraph } from './useGraph';
export { useStore } from './useStore';
// ... etc
```

### 1.5 Separate Demo from Library
**Priority: Medium**

Currently `App.tsx` serves as both demo and development entry. Consider:
- Creating a dedicated `examples/` or `demo/` directory
- Moving example node/edge configurations there
- Making `src/` purely library code for easier packaging

---

## 2. Type Safety Improvements

### 2.1 Strengthen Type Definitions
**Priority: High**

Current types in `types/types.ts` could be more specific:

```typescript
// Instead of generic string for node/edge types
type NodeType = 'default' | 'custom' | 'experimental';
type EdgeType = 'default' | 'animated' | 'breakable';

// Add generic type parameters for custom data
interface NodeData<T = unknown> {
  id: string;
  type: NodeType;
  position: Position;
  data?: T;
}
```

### 2.2 Add Strict Null Checks for DOM Operations
**Priority: High**

Several places access DOM elements without null checks:

```typescript
// Current (unsafe)
const rect = element.getBoundingClientRect();

// Recommended
const rect = element?.getBoundingClientRect();
if (!rect) return;
```

### 2.3 Define Event Handler Types
**Priority: Medium**

Create explicit types for event handlers used across components to ensure consistency.

---

## 3. Testing Infrastructure

### 3.1 Add Unit Tests
**Priority: High**

No testing infrastructure exists. Recommend adding:

```bash
npm install -D vitest @testing-library/react @testing-library/user-event jsdom
```

Key areas to test:
- `Graph.ts` - Core state management logic
- `createStore.ts` - Pub/sub functionality
- `makePath()` in `LiveEdge.ts` - Edge path calculations
- Component rendering and interactions

### 3.2 Add Visual Regression Tests
**Priority: Low**

Consider Playwright or Chromatic for visual testing of node/edge rendering.

---

## 4. Performance Optimizations

### 4.1 Memoize Edge Path Calculations
**Priority: Medium**

The `makePath()` function recalculates on every render. Consider memoizing based on start/end positions.

### 4.2 Virtualize Large Graphs
**Priority: Medium**

For graphs with many nodes (100+), implement viewport-based rendering:
- Only render nodes visible in the current viewport
- Use intersection observer for lazy loading

### 4.3 Debounce Edge Updates During Drag
**Priority: Low**

While `requestAnimationFrame` is used, consider debouncing edge recalculations for complex graphs.

### 4.4 Consider Web Workers for Graph Calculations
**Priority: Low**

For complex graphs, offload layout calculations to a Web Worker to prevent main thread blocking.

---

## 5. Code Duplication

### 5.1 Edge Component Refactoring
**Priority: High**

`Edge.tsx`, `AnimatedEdge.tsx`, and `BreakableEdge.tsx` share significant code. Create a base edge component:

```typescript
// BaseEdge.tsx
interface BaseEdgeProps {
  paths: PathConfig[];
  onDelete?: () => void;
  // ... common props
}

const BaseEdge: React.FC<BaseEdgeProps> = ({ paths, ...props }) => {
  // Common logic here
};
```

### 5.2 Node Component Refactoring
**Priority: Medium**

`Node.tsx`, `CustomNode.tsx`, and `ExperimentalNode.tsx` could share more logic through `NodeShell.tsx`. Consider a composition pattern:

```typescript
<NodeShell>
  <NodeHeader />
  <NodeContent />
  <NodePorts />
</NodeShell>
```

---

## 6. Missing Features

### 6.1 Selection System
**Priority: High**

Implement node/edge selection with:
- Single click selection
- Shift+click multi-select
- Drag-to-select (marquee selection)
- Selection state management

### 6.2 Zoom Controls
**Priority: High**

While `ZoomProvider` exists, zoom controls are incomplete:
- Add zoom in/out buttons
- Implement zoom to fit
- Add minimap for navigation
- Support pinch-to-zoom on touch devices

### 6.3 Pan Functionality
**Priority: High**

Add canvas panning:
- Middle-mouse drag to pan
- Space+drag to pan
- Touch gesture support

### 6.4 Undo/Redo System
**Priority: Medium**

Implement command pattern for undo/redo:
- Track state changes as commands
- Allow reverting node moves, edge deletions, etc.

### 6.5 Keyboard Shortcuts
**Priority: Medium**

- Delete key to remove selected nodes/edges
- Ctrl+A to select all
- Ctrl+C/V for copy/paste
- Arrow keys to nudge selected nodes

### 6.6 Snap to Grid
**Priority: Low**

Optional grid snapping when dragging nodes.

---

## 7. API Design

### 7.1 Event Callbacks
**Priority: High**

Add callbacks for external integration:

```typescript
interface FlowProps {
  onNodeClick?: (node: NodeData) => void;
  onEdgeClick?: (edge: EdgeData) => void;
  onNodeMove?: (node: NodeData, position: Position) => void;
  onConnect?: (connection: Connection) => void;
  onDisconnect?: (edge: EdgeData) => void;
  onChange?: (state: GraphState) => void;
}
```

### 7.2 Imperative API
**Priority: Medium**

Expose graph manipulation methods via ref:

```typescript
const flowRef = useRef<FlowHandle>(null);

// Later:
flowRef.current?.addNode(newNode);
flowRef.current?.removeEdge(edgeId);
flowRef.current?.fitView();
```

### 7.3 Controlled vs Uncontrolled Mode
**Priority: Medium**

Support both patterns:
- Uncontrolled: Library manages state internally
- Controlled: Parent component manages state via props

---

## 8. Build & Packaging

### 8.1 Library Build Configuration
**Priority: High**

Current setup is app-focused. Add library build for npm publishing:

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'FlowForgeReact',
      formats: ['es', 'cjs', 'umd'],
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
    },
  },
});
```

### 8.2 Remove Unused Dependencies
**Priority: Medium**

`regl` is installed but not used. Either:
- Remove it if WebGL rendering is not planned
- Document future plans if it's reserved for later use

### 8.3 Add Package Exports
**Priority: Medium**

Configure `package.json` exports for modern bundlers:

```json
{
  "exports": {
    ".": {
      "import": "./dist/index.es.js",
      "require": "./dist/index.cjs.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

---

## 9. Documentation

### 9.1 API Documentation
**Priority: High**

Add JSDoc comments to all public components and functions:

```typescript
/**
 * Renders a draggable node on the canvas.
 * @param props - Node configuration
 * @param props.id - Unique node identifier
 * @param props.type - Node type for rendering variant
 * @example
 * <Node id="node-1" type="default" position={{ x: 100, y: 100 }} />
 */
```

### 9.2 Storybook Integration
**Priority: Medium**

Add Storybook for component documentation and visual testing:

```bash
npx storybook@latest init
```

Create stories for each node and edge type.

### 9.3 Interactive Examples
**Priority: Low**

Create CodeSandbox or StackBlitz examples for common use cases.

---

## 10. Code Quality

### 10.1 Add Prettier
**Priority: Medium**

Ensure consistent code formatting:

```bash
npm install -D prettier eslint-config-prettier
```

### 10.2 Add Husky Pre-commit Hooks
**Priority: Medium**

Automate quality checks:

```bash
npm install -D husky lint-staged
```

### 10.3 Enable Stricter ESLint Rules
**Priority: Low**

Consider adding:
- `@typescript-eslint/strict`
- `eslint-plugin-import` for import ordering
- `eslint-plugin-jsx-a11y` for accessibility

---

## 11. Accessibility

### 11.1 Keyboard Navigation
**Priority: Medium**

- Tab through nodes
- Arrow keys to move focus between connected nodes
- Enter to select/activate

### 11.2 ARIA Labels
**Priority: Medium**

Add appropriate ARIA attributes:

```tsx
<div
  role="application"
  aria-label="Node graph editor"
  aria-describedby="graph-instructions"
>
```

### 11.3 Screen Reader Support
**Priority: Low**

Provide text descriptions of graph structure for screen reader users.

---

## 12. Quick Wins (Low Effort, High Impact)

1. **Fix ZoomProvier.tsx typo** - 1 minute
2. **Remove empty providers** - 5 minutes
3. **Add index.ts barrel exports** - 10 minutes
4. **Remove unused `regl` dependency** - 1 minute
5. **Add basic JSDoc comments** - 30 minutes
6. **Add null checks for DOM operations** - 15 minutes

---

## Summary

| Category | High Priority Items |
|----------|---------------------|
| Code Cleanup | Remove empty providers, fix typo, complete hooks |
| Type Safety | Strengthen types, add null checks |
| Testing | Add Vitest + React Testing Library |
| Features | Selection, zoom controls, pan, event callbacks |
| Build | Library build config for npm publishing |
| Documentation | JSDoc comments, API docs |

Addressing these improvements will make FlowForge React more maintainable, robust, and ready for production use.
