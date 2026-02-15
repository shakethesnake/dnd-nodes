# Реализация пункта 2: Расширяемость рендеринга (Registry API)

## Обзор

Реализован второй пункт из [flexebility.md](flexebility.md) - **"Расширяемость рендеринга: registry вместо хардкода"**.

## Что было сделано

### 1. Созданы новые типы (src/types/types.ts)

Добавлены типы для системы registries:

```typescript
// Рендереры
type NodeRenderer<T = Record<string, unknown>> = React.FC<NodeData<T>>;
type EdgeRenderer<T = Record<string, unknown>> = React.FC<EdgeData<T>>;

// Registries
type NodeTypesRegistry = Record<string, NodeRenderer>;
type EdgeTypesRegistry = Record<string, EdgeRenderer>;
```

### 2. Созданы дефолтные registries (src/core/defaultRegistries.ts)

Вынесены встроенные типы в отдельный модуль:

```typescript
export const defaultNodeTypes: NodeTypesRegistry = {
  default: Node,
  custom: CustomNode,
  experimental: ExperimentalNode,
};

export const defaultEdgeTypes: EdgeTypesRegistry = {
  default: Edge,
  animated: AnimatedEdge,
  breakable: BreakableEdge,
};
```

### 3. Создан RegistryProvider (src/providers/RegistryProvider.tsx)

Новый контекст для управления registries:

```typescript
export const RegistryProvider: React.FC<RegistryProviderProps> = ({
  children,
  nodeTypes,
  edgeTypes,
}) => {
  // Автоматическое слияние с дефолтными типами
  const mergedNodeTypes = nodeTypes
    ? { ...defaultNodeTypes, ...nodeTypes }
    : defaultNodeTypes;

  const mergedEdgeTypes = edgeTypes
    ? { ...defaultEdgeTypes, ...edgeTypes }
    : defaultEdgeTypes;

  return <RegistryContext.Provider value={{ nodeTypes: mergedNodeTypes, edgeTypes: mergedEdgeTypes }}>
    {children}
  </RegistryContext.Provider>;
};

// Хук для доступа к registries
export const useRegistry = (): RegistryContextType => {
  const context = useContext(RegistryContext);
  if (!context) {
    throw new Error("useRegistry() must be used within a <RegistryProvider>");
  }
  return context;
};
```

### 4. Обновлен Flow компонент (src/components/Flow.tsx)

Текущий `Flow` поддерживает передачу `nodeTypes` и `edgeTypes` для расширения
рендеринга через `RegistryProvider`.

Важно: `renderCanvas` в текущем API отсутствует.

### 5. Обновлен Canvas (src/components/Canvas.tsx)

Использует nodeTypes из контекста:

```typescript
export const FlowCanvas: React.FC = () => {
  const graph = useGraph();
  const { nodes, canvasView } = useStore(graph.getStore());
  const { nodeTypes } = useRegistry();  // ← Из контекста

  return (
    <div data-flow-root className={canvasViewClass}>
      {nodes?.map((n) => {
        const NodeComponent = nodeTypes[n.type || 'default'] || nodeTypes['default'] || Node;
        return <NodeComponent key={n.id} {...n} />;
      })}
      <EdgesLayer type="svg" />
    </div>
  );
};
```

### 6. Обновлен EdgeLayer (src/components/EdgeLayer.tsx)

Использует edgeTypes из контекста:

```typescript
export const EdgesLayer: React.FC<{ type?: "svg" | "webgl" }> = ({ type = "svg" }) => {
  const graph = useGraph();
  const { edges } = useStore(graph.getStore());
  const { edgeTypes } = useRegistry();  // ← Из контекста

  const edgeElements = useMemo(() => {
    return edges.map((e) => {
      const EdgeComponent = edgeTypes[e.type || 'default'] || edgeTypes['default'] || Edge;
      return <EdgeComponent key={e.id} {...e} />;
    });
  }, [edges, edgeTypes]);

  // ...
};
```

### 7. Обновлены экспорты

Все новые API экспортированы из библиотеки:

```typescript
// Провайдеры и хуки
export { RegistryProvider, useRegistry } from './providers';

// Дефолтные registries
export { defaultNodeTypes, defaultEdgeTypes } from './core';

// Типы
export type {
  NodeRenderer,
  EdgeRenderer,
  NodeTypesRegistry,
  EdgeTypesRegistry,
  FlowProps
} from './types';
```

### 8. Создана документация

- **[REGISTRY_API.md](REGISTRY_API.md)** - подробная документация по использованию Registry API
- **[src/examples/CustomRegistryExample.tsx](src/examples/CustomRegistryExample.tsx)** - рабочий пример с кастомными типами

## API для пользователей

### Базовое использование

```typescript
import { Flow, Graph } from 'flowforge-react';

// Кастомный компонент ноды
const MyNode: React.FC<NodeData> = ({ id, position, label }) => (
  <div style={{ position: 'absolute', left: position.x, top: position.y }}>
    {label}
  </div>
);

function App() {
  return (
    <Flow
      graph={graph}
      nodeTypes={{
        myCustom: MyNode
      }}
    />
  );
}
```

### Расширение дефолтных типов

```typescript
import { Flow, Graph, defaultNodeTypes, defaultEdgeTypes } from 'flowforge-react';

function App() {
  return (
    <Flow
      graph={graph}
      nodeTypes={{
        ...defaultNodeTypes,  // Все встроенные типы
        myCustom: MyNode      // + кастомный тип
      }}
      edgeTypes={{
        ...defaultEdgeTypes,
        myCustomEdge: MyEdge
      }}
    />
  );
}
```

### Кастомный Canvas (planned)

```typescript
import { Flow, useGraph, useStore, useRegistry } from 'flowforge-react';

const MyCanvas: React.FC = () => {
  const graph = useGraph();
  const { nodes, edges } = useStore(graph.getStore());
  const { nodeTypes, edgeTypes } = useRegistry();

  return <div>{/* Кастомная реализация */}</div>;
};

function App() {
  return (
    <GraphProvider graph={graph}>
      <RegistryProvider nodeTypes={{ myCustom: MyNode }}>
        <MyCanvas />
      </RegistryProvider>
    </GraphProvider>
  );
}
```

## Преимущества новой архитектуры

### ✅ Открытость для расширений

Пользователи могут добавлять свои типы без модификации исходного кода библиотеки.

### ✅ Закрытость для изменений

Внутренняя реализация защищена, изменения API обратно совместимы.

### ✅ Композируемость

Registries можно комбинировать, расширять, переопределять.

### ✅ Типобезопасность

TypeScript типы обеспечивают корректность использования API.

### ✅ Путь к плагинам

Архитектура готова для создания экосистемы плагинов:

```typescript
import { fancyNodeTypes, fancyEdgeTypes } from 'flowforge-fancy-plugin';

<Flow
  graph={graph}
  nodeTypes={{ ...defaultNodeTypes, ...fancyNodeTypes }}
  edgeTypes={{ ...defaultEdgeTypes, ...fancyEdgeTypes }}
/>
```

## Файлы изменены

### Созданы новые файлы

- `src/core/defaultRegistries.ts` - дефолтные registries
- `src/providers/RegistryProvider.tsx` - контекст для registries
- `src/examples/CustomRegistryExample.tsx` - пример использования
- `REGISTRY_API.md` - документация
- `POINT_2_IMPLEMENTATION.md` - этот файл

### Изменены существующие файлы

- `src/types/types.ts` - добавлены типы NodeRenderer, EdgeRenderer, NodeTypesRegistry, EdgeTypesRegistry
- `src/types/index.ts` - экспорт новых типов
- `src/core/index.ts` - экспорт defaultNodeTypes, defaultEdgeTypes
- `src/components/Flow.tsx` - добавлены пропсы nodeTypes и edgeTypes
- `src/components/Canvas.tsx` - использует nodeTypes из контекста
- `src/components/EdgeLayer.tsx` - использует edgeTypes из контекста
- `src/components/index.ts` - экспорт FlowProps
- `src/providers/index.ts` - экспорт RegistryProvider и useRegistry
- `src/index.ts` - экспорт всех новых API

## Сборка

Библиотека успешно собирается с новыми изменениями:

```bash
npm run build
# ✓ built in 237ms
```

Все TypeScript типы генерируются корректно:

- `dist/index.d.ts` - главный entry point с новыми типами
- `dist/core/index.d.ts` - включает defaultNodeTypes и defaultEdgeTypes
- `dist/providers/index.d.ts` - включает RegistryProvider и useRegistry
- `dist/types/index.d.ts` - включает все типы registries

## Обратная совместимость

✅ **Полная обратная совместимость сохранена**

Старый код продолжает работать без изменений:

```typescript
// Старый способ - всё ещё работает
<Flow graph={graph} />
```

Новые пропсы `nodeTypes` и `edgeTypes` опциональные. Если не указаны, используются дефолтные типы.

## Known limitations

- `renderCanvas` как проп `Flow` пока не реализован.
- Registry API покрывает ноды/рёбра, но не предоставляет отдельный high-level canvas API.

## Следующие шаги (из flexebility.md)

- ✅ Пункт 1: Пакетирование и импорты - **ВЫПОЛНЕНО**
- 🟡 Пункт 2: Registry вместо хардкода - **ЧАСТИЧНО (без renderCanvas)**
- ⏳ Пункт 3: Порты и соединения (multi-port модель)
- ⏳ Пункт 4: Controlled/uncontrolled режимы
- ⏳ Пункт 5: Производительность (viewport culling, WebGL)
- ⏳ Пункт 6: UX-фичи (selection, hotkeys, snapping)
- ⏳ Пункт 7: API наблюдений (typed EventEmitter)
- ⏳ Пункт 8: Документация и примеры

## Примеры использования

Полные примеры смотрите в:
- [REGISTRY_API.md](REGISTRY_API.md) - подробная документация с примерами
- [src/examples/CustomRegistryExample.tsx](src/examples/CustomRegistryExample.tsx) - рабочий код
