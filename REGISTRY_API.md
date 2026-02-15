# Registry API - Custom Node and Edge Types

Этот документ описывает API для кастомизации типов нод и рёбер в FlowForge React.

## Обзор

FlowForge React теперь поддерживает расширяемую систему рендеринга через **Registry API**. Это позволяет:

- ✅ Использовать собственные компоненты для нод и рёбер
- ✅ Расширять встроенные типы новыми кастомными типами
- ✅ Заменять дефолтные компоненты без форка библиотеки
- ✅ Создавать "плагины" с наборами компонентов
- ✅ Управлять рендерингом через registries без правок ядра

## Базовое использование

### 1. Использование дефолтных типов

По умолчанию FlowForge предоставляет встроенные типы:

```typescript
import { Flow, Graph } from 'flowforge-react';

const graph = new Graph({
  nodes: [
    { id: '1', position: { x: 100, y: 100 }, type: 'default' },
    { id: '2', position: { x: 300, y: 100 }, type: 'custom' },
    { id: '3', position: { x: 500, y: 100 }, type: 'experimental' }
  ],
  edges: [
    { id: 'e1', sourceNode: '1', targetNode: '2', type: 'default' },
    { id: 'e2', sourceNode: '2', targetNode: '3', type: 'animated' }
  ]
});

function App() {
  return <Flow graph={graph} />;
}
```

**Встроенные типы нод:**
- `default` - базовая нода
- `custom` - кастомная нода с расширенными возможностями
- `experimental` - экспериментальная нода

**Встроенные типы рёбер:**
- `default` - обычное ребро
- `animated` - анимированное ребро
- `breakable` - ребро с возможностью удаления по клику

### 2. Добавление кастомных типов

Создайте собственные компоненты нод и рёбер:

```typescript
import React from 'react';
import { Flow, Graph, type NodeData, type EdgeData } from 'flowforge-react';

// Кастомная нода
const MyCustomNode: React.FC<NodeData> = ({ id, position, label, data }) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        padding: '20px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}
    >
      <h3>{label}</h3>
      <p>{data?.description}</p>
    </div>
  );
};

// Кастомное ребро
const MyCustomEdge: React.FC<EdgeData> = ({ id, sourcePort, targetPort }) => {
  if (!sourcePort || !targetPort) return null;

  return (
    <g>
      <line
        x1={sourcePort.x}
        y1={sourcePort.y}
        x2={targetPort.x}
        y2={targetPort.y}
        stroke="url(#gradient)"
        strokeWidth="3"
        strokeDasharray="5,5"
      />
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#667eea" />
          <stop offset="100%" stopColor="#764ba2" />
        </linearGradient>
      </defs>
    </g>
  );
};

const graph = new Graph({
  nodes: [
    { id: '1', position: { x: 100, y: 100 }, type: 'myCustom', label: 'Custom Node' }
  ],
  edges: [
    { id: 'e1', sourceNode: '1', targetNode: '2', type: 'myCustomEdge' }
  ]
});

function App() {
  return (
    <Flow
      graph={graph}
      nodeTypes={{
        myCustom: MyCustomNode
      }}
      edgeTypes={{
        myCustomEdge: MyCustomEdge
      }}
    />
  );
}
```

### 3. Расширение дефолтных типов

Вы можете использовать встроенные типы вместе с кастомными:

```typescript
import { Flow, Graph, defaultNodeTypes, defaultEdgeTypes } from 'flowforge-react';

function App() {
  return (
    <Flow
      graph={graph}
      nodeTypes={{
        ...defaultNodeTypes,  // Все встроенные типы
        myCustom: MyCustomNode  // + ваш кастомный тип
      }}
      edgeTypes={{
        ...defaultEdgeTypes,  // Все встроенные типы
        myCustomEdge: MyCustomEdge  // + ваш кастомный тип
      }}
    />
  );
}
```

### 4. Переопределение дефолтных типов

Замените встроенный тип своим:

```typescript
import { Flow, Graph, defaultNodeTypes } from 'flowforge-react';

function App() {
  return (
    <Flow
      graph={graph}
      nodeTypes={{
        ...defaultNodeTypes,
        default: MyCustomNode  // Заменяем дефолтную ноду
      }}
    />
  );
}
```

## TypeScript типы

### NodeRenderer

```typescript
type NodeRenderer<T = Record<string, unknown>> = React.FC<NodeData<T>>;
```

Компонент-рендерер ноды должен принимать `NodeData` пропсы:

```typescript
interface NodeData<T = Record<string, unknown>> {
  id: string;
  position: Vec2;
  label?: string;
  type?: string;
  data?: T;  // Кастомные данные
}
```

### EdgeRenderer

```typescript
type EdgeRenderer<T = Record<string, unknown>> = React.FC<EdgeData<T>>;
```

Компонент-рендерер ребра должен принимать `EdgeData` пропсы:

```typescript
interface EdgeData<T = Record<string, unknown>> {
  id: string;
  sourceNode: string;
  targetNode: string;
  sourcePort?: Vec2;
  targetPort?: Vec2;
  label?: string;
  type?: string;
  data?: T;  // Кастомные данные
}
```

### Registry типы

```typescript
type NodeTypesRegistry = Record<string, NodeRenderer>;
type EdgeTypesRegistry = Record<string, EdgeRenderer>;
```

## Продвинутые возможности

### Кастомный Canvas (planned)

`FlowProps` в текущей версии **не** содержит `renderCanvas`.

Если нужен полностью кастомный canvas, сейчас используйте composition через
`GraphProvider` + `RegistryProvider` + собственный компонент канваса.
Поддержка `renderCanvas` как прямого пропа рассматривается отдельно и пока не входит
в текущий стабильный API.

### Использование RegistryProvider отдельно

Для сложных сценариев вы можете использовать `RegistryProvider` отдельно:

```typescript
import { RegistryProvider, useRegistry } from 'flowforge-react';

function MyComponent() {
  const { nodeTypes, edgeTypes } = useRegistry();
  // Используйте registries
}

function App() {
  return (
    <RegistryProvider
      nodeTypes={{ myCustom: MyCustomNode }}
      edgeTypes={{ myCustomEdge: MyCustomEdge }}
    >
      <MyComponent />
    </RegistryProvider>
  );
}
```

## Экспортируемые API

### Из главного модуля

```typescript
import {
  // Провайдер и хук
  RegistryProvider,
  useRegistry,

  // Дефолтные registries
  defaultNodeTypes,
  defaultEdgeTypes,

  // Типы
  type NodeRenderer,
  type EdgeRenderer,
  type NodeTypesRegistry,
  type EdgeTypesRegistry,
  type FlowProps
} from 'flowforge-react';
```

### Из subpath exports

```typescript
// Только провайдеры
import { RegistryProvider, useRegistry } from 'flowforge-react/providers';

// Только core (registries)
import { defaultNodeTypes, defaultEdgeTypes } from 'flowforge-react/core';

// Только типы
import type { NodeRenderer, EdgeRenderer } from 'flowforge-react/types';
```

## Примеры использования

### Workflow редактор с кастомными нодами

```typescript
// Нода для условия
const ConditionNode: React.FC<NodeData> = (props) => (
  <div className="condition-node">
    <div className="icon">🔀</div>
    <span>{props.label}</span>
  </div>
);

// Нода для действия
const ActionNode: React.FC<NodeData> = (props) => (
  <div className="action-node">
    <div className="icon">⚡</div>
    <span>{props.label}</span>
  </div>
);

function WorkflowEditor() {
  const graph = new Graph({
    nodes: [
      { id: '1', type: 'condition', label: 'If user logged in' },
      { id: '2', type: 'action', label: 'Send welcome email' }
    ]
  });

  return (
    <Flow
      graph={graph}
      nodeTypes={{
        condition: ConditionNode,
        action: ActionNode
      }}
    />
  );
}
```

### Visual Programming с типизированными соединениями

```typescript
const DataNode: React.FC<NodeData> = (props) => (
  <div className="data-node" data-node-type="data">
    <div className="output" data-port-type="data-output">📊</div>
    {props.label}
  </div>
);

const ProcessNode: React.FC<NodeData> = (props) => (
  <div className="process-node" data-node-type="process">
    <div className="input" data-port-type="data-input">📥</div>
    {props.label}
    <div className="output" data-port-type="data-output">📤</div>
  </div>
);

function DataFlowEditor() {
  return (
    <Flow
      graph={graph}
      nodeTypes={{
        data: DataNode,
        process: ProcessNode
      }}
    />
  );
}
```

## Миграция с захардкоженных типов

Если вы использовали старый API с захардкоженными типами, миграция очень простая:

### До (старый API)

```typescript
// Нужно было редактировать Canvas.tsx напрямую
const nodeTypes = {
  default: Node,
  custom: CustomNode,
  myCustom: MyCustomNode  // Добавляли сюда
};
```

### После (новый API)

```typescript
// Просто передайте пропсы в Flow
<Flow
  graph={graph}
  nodeTypes={{
    myCustom: MyCustomNode
  }}
/>
```

## Best Practices

1. **Используйте TypeScript** - типизация помогает избежать ошибок
2. **Реюзайте дефолтные типы** - не изобретайте велосипед, расширяйте существующие
3. **Документируйте кастомные типы** - другие разработчики будут благодарны
4. **Тестируйте рендеринг** - убедитесь, что компоненты корректно отображаются
5. **Оптимизируйте performance** - используйте мемоизацию для сложных компонентов

## Что дальше?

- Изучите [advanced_example.md](advanced_example.md) для примеров сложных сценариев
- Прочитайте [flexebility.md](flexebility.md) для понимания архитектуры
- Реализуйте multi-port систему (пункт 3 из flexebility.md)
