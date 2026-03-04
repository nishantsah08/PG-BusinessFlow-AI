import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Wrench, AlertCircle, Clock, CheckCircle, Loader2, Plus, X } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, trend, trendColor = "text-green-600" }) => (
    <div className="bg-white p-5 rounded-xl border border-gray-100 flex flex-col justify-between shadow-sm">
        <div className="flex justify-between items-start">
            <div>
                <p className="text-sm font-medium text-gray-500">{title}</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">{value}</h3>
            </div>
            <div className={`p-2 rounded-lg bg-gray-50`}>
                <Icon className="w-5 h-5 text-gray-600" />
            </div>
        </div>
        {trend !== undefined && (
            <div className="mt-4 flex items-center text-sm">
                <span className={`font-medium ${trendColor}`}>{trend}</span>
                <span className="text-gray-400 ml-2">vs last month</span>
            </div>
        )}
    </div>
);

const getStatusBadge = (status) => {
    switch (status) {
        case 'OPEN': return <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-xs font-semibold">Open</span>;
        case 'IN_PROGRESS': return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-semibold">In Progress</span>;
        case 'RESOLVED': return <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-semibold">Resolved</span>;
        case 'CANCELLED': return <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded-full text-xs font-semibold">Cancelled</span>;
        default: return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-semibold">{status}</span>;
    }
};

const getPriorityBadge = (priority) => {
    switch (priority) {
        case 'CRITICAL': return <span className="text-red-600 font-bold text-xs flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Critical</span>;
        case 'HIGH': return <span className="text-orange-500 font-bold text-xs">High</span>;
        case 'MEDIUM': return <span className="text-yellow-600 font-bold text-xs">Medium</span>;
        case 'LOW': return <span className="text-gray-500 font-bold text-xs">Low</span>;
        default: return null;
    }
};

const getNextStatus = (currentStatus) => {
    if (currentStatus === 'OPEN') return 'IN_PROGRESS';
    if (currentStatus === 'IN_PROGRESS') return 'RESOLVED';
    return null; // Cannot update further with a simple button
};

const MaintenanceView = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [tickets, setTickets] = useState([]);
    const [maintenanceData, setMaintenanceData] = useState([]);
    const [summary, setSummary] = useState({});
    const [propertiesMap, setPropertiesMap] = useState({});

    // Form state
    const [showLogForm, setShowLogForm] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [logPropId, setLogPropId] = useState('');
    const [logUnitId, setLogUnitId] = useState('');
    const [logIssue, setLogIssue] = useState('');
    const [logCategory, setLogCategory] = useState('Other');
    const [logPriority, setLogPriority] = useState('MEDIUM');

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch Global Analytics
            const statsRes = await fetch('/api/master_ai/tools/execute', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                    agent_name: 'PropertyAI',
                    tool_name: 'get_analytics_stats',
                    parameters: {}
                })
            });
            const statsBody = await statsRes.json();
            if (statsBody.success && statsBody.data) {
                setMaintenanceData(statsBody.data.maintenance_data || []);
                setSummary(statsBody.data.summary || {});
            }

            // Fetch Properties for Map
            const propsRes = await fetch('/api/master_ai/tools/execute', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                    agent_name: 'PropertyAI',
                    tool_name: 'get_properties',
                    parameters: {}
                })
            });
            const propsBody = await propsRes.json();
            const pMap = {};
            if (propsBody.data) {
                propsBody.data.forEach(p => { pMap[p.id] = p.name; });
            }
            setPropertiesMap(pMap);

            // Fetch Tickets
            const tktsRes = await fetch('/api/master_ai/tools/execute', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                    agent_name: 'PropertyAI',
                    tool_name: 'get_maintenance_reqs',
                    parameters: {}
                })
            });
            const tktsBody = await tktsRes.json();
            setTickets(tktsBody.data || []);

        } catch (e) {
            console.error("Failed to fetch maintenance data:", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleLogSubmit = async (e) => {
        e.preventDefault();
        // Since properties map is object, we just grab first key if single prop system
        const propertyId = logPropId || Object.keys(propertiesMap)[0] || 'PROP-1';

        setIsSaving(true);
        try {
            const payload = {
                property_id: propertyId,
                unit_id: logUnitId || 'Common Area',
                category: logCategory,
                description: logIssue,
                priority: logPriority,
                reported_by: 'Staff'
            };
            const res = await fetch('/api/master_ai/tools/execute', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                    agent_name: 'PropertyAI',
                    tool_name: 'log_maintenance_req',
                    parameters: payload
                })
            });
            if (res.ok) {
                setShowLogForm(false);
                setLogIssue('');
                setLogUnitId('');
                await fetchData();
            } else {
                alert("Failed to create ticket");
            }
        } catch (e) {
            console.error("Error creating ticket:", e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateStatus = async (ticket) => {
        const nextStatus = getNextStatus(ticket.status);
        if (!nextStatus) return; // Cannot update

        try {
            await fetch('/api/master_ai/tools/execute', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agent_name: 'PropertyAI',
                    tool_name: 'update_maintenance_req',
                    parameters: { req_id: ticket.id, status: nextStatus }
                })
            });
            await fetchData();
        } catch (e) {
            console.error("Failed to update status", e);
        }
    };

    if (isLoading && tickets.length === 0) {
        return <div className="h-full flex items-center justify-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mr-3" /> Loading Maintenance Data...</div>;
    }

    return (
        <div className="space-y-6">

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard title="Open Tickets" value={summary.open_tickets || 0} icon={Wrench} trendColor="text-green-600" />
                <StatCard title="High Priority" value={summary.high_priority_tickets || 0} icon={AlertCircle} trendColor="text-rose-600" />
                <StatCard title="Avg Resolution" value={`${summary.avg_resolution_hours || 0}h`} icon={Clock} trendColor="text-green-600" />
                <StatCard title="Resolved This Month" value={summary.resolved_this_month || 0} icon={CheckCircle} trendColor="text-green-600" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Tickets List */}
                <div className="xl:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col relative overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 z-10">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Active Tickets</h3>
                            <p className="text-sm text-gray-500">Manage ongoing maintenance requests</p>
                        </div>
                        <button
                            onClick={() => setShowLogForm(!showLogForm)}
                            className="flex items-center gap-1 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                        >
                            {showLogForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            {showLogForm ? 'Close' : 'Log Issue'}
                        </button>
                    </div>

                    {showLogForm && (
                        <div className="bg-indigo-50 border-b border-indigo-100 p-4 z-10 transition-all">
                            <form onSubmit={handleLogSubmit} className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex gap-2">
                                        <input
                                            required value={logUnitId} onChange={e => setLogUnitId(e.target.value)}
                                            placeholder="Unit/Location (e.g. 101)"
                                            className="w-1/2 px-3 py-2 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                        <select
                                            value={logCategory} onChange={e => setLogCategory(e.target.value)}
                                            className="w-1/2 px-3 py-2 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="PLUMBING">Plumbing</option>
                                            <option value="ELECTRICAL">Electrical</option>
                                            <option value="CARPENTRY">Carpentry</option>
                                            <option value="Cleaning">Cleaning</option>
                                            <option value="Appliance">Appliance</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <select
                                        value={logPriority} onChange={e => setLogPriority(e.target.value)}
                                        className="w-full px-3 py-2 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="LOW">Low</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="HIGH">High</option>
                                        <option value="CRITICAL">Critical</option>
                                    </select>
                                </div>
                                <input
                                    required value={logIssue} onChange={e => setLogIssue(e.target.value)}
                                    placeholder="Describe issue (e.g. Leaking pipe)"
                                    className="w-full px-3 py-2 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <div className="flex justify-end">
                                    <button
                                        type="submit" disabled={isSaving}
                                        className="bg-indigo-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                        {isSaving ? 'Submitting...' : 'Submit Ticket'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="flex-1 overflow-auto p-4 z-0">
                        <div className="space-y-3">
                            {tickets.length === 0 ? (
                                <div className="text-center text-gray-500 py-10">No active maintenance tickets found.</div>
                            ) : tickets.map(ticket => (
                                <div key={ticket.id} className="p-4 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors flex items-center justify-between">
                                    <div className="flex items-start gap-4">
                                        <div className="p-2 bg-gray-50 rounded-lg shrink-0 mt-1">
                                            <Wrench className="w-5 h-5 text-gray-500" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{ticket.id}</span>
                                                {getPriorityBadge(ticket.priority)}
                                                {getStatusBadge(ticket.status)}
                                            </div>
                                            <h4 className="font-semibold text-gray-900 text-sm mb-1">{ticket.description}</h4>
                                            <p className="text-xs text-gray-500">
                                                {propertiesMap[ticket.property_id] || ticket.property_id} • Unit {ticket.unit_id} • Category: {ticket.category}
                                            </p>
                                        </div>
                                    </div>
                                    {getNextStatus(ticket.status) && (
                                        <button
                                            onClick={() => handleUpdateStatus(ticket)}
                                            className="text-indigo-600 text-sm font-medium hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors shrink-0"
                                        >
                                            Mark {getNextStatus(ticket.status).replace('_', ' ')}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* KPI Graph Area */}
                <div className="xl:col-span-1 bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col z-0 relative">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Maintenance Load</h3>
                    <p className="text-sm text-gray-500 mb-6">Tickets created vs resolved (6 months)</p>

                    <div className="flex-1 min-h-[300px]">
                        {maintenanceData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={maintenanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                                    <Line
                                        type="monotone"
                                        dataKey="created"
                                        name="Created"
                                        stroke="#ef4444"
                                        strokeWidth={3}
                                        dot={{ r: 4, strokeWidth: 2 }}
                                        activeDot={{ r: 6 }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="resolved"
                                        name="Resolved"
                                        stroke="#10b981"
                                        strokeWidth={3}
                                        dot={{ r: 4, strokeWidth: 2 }}
                                        activeDot={{ r: 6 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : null}
                    </div>
                </div>

            </div>
        </div >
    );
};

export default MaintenanceView;
