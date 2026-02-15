# Example 2: Conditional Connection Validation

## Overview

This example demonstrates **conditional node connections** with **validation logic** and **visual feedback**.

## Features Demonstrated

### 1. **Pre-Connection Validation**
- Custom validation function (`canConnect`) is executed **before** creating a connection
- Returns `true` or `false` based on graph state
- Demonstrates computational logic that influences connection behavior

### 2. **Conditional Logic**
- **Rule**: Nodes 4 and 5 can only connect if Nodes 2 and 3 are already connected
- Shows how to implement dependencies between different parts of the graph
- Validates graph state in real-time

### 3. **Visual Feedback**
- When validation fails, the target port **flashes red** for 0.5 seconds
- Provides immediate user feedback without intrusive alerts
- Uses CSS transitions for smooth visual effects

### 4. **Animated Edges**
- Top row nodes (1, 2, 3) use animated edges
- Flowing particles with glow effect
- Different colors and speeds per edge

### 5. **Event Logging**
- Real-time event log sidebar
- Tracks connection attempts (success and failure)
- Shows current connection state

## Graph Structure

```
Top Row (Animated Edges):
┌────────┐      ┌────────┐      ┌────────┐
│ Node 1 │─────▶│ Node 2 │      │ Node 3 │
└────────┘      └────────┘      └────────┘
   (Green)        (Blue)         (Purple)

   Initial: 1→2 connected
   Goal: Connect 2→3


Bottom Row (Conditional):
┌────────┐                      ┌────────┐
│ Node 4 │                      │ Node 5 │
└────────┘                      └────────┘
  (Orange)                        (Red)

  Can only connect if 2→3 are connected!
```

## Validation Logic

```typescript
const canConnect: CanConnectFn = ({
    sourceNodeId,
    targetNodeId,
    // ... other params
}) => {
    // Check if this is a Node 4 ↔ Node 5 connection
    const isNode4or5Connection =
        (sourceNodeId === "node-4" && targetNodeId === "node-5") ||
        (sourceNodeId === "node-5" && targetNodeId === "node-4");

    if (isNode4or5Connection) {
        // Validate: Are Node 2 and Node 3 connected?
        const isNode2And3Connected = edges.some(
            (edge) =>
                (edge.sourceNode === "node-2" && edge.targetNode === "node-3") ||
                (edge.sourceNode === "node-3" && edge.targetNode === "node-2")
        );

        if (!isNode2And3Connected) {
            // Highlight port with red & return false
            highlightErrorPort(targetNodeId, targetPortId || "in");
            return {
                allowed: false,
                reason: "Node 2 and Node 3 must be connected first!",
            };
        }
    }

    return { allowed: true };
};
```

## Testing Steps

1. **Initial State**
   - Node 1 → Node 2 are connected (animated edge)
   - Node 3 is disconnected
   - Node 4 and Node 5 are disconnected

2. **Test Validation Failure**
   - Try to connect Node 4 to Node 5
   - ❌ Connection will be **rejected**
   - Target port will **flash red** for 0.5 seconds
   - Error message appears in log: "Node 2 and Node 3 must be connected first!"

3. **Enable Connection**
   - Connect Node 2 → Node 3
   - Notice the animated edge appears

4. **Test Validation Success**
   - Now try to connect Node 4 to Node 5 again
   - ✅ Connection will be **accepted**
   - Default edge appears
   - Success message in log

## Key Implementation Details

### Error Port Highlighting

```typescript
const [errorPorts, setErrorPorts] = useState<Set<string>>(new Set());

const highlightErrorPort = (nodeId: string, portId: string) => {
    const key = `${nodeId}-${portId}`;
    setErrorPorts(prev => new Set(prev).add(key));

    // Auto-clear after 500ms
    setTimeout(() => {
        setErrorPorts(prev => {
            const next = new Set(prev);
            next.delete(key);
            return next;
        });
    }, 500);
};
```

### Port Error Styling

```typescript
<Port
    type="input"
    portId="in"
    data={{ nodeId: id }}
    style={{
        background: inputPortHasError ? "#ef4444" : "#64748b",
        boxShadow: inputPortHasError
            ? "0 0 12px rgba(239, 68, 68, 0.8)"
            : "none",
    }}
/>
```

## Use Cases

This pattern is useful for:

- **Workflow dependencies**: Step B can only connect after Step A is complete
- **Type validation**: Certain node types can only connect in specific orders
- **Access control**: Users must complete prerequisites before proceeding
- **Data flow validation**: Ensure required data sources are connected
- **Game logic**: Players must unlock certain paths before accessing others

## Files

- `ConditionalConnectionExample.tsx` - Main example component
- `ConditionalNode.tsx` - Custom node with error highlighting
- `styles.css` - Styling for info panel, logs, and animations
- `index.ts` - Export file

## API Usage

### ConnectionProvider

```typescript
<ConnectionProvider
    canConnect={canConnectCallback}
    eventHandlers={{
        onConnect: (payload) => { /* ... */ },
        onConnectCancel: (payload) => { /* ... */ },
    }}
>
    <Flow graph={graph} nodeTypes={...} />
</ConnectionProvider>
```

### Connection Validation Function

```typescript
type CanConnectFn = (params: {
    sourceNodeId: string;
    sourcePortId?: string;
    targetNodeId: string;
    targetPortId?: string;
    sourcePortType: 'input' | 'output';
    targetPortType: 'input' | 'output';
}) => { allowed: true } | { allowed: false; reason?: string };
```

## Extending This Example

Ideas for extensions:

1. **Multi-level Dependencies**
   - Node 6 can only connect if both (2→3) AND (4→5) are connected

2. **Time-based Validation**
   - Connections expire after a certain time

3. **User Permission Checks**
   - Validate user roles before allowing connections

4. **Complex Business Rules**
   - Check multiple conditions, data types, node states, etc.

5. **Visual Path Highlighting**
   - When hovering over a disabled connection, highlight the required connections

6. **Progress Indicators**
   - Show which prerequisites are completed (checklist UI)

## Related Examples

- **Example 1**: Multi-port nodes with type validation
- **Example 3**: Dynamic node creation and deletion
- **Example 4**: Custom edge routing algorithms

---

**💡 Key Takeaway**: This example shows how to implement **stateful validation** where connection rules depend on the **current graph state**, demonstrating the power of pre-connection computation.
