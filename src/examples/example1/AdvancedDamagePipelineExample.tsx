import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
// import { Graph, GraphProvider, ZoomProvider, FlowProvider, useGraph, useStore, debounce } from "flowforge-react";
import { Graph, GraphProvider, ZoomProvider, FlowProvider, useGraph, useStore, debounce } from "../../index";

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