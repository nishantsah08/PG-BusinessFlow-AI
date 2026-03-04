import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactFlow, {
    Controls,
    Background,
    MiniMap,
    Handle,
    Position,
    MarkerType,
    useNodesState,
    useEdgesState
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Bot, Share2, Activity, CornerLeftUp } from 'lucide-react';
import apiClient from '../../api/client';
import StateWrapper from '../common/StateWrapper';
import AgentCard from './AgentCard';
import useRealtimeSource from '../../hooks/useRealtimeSource';

// --- Custom Nodes ---

// 1. Master AI Node
const MasterNode = ({ data }) => {
    return (
        <div className="bg-indigo-600 text-white rounded-xl shadow-lg p-5 w-72 text-center border-2 border-indigo-700 relative">
            {/* Target for returning event bus events */}
            <Handle type="target" position={Position.Left} id="from-bus" style={{ background: '#f97316', width: '8px', height: '8px', border: 'none' }} />

            <div className="font-bold text-xl mb-1 flex items-center justify-center tracking-wide">
                <Bot className="w-6 h-6 mr-3" /> Master AI
            </div>
            <div className="text-indigo-200 text-xs font-semibold uppercase tracking-widest">Orchestrator</div>

            {/* Source for MCP calls to agents */}
            <Handle type="source" position={Position.Bottom} id="to-agents" style={{ background: '#818cf8', width: '12px', height: '12px', border: '2px solid white' }} />
        </div>
    );
};

// 2. Event Bus Node
const BusNode = ({ data }) => {
    return (
        <div style={{ width: data.width || 800 }} className="relative flex justify-center py-4 transition-all duration-300">
            {/* Target for events coming from agents */}
            <Handle type="target" position={Position.Top} id="from-agents" style={{ opacity: 0 }} />

            <div className="h-4 bg-gradient-to-r from-orange-400 via-rose-400 to-orange-400 w-full rounded-full shadow-inner border border-orange-500 relative flex items-center justify-center">
                <div className="absolute -top-3 text-xs font-bold text-white bg-orange-500 px-6 py-1.5 rounded-full shadow-lg flex items-center border border-orange-600 tracking-widest uppercase">
                    <Activity className="w-4 h-4 mr-2" /> Event Bus
                </div>
            </div>

            {/* Source for events returning to Master AI */}
            <Handle type="source" position={Position.Left} id="to-master" style={{ opacity: 0 }} />
        </div>
    );
};

// 3. Agent Node incorporating AgentCard
const AgentNode = ({ data }) => {
    return (
        <div className="w-64 transition-transform hover:-translate-y-1 duration-300 shadow-md hover:shadow-xl rounded-lg bg-white bg-opacity-100 h-full">
            <Handle type="target" position={Position.Top} id="from-master" style={{ background: '#818cf8', width: '8px', height: '8px', border: 'none' }} />

            <AgentCard agent={data.agent} onActionSuccess={data.onActionSuccess} />

            <Handle type="source" position={Position.Bottom} id="to-bus" style={{ background: '#f97316', width: '8px', height: '8px', border: 'none' }} />
        </div>
    );
};


/**
 * AgentDashboard Component
 * Orchestrates the list of all agents, their status, and delegating control UI via a ReactFlow diagram.
 */
const AgentDashboard = () => {
    const [status, setStatus] = useState('loading');
    const [errorMsg, setErrorMsg] = useState(null);
    const [agents, setAgents] = useState([]);

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    // Custom node types definitions
    const nodeTypes = useMemo(() => ({
        masterNode: MasterNode,
        busNode: BusNode,
        agentNode: AgentNode
    }), []);

    const fetchAgents = useCallback(async () => {
        try {
            const response = await apiClient.get('/api/system/agents');

            if (response.success && response.data?.agents && Array.isArray(response.data.agents)) {
                if (response.data.agents.length > 0) {
                    setAgents(response.data.agents);
                    setStatus('success');
                } else {
                    setAgents([]);
                    setStatus('empty');
                }
            } else {
                throw new Error(response.error || 'Failed to parse agent list');
            }
        } catch (err) {
            setErrorMsg(err.message);
            setStatus('error');
        }
    }, []);

    // Initial load
    useEffect(() => {
        fetchAgents();
    }, [fetchAgents]);

    // Reactive subscription to replace polling
    useRealtimeSource('/api/system/events/stream', (event) => {
        if (event && event.event_type !== 'ping') {
            fetchAgents();
        }
    });

    // Rebuild the flow graph whenever agents array changes
    useEffect(() => {
        if (!agents || agents.length === 0) return;

        const newNodes = [];
        const newEdges = [];
        // Approximate agent node height is ~180px
        const agentHeight = 180;

        // 1. Master AI Node
        const masterX = (agents.length * 320) / 2 - 144; // Center it based on number of agents (288px width roughly)

        // Gap from Master AI to Agents = 1.5 * agentHeight
        // Let's set agentY first to compute everything relative to it.
        const agentY = 300;
        const masterY = agentY - (1.5 * agentHeight) - 80; // subtracting 80px (approx height of master node)

        newNodes.push({
            id: 'master',
            type: 'masterNode',
            data: { label: 'Master AI' },
            position: { x: masterX, y: masterY }, // Moved up
            draggable: true,
        });

        // 2. Agents
        agents.forEach((agent, index) => {
            const agentX = index * 320;
            // agentY is 300

            newNodes.push({
                id: `agent-${agent.name}`,
                type: 'agentNode',
                data: {
                    agent: agent,
                    onActionSuccess: fetchAgents
                },
                position: { x: agentX, y: agentY },
                draggable: true,
            });

            // Edge from Master to Agent (MCP Calls)
            newEdges.push({
                id: `e-master-${agent.name}`,
                source: 'master',
                sourceHandle: 'to-agents',
                target: `agent-${agent.name}`,
                targetHandle: 'from-master',
                type: 'default',
                animated: true,
                style: { stroke: '#818cf8', strokeWidth: 2 },
                label: 'MCP Call',
                labelStyle: { fill: '#4f46e5', fontWeight: 700, fontSize: 10 },
                labelBgStyle: { fill: '#eef2ff', fillOpacity: 0.8 },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#818cf8' },
            });
        });
        // 3. Event Bus
        // Gap from Agents to Event Bus = 2/3 * agentHeight
        const busY = agentY + agentHeight + (0.66 * agentHeight);
        // Event bus spans across the agents dynamically
        // Since agents are placed at index * 320, the span is roughly (agents.length - 1) * 320 + 264 (agent width)
        const agentSpan = agents.length > 0 ? (agents.length - 1) * 320 + 264 : 0;
        const busWidth = Math.max(agentSpan, 800);
        // Center the bus: position x such that the bus's center aligns with the agents' bounding box center
        // Center of agents = agentSpan / 2. Center of bus = busWidth / 2.
        // Therefore, x = (agentSpan / 2) - (busWidth / 2)
        const busX = (agentSpan / 2) - (busWidth / 2);

        newNodes.push({
            id: 'event-bus',
            type: 'busNode',
            data: { label: 'Event Bus', width: busWidth },
            position: { x: busX, y: busY },
            draggable: true,
        });

        // Edges from Agents to Event Bus
        agents.forEach((agent) => {
            newEdges.push({
                id: `e-${agent.name}-bus`,
                source: `agent-${agent.name}`,
                sourceHandle: 'to-bus',
                target: 'event-bus',
                targetHandle: 'from-agents',
                type: 'step',
                animated: true,
                style: { stroke: '#fb923c', strokeWidth: 2, strokeDasharray: '5,5' },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#fb923c' },
            });
        });

        // 4. Edge from Event Bus wrapping back up to Master AI
        newEdges.push({
            id: 'e-bus-master',
            source: 'event-bus',
            sourceHandle: 'to-master',
            target: 'master',
            targetHandle: 'from-bus',
            type: 'step',
            animated: true,
            style: { stroke: '#ea580c', strokeWidth: 3 },
            label: 'Event Stream Return',
            labelStyle: { fill: '#ea580c', fontWeight: 700, fontSize: 10, letterSpacing: '1px' },
            labelBgStyle: { fill: '#fff5f5', fillOpacity: 0.9 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#ea580c' },
        });

        setNodes(newNodes);
        setEdges(newEdges);
    }, [agents, setNodes, setEdges, fetchAgents]);

    return (
        <div className="h-full w-full bg-slate-50 flex flex-col relative overflow-hidden">
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0 z-20 shadow-sm relative">
                <h1 className="text-xl font-bold text-gray-900">Agent Flow Dashboard</h1>
                <p className="text-sm text-gray-500 mt-1">System architecture, agent control, and event streams map</p>
            </div>

            <div className="flex-1 overflow-hidden relative z-10 w-full">
                <StateWrapper
                    state={status}
                    error={errorMsg}
                    onRetry={fetchAgents}
                    emptyMessage="No agents currently registered in the system."
                >
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        nodeTypes={nodeTypes}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        fitView
                        attributionPosition="bottom-right"
                        minZoom={0.5}
                        maxZoom={1.5}
                        className="bg-slate-50 pattern-dots pattern-gray-200 pattern-bg-white pattern-size-4 pattern-opacity-40"
                    >
                        <Controls />
                        <Background color="#cbd5e1" gap={20} size={1} />
                        <MiniMap
                            nodeStrokeColor={(n) => {
                                if (n.type === 'masterNode') return '#4f46e5';
                                if (n.type === 'busNode') return '#ea580c';
                                return '#cbd5e1';
                            }}
                            nodeColor={(n) => {
                                if (n.type === 'masterNode') return '#4f46e5';
                                if (n.type === 'busNode') return '#fb923c';
                                return '#fff';
                            }}
                            nodeBorderRadius={2}
                        />
                    </ReactFlow>
                </StateWrapper>
            </div>
        </div>
    );
};

export default AgentDashboard;
