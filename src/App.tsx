import "./styles/flowforge.css";
import "./App.css";
import { useState, type ComponentType } from "react";
import { AgentFlowExample } from "./examples/example3/AgentFlowExample";
import { AgentBuilderExample } from "./examples/example4/AgentBuilderExample";
import { InfiniteCanvasExample } from "./examples/InfiniteCanvasExample";

type ExampleKey = "example4" | "example3" | "infinite";

const EXAMPLES: Record<ExampleKey, ComponentType> = {
  example4: AgentBuilderExample,
  example3: AgentFlowExample,
  infinite: InfiniteCanvasExample,
};

export function App() {
  const [activeExample, setActiveExample] = useState<ExampleKey>("example4");
  const ActiveExample = EXAMPLES[activeExample];

  return (
    <div className="dev-shell">
      <header className="dev-toolbar">
        <span className="dev-toolbar-title">FlowForge Examples</span>
        <button
          type="button"
          className={activeExample === "example4" ? "active" : ""}
          onClick={() => setActiveExample("example4")}
        >
          Example 4: Agent Builder
        </button>
        <button
          type="button"
          className={activeExample === "example3" ? "active" : ""}
          onClick={() => setActiveExample("example3")}
        >
          Example 3: Agent Flow
        </button>
        <button
          type="button"
          className={activeExample === "infinite" ? "active" : ""}
          onClick={() => setActiveExample("infinite")}
        >
          Infinite Canvas
        </button>
      </header>

      <main className="dev-content">
        <ActiveExample />
      </main>
    </div>
  );
}
