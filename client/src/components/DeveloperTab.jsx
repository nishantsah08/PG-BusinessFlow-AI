import React, { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Activity, X } from 'lucide-react';

const DeveloperTab = () => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [loading, setLoading] = useState(true);
    const [selectedAgent, setSelectedAgent] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch('/api/agents');
            const agents = await res.json();

            const newNodes = [];
            const newEdges = [];

            // 1. Master Node
            const master = agents.find(a => a.name === 'MasterAI');
            if (master) {
                newNodes.push({
                    id: 'MasterAI',
                    data: { label: `${master.identity?.personaName || master.name}\n[${master.identity?.role || 'Orchestrator'}]`, fullData: master },
                    position: { x: 500, y: 50 },
                    style: { background: '#fff', border: '2px solid #4f46e5', borderRadius: '12px', padding: '10px', width: 220, fontWeight: 'bold' }
                });
            }

            const mainAgents = agents.filter(a => a.name !== 'MasterAI');

            mainAgents.forEach((agent, index) => {
                const agentX = 100 + (index * 280);
                const agentY = 300;

                // 2. Main Agent Nodes
                newNodes.push({
                    id: agent.name,
                    data: { label: `${agent.name}\n[${agent.identity?.role}]`, fullData: agent },
                    position: { x: agentX, y: agentY },
                    style: { background: '#f8fafc', border: '1px solid #64748b', borderRadius: '8px', padding: '10px', width: 200 }
                });

                newEdges.push({
                    id: `e-MasterAI-${agent.name}`,
                    source: 'MasterAI',
                    target: agent.name,
                    animated: true,
                    style: { stroke: '#4f46e5' },
                });

                // 3. Sub-Agent Nodes
                if (agent.subAgents && agent.subAgents.length > 0) {
                    agent.subAgents.forEach((sub, subIndex) => {
                        const subX = agentX + (subIndex * 40 - ((agent.subAgents.length - 1) * 20));
                        const subY = agentY + 200 + (subIndex * 60);

                        newNodes.push({
                            id: sub.name,
                            data: { label: sub.name, fullData: sub },
                            position: { x: subX, y: subY },
                            style: { background: '#eff6ff', border: '1px dashed #93c5fd', borderRadius: '6px', padding: '8px', width: 140, fontSize: '12px' }
                        });

                        newEdges.push({
                            id: `e-${agent.name}-${sub.name}`,
                            source: agent.name,
                            target: sub.name,
                            type: 'step',
                            style: { stroke: '#94a3b8', strokeDasharray: '5,5' },
                        });
                    });
                }
            });

            setNodes(newNodes);
            setEdges(newEdges);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [setNodes, setEdges]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const onNodeClick = (event, node) => {
        setSelectedAgent(node.data.fullData);
    };

    return (
        <div className="h-full flex flex-col relative">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white z-10">
                <div>
                    <h2 className="text-lg font-semibold text-gray-800">System Architecture</h2>
                    <p className="text-sm text-gray-500">Click on an agent to view their full definition.</p>
                </div>
                <button onClick={fetchData} className="p-2 text-gray-500 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 rounded-lg transition-colors">
                    <Activity className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 bg-gray-50 relative">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onNodeClick={onNodeClick}
                    fitView
                >
                    <Controls />
                    <MiniMap />
                    <Background gap={12} size={1} />
                </ReactFlow>

                {/* Detail Popup */}
                {selectedAgent && (
                    <div className="absolute top-4 right-4 w-96 max-h-[90%] overflow-y-auto bg-white rounded-xl shadow-2xl border border-gray-100 p-6 z-50 transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">{selectedAgent.identity?.personaName || selectedAgent.name}</h3>
                                <p className="text-sm text-indigo-600 font-medium">{selectedAgent.identity?.role}</p>
                            </div>
                            <button onClick={() => setSelectedAgent(null)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Description</h4>
                                <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    {selectedAgent.identity?.description || "No description provided."}
                                </p>
                            </div>

                            {selectedAgent.capabilities && (
                                <div>
                                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Capabilities</h4>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {selectedAgent.capabilities.skills?.map(skill => (
                                            <span key={skill} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md border border-blue-100">{skill}</span>
                                        ))}
                                    </div>
                                    <div className="space-y-1">
                                        {(selectedAgent.capabilities.registeredTools || selectedAgent.capabilities.tools)?.map(tool => (
                                            <div key={tool} className="flex items-center text-xs text-gray-500">
                                                <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mr-2"></div>
                                                <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">{tool}</code>
                                            </div>
                                        ))}
                                    </div>

                                    {selectedAgent.capabilities.triggers && selectedAgent.capabilities.triggers.length > 0 && (
                                        <div className="mt-3">
                                            <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Triggers</h5>
                                            <ul className="list-disc list-inside text-xs text-gray-600 space-y-1">
                                                {selectedAgent.capabilities.triggers.map(t => <li key={t}>{t}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}

                            {selectedAgent.directives && (
                                <div>
                                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Directives</h4>
                                    <div className="space-y-3">
                                        <div>
                                            <span className="text-xs font-medium text-green-600 block mb-1">Goals</span>
                                            <ul className="list-disc list-inside text-xs text-gray-600 space-y-1">
                                                {selectedAgent.directives.goals?.map(g => <li key={g}>{g}</li>)}
                                            </ul>
                                        </div>
                                        <div>
                                            <span className="text-xs font-medium text-red-600 block mb-1">Constraints</span>
                                            <ul className="list-disc list-inside text-xs text-gray-600 space-y-1">
                                                {selectedAgent.directives.constraints?.map(c => <li key={c}>{c}</li>)}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DeveloperTab;
