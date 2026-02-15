// damageEngine.ts
import type { Dispatch, SetStateAction } from "react";
// import type { EdgeData, NodeData } from "flowforge-react";
import type { EdgeData, NodeData } from "../../index";

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
