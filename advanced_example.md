# Продвинутый пример: «D&D Damage Pipeline» (узловой редактор + вычислительный движок)

Ниже — один «серьёзный» пример, который одновременно использует редактор
(ноды/рёбра/drag&drop/LiveEdge) и показывает, что граф можно интерпретировать как
вычислительный DAG (реактивный “rule engine”).

Идея: собрать пайплайн расчёта **ожидаемого урона** с учётом
**вероятности попадания**, **кубов**, а также **асинхронного шага**
(получение резистов монстра).

> Пример большой: ниже он разбит на несколько блоков кода, как на “файлы”.

## Что демонстрирует пример

- Мульти-порты (несколько входов у одного узла) через `data-port-id` + хранение
  `fromPort/toPort` в `edge.data`.
- LiveEdge preview при протягивании соединения
  (`createLiveEdge/updateLiveEdge/removeLiveEdge`).
- Свой слой рёбер (аналог `EdgesLayer`), но с логикой выбора портов по `portId`.
- Свой NodeShell (drag логика) с обновлением рёбер через rAF (как в
  `Graph.updateEdgesForNode`, но port-aware).
- Вычислительный движок DAG поверх `GraphState`:
  - топологическая сортировка + диагностика циклов;
  - игнорирование `position` при пересчёте (перетаскивание не триггерит логику);
  - асинхронные ноды + отмена через `AbortController`.

---

## Код примера

Ниже код разбит на 3 «логических файла» (в реальном проекте их стоит разнести):

1) `damageEngine.ts` — вычисления (кубы/распределения/DAG/async + отмена)  
2) `portsAndEdges.tsx` — port-aware порты/рёбра/drag-shell  
3) `AdvancedDamagePipelineExample.tsx` — UI-ноды + сборка стартового графа

### 1) `damageEngine.ts`

```ts
// damageEngine.ts
import type { Dispatch, SetStateAction } from "react";
import type { EdgeData, NodeData } from "flowforge-react";

export type PortId = string;

export type NodeKind =
  | "const"
  | "dice"
  | "add"
  | "pHitGte" // вероятность: P(x >= threshold)
  | "expectedDamage" // E[dmg] * pHit
  | "monsterLookup" // async: резисты монстра
  | "applyResistance"
  | "output";

export type DamageNode = NodeData<{
  kind: NodeKind;
  value?: number; // const
  dice?: { count: number; sides: number }; // dice
  threshold?: number; // pHitGte
  monsterId?: string; // monsterLookup
  damageType?: string; // applyResistance
}>;

export type DamageEdge = EdgeData<{
  fromPort: PortId;
  toPort: PortId;
  color?: string;
  dataType?: "number" | "dist" | "prob" | "monster";
}>;

export type Dist = Map<number, number>; // value -> probability

export type Value =
  | { kind: "number"; value: number }
  | { kind: "prob"; value: number }
  | { kind: "dist"; value: Dist }
  | { kind: "monster"; resist: Set<string> };

export type RuntimeState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "ok"; value: Value }
  | { status: "error"; error: string };

export type RuntimeById = Record<string, RuntimeState>;

export function expectedValue(d: Dist): number {
  let sum = 0;
  for (const [v, p] of d) sum += v * p;
  return sum;
}

export function distFromConstant(n: number): Dist {
  return new Map([[n, 1]]);
}

export function distConvolve(a: Dist, b: Dist): Dist {
  const out = new Map<number, number>();
  for (const [va, pa] of a) {
    for (const [vb, pb] of b) {
      const v = va + vb;
      out.set(v, (out.get(v) ?? 0) + pa * pb);
    }
  }
  return out;
}

export function distDice(count: number, sides: number): Dist {
  let base: Dist = new Map();
  for (let i = 1; i <= sides; i++) base.set(i, 1 / sides);

  let out = distFromConstant(0);
  for (let i = 0; i < count; i++) out = distConvolve(out, base);
  return out;
}

export function probGteDist(d: Dist, threshold: number): number {
  let p = 0;
  for (const [v, prob] of d) if (v >= threshold) p += prob;
  return p;
}

export function formatValue(v: Value): string {
  switch (v.kind) {
    case "number":
      return v.value.toFixed(3);
    case "prob":
      return `${(v.value * 100).toFixed(1)}%`;
    case "dist":
      return `dist{E=${expectedValue(v.value).toFixed(3)}}`;
    case "monster":
      return `resist=[${Array.from(v.resist).join(", ")}]`;
  }
}

const MONSTERS: Record<string, { resist: string[] }> = {
  goblin: { resist: [] },
  skeleton: { resist: ["piercing", "slashing"] },
  fireElemental: { resist: ["fire"] },
};

async function fetchMonster(monsterId: string, signal: AbortSignal): Promise<Set<string>> {
  // Имитация задержки + поддержка отмены.
  await new Promise<void>((resolve, reject) => {
    const t = window.setTimeout(resolve, 500);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

  const m = MONSTERS[monsterId] ?? { resist: [] };
  return new Set(m.resist);
}

function topoSort(nodes: DamageNode[], edges: DamageEdge[]) {
  const inDeg = new Map<string, number>();
  const out = new Map<string, string[]>();

  for (const n of nodes) {
    inDeg.set(n.id, 0);
    out.set(n.id, []);
  }

  for (const e of edges) {
    if (!inDeg.has(e.sourceNode) || !inDeg.has(e.targetNode)) continue;
    inDeg.set(e.targetNode, (inDeg.get(e.targetNode) ?? 0) + 1);
    out.get(e.sourceNode)!.push(e.targetNode);
  }

  const q: string[] = [];
  for (const [id, d] of inDeg) if (d === 0) q.push(id);

  const order: string[] = [];
  while (q.length) {
    const id = q.shift()!;
    order.push(id);
    for (const t of out.get(id) ?? []) {
      inDeg.set(t, (inDeg.get(t) ?? 0) - 1);
      if ((inDeg.get(t) ?? 0) === 0) q.push(t);
    }
  }

  const hasCycle = order.length !== nodes.length;
  return { order, hasCycle };
}

function buildInputMap(nodeId: string, edges: DamageEdge[], values: Map<string, Value>) {
  // inputPort -> Value из sourceNode
  const inputs = new Map<PortId, Value>();
  for (const e of edges) {
    if (e.targetNode !== nodeId) continue;
    const toPort = e.data?.toPort ?? "in";
    const v = values.get(e.sourceNode);
    if (!v) continue;
    inputs.set(toPort, v);
  }
  return inputs;
}

function asNumber(v: Value): number | null {
  if (v.kind === "number") return v.value;
  if (v.kind === "prob") return v.value;
  if (v.kind === "dist") return expectedValue(v.value);
  return null;
}

function asDist(v: Value): Dist | null {
  if (v.kind === "dist") return v.value;
  if (v.kind === "number") return distFromConstant(v.value);
  return null;
}

export async function runEngine(params: {
  nodes: DamageNode[];
  edges: DamageEdge[];
  signal: AbortSignal;
  setRuntime: Dispatch<SetStateAction<RuntimeById>>;
}) {
  const { nodes, edges, signal, setRuntime } = params;

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const { order, hasCycle } = topoSort(nodes, edges);

  // На старте — отмечаем, что всё "running"
  setRuntime(() => {
    const next: RuntimeById = {};
    for (const n of nodes) next[n.id] = { status: "running" };
    return next;
  });

  if (hasCycle) {
    setRuntime(() => {
      const next: RuntimeById = {};
      for (const n of nodes) next[n.id] = { status: "error", error: "Cycle detected: граф не DAG" };
      return next;
    });
    return;
  }

  const values = new Map<string, Value>();

  for (const id of order) {
    if (signal.aborted) return;
    const n = byId.get(id);
    if (!n) continue;

    try {
      const inputs = buildInputMap(id, edges, values);
      const kind = n.data?.kind;

      let out: Value;
      switch (kind) {
        case "const": {
          out = { kind: "number", value: n.data?.value ?? 0 };
          break;
        }
        case "dice": {
          const c = n.data?.dice?.count ?? 1;
          const s = n.data?.dice?.sides ?? 20;
          out = { kind: "dist", value: distDice(c, s) };
          break;
        }
        case "add": {
          const a = inputs.get("a");
          const b = inputs.get("b");
          if (!a || !b) throw new Error("add: нужны входы a и b");
          const da = asDist(a);
          const db = asDist(b);
          if (!da || !db) throw new Error("add: несовместимые типы входов");
          out = { kind: "dist", value: distConvolve(da, db) };
          break;
        }
        case "pHitGte": {
          const x = inputs.get("x");
          const threshold = n.data?.threshold ?? 10;
          if (!x) throw new Error("pHitGte: нужен вход x");
          if (x.kind === "dist") out = { kind: "prob", value: probGteDist(x.value, threshold) };
          else if (x.kind === "number") out = { kind: "prob", value: x.value >= threshold ? 1 : 0 };
          else throw new Error("pHitGte: ожидается dist/number");
          break;
        }
        case "expectedDamage": {
          const dmg = inputs.get("dmg");
          const p = inputs.get("p");
          if (!dmg || !p) throw new Error("expectedDamage: нужны входы dmg и p");
          const ev = asNumber(dmg);
          if (ev === null) throw new Error("expectedDamage: dmg не приводится к number");
          if (p.kind !== "prob" && p.kind !== "number") throw new Error("expectedDamage: p должен быть prob/number");
          const pv = p.kind === "prob" ? p.value : p.value;
          out = { kind: "number", value: ev * pv };
          break;
        }
        case "monsterLookup": {
          const monsterId = n.data?.monsterId ?? "goblin";
          const resist = await fetchMonster(monsterId, signal);
          out = { kind: "monster", resist };
          break;
        }
        case "applyResistance": {
          const dmg = inputs.get("dmg");
          const mon = inputs.get("mon");
          const damageType = n.data?.damageType ?? "fire";
          if (!dmg || !mon) throw new Error("applyResistance: нужны входы dmg и mon");
          if (mon.kind !== "monster") throw new Error("applyResistance: mon должен быть monster");
          const v = asNumber(dmg);
          if (v === null) throw new Error("applyResistance: dmg не приводится к number");
          out = { kind: "number", value: mon.resist.has(damageType) ? v / 2 : v };
          break;
        }
        case "output": {
          const x = inputs.get("in");
          if (!x) throw new Error("output: нужен вход in");
          out = x;
          break;
        }
        default:
          throw new Error(`Unknown kind: ${String(kind)}`);
      }

      values.set(id, out);
      setRuntime((prev) => ({ ...prev, [id]: { status: "ok", value: out } }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setRuntime((prev) => ({ ...prev, [id]: { status: "error", error: msg } }));
    }
  }
}

// Игнорируем position, чтобы UI-драг не триггерил пересчёт
export function logicKey(nodes: DamageNode[], edges: DamageEdge[]): string {
  const n = nodes
    .map((x) => ({ id: x.id, type: x.type, data: x.data }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const e = edges
    .map((x) => ({ id: x.id, sourceNode: x.sourceNode, targetNode: x.targetNode, data: x.data, type: x.type }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify({ n, e });
}
```

### 2) `portsAndEdges.tsx`

```tsx
// portsAndEdges.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  createLiveEdge,
  updateLiveEdge,
  removeLiveEdge,
  makePath,
  type Vec2,
  useGraph,
  useStore,
  type Graph,
} from "flowforge-react";

import type { DamageEdge, DamageNode } from "./damageEngine";

function portCenter(el: HTMLElement | null): Vec2 | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function getPortEl(graph: Graph, nodeId: string, portId: string, portType?: "input" | "output") {
  const nodeEl = graph.nodeRegistry.get(nodeId);
  if (!nodeEl) return null;
  const typeSel = portType ? `[data-port-type="${portType}"]` : "";
  return nodeEl.querySelector<HTMLElement>(`.port${typeSel}[data-port-id="${portId}"]`);
}

// rAF-batched update paths for edges connected to a given nodeId
export const rafUpdateEdgesForNode = (() => {
  const frames = new Map<string, number>();
  return (graph: Graph, nodeId: string) => {
    const prev = frames.get(nodeId);
    if (prev) cancelAnimationFrame(prev);

    const frame = requestAnimationFrame(() => {
      frames.delete(nodeId);
      const svg = graph.getLayer("edgeLayer");
      if (!(svg instanceof SVGSVGElement)) return;

      const { edges } = graph.getState();
      const related = (edges as DamageEdge[]).filter(
        (e) => e.sourceNode === nodeId || e.targetNode === nodeId
      );

      for (const e of related) {
        const fromPort = e.data?.fromPort ?? "out";
        const toPort = e.data?.toPort ?? "in";

        const sEl = getPortEl(graph, e.sourceNode, fromPort, "output");
        const tEl = getPortEl(graph, e.targetNode, toPort, "input");
        const s = portCenter(sEl);
        const t = portCenter(tEl);
        if (!s || !t) continue;

        const pathEls = svg.querySelectorAll<SVGPathElement>(`path[data-edge-id="${e.id}"]`);
        pathEls.forEach((p) => p.setAttribute("d", makePath(s, t)));
      }
    });

    frames.set(nodeId, frame);
  };
})();

export function TypedPort(props: {
  nodeId: string;
  portId: string;
  type: "input" | "output";
  style: React.CSSProperties;
}) {
  const { nodeId, portId, type, style } = props;
  const graph = useGraph();

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (type !== "output") return;
    e.stopPropagation();

    const el = e.currentTarget;
    const start = portCenter(el);
    const layer = graph.getLayer("edgeLayer");
    if (!start || !(layer instanceof SVGSVGElement)) return;

    createLiveEdge(layer, start);

    const handleMove = (ev: PointerEvent) => updateLiveEdge(start, { x: ev.clientX, y: ev.clientY });

    const handleUp = (ev: PointerEvent) => {
      const targetEl = ev.target as HTMLElement;
      const tType = targetEl.getAttribute("data-port-type");
      const tNodeId = targetEl.getAttribute("data-port-node");
      const tPortId = targetEl.getAttribute("data-port-id");

      if (tType === "input" && tNodeId && tPortId && tNodeId !== nodeId) {
        graph.setState((s) => ({
          ...s,
          edges: [
            ...s.edges,
            {
              id: crypto.randomUUID(),
              sourceNode: nodeId,
              targetNode: tNodeId,
              type: "default",
              data: { fromPort: portId, toPort: tPortId, color: "#7aa2ff", dataType: "dist" },
            } satisfies DamageEdge,
          ],
        }));
      }

      removeLiveEdge();
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  return (
    <div
      className={`port ${type}`}
      data-port-type={type}
      data-port-node={nodeId}
      data-port-id={portId}
      onPointerDown={onPointerDown}
      style={{
        width: 10,
        height: 10,
        borderRadius: 4,
        background: type === "output" ? "#7aa2ff" : "#9ca3af",
        border: "1px solid rgba(255,255,255,0.25)",
        ...style,
      }}
    />
  );
}

export function NodeShellMultiPort(props: { node: DamageNode; children: React.ReactNode; style?: React.CSSProperties }) {
  const { node, children, style } = props;
  const graph = useGraph();
  const ref = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (ref.current) graph.nodeRegistry.set(node.id, ref.current);
    return () => graph.nodeRegistry.delete(node.id);
  }, [graph, node.id]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const el = ref.current;
    if (!el) return;

    const startCanvas = graph.toCanvasSpace({ x: e.clientX, y: e.clientY });
    const startPos = graph.getState().nodes.find((n) => n.id === node.id)?.position;
    if (!startPos) return;

    setDragging(true);
    graph.setState((s) => ({ ...s, draggingId: node.id }));

    const handleMove = (ev: PointerEvent) => {
      const curCanvas = graph.toCanvasSpace({ x: ev.clientX, y: ev.clientY });
      const dx = curCanvas.x - startCanvas.x;
      const dy = curCanvas.y - startCanvas.y;
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      rafUpdateEdgesForNode(graph, node.id);
    };

    const handleUp = (ev: PointerEvent) => {
      const curCanvas = graph.toCanvasSpace({ x: ev.clientX, y: ev.clientY });
      const dx = curCanvas.x - startCanvas.x;
      const dy = curCanvas.y - startCanvas.y;

      graph.setState((s) => ({
        ...s,
        nodes: s.nodes.map((n) =>
          n.id === node.id ? { ...n, position: { x: startPos.x + dx, y: startPos.y + dy } } : n
        ),
        draggingId: null,
      }));

      el.style.left = `${startPos.x + dx}px`;
      el.style.top = `${startPos.y + dy}px`;
      el.style.transform = "";
      setDragging(false);

      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  return (
    <div
      ref={ref}
      className={`node ${dragging ? "dragging" : ""}`}
      onPointerDown={onPointerDown}
      style={{
        position: "absolute",
        left: node.position.x,
        top: node.position.y,
        width: 220,
        borderRadius: 10,
        background: "rgba(17,24,39,0.9)",
        border: "1px solid rgba(255,255,255,0.12)",
        color: "white",
        userSelect: "none",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function MultiPortEdgesLayer() {
  const graph = useGraph();
  const { edges } = useStore(graph.getStore()) as { edges: DamageEdge[] };
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    for (const e of edges) {
      const fromPort = e.data?.fromPort ?? "out";
      const toPort = e.data?.toPort ?? "in";

      const sEl = getPortEl(graph, e.sourceNode, fromPort, "output");
      const tEl = getPortEl(graph, e.targetNode, toPort, "input");
      const s = portCenter(sEl);
      const t = portCenter(tEl);
      if (!s || !t) continue;

      const pathEls = svg.querySelectorAll<SVGPathElement>(`path[data-edge-id="${e.id}"]`);
      pathEls.forEach((p) => p.setAttribute("d", makePath(s, t)));
    }
  }, [edges, graph]);

  return (
    <svg
      ref={(el) => {
        svgRef.current = el;
        if (el) graph.addLayer("edgeLayer", el);
      }}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      {edges.map((e) => (
        <path
          key={e.id}
          data-edge-id={e.id}
          d="M0,0 L0,0"
          stroke={e.data?.color ?? "#94a3b8"}
          strokeWidth={2}
          fill="none"
          strokeDasharray="6 3"
        />
      ))}
    </svg>
  );
}
```

### 3) `AdvancedDamagePipelineExample.tsx`

```tsx
// AdvancedDamagePipelineExample.tsx
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Graph, GraphProvider, ZoomProvider, FlowProvider, useGraph, useStore, debounce } from "flowforge-react";

import { formatValue, logicKey, runEngine, type DamageEdge, type DamageNode, type RuntimeById, type RuntimeState } from "./damageEngine";
import { MultiPortEdgesLayer, NodeShellMultiPort, TypedPort } from "./portsAndEdges";

const RuntimeContext = createContext<RuntimeById>({});

function useRuntime(id: string): RuntimeState {
  const map = useContext(RuntimeContext);
  return map[id] ?? { status: "idle" };
}

function NodeHeader(props: { title: string; subtitle: string }) {
  return (
    <div style={{ padding: "10px 10px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ fontWeight: 700, lineHeight: 1.2 }}>{props.title}</div>
      <div style={{ opacity: 0.75, fontSize: 12 }}>{props.subtitle}</div>
    </div>
  );
}

function RuntimeBadge(props: { id: string }) {
  const r = useRuntime(props.id);
  const bg =
    r.status === "running"
      ? "#2563eb"
      : r.status === "ok"
        ? "#059669"
        : r.status === "error"
          ? "#dc2626"
          : "#6b7280";

  const label = r.status === "ok" ? formatValue(r.value) : r.status === "error" ? r.error : r.status;

  return (
    <div
      style={{
        marginTop: 8,
        padding: "6px 8px",
        borderRadius: 8,
        background: bg,
        fontSize: 12,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
      title={label}
    >
      {label}
    </div>
  );
}

function ConstNodeView(node: DamageNode) {
  return (
    <NodeShellMultiPort node={node}>
      <NodeHeader title={node.label ?? "Const"} subtitle={`kind=const, value=${node.data?.value ?? 0}`} />
      <div style={{ padding: 10 }}>
        <TypedPort nodeId={node.id} portId="out" type="output" style={{ position: "absolute", right: -6, top: 36 }} />
        <RuntimeBadge id={node.id} />
      </div>
    </NodeShellMultiPort>
  );
}

function DiceNodeView(node: DamageNode) {
  const c = node.data?.dice?.count ?? 1;
  const s = node.data?.dice?.sides ?? 20;
  return (
    <NodeShellMultiPort node={node}>
      <NodeHeader title={node.label ?? "Dice"} subtitle={`kind=dice, ${c}d${s}`} />
      <div style={{ padding: 10 }}>
        <TypedPort nodeId={node.id} portId="out" type="output" style={{ position: "absolute", right: -6, top: 36 }} />
        <RuntimeBadge id={node.id} />
      </div>
    </NodeShellMultiPort>
  );
}

function AddNodeView(node: DamageNode) {
  return (
    <NodeShellMultiPort node={node} style={{ background: "rgba(88,28,135,0.88)" }}>
      <NodeHeader title={node.label ?? "Add"} subtitle="kind=add (dist + dist)" />
      <div style={{ padding: 10, position: "relative", height: 60 }}>
        <TypedPort nodeId={node.id} portId="a" type="input" style={{ position: "absolute", left: -6, top: 20 }} />
        <TypedPort nodeId={node.id} portId="b" type="input" style={{ position: "absolute", left: -6, top: 44 }} />
        <TypedPort nodeId={node.id} portId="out" type="output" style={{ position: "absolute", right: -6, top: 32 }} />
        <RuntimeBadge id={node.id} />
      </div>
    </NodeShellMultiPort>
  );
}

function PHitNodeView(node: DamageNode) {
  return (
    <NodeShellMultiPort node={node} style={{ background: "rgba(15,118,110,0.88)" }}>
      <NodeHeader title={node.label ?? "p(hit)"} subtitle={`kind=pHitGte, threshold=${node.data?.threshold ?? 10}`} />
      <div style={{ padding: 10, position: "relative", height: 60 }}>
        <TypedPort nodeId={node.id} portId="x" type="input" style={{ position: "absolute", left: -6, top: 32 }} />
        <TypedPort nodeId={node.id} portId="out" type="output" style={{ position: "absolute", right: -6, top: 32 }} />
        <RuntimeBadge id={node.id} />
      </div>
    </NodeShellMultiPort>
  );
}

function ExpectedDamageNodeView(node: DamageNode) {
  return (
    <NodeShellMultiPort node={node} style={{ background: "rgba(30,64,175,0.88)" }}>
      <NodeHeader title={node.label ?? "E[damage]"} subtitle="kind=expectedDamage" />
      <div style={{ padding: 10, position: "relative", height: 60 }}>
        <TypedPort nodeId={node.id} portId="dmg" type="input" style={{ position: "absolute", left: -6, top: 20 }} />
        <TypedPort nodeId={node.id} portId="p" type="input" style={{ position: "absolute", left: -6, top: 44 }} />
        <TypedPort nodeId={node.id} portId="out" type="output" style={{ position: "absolute", right: -6, top: 32 }} />
        <RuntimeBadge id={node.id} />
      </div>
    </NodeShellMultiPort>
  );
}

function MonsterLookupNodeView(node: DamageNode) {
  const monsterId = node.data?.monsterId ?? "goblin";
  return (
    <NodeShellMultiPort node={node} style={{ background: "rgba(124,45,18,0.9)" }}>
      <NodeHeader title={node.label ?? "Monster"} subtitle={`kind=monsterLookup, id=${monsterId} (async)`} />
      <div style={{ padding: 10 }}>
        <TypedPort nodeId={node.id} portId="out" type="output" style={{ position: "absolute", right: -6, top: 36 }} />
        <RuntimeBadge id={node.id} />
      </div>
    </NodeShellMultiPort>
  );
}

function ApplyResistanceNodeView(node: DamageNode) {
  return (
    <NodeShellMultiPort node={node} style={{ background: "rgba(185,28,28,0.88)" }}>
      <NodeHeader title={node.label ?? "Resist"} subtitle={`kind=applyResistance, type=${node.data?.damageType ?? "fire"}`} />
      <div style={{ padding: 10, position: "relative", height: 60 }}>
        <TypedPort nodeId={node.id} portId="dmg" type="input" style={{ position: "absolute", left: -6, top: 20 }} />
        <TypedPort nodeId={node.id} portId="mon" type="input" style={{ position: "absolute", left: -6, top: 44 }} />
        <TypedPort nodeId={node.id} portId="out" type="output" style={{ position: "absolute", right: -6, top: 32 }} />
        <RuntimeBadge id={node.id} />
      </div>
    </NodeShellMultiPort>
  );
}

function OutputNodeView(node: DamageNode) {
  return (
    <NodeShellMultiPort node={node} style={{ background: "rgba(3,105,161,0.9)" }}>
      <NodeHeader title={node.label ?? "Output"} subtitle="kind=output" />
      <div style={{ padding: 10, position: "relative", height: 60 }}>
        <TypedPort nodeId={node.id} portId="in" type="input" style={{ position: "absolute", left: -6, top: 32 }} />
        <RuntimeBadge id={node.id} />
      </div>
    </NodeShellMultiPort>
  );
}

const nodeTypes: Record<string, React.FC<DamageNode>> = {
  const: ConstNodeView,
  dice: DiceNodeView,
  add: AddNodeView,
  pHitGte: PHitNodeView,
  expectedDamage: ExpectedDamageNodeView,
  monsterLookup: MonsterLookupNodeView,
  applyResistance: ApplyResistanceNodeView,
  output: OutputNodeView,
};

function AdvancedCanvas() {
  const graph = useGraph();
  const state = useStore(graph.getStore()) as {
    nodes: DamageNode[];
    edges: DamageEdge[];
    canvasView?: "grid" | "dots";
  };

  const { nodes, edges, canvasView } = state;

  const [runtime, setRuntime] = useState<RuntimeById>({});
  const abortRef = useRef<AbortController | null>(null);

  const key = useMemo(() => logicKey(nodes, edges), [nodes, edges]);

  useEffect(() => {
    const run = debounce(() => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      void runEngine({ nodes, edges, signal: ac.signal, setRuntime });
    }, 80);

    run();
    return () => {
      run.cancel();
      abortRef.current?.abort();
    };
  }, [key, nodes, edges]);

  const canvasViewClass = canvasView === "dots" ? "canvas-view-dots" : "canvas-view-grid";

  return (
    <RuntimeContext.Provider value={runtime}>
      <div
        data-flow-root
        className={canvasViewClass}
        style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}
      >
        {nodes.map((n) => {
          const kind = n.data?.kind ?? "const";
          const C = nodeTypes[kind] ?? ConstNodeView;
          return <C key={n.id} {...n} />;
        })}
        <MultiPortEdgesLayer />
      </div>
    </RuntimeContext.Provider>
  );
}

function AdvancedFlow(props: { graph: Graph }) {
  return (
    <GraphProvider graph={props.graph}>
      <ZoomProvider>
        <FlowProvider>
          <AdvancedCanvas />
        </FlowProvider>
      </ZoomProvider>
    </GraphProvider>
  );
}

function createGraph(): Graph {
  const nodes: DamageNode[] = [
    { id: "d20", position: { x: 60, y: 60 }, label: "d20", data: { kind: "dice", dice: { count: 1, sides: 20 } } },
    { id: "atkBonus", position: { x: 60, y: 210 }, label: "+7", data: { kind: "const", value: 7 } },
    { id: "attackRoll", position: { x: 330, y: 120 }, label: "AttackRoll", data: { kind: "add" } },
    { id: "pHit", position: { x: 610, y: 120 }, label: "pHit vs AC15", data: { kind: "pHitGte", threshold: 15 } },

    { id: "dmgDice", position: { x: 60, y: 390 }, label: "2d6", data: { kind: "dice", dice: { count: 2, sides: 6 } } },
    { id: "dmgBonus", position: { x: 60, y: 540 }, label: "+4", data: { kind: "const", value: 4 } },
    { id: "rawDamage", position: { x: 330, y: 450 }, label: "Damage", data: { kind: "add" } },
    { id: "expected", position: { x: 610, y: 330 }, label: "Expected", data: { kind: "expectedDamage" } },

    { id: "monster", position: { x: 900, y: 60 }, label: "Skeleton", data: { kind: "monsterLookup", monsterId: "skeleton" } },
    { id: "resist", position: { x: 900, y: 300 }, label: "Resist(piercing)", data: { kind: "applyResistance", damageType: "piercing" } },
    { id: "out", position: { x: 1180, y: 300 }, label: "Final", data: { kind: "output" } },
  ];

  const edges: DamageEdge[] = [
    { id: "e1", sourceNode: "d20", targetNode: "attackRoll", data: { fromPort: "out", toPort: "a", color: "#7aa2ff", dataType: "dist" } },
    { id: "e2", sourceNode: "atkBonus", targetNode: "attackRoll", data: { fromPort: "out", toPort: "b", color: "#7aa2ff", dataType: "dist" } },
    { id: "e3", sourceNode: "attackRoll", targetNode: "pHit", data: { fromPort: "out", toPort: "x", color: "#34d399", dataType: "dist" } },

    { id: "e4", sourceNode: "dmgDice", targetNode: "rawDamage", data: { fromPort: "out", toPort: "a", color: "#fb7185", dataType: "dist" } },
    { id: "e5", sourceNode: "dmgBonus", targetNode: "rawDamage", data: { fromPort: "out", toPort: "b", color: "#fb7185", dataType: "dist" } },

    { id: "e6", sourceNode: "rawDamage", targetNode: "expected", data: { fromPort: "out", toPort: "dmg", color: "#60a5fa", dataType: "dist" } },
    { id: "e7", sourceNode: "pHit", targetNode: "expected", data: { fromPort: "out", toPort: "p", color: "#60a5fa", dataType: "prob" } },

    { id: "e8", sourceNode: "expected", targetNode: "resist", data: { fromPort: "out", toPort: "dmg", color: "#f87171", dataType: "number" } },
    { id: "e9", sourceNode: "monster", targetNode: "resist", data: { fromPort: "out", toPort: "mon", color: "#f87171", dataType: "monster" } },

    { id: "e10", sourceNode: "resist", targetNode: "out", data: { fromPort: "out", toPort: "in", color: "#22d3ee", dataType: "number" } },
  ];

  return new Graph({ nodes, edges, canvasView: "grid" });
}

export function AdvancedDamagePipelineExample() {
  const graph = useMemo(() => createGraph(), []);
  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <AdvancedFlow graph={graph} />
    </div>
  );
}
```

### Как подключить в демо этого репозитория

1) Создайте файлы из блоков выше в `src/examples/` (или положите рядом с `App.tsx`).  
2) В `src/App.tsx` временно отрендерите:

```tsx
import { AdvancedDamagePipelineExample } from "./examples/AdvancedDamagePipelineExample";

export function App() {
  return <AdvancedDamagePipelineExample />;
}
```

---

## Что происходит в этом примере (по шагам)

1) Порты и рёбра  
Каждый порт — это просто DOM-элемент `.port`, но дополнительно с `data-port-id`.
При соединении из output-порта мы сохраняем в `edge.data` пару
`{ fromPort, toPort }`, чтобы потом вычислять, к каким именно портам привязан путь.

2) LiveEdge (preview)  
`TypedPort` использует `createLiveEdge/updateLiveEdge/removeLiveEdge`, поэтому при
drag-connecting вы видите “живое” ребро.

3) Port-aware обновление рёбер  
Встроенный `Graph.updateEdgesForNode()` ориентируется на `.port.input/.port.output`
и не различает несколько портов. Поэтому в `portsAndEdges.tsx` есть
`rafUpdateEdgesForNode()` — он ищет конкретные порты по `data-port-id` и обновляет
`d` у `<path data-edge-id="...">` через `makePath()` (обновление батчится в rAF).

4) DAG-движок  
`runEngine()` делает топосорт, вычисляет распределения кубов (свёртка), считает
`pHit = P(AttackRoll >= AC)` и `Expected = E[Damage] * pHit`. Нода
`monsterLookup` имитирует асинхронный запрос резистов, а при изменении графа
старый запуск отменяется через `AbortController`.

5) Debounce пересчёта  
В `AdvancedCanvas` пересчёт запускается через `debounce(..., 80)`, и ещё важнее:
ключ `logicKey()` не учитывает `position`, поэтому обычное перетаскивание нод
не пересчитывает математику (только визуально обновляет рёбра).

---

Если хочешь, я адаптирую этот же пример под конкретные механики D&D:
advantage/disadvantage, crit, saving throws, vulnerability, несколько типов урона
в одном пайплайне, и т.п.
