import React, { useState, useEffect, useRef } from 'react';
import { Settings, Plus, Loader2, Zap, Trash2, Search, LineChart, FileText, X } from 'lucide-react';
import { ResponsiveContainer, LineChart as RechartsLineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { executeDashboardTool } from './toolClient';

const MetersView = () => {
    const [properties, setProperties] = useState([]);
    const [selectedPropertyId, setSelectedPropertyId] = useState(null);
    const [units, setUnits] = useState([]);
    const [meters, setMeters] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isAddingMeter, setIsAddingMeter] = useState(false);
    const [newConsumerNumber, setNewConsumerNumber] = useState('');
    const [newType, setNewType] = useState('ELECTRICITY');
    const [newLinkedUnits, setNewLinkedUnits] = useState([]);
    const [newInitialReading, setNewInitialReading] = useState('');

    const [selectedMeterId, setSelectedMeterId] = useState(null);
    const [newReadingVal, setNewReadingVal] = useState('');
    const [errorModal, setErrorModal] = useState({ open: false, message: '' });
    const latestUnitsRequestIdRef = useRef(0);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch properties
            const { data: propData } = await executeDashboardTool('PropertyAI', 'get_properties', {});
            setProperties(propData || []);
            const firstPropId = propData?.[0]?.id;

            if (!selectedPropertyId && firstPropId) {
                setSelectedPropertyId(firstPropId);
            }

            // Fetch meters
            const { data: meterData } = await executeDashboardTool('PropertyAI', 'get_meters', {});
            setMeters(meterData || []);
            if (!selectedPropertyId && !firstPropId) {
                setUnits([]);
                setIsLoading(false);
            }

        } catch (e) {
            console.error("Failed to fetch initial meter data:", e);
            setIsLoading(false);
        }
    };

    const fetchUnitsForProperty = async (propId) => {
        const requestId = latestUnitsRequestIdRef.current + 1;
        latestUnitsRequestIdRef.current = requestId;
        try {
            const { data: unitData } = await executeDashboardTool('PropertyAI', 'get_units', { property_id: propId });
            if (latestUnitsRequestIdRef.current !== requestId) return;
            setUnits(unitData || []);
        } catch (e) {
            if (latestUnitsRequestIdRef.current !== requestId) return;
            console.error(e);
        } finally {
            if (latestUnitsRequestIdRef.current === requestId) {
                setIsLoading(false);
            }
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (selectedPropertyId) {
            setUnits([]);
            setSelectedMeterId(null);
            setIsLoading(true);
            fetchUnitsForProperty(selectedPropertyId);
        }
    }, [selectedPropertyId]);

    const handleAddMeter = async (e) => {
        e.preventDefault();
        try {
            await executeDashboardTool('PropertyAI', 'add_meter', {
                consumer_number: newConsumerNumber,
                type: newType,
                linked_units: newLinkedUnits,
                initial_reading: newInitialReading ? parseFloat(newInitialReading) : undefined
            });
                setNewConsumerNumber('');
                setNewLinkedUnits([]);
                setNewInitialReading('');
                setIsAddingMeter(false);
                fetchData();
        } catch (e) {
            console.error(e);
            setErrorModal({ open: true, message: e?.message || 'Network error while adding meter.' });
        }
    };

    const handleDeleteMeter = async (meterId) => {
        if (!window.confirm("Delete this meter?")) return;
        try {
            await executeDashboardTool('PropertyAI', 'delete_meter', { meter_id: meterId });
            fetchData();
        } catch (e) { console.error(e); }
    };

    const handleAddReading = async (e) => {
        e.preventDefault();
        if (!selectedMeterId || !newReadingVal) return;
        try {
            await executeDashboardTool('PropertyAI', 'update_meter_reading', {
                meter_id: selectedMeterId,
                reading: parseFloat(newReadingVal),
                date: new Date().toISOString()
            });
                setNewReadingVal('');
                fetchData();
        } catch (e) {
            console.error(e);
            setErrorModal({ open: true, message: e?.message || 'Network error while adding meter reading.' });
        }
    };

    // Derived Data: Filter meters related to the selected property's units
    const currentPropertyUnits = units.map(u => u.id);
    const visibleMeters = meters.filter(m => m.linked_units.length === 0 || m.linked_units.some(uId => currentPropertyUnits.includes(uId)));

    const selectedMeter = meters.find(m => m.id === selectedMeterId);

    // Chart Format
    const chartData = selectedMeter ? selectedMeter.readings.map(r => ({
        date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: r.value
    })) : [];

    return (
        <div className="flex h-full gap-6">
            <div className="w-1/3 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-gray-900">Utility Meters</h2>
                    <button onClick={() => { setIsAddingMeter(true); setSelectedMeterId(null); }} className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                        <Plus className="w-4 h-4" /> Add
                    </button>
                </div>

                <select
                    value={selectedPropertyId || ''}
                    onChange={e => setSelectedPropertyId(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                    <option value="" disabled>Select Property Filter</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>

                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                    {isLoading ? (
                        <div className="text-center p-4 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>
                    ) : visibleMeters.length === 0 ? (
                        <div className="text-center p-4 text-gray-500 text-sm">No meters associated with this property's units.</div>
                    ) : visibleMeters.map(m => (
                        <div
                            key={m.id}
                            onClick={() => { setSelectedMeterId(m.id); setIsAddingMeter(false); }}
                            className={`p-4 rounded-xl cursor-pointer border transition-all ${selectedMeterId === m.id ? 'border-indigo-500 bg-indigo-50/50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                        >
                            <div className="flex justify-between mb-1">
                                <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" /> {m.consumer_number}</h3>
                                <span className="text-xs font-bold text-gray-500">{m.type}</span>
                            </div>
                            <p className="text-xs text-gray-500">{m.linked_units.length} Linked Units</p>
                            <div className="flex justify-between items-end mt-3">
                                <div className="text-xl font-bold text-gray-800">{m.readings.length > 0 ? m.readings[m.readings.length - 1].value : 0} <span className="text-xs font-normal text-gray-500">kWh</span></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="w-2/3 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
                {isAddingMeter ? (
                    <div className="p-6">
                        <h2 className="text-xl font-bold mb-6">Register New Meter</h2>
                        <form onSubmit={handleAddMeter} className="space-y-4 max-w-lg">
                            <div>
                                <label className="text-sm font-semibold text-gray-600 block mb-1">Consumer / Meter Number</label>
                                <input aria-label="Consumer / Meter Number" required value={newConsumerNumber} onChange={e => setNewConsumerNumber(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-gray-600 block mb-1">Utility Type</label>
                                <select value={newType} onChange={e => setNewType(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none">
                                    <option value="ELECTRICITY">Electricity</option>
                                    <option value="WATER">Water</option>
                                    <option value="GAS">Gas</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-gray-600 block mb-1">Linked Units (Hold Ctrl/Cmd to select multiple)</label>
                                <select multiple value={newLinkedUnits} onChange={e => setNewLinkedUnits(Array.from(e.target.selectedOptions, option => option.value))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none h-32">
                                    {units.map(u => <option key={u.id} value={u.id}>Unit {u.unit_number} (Floor {u.floor})</option>)}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">Leave empty if this is a main building meter.</p>
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-gray-600 block mb-1">Initial Reading</label>
                                <input aria-label="Initial Reading" type="number" value={newInitialReading} onChange={e => setNewInitialReading(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
                            </div>
                            <div className="pt-4 flex gap-2">
                                <button type="button" onClick={() => setIsAddingMeter(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-indigo-600 rounded-lg text-sm text-white font-medium hover:bg-indigo-700">Save Meter</button>
                            </div>
                        </form>
                    </div>
                ) : selectedMeter ? (
                    <div className="flex flex-col h-full">
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-1">{selectedMeter.consumer_number}</h2>
                                    <p className="text-sm text-gray-500">Linked to Units: {selectedMeter.linked_units.length > 0 ? selectedMeter.linked_units.join(', ') : 'None'}</p>
                                </div>
                                <button onClick={() => handleDeleteMeter(selectedMeter.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"><Trash2 className="w-5 h-5" /></button>
                            </div>
                        </div>
                        <div className="p-6 grid grid-cols-2 gap-6 flex-1 overflow-y-auto bg-gray-50/50">
                            <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm h-fit">
                                <h3 className="font-semibold text-gray-900 mb-4">Record New Reading</h3>
                                <form onSubmit={handleAddReading} className="flex gap-2">
                                    <input type="number" step="0.01" required value={newReadingVal} onChange={e => setNewReadingVal(e.target.value)} placeholder="0.00" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm" />
                                    <button type="submit" className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800">Add</button>
                                </form>
                                <div className="mt-6">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Reading History</h4>
                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                                        {[...selectedMeter.readings].reverse().map(r => (
                                            <div key={r.id || Math.random()} className="flex justify-between items-center text-sm p-2 rounded bg-gray-50 border border-gray-100">
                                                <span className="text-gray-500">{new Date(r.date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                <span className="font-semibold text-gray-900">{r.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm flex flex-col">
                                <h3 className="font-semibold text-gray-900 mb-6">Consumption Trend</h3>
                                <div className="flex-1 min-h-[200px]">
                                    {chartData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RechartsLineChart data={chartData}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                                                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#4f46e5', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                                            </RechartsLineChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-gray-400 text-sm">Not enough data points yet.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <Zap className="w-16 h-16 mb-4 text-gray-200" />
                        <h3 className="text-lg font-medium text-gray-500">Meters</h3>
                        <p className="text-sm mt-1">Select a meter from the list or add a new one.</p>
                    </div>
                )}
            </div>

            {errorModal.open && (
                <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-lg">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-base font-semibold text-gray-900">Unable to save reading</h3>
                            <button
                                type="button"
                                onClick={() => setErrorModal({ open: false, message: '' })}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="px-5 py-4 text-sm text-gray-700">{errorModal.message}</div>
                        <div className="px-5 pb-4 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setErrorModal({ open: false, message: '' })}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MetersView;
