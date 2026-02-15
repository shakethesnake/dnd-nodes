// Example: Custom Node and Edge Types using Registry API
import React from 'react';
import { Flow, Graph, type NodeData, type EdgeData, defaultNodeTypes } from '../../index';

/**
 * Custom Node Example: Styled gradient node
 */
const GradientNode: React.FC<NodeData> = ({ position, label, data }) => {
  const description = typeof data?.description === 'string' ? data.description : undefined;

  return (
    <div
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        padding: '16px 24px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        fontWeight: 'bold',
        minWidth: '120px',
        textAlign: 'center'
      }}
    >
      <div style={{ fontSize: '24px', marginBottom: '8px' }}>✨</div>
      <div>{label || 'Gradient Node'}</div>
      {description && (
        <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.9 }}>
          {description}
        </div>
      )}
    </div>
  );
};

/**
 * Custom Node Example: Icon node with colored background
 */
const IconNode: React.FC<NodeData> = ({ position, label, data }) => {
  const icon = typeof data?.icon === 'string' ? data.icon : '📦';
  const bgColor = typeof data?.color === 'string' ? data.color : '#4a5568';

  return (
    <div
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        padding: '12px',
        background: bgColor,
        color: 'white',
        borderRadius: '50%',
        width: '60px',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '32px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        cursor: 'pointer',
        transition: 'transform 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
      title={label}
    >
      {icon}
    </div>
  );
};

/**
 * Custom Edge Example: Dashed gradient edge
 */
const DashedGradientEdge: React.FC<EdgeData> = ({ id, sourcePort, targetPort, label }) => {
  if (!sourcePort || !targetPort) return null;

  const midX = (sourcePort.x + targetPort.x) / 2;
  const midY = (sourcePort.y + targetPort.y) / 2;

  return (
    <g>
      {/* Gradient definition */}
      <defs>
        <linearGradient id={`gradient-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#667eea" />
          <stop offset="100%" stopColor="#764ba2" />
        </linearGradient>
      </defs>

      {/* Dashed line */}
      <line
        x1={sourcePort.x}
        y1={sourcePort.y}
        x2={targetPort.x}
        y2={targetPort.y}
        stroke={`url(#gradient-${id})`}
        strokeWidth="3"
        strokeDasharray="10,5"
        strokeLinecap="round"
        data-edge-id={id}
      />

      {/* Label */}
      {label && (
        <text
          x={midX}
          y={midY - 10}
          fill="#667eea"
          fontSize="12"
          fontWeight="bold"
          textAnchor="middle"
        >
          {label}
        </text>
      )}
    </g>
  );
};

/**
 * Custom Edge Example: Animated dots edge
 */
const AnimatedDotsEdge: React.FC<EdgeData> = ({ id, sourcePort, targetPort }) => {
  if (!sourcePort || !targetPort) return null;

  return (
    <g>
      <defs>
        <linearGradient id={`dots-gradient-${id}`}>
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>

      <line
        x1={sourcePort.x}
        y1={sourcePort.y}
        x2={targetPort.x}
        y2={targetPort.y}
        stroke={`url(#dots-gradient-${id})`}
        strokeWidth="4"
        strokeDasharray="1,8"
        strokeLinecap="round"
        data-edge-id={id}
      >
        <animate
          attributeName="stroke-dashoffset"
          from="0"
          to="18"
          dur="1s"
          repeatCount="indefinite"
        />
      </line>
    </g>
  );
};

/**
 * Example component using custom registries
 */
export const CustomRegistryExample: React.FC = () => {
  const graph = new Graph({
    nodes: [
      {
        id: '1',
        position: { x: 100, y: 100 },
        type: 'gradient',
        label: 'Start',
        data: { description: 'Entry point' }
      },
      {
        id: '2',
        position: { x: 350, y: 100 },
        type: 'icon',
        label: 'Process',
        data: { icon: '⚙️', color: '#3b82f6' }
      },
      {
        id: '3',
        position: { x: 500, y: 100 },
        type: 'icon',
        label: 'Data',
        data: { icon: '📊', color: '#10b981' }
      },
      {
        id: '4',
        position: { x: 350, y: 250 },
        type: 'default', // Using built-in default type
        label: 'Standard Node'
      },
      {
        id: '5',
        position: { x: 650, y: 150 },
        type: 'gradient',
        label: 'End',
        data: { description: 'Final output' }
      }
    ],
    edges: [
      {
        id: 'e1',
        sourceNode: '1',
        targetNode: '2',
        type: 'dashedGradient',
        label: 'flow'
      },
      {
        id: 'e2',
        sourceNode: '2',
        targetNode: '3',
        type: 'animatedDots'
      },
      {
        id: 'e3',
        sourceNode: '2',
        targetNode: '4',
        type: 'default' // Using built-in default type
      },
      {
        id: 'e4',
        sourceNode: '3',
        targetNode: '5',
        type: 'dashedGradient',
        label: 'result'
      }
    ]
  });

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <Flow
        graph={graph}
        // Mix custom types with default types
        nodeTypes={{
          ...defaultNodeTypes,  // Keep all default types
          gradient: GradientNode,
          icon: IconNode
        }}
        edgeTypes={{
          dashedGradient: DashedGradientEdge,
          animatedDots: AnimatedDotsEdge
          // Default types are automatically included
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          padding: '16px',
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          maxWidth: '300px'
        }}
      >
        <h3 style={{ margin: '0 0 12px 0' }}>Custom Registry Example</h3>
        <p style={{ margin: '0 0 8px 0', fontSize: '14px' }}>
          This example demonstrates the Registry API:
        </p>
        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
          <li>Custom <strong>GradientNode</strong> with styling</li>
          <li>Custom <strong>IconNode</strong> with emoji icons</li>
          <li>Custom <strong>DashedGradientEdge</strong></li>
          <li>Custom <strong>AnimatedDotsEdge</strong></li>
          <li>Built-in <strong>default</strong> types still work</li>
        </ul>
      </div>
    </div>
  );
};

export default CustomRegistryExample;
