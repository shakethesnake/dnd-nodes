# Flexebility: как сделать FlowForge React гибче

Этот файл — список конкретных улучшений, которые увеличат гибкость библиотеки и удобство её использования в сложных кейсах (workflow editors, visual programming, rule engines).

## 1) Пакетирование и импорты (DX)

- **Единая точка импорта**: пользователи всегда импортируют из `flowforge-react`.
  - Соберите библиотеку в `dist/` и публикуйте в npm (или приватный registry).
  - В `package.json` добавьте явные поля `exports` и `types`, чтобы TS и бандлеры резолвили типы и ESM корректно.
- **Subpath exports (опционально)**: если библиотека разрастётся, удобно поддержать:
  - `flowforge-react/core`, `flowforge-react/components`, `flowforge-react/hooks`, `flowforge-react/types`
  - Это снижает связность и улучшает tree-shaking, но требует дисциплины API и семвер.
- **CSS/стили**: если библиотека поставляет стили, предусмотрите:
  - `flowforge-react/styles.css` (subpath export) или CSS-in-JS стратегию.
- **Dev-UX для примеров**:
  - Примеры в репозитории импортируют из `../index` (локальный `src/index.ts`), чтобы не зависеть от публикации/линковки.
  - Для e2e-проверки “как у пользователя” добавьте отдельный `examples-consumer/` проект, который ставит пакет как зависимость (через workspace/link).

## 2) Расширяемость рендеринга: registry вместо хардкода

- **Node/Edge registries как пропсы**:
  - Сейчас реестр типов нод/рёбер захардкожен внутри Canvas/EdgeLayer.
  - Сделайте API вида: `<Flow graph={graph} nodeTypes={...} edgeTypes={...} />` (или через контекст).
  - Это сразу открывает путь к “плагинам” и внешним наборам компонентов.
- **Кастомный Canvas**:
  - Поддержите композицию: пользователи могут заменить Canvas целиком, но использовать ваши провайдеры/Graph.
  - Пример: `<Flow graph={graph} renderCanvas={() => <MyCanvas/>} />`.

## 3) Порты и соединения: “портовая” модель как часть core

- **Поддержка multi-port официально**:
  - В `EdgeData` добавить `sourcePortId/targetPortId` (или `sourceHandle/targetHandle`).
  - В `Graph.updateEdgesForNode()` научить искать конкретные порты (не только `.port.input/.port.output`).
- **Стратегия соединений** (connection strategy):
  - Хук/коллбек валидации: можно ли соединять эти порты? (типы данных, направления, кратность, запрет циклов, и т.д.)
  - Маппинг “куда приклеиваться” при drag (snapping к ближайшему порту, приоритеты).
- **События соединений**:
  - `onConnectStart`, `onConnectMove`, `onConnectEnd`, `onConnect` (успех), `onConnectCancel`.
  - Сейчас LiveEdge живёт отдельно — сделайте его частью предсказуемого lifecycle.

## 4) Состояние и управляемость (controlled/uncontrolled)

- **Controlled mode**:
  - Разрешить управлять `nodes/edges` извне (через пропсы + callbacks), сохраняя внутренний Graph как “движок”.
  - Это упрощает интеграцию с Redux, Zustand, RTK Query, Yjs/CRDT и т.п.
- **Транзакции/батчинг**:
  - `graph.batch(() => { ... })` или `graph.setState` с батч-режимом для больших изменений (1000+ нод).
  - Это уменьшит лишние уведомления подписчиков и перерасчёт рёбер.
- **Undo/Redo**:
  - История изменений на уровне GraphState (команды или снапшоты).
  - Для workflow-редакторов это критично.
- **Сериализация**:
  - `graph.toJSON()` / `Graph.fromJSON()` со схемой версии, миграциями, и валидацией входных данных.

## 5) Производительность и масштаб (большие графы)

- **Viewport culling “из коробки”**:
  - Сейчас `useViewport` есть, но не интегрирован в Canvas по умолчанию.
  - Сделайте опцию `viewportCulling` и/или `renderOnlyVisibleNodes`.
- **Edge routing стратегии**:
  - Несколько роутеров: bezier / orthogonal / smooth-step / custom.
  - Кэширование путей (у вас уже есть memoization в `makePath`) + ключи на основе портов.
- **WebGL слой рёбер (опционально)**:
  - В проекте есть `regl`; логично дать переключатель `EdgesLayer type="webgl"` для массовых рёбер.

## 6) UX-фичи, которые повышают “фреймворковость”

- **Выделение/рамка выделения** (lasso), multi-select, группировка.
- **Keyboard shortcuts**: delete, duplicate, copy/paste, arrow-move, zoom in/out.
- **Snapping**: к сетке, к направляющим, выравнивание, distribute.
- **Minimap**, breadcrumbs, search по нодам.
- **Интерактивные рёбра**:
  - У вас есть `BreakableEdge`, но click handler закомментирован — хорошо бы сделать это конфигурируемым и доступным через API.

## 7) API наблюдений и интеграций

- **EventEmitter “по-взрослому”**:
  - Сейчас он минимальный. Для реальных интеграций часто нужны payload’ы, once, wildcard, typed events.
- **Хуки-адаптеры**:
  - `useNode(id)`, `useEdgesForNode(id)`, `useSelection()`, `useConnectionPreview()` — уменьшают boilerplate.

## 8) Документация и примеры как часть продукта

- **Cookbook**: multi-port, async nodes, validation, custom edge routing, custom node shell, perf.
- **One “advanced” пример** (как в `advanced_example.md`) лучше держать как живую демку в `src/examples/` и как отдельный consumer-проект, чтобы гарантировать импорт из `flowforge-react`.

---

Если хочешь, я могу:
- предложить конкретную схему `exports` для `package.json` под ваш build (ESM + d.ts),
- или спроектировать минимальный “plugin API” (registry + hooks + events) так, чтобы не ломать текущую архитектуру.


---

# Детальные решения по каждому пункту

Ниже — “что именно сделать и как” для каждого раздела выше. Я пишу это с учётом текущей структуры проекта (`src/index.ts` уже есть, сборка сейчас “app-first” через Vite).

## 1) Пакетирование и импорты (DX) — как сделать `import ... from "flowforge-react"` рабочим

### 1.1 Единая точка импорта (пакет реально существует)

**Проблема, которую решаем:** внутри репозитория можно импортировать из `src/…`, но внешний пользователь хочет `from "flowforge-react"`. Это возможно только если библиотека **собрана** и **установлена** как dependency.

**Что сделать:**
- Перевести сборку в режим “library build” (выходные файлы в `dist/`).
- Генерировать `d.ts` (типовые декларации) рядом с JS.
- Описать `exports`/`types` в `package.json`, чтобы TS и бандлеры одинаково резолвили вход.

**Как сделать (вариант A: Vite library mode):**
- Вынести отдельную конфигурацию для lib-билда или добавить условный режим в `vite.config.ts`.
- Включить `build.lib` с entry `src/index.ts`, задать `formats: ['es']` (минимум).
- Обязательно настроить “external” для `react` и `react-dom` (чтобы не бандлить React внутрь библиотеки).

**Как сделать (вариант B: отдельный сборщик JS + отдельный билд типов):**
- JS: `tsup`/`rollup`/`esbuild` (любой), entry `src/index.ts`, output в `dist/`.
- Типы: `tsc -p tsconfig.build.json` с `declaration: true`, `emitDeclarationOnly: true`, `outDir: dist`.

**Что прописать в `package.json` (минимальный смысл):**
- `"name": "flowforge-react"` (у вас уже так)
- `"main"`/`"module"`/`"types"` или (лучше) `"exports"`, например:
  - `exports["."].import -> ./dist/index.js`
  - `exports["."].types -> ./dist/index.d.ts`

### 1.2 Subpath exports (опционально)

**Проблема:** когда API разрастается, пользователи хотят стабильные “подмодули” и более предсказуемый tree-shaking.

**Что сделать:**
- Создать отдельные public entrypoints:
  - `src/core/index.ts`, `src/components/index.ts`, `src/hooks/index.ts`, `src/types/index.ts` (они уже есть)
- Экспортировать их как subpaths через `package.json#exports`:
  - `"./core"`, `"./components"`, `"./hooks"`, `"./types"`

**Как:**
- Следить, чтобы эти entrypoints не тянули лишнее (например, `core` не должен импортировать React).
- Документировать, что root-import (`"flowforge-react"`) — “stable”, а subpaths — “advanced/optional”.

### 1.3 CSS/стили

**Проблема:** пользователи хотят “из коробки” стили, но не все хотят навязывание.

**Что сделать:**
- Выбрать стратегию:
  - (а) библиотека экспортирует готовый CSS файл: `flowforge-react/styles.css`
  - (б) полностью без стилей, но с CSS variables/классами (пользователь стилизует сам)

**Как (а):**
- Хранить стили в `src/styles.css`, копировать в `dist/styles.css`.
- Добавить subpath export `"./styles.css"`.
- В README: “подключите один раз `import 'flowforge-react/styles.css'`”.

### 1.4 Dev-UX для примеров в репозитории

**Проблема:** если примеры импортируют `from "flowforge-react"` внутри этого же репо, TS будет ругаться, пока пакет не установлен как dependency.

**Что сделать (рекомендуемо):**
- Внутренние примеры импортируют из локального entrypoint:
  - из `src/examples/*` это `from ".."` или `from "../index"`.
- Для проверки “как у пользователя” добавить отдельный consumer-проект:
  - `examples-consumer/` с собственным `package.json`, который зависит от `flowforge-react` через workspace или `npm link`.

---

## 2) Registry вместо хардкода — как дать пользователю свои ноды/рёбра

**Проблема:** сейчас `FlowCanvas` держит `nodeTypes` внутри файла, `EdgesLayer` — `edgeTypes` внутри файла. Пользователь не может “подключить” свои типы без форка.

**Что сделать:**
- Ввести публичные типы:
  - `type NodeRenderer = React.FC<NodeData>`
  - `type EdgeRenderer = React.FC<EdgeData>`
- Вынести registries в props `Flow` (или в отдельный Provider):
  - `<Flow graph={graph} nodeTypes={...} edgeTypes={...} />`

**Как (реализация):**
- `src/components/Flow.tsx`: принять `nodeTypes/edgeTypes` и положить в контекст.
- `src/components/Canvas.tsx`: доставать `nodeTypes` из контекста вместо локального объекта.
- `src/components/EdgeLayer.tsx`: доставать `edgeTypes` из контекста.
- Добавить дефолтные registry, которые соответствуют текущим `Node/CustomNode/ExperimentalNode` и `Edge/AnimatedEdge/BreakableEdge`.

**Бонус:** разрешить частичное переопределение:
- `nodeTypes={{ ...defaultNodeTypes, myType: MyNode }}`

---

## 3) Порты и соединения — как сделать multi-port “официальной” фичей core

### 3.1 Multi-port в данных

**Проблема:** сейчас `EdgeData` хранит только `sourceNode/targetNode` и (иногда) координаты `sourcePort/targetPort`, но нет привязки к “какому именно порту” (если их несколько).

**Что сделать:**
- Расширить `EdgeData` (в `src/types/types.ts`) полями:
  - `sourcePortId?: string`
  - `targetPortId?: string`
- Обновить создание ребра (в `Port.tsx` и/или Node-компонентах), чтобы эти поля заполнялись.

### 3.2 Обновление путей с учётом portId

**Проблема:** `Graph.updateEdgesForNode()` ищет `.port.output`/`.port.input` без `portId`.

**Что сделать:**
- Изменить алгоритм получения портов:
  - искать `.port.output[data-port-id="..."]` и `.port.input[data-port-id="..."]`
- Ввести дефолт `portId` (например `"out"` и `"in"`) если не задан.

**Как:**
- Обновить `Graph.getNodePortsScreen()` так, чтобы оно принимало `portId` и тип порта.
- В `EdgesLayer` и `updateEdgesForNode` использовать `edge.sourcePortId/edge.targetPortId`.

### 3.3 Connection strategy + события

**Проблема:** пользователю нужны правила соединений (типы данных, кратность, запрет циклов, “только один вход”, и т.п.).

**Что сделать:**
- Добавить API-коллбек/стратегию:
  - `canConnect({ sourceNodeId, sourcePortId, targetNodeId, targetPortId }) -> boolean | { ok: false, reason }`
- Добавить lifecycle события:
  - `onConnectStart`, `onConnectMove`, `onConnectCancel`, `onConnect`

**Как:**
- Держать состояние “идёт соединение” в отдельном `ConnectionProvider` (он у вас уже есть) и сделать его источником правды.
- LiveEdge должен быть внутренней реализацией этого состояния, а не “самостоятельной” процедурой.

---

## 4) Controlled/uncontrolled — как интегрироваться с внешним стейтом и добавлять Undo/Redo

### 4.1 Controlled mode

**Проблема:** многие приложения хотят хранить граф в своём сторе (Redux/Zustand/Yjs), а библиотека должна быть “view + interaction layer”.

**Что сделать:**
- Ввести режим, когда `Flow` принимает `state` и `onChange`:
  - `nodes`, `edges`, `onNodesChange`, `onEdgesChange` (или один `onStateChange`)
- `Graph` остаётся как helper (coords, registry DOM, path updates), но данные могут приходить извне.

**Как:**
- Сделать `Graph` способным “подписываться” на внешний state (или сделать Graph опциональным, а Canvas работать напрямую от props).
- На практике удобнее: `Graph` хранит только runtime/DOM registry, а данные — controlled.

### 4.2 Батчинг

**Проблема:** при массовых изменениях (1000 нод) много лишних `subscribe()` уведомлений и перерасчётов.

**Что сделать:**
- Добавить `store.batch(fn)` или `graph.batch(fn)`:
  - внутри `createStore` временно накапливать обновления и вызвать listeners один раз.

### 4.3 Undo/Redo

**Что сделать:**
- Выбрать модель:
  - snapshots (проще, но память) или commands/patches (сложнее, но экономичнее).
- Добавить `history` слой поверх `graph.setState`:
  - при каждом “логическом” действии пушить запись в историю.

**Как:**
- В UI-слое различать “drag move” (можно коммитить один раз на pointerup) и “edit action”.

### 4.4 Сериализация

**Что сделать:**
- `GraphState` -> JSON (без DOM/registry).
- Версионирование схемы: `{ version: 1, nodes, edges }`.
- Миграции: `migrate(v1->v2)`.

---

## 5) Производительность — как масштабироваться на большие графы

### 5.1 Viewport culling по умолчанию

**Что сделать:**
- В `FlowCanvas` добавить опцию `viewportCulling` и использовать `useViewport`.
- Рендерить только `visibleNodes`.

**Как:**
- Дать `containerRef` на canvas wrapper (у вас `data-flow-root` уже есть).
- При zoom/pan учитывать трансформации (если появятся) — bounds должен работать в координатах canvas.

### 5.2 Роутинг рёбер

**Что сделать:**
- Ввести интерфейс роутера:
  - `type EdgeRouter = (a: Vec2, b: Vec2, ctx) => string`
- Дефолт: текущий `makePath`.

**Как:**
- Передавать router через контекст/props.
- Для orthogonal/smooth-step можно держать отдельные реализации в `core/routers/*`.

### 5.3 WebGL слой рёбер

**Что сделать:**
- Реально реализовать `EdgesLayer type="webgl"`:
  - SVG для интерактивных/подписанных рёбер, WebGL для “фона” массовых соединений.

**Как:**
- Ввести “dual layer”: webgl canvas + svg overlay.
- Держать геометрию линий в буферах и обновлять батчами.

---

## 6) UX-фичи — как закрыть ожидания от workflow-редактора

### 6.1 Selection / lasso / multi-select

**Что сделать:**
- В `GraphState` хранить:
  - `selectedNodeIds: string[]`, `selectedEdgeIds: string[]`
- Реализовать lasso rectangle на canvas pointer events.

### 6.2 Hotkeys

**Что сделать:**
- Хук `useHotkeys({ onDelete, onDuplicate, ... })`.
- Единый список shortcuts в docs.

### 6.3 Snapping

**Что сделать:**
- Опции: `gridSize`, `snapToGrid`, `snapThreshold`.
- При drag (на pointerup) округлять позицию, а при pointermove — показывать preview.

### 6.4 Minimap / search

**Что сделать:**
- Minimap: bounding box всех нод -> маленький viewport.
- Search: индекс по `label/id` -> фокус/подсветка.

### 6.5 Интерактивные рёбра

**Что сделать:**
- В `BreakableEdge` вернуть управляемый `onClick` (не хардкод удаления).
- Ввести `edgeInteraction` config:
  - например `{ deletable: true, onDeleteEdge(id) }`.

---

## 7) API наблюдений и интеграций — как стать “платформой”

### 7.1 Typed EventEmitter

**Что сделать:**
- Переписать `EventEmitter` на generic event map:
  - `on<K extends keyof Events>(event: K, cb: (payload: Events[K]) => void)`
  - `emit<K extends keyof Events>(event: K, payload: Events[K])`
- Добавить `once`, опционально wildcard.

### 7.2 Хуки-адаптеры (меньше boilerplate)

**Что сделать:**
- Добавить “селекторы” к store:
  - `useStore(store, selector)` чтобы не перерендеривать всё при любом изменении.
- На основе этого сделать:
  - `useNode(id)`, `useEdgesForNode(id)`, `useSelection()`.

---

## 8) Документация и примеры — как превратить репо в продукт

### 8.1 Cookbook

**Что сделать:**
- Папка `docs/` с короткими рецептами:
  - multi-port, async nodes, validation, custom edge routing, custom node shell, perf.

### 8.2 Advanced demo как “контракт качества”

**Что сделать:**
- Держать advanced-демку в двух вариантах:
  - (а) внутри репозитория (импорт из `../index`) — чтобы быстро развивать
  - (б) consumer-проект (импорт из `"flowforge-react"`) — чтобы гарантировать, что публикация/exports/типы работают как у пользователя
