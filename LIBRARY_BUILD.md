# FlowForge React - Library Build Documentation

## Обзор

FlowForge React теперь настроен как полноценная библиотека с поддержкой импортов и TypeScript типов.

## Сборка библиотеки

```bash
npm run build
```

Эта команда:
1. Генерирует TypeScript декларации типов в `dist/` через `tsc`
2. Собирает JavaScript модули через Vite

## Использование библиотеки

### Основной импорт

Импорт всех компонентов и утилит из главного входного файла:

```typescript
import {
  Flow,
  Graph,
  useGraph,
  type NodeData,
  type EdgeData
} from 'flowforge-react';
```

### Subpath Exports (опционально)

Для оптимизации tree-shaking и уменьшения размера бандла можно импортировать из конкретных модулей:

```typescript
// Core функциональность
import { Graph, createStore } from 'flowforge-react/core';

// Компоненты
import { Flow, Node, Edge } from 'flowforge-react/components';

// Хуки
import { useGraph, useStore } from 'flowforge-react/hooks';

// Провайдеры
import { GraphProvider, FlowProvider } from 'flowforge-react/providers';

// Только типы
import type { NodeData, EdgeData, GraphState } from 'flowforge-react/types';
```

## Структура exports

В `package.json` настроены следующие экспорты:

- `.` - главный entry point со всеми экспортами
- `./core` - ядро библиотеки (Graph, createStore, EventEmitter, LiveEdge, утилиты)
- `./components` - React компоненты
- `./hooks` - React хуки
- `./providers` - React контекстные провайдеры
- `./types` - только TypeScript типы

## Внешние зависимости

Библиотека помечает следующие пакеты как external (не включаются в бандл):
- `react`
- `react-dom`
- `react/jsx-runtime`

Пользователь библиотеки должен установить эти зависимости самостоятельно.

## Файлы в npm пакете

При публикации в npm будут включены только файлы из директории `dist/`:

```
dist/
├── index.js              # Главный entry point
├── index.d.ts            # TypeScript типы для главного entry point
├── core.js               # Core module
├── components.js         # Components module
├── hooks.js              # Hooks module
├── providers.js          # Providers module
├── types.js              # Types module (пустой, только для типов)
└── [chunk files]         # Внутренние чанки для code splitting
```

## Разработка

Для локальной разработки примеров в репозитории, импорты должны использовать относительные пути:

```typescript
// В src/examples/**/*
import { Flow, Graph } from '../index';
```

Для тестирования библиотеки "как у пользователя", рекомендуется создать отдельный consumer проект через npm workspace или npm link.

## TypeScript конфигурация

### tsconfig.build.json

Используется для генерации `.d.ts` файлов:
- `declaration: true` - генерировать типы
- `emitDeclarationOnly: true` - только типы, без JS
- Исключает тесты и примеры из сборки

### vite.config.ts

Настроен для library mode:
- Multiple entry points для subpath exports
- ESM формат
- External dependencies для React
- Sourcemaps включены

## Рекомендации

1. **Версионирование**: Используйте semantic versioning для публикации
2. **Changelog**: Ведите changelog для отслеживания изменений API
3. **Breaking changes**: Документируйте breaking changes при обновлении major версии
4. **CSS/стили**: В будущем можно добавить `./styles.css` subpath export для стилей

## Следующие шаги (из flexebility.md)

- [ ] Добавить CSS/стили экспорт
- [ ] Создать consumer-проект для e2e тестирования
- [ ] Настроить автоматическую публикацию в npm
- [ ] Добавить registry для кастомных типов нод/рёбер (пункт 2)
- [ ] Реализовать multi-port поддержку (пункт 3)
