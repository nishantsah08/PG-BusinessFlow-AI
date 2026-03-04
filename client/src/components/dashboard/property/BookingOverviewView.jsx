import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Zap, UserX, AlertTriangle, Layers, Home, Info, Building } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

const BookingOverviewView = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [properties, setProperties] = useState([]);
    const [selectedPropertyId, setSelectedPropertyId] = useState('');

    // Active Property Data
    const [units, setUnits] = useState([]);

    // Analytics State
    const [occupancyData, setOccupancyData] = useState([]);
    const [churnData, setChurnData] = useState([]);
    const [summary, setSummary] = useState({});
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    useEffect(() => {
        const loadData = async () => {
            try {
                // Fetch Properties
                const propRes = await fetch('/api/master_ai/tools/execute', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                        agent_name: 'PropertyAI',
                        tool_name: 'get_properties',
                        parameters: {}
                    })
                });
                const propBody = await propRes.json();
                const loadedProps = propBody.data || [];
                setProperties(loadedProps);

                let activePropId = loadedProps.length > 0 ? loadedProps[0].id : null;
                setSelectedPropertyId(activePropId || '');

            } catch (error) {
                console.error("Failed to load overview data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    // Effect to fetch units and analytics when selected property changes
    useEffect(() => {
        if (!selectedPropertyId) {
            setUnits([]);
            return;
        }

        const fetchDetails = async () => {
            setIsLoading(true);
            try {
                // Fetch Units for explicit floor mapping
                const unitsRes = await fetch('/api/master_ai/tools/execute', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                        agent_name: 'PropertyAI',
                        tool_name: 'get_units',
                        parameters: { property_id: selectedPropertyId }
                    })
                });
                const unitsBody = await unitsRes.json();
                setUnits(unitsBody.data || []);

                // Fetch Analytics for charts
                const statsRes = await fetch('/api/master_ai/tools/execute', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                        agent_name: 'PropertyAI',
                        tool_name: 'get_analytics_stats',
                        parameters: { property_id: selectedPropertyId }
                    })
                });
                const statsBody = await statsRes.json();
                if (statsBody.success && statsBody.data) {
                    setOccupancyData(statsBody.data.occupancy_data || []);
                    setChurnData(statsBody.data.churn_data || []);
                    setSummary(statsBody.data.summary || {});
                }
            } catch (e) {
                console.error("Failed to fetch property details:", e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchDetails();
    }, [selectedPropertyId]);

    // Group units by floor for the visual grid
    const groupedUnits = useMemo(() => {
        const grouped = {};
        units.forEach(unit => {
            const floor = parseInt(unit.floor) || 0; // Default to Ground Floor
            if (!grouped[floor]) {
                grouped[floor] = [];
            }
            grouped[floor].push(unit);
        });

        // Sort floors descending (highest floor on top)
        const sortedFloors = Object.keys(grouped).sort((a, b) => parseInt(b) - parseInt(a));

        // Sort units numerically within each floor
        sortedFloors.forEach(floor => {
            grouped[floor].sort((a, b) => {
                const numA = parseInt(a.unit_number.replace(/\D/g, '')) || 0;
                const numB = parseInt(b.unit_number.replace(/\D/g, '')) || 0;
                return numA - numB;
            });
        });

        return { sortedFloors, grouped };
    }, [units]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'AVAILABLE': return 'bg-emerald-100 border-emerald-200 text-emerald-700 hover:bg-emerald-200';
            case 'BOOKED': return 'bg-rose-100 border-rose-200 text-rose-700 hover:bg-rose-200';
            case 'NOTICE': return 'bg-amber-100 border-amber-200 text-amber-700 hover:bg-amber-200';
            default: return 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200';
        }
    };

    const filteredOccupancyData = useMemo(() => {
        return occupancyData.filter((item) => {
            const key = String(item.period_start || '');
            if (fromDate && key < fromDate) return false;
            if (toDate && key > toDate) return false;
            return true;
        });
    }, [occupancyData, fromDate, toDate]);

    const filteredChurnData = useMemo(() => {
        return churnData.filter((item) => {
            const key = String(item.period_start || '');
            if (fromDate && key < fromDate) return false;
            if (toDate && key > toDate) return false;
            return true;
        });
    }, [churnData, fromDate, toDate]);

    if (isLoading && properties.length === 0) {
        return <div className="h-full flex items-center justify-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mr-3" /> Loading Overview...</div>;
    }

    return (
        <div className="space-y-6">

            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">Dashboard Metrics</h2>
                <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">Property Filter:</span>
                    <select
                        value={selectedPropertyId}
                        onChange={e => setSelectedPropertyId(e.target.value)}
                        className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                        {properties.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                    <span className="text-gray-500 ml-2">From:</span>
                    <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5"
                    />
                    <span className="text-gray-500">To:</span>
                    <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5"
                    />
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-medium text-gray-500">Total Capacity</p>
                        <Zap className="text-yellow-500 w-5 h-5" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">{summary.capacity || 0}</h3>
                    <p className="text-xs text-gray-400 mt-1">Maximum Beds/Units</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-medium text-gray-500">Current Occupancy</p>
                        <UserX className="text-indigo-500 w-5 h-5" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">{summary.occupied || 0}</h3>
                    <p className="text-xs text-green-500 font-medium mt-1">{(summary.capacity ? ((summary.occupied / summary.capacity) * 100).toFixed(1) : 0)}% Utilization Rate</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-medium text-gray-500">Upcoming Vacancies</p>
                        <AlertTriangle className="text-amber-500 w-5 h-5" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">{summary.on_notice || 0}</h3>
                    <p className="text-xs text-gray-400 mt-1">Tenants on Notice Period</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-medium text-gray-500">Available Stock</p>
                        <Home className="text-emerald-500 w-5 h-5" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">{summary.available || 0}</h3>
                    <p className="text-xs text-gray-400 mt-1">Ready for immediate move-in</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Left Col: Physical Floor Plan Grid */}
                <div className="xl:col-span-1 space-y-6">
                    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm min-h-[500px]">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Layers className="w-5 h-5 text-indigo-500" /> Physical Layout</h3>

                            <div className="flex gap-2 text-[10px] font-medium text-gray-500">
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400"></div> Free</span>
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-400"></div> Booked</span>
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400"></div> Notice</span>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="flex items-center justify-center p-8 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Rendering Layout...</div>
                        ) : units.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-10 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                <Building className="w-12 h-12 text-gray-300 mb-3" />
                                <h4 className="text-lg font-bold text-gray-700">No Physical Layout Created</h4>
                                <p className="text-sm text-gray-500 mt-2 max-w-sm">
                                    This property has zero registered units. To visualize the physical building layout, go to the <strong>Property Management</strong> tab, select this property, and start adding units to specific floors.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {groupedUnits.sortedFloors.map(floor => (
                                    <div key={floor} className="relative">
                                        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gray-800 text-white rounded-l-lg flex items-center justify-center border-r border-gray-700">
                                            <span className="-rotate-90 text-xs font-bold tracking-widest whitespace-nowrap">FL {floor}</span>
                                        </div>
                                        <div className="ml-8 bg-gray-50 border border-gray-200 border-l-0 rounded-r-lg p-3 grid grid-cols-3 gap-2">
                                            {groupedUnits.grouped[floor].map(u => (
                                                <div key={u.id} className={`p-2 rounded border text-center font-medium cursor-help transition-colors ${getStatusColor(u.status)}`} title={`${u.types ? u.types.join(', ') : 'Standard'} Unit`}>
                                                    <div className="text-sm">{u.unit_number}</div>
                                                    <div className="text-[9px] opacity-80 uppercase tracking-wide mt-0.5">{u.types && u.types.length > 0 ? u.types[0].substring(0, 6) : 'STD'}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Col: Charts */}
                <div className="xl:col-span-2 space-y-6">

                    {/* Occupancy Chart */}
                    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-6">Occupancy Trend vs Full Capacity</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={filteredOccupancyData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                                    <RechartsTooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                    <Line type="monotone" dataKey="capacity" name="Total Capacity Limit" stroke="#9ca3af" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} strokeDasharray="5 5" />
                                    <Line type="monotone" dataKey="occupied" name="Actual Occupied" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Churn Chart */}
                    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-6">Monthly Tenant Churning</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={filteredChurnData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                                    <RechartsTooltip
                                        cursor={{ fill: '#f9fafb' }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                    <Bar dataKey="move_ins" name="Move-ins (New Tenants)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                    <Bar dataKey="move_outs" name="Move-outs (Exits)" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default BookingOverviewView;
