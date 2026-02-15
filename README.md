# FlowForge React

Лёгкая библиотека для интерактивных node/edge графов на React + TypeScript.

## Быстрый старт

```tsx
import { Flow, Graph } from "flowforge-react";

const graph = new Graph({
  nodes: [{ id: "n1", position: { x: 120, y: 80 }, label: "Start" }],
  edges: [],
});

export function App() {
  return <Flow graph={graph} />;
}
```

## Основные возможности

- `controlled` и `uncontrolled` режимы `Flow`
- Registry API: `nodeTypes`, `edgeTypes`
- Multi-port соединения через `Port`
- `canConnect` + `connectionEventHandlers`
- Undo/redo и hotkeys (`Delete`, `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, `Ctrl/Cmd+Y`)
- Viewport culling (`viewportCulling`, `cullingPadding`, `estimatedNodeSize`)
- Edge routing (`edgeRouter: "bezier" | "smoothStep" | custom`)
- Режим `edgeLayerType="webgl"` с честным fallback в SVG
- Snap-to-grid (`snapToGrid`, `gridSize`)

## Пример с расширенным API

```tsx
<Flow
  graph={graph}
  nodeTypes={{ myNode: MyNode }}
  edgeTypes={{ myEdge: MyEdge }}
  canConnect={myCanConnect}
  connectionEventHandlers={myHandlers}
  viewportCulling
  cullingPadding={120}
  edgeRouter="smoothStep"
  snapToGrid
  gridSize={16}
/>
```

## Полезные хуки

- `useGraph()`
- `useStore(store)`
- `useNode(id)`
- `useEdgesForNode(id)`
- `useSelection()`
- `useConnectionPreview()`
- `useHistory(graph)`
- `useViewport(ref, options)`

## Документация и примеры

- `REGISTRY_API.md`
- `POINT_2_IMPLEMENTATION.md`
- `POINT_3_IMPLEMENTATION.md`
- `src/examples/example1/AdvancedDamagePipelineExample.tsx`
- `src/examples/example1/MultiPortExample.tsx`
- `src/examples/example2/ConditionalConnectionExample.tsx`

## Разработка

```bash
pnpm install
pnpm dev
pnpm test:run
pnpm exec tsc -p tsconfig.app.json --noEmit
pnpm exec tsc -p tsconfig.build.json --noEmit
```
