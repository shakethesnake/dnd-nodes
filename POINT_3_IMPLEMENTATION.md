# Реализация пункта 3: Порты и соединения

Этот документ описывает реализацию **пункта 3 из flexebility.md**: "Порты и соединения: 'портовая' модель как часть core".

## Содержание

1. [Обзор](#обзор)
2. [Реализованные фичи](#реализованные-фичи)
3. [Изменения в архитектуре](#изменения-в-архитектуре)
4. [API и использование](#api-и-использование)
5. [Примеры](#примеры)
6. [Миграция существующего кода](#миграция-существующего-кода)

---

## Обзор

Реализация добавляет поддержку **multi-port** (несколько портов на одной ноде), **валидацию соединений** и **lifecycle события** для создания соединений.

### Что было добавлено:

1. ✅ **Multi-port в данных**: поля `sourcePortId` и `targetPortId` в `EdgeData`
2. ✅ **Обновление путей с учётом portId**: `Graph` теперь ищет порты по их ID
3. ✅ **Connection strategy**: callback `canConnect` для валидации
4. ✅ **Connection events**: `onConnectStart`, `onConnectMove`, `onConnect`, `onConnectCancel`, `onConnectEnd`

---

## Реализованные фичи

### 3.1 Multi-port в данных

#### Изменения в типах ([src/types/types.ts](src/types/types.ts))

```typescript
export interface EdgeData<T = Record<string, unknown>> {
  id: string;
  sourceNode: string;
  targetNode: string;
  sourcePortId?: string;  // ← Новое поле
  targetPortId?: string;  // ← Новое поле
  sourcePort?: Vec2;
  targetPort?: Vec2;
  // ... остальные поля
}
```

**Дефолтные значения:**
- `sourcePortId` по умолчанию: `"out"`
- `targetPortId` по умолчанию: `"in"`

#### Изменения в Port компоненте ([src/components/Port.tsx](src/components/Port.tsx))

```typescript
interface PortProps {
  type?: 'input' | 'output';
  portId?: string;  // ← Новый проп
  // ...
}
```

Компонент автоматически устанавливает:
- `data-port-id` атрибут на DOM элемент
- Дефолтный `portId` в зависимости от `type`: `"out"` для output, `"in"` для input

**Пример использования:**

```tsx
<Port type="input" portId="data-in" data={{ nodeId: "node-1" }} />
<Port type="output" portId="result-out" data={{ nodeId: "node-1" }} />
```

---

### 3.2 Обновление путей с учётом portId

#### Изменения в Graph ([src/core/Graph.ts](src/core/Graph.ts))

**Новый метод:**

```typescript
private getNodePortScreen(
  nodeId: string,
  portId: string = 'out',
  portType: 'input' | 'output' = 'output'
): Vec2 | null
```

Ищет порт по селектору:
```css
.port.output[data-port-id="result-out"]
```

Если порт с конкретным `portId` не найден, возвращается первый порт указанного типа (fallback).

**Обновлённый метод `updateEdgesForNode`:**

```typescript
updateEdgesForNode = (nodeId: string) => {
  // ...
  for (const e of related) {
    const sourcePortId = e.sourcePortId || 'out';
    const targetPortId = e.targetPortId || 'in';

    const s = this.getNodePortScreen(e.sourceNode, sourcePortId, 'output');
    const t = this.getNodePortScreen(e.targetNode, targetPortId, 'input');
    // ... обновляет paths
  }
}
```

---

### 3.3 Connection strategy + события

#### ConnectionProvider ([src/providers/ConnectionProvider.tsx](src/providers/ConnectionProvider.tsx))

Новый провайдер с полным контролем над lifecycle соединений.

**Интерфейс:**

```typescript
interface ConnectionContextValue {
  currentConnection: ConnectionAttempt | null;
  startConnection: (attempt: ConnectionAttempt) => void;
  updateConnection: (position: Vec2) => void;
  completeConnection: (params: {...}) => boolean;
  cancelConnection: (reason?: string) => void;
  canConnect: CanConnectFn;
}
```

**Props провайдера:**

```typescript
interface ConnectionProviderProps {
  canConnect?: CanConnectFn;           // Валидация соединений
  eventHandlers?: ConnectionEventHandlers;  // Lifecycle события
}
```

#### Валидация соединений: `canConnect`

Тип функции валидации:

```typescript
type CanConnectFn = (params: {
  sourceNodeId: string;
  sourcePortId?: string;
  targetNodeId: string;
  targetPortId?: string;
  sourcePortType: 'input' | 'output';
  targetPortType: 'input' | 'output';
}) => ConnectionValidation;

type ConnectionValidation =
  | { allowed: true }
  | { allowed: false; reason?: string };
```

**Пример:**

```typescript
const canConnect: CanConnectFn = ({ sourceNodeId, targetNodeId }) => {
  if (sourceNodeId === targetNodeId) {
    return { allowed: false, reason: 'Cannot connect node to itself' };
  }
  return { allowed: true };
};
```

**Дефолтная валидация:**
- Запрещает self-connections (узел → сам себя)
- Разрешает только output → input
- Запрещает input → input и output → output

#### Lifecycle события

```typescript
interface ConnectionEventHandlers {
  onConnectStart?: (payload: {
    sourceNodeId: string;
    sourcePortId?: string;
    sourcePortType: 'input' | 'output';
    sourcePosition: Vec2;
  }) => void;

  onConnectMove?: (payload: {
    sourceNodeId: string;
    sourcePortId?: string;
    currentPosition: Vec2;
  }) => void;

  onConnectEnd?: (payload: {
    sourceNodeId: string;
    sourcePortId?: string;
  }) => void;

  onConnect?: (payload: {
    sourceNodeId: string;
    sourcePortId?: string;
    targetNodeId: string;
    targetPortId?: string;
    edge: EdgeData;
  }) => void;

  onConnectCancel?: (payload: {
    sourceNodeId: string;
    sourcePortId?: string;
    reason?: string;
  }) => void;
}
```

**Порядок вызова:**

```
Start drag from port
  ↓
onConnectStart
  ↓
onConnectMove (много раз при движении мыши)
  ↓
Drop on target port
  ↓
canConnect validation
  ↓
✅ Success:              ❌ Failure:
onConnect                onConnectCancel
  ↓                        ↓
onConnectEnd             onConnectEnd
```

---

## API и использование

### Базовое использование (без ConnectionProvider)

Работает как раньше, но теперь с поддержкой `portId`:

```tsx
import { Port } from 'flowforge-react';

function MyNode({ id }) {
  return (
    <div>
      <Port type="input" portId="in-data" data={{ nodeId: id }} />
      <Port type="output" portId="out-result" data={{ nodeId: id }} />
    </div>
  );
}
```

### Продвинутое использование (с ConnectionProvider)

```tsx
import { Flow, ConnectionProvider } from 'flowforge-react';

function App() {
  const canConnect = ({ sourcePortId, targetPortId }) => {
    // Кастомная логика валидации
    if (sourcePortId === 'out-error' && targetPortId === 'in-data') {
      return { allowed: false, reason: 'Error port cannot connect to data input' };
    }
    return { allowed: true };
  };

  const eventHandlers = {
    onConnect: ({ edge }) => {
      console.log('New connection created:', edge);
      // Можно добавить аналитику, логирование и т.д.
    },
  };

  return (
    <ConnectionProvider canConnect={canConnect} eventHandlers={eventHandlers}>
      <Flow graph={graph} nodeTypes={nodeTypes} />
    </ConnectionProvider>
  );
}
```

---

## Примеры

### Пример 1: Простая нода с несколькими портами

См. [src/examples/MultiPortNode.tsx](src/examples/MultiPortNode.tsx)

```tsx
export const MultiPortNode: React.FC<NodeData> = ({ id, label }) => {
  return (
    <div>
      <h3>{label}</h3>

      {/* Inputs */}
      <Port type="input" portId="in-data" data={{ nodeId: id }} />
      <Port type="input" portId="in-config" data={{ nodeId: id }} />

      {/* Outputs */}
      <Port type="output" portId="out-result" data={{ nodeId: id }} />
      <Port type="output" portId="out-error" data={{ nodeId: id }} />
    </div>
  );
};
```

### Пример 2: Полноценное приложение с валидацией

См. [src/examples/MultiPortExample.tsx](src/examples/MultiPortExample.tsx)

Демонстрирует:
- Nodes с 3+ портами каждая
- Валидацию по типам портов (data/config/trigger)
- Event log для отображения всех событий
- Визуальную обратную связь

---

## Миграция существующего кода

### Обратная совместимость

✅ **Все существующие компоненты продолжают работать без изменений.**

Если вы не указываете `portId`, используются дефолтные значения:
- Output port: `portId = "out"`
- Input port: `portId = "in"`

### Если вы хотите добавить multi-port:

1. **Добавьте `portId` к вашим Port компонентам:**

```tsx
// Было:
<Port type="input" data={{ nodeId: id }} />

// Стало:
<Port type="input" portId="my-custom-input" data={{ nodeId: id }} />
```

2. **(Опционально) Оберните ваше приложение в ConnectionProvider:**

```tsx
<ConnectionProvider canConnect={myValidationFn} eventHandlers={myHandlers}>
  <Flow ... />
</ConnectionProvider>
```

3. **(Опционально) Используйте новые типы для type-safety:**

```typescript
import type {
  CanConnectFn,
  ConnectionEventHandlers,
  ConnectionAttempt
} from 'flowforge-react/types';
```

---

## Дальнейшее развитие

Реализация пункта 3 завершена, дальнейшие шаги идут уже по следующим пунктам плана:

- **Пункт 4**: Controlled/uncontrolled mode + Undo/Redo
- **Пункт 5**: Viewport culling + WebGL edges
- **Пункт 6**: UX фичи (selection, hotkeys, snapping, minimap)
- **Пункт 7**: Typed EventEmitter, хуки-адаптеры

---

## Файлы, которые были изменены

### Основные изменения:
- ✅ [src/types/types.ts](src/types/types.ts) - добавлены типы для multi-port и connection events
- ✅ [src/components/Port.tsx](src/components/Port.tsx) - поддержка portId и интеграция с ConnectionProvider
- ✅ [src/core/Graph.ts](src/core/Graph.ts) - поиск портов по portId
- ✅ [src/providers/ConnectionProvider.tsx](src/providers/ConnectionProvider.tsx) - полностью переписан

### Новые файлы:
- ✅ [src/examples/MultiPortNode.tsx](src/examples/MultiPortNode.tsx) - пример ноды с несколькими портами
- ✅ [src/examples/MultiPortExample.tsx](src/examples/MultiPortExample.tsx) - демо-приложение
- ✅ [POINT_3_IMPLEMENTATION.md](POINT_3_IMPLEMENTATION.md) - эта документация

---

## Тестирование

Для тестирования реализации:

1. Запустите пример:
```bash
npm run dev
# или если настроен отдельный example:
npm run example:multiport
```

2. Попробуйте соединить различные порты
3. Проверьте event log в правой части экрана
4. Попробуйте соединить несовместимые порты (должна сработать валидация)

---

## Обратная связь и вопросы

Если у вас есть вопросы или предложения по реализации:
- Создайте issue в репозитории
- Или обратитесь к документации в `flexebility.md` для контекста

**Статус:** ✅ Пункт 3 реализован
