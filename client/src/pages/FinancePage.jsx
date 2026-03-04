import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Plus, Save, Search, X } from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';

const formatCurrency = (value) => `₹ ${Number(value || 0).toLocaleString('en-IN')}`;

const DEMO_INCOMING = [
    {
        txn_id: 'IN-240301-001',
        payer_id: '+919800098000',
        amount: 15000,
        date: '2026-03-01',
        payment_mode: 'UPI',
        status: 'SUCCESS',
        note: 'March rent + dues',
    },
    {
        txn_id: 'IN-240302-002',
        payer_id: '+919811112222',
        amount: 12000,
        date: '2026-03-02',
        payment_mode: 'Bank Transfer',
        status: 'SUCCESS',
        note: 'March rent',
    },
    {
        txn_id: 'IN-240303-003',
        payer_id: '+919822223333',
        amount: 6000,
        date: '2026-03-03',
        payment_mode: 'Cash',
        status: 'PENDING_REVIEW',
        note: 'Partial payment',
    },
];

const DEMO_OUTGOING = [
    {
        txn_id: 'OUT-240301-001',
        category: 'OpEx',
        sub_category: 'Plumbing',
        work_done: 'Pipe replacement in Block A',
        property_id: 'PROP-1',
        amount: 2500,
        payee: 'Ravi Plumbing Works',
        payment_mode: 'UPI',
        date: '2026-03-01',
        status: 'SUCCESS',
    },
    {
        txn_id: 'OUT-240302-002',
        category: 'OpEx',
        sub_category: 'Housekeeping',
        work_done: 'Monthly cleaning services',
        property_id: 'PROP-2',
        amount: 4200,
        payee: 'Sparkle Services',
        payment_mode: 'Bank Transfer',
        date: '2026-03-02',
        status: 'SUCCESS',
    },
    {
        txn_id: 'OUT-240303-003',
        category: 'CapEx',
        sub_category: 'Furniture',
        work_done: 'New cots for 2 rooms',
        property_id: 'PROP-1',
        amount: 9800,
        payee: 'Urban Furnishers',
        payment_mode: 'UPI',
        date: '2026-03-03',
        status: 'PENDING_APPROVAL',
    },
];

const blankIncomingForm = {
    txn_id: '',
    payer_id: '',
    amount: '',
    date: '',
    payment_mode: 'UPI',
    status: 'SUCCESS',
    note: '',
};

const blankOutgoingForm = {
    txn_id: '',
    category: 'OpEx',
    sub_category: '',
    work_done: '',
    property_id: '',
    amount: '',
    payee: '',
    payment_mode: 'UPI',
    date: '',
    status: 'SUCCESS',
};

const FinancePage = () => {
    const { authContext } = useAuth();

    const [incomingRows, setIncomingRows] = useState([]);
    const [outgoingRows, setOutgoingRows] = useState([]);
    const [incomingFilter, setIncomingFilter] = useState({ search: '', status: 'ALL' });
    const [outgoingFilter, setOutgoingFilter] = useState({ search: '', category: 'ALL' });
    const [incomingForm, setIncomingForm] = useState(blankIncomingForm);
    const [outgoingForm, setOutgoingForm] = useState(blankOutgoingForm);
    const [editingIncomingId, setEditingIncomingId] = useState('');
    const [editingOutgoingId, setEditingOutgoingId] = useState('');
    const [activeSection, setActiveSection] = useState('overview');
    const [showIncomingModal, setShowIncomingModal] = useState(false);
    const [showOutgoingModal, setShowOutgoingModal] = useState(false);
    const [activeRequest, setActiveRequest] = useState('');
    const [notice, setNotice] = useState('Loading live finance records...');

    const financePermissions = useMemo(
        () => authContext?.permissions?.admin_adapter?.FinanceAI || [],
        [authContext?.permissions?.admin_adapter?.FinanceAI]
    );

    const canExecute = useCallback((toolName) => financePermissions.includes(toolName), [financePermissions]);

    const executeFinanceTool = useCallback(async ({ tool_name, parameters }) => {
        if (!canExecute(tool_name)) {
            return { success: false, error: `Role ${authContext?.profile_type || 'unknown'} is not permitted for ${tool_name}.` };
        }

        setActiveRequest(tool_name);
        try {
            const response = await apiClient.post('/api/master_ai/tools/execute', {
                agent_name: 'FinanceAI',
                tool_name,
                parameters,
            });
            return response;
        } finally {
            setActiveRequest('');
        }
    }, [authContext?.profile_type, canExecute]);

    useEffect(() => {
        const loadRecords = async () => {
            let incomingLoaded = false;
            let outgoingLoaded = false;

            if (canExecute('get_incoming_txns')) {
                const incomingResponse = await executeFinanceTool({
                    tool_name: 'get_incoming_txns',
                    parameters: { limit: 200 }
                });
                const incomingList = incomingResponse?.data?.transactions;
                if (incomingResponse?.success && Array.isArray(incomingList) && incomingList.length > 0) {
                    setIncomingRows(incomingList.map((row) => ({
                        txn_id: row.txn_id,
                        payer_id: row.payer_id,
                        amount: row.amount,
                        date: String(row.date || row.timestamp || '').slice(0, 10),
                        payment_mode: row.payment_mode || 'Unknown',
                        status: row.status || 'SUCCESS',
                        note: row.remarks || ''
                    })));
                    incomingLoaded = true;
                }
            }

            if (canExecute('get_expenses')) {
                const outgoingResponse = await executeFinanceTool({
                    tool_name: 'get_expenses',
                    parameters: { limit: 200 }
                });
                const outgoingList = outgoingResponse?.data?.transactions;
                if (outgoingResponse?.success && Array.isArray(outgoingList) && outgoingList.length > 0) {
                    setOutgoingRows(outgoingList.map((row) => ({
                        txn_id: row.txn_id,
                        category: row.category || 'OpEx',
                        sub_category: row.sub_category || '',
                        work_done: row.work_done || '',
                        property_id: row.property_id || '',
                        amount: row.amount,
                        payee: row.payee || '',
                        payment_mode: row.payment_mode || 'Unknown',
                        date: String(row.date || row.timestamp || '').slice(0, 10),
                        status: row.status || 'SUCCESS'
                    })));
                    outgoingLoaded = true;
                }
            }

            if (!incomingLoaded) setIncomingRows(DEMO_INCOMING);
            if (!outgoingLoaded) setOutgoingRows(DEMO_OUTGOING);

            if (incomingLoaded || outgoingLoaded) {
                setNotice('Live finance records loaded. You can add and edit records.');
            } else {
                setNotice('Live finance records are unavailable, showing fallback demo data.');
            }
        };

        if (!financePermissions.length) return;
        loadRecords();
    }, [canExecute, executeFinanceTool, financePermissions.length]);

    const totals = useMemo(() => {
        const inflow = incomingRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
        const outflow = outgoingRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
        return { inflow, outflow, net: inflow - outflow };
    }, [incomingRows, outgoingRows]);

    const filteredIncoming = useMemo(() => {
        const query = incomingFilter.search.trim().toLowerCase();
        return incomingRows.filter((row) => {
            const matchesStatus = incomingFilter.status === 'ALL' || row.status === incomingFilter.status;
            if (!matchesStatus) return false;
            if (!query) return true;
            return [row.txn_id, row.payer_id, row.payment_mode, row.note]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(query));
        });
    }, [incomingFilter, incomingRows]);

    const filteredOutgoing = useMemo(() => {
        const query = outgoingFilter.search.trim().toLowerCase();
        return outgoingRows.filter((row) => {
            const matchesCategory = outgoingFilter.category === 'ALL' || row.category === outgoingFilter.category;
            if (!matchesCategory) return false;
            if (!query) return true;
            return [row.txn_id, row.payee, row.sub_category, row.work_done, row.property_id]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(query));
        });
    }, [outgoingFilter, outgoingRows]);

    const handleIncomingSubmit = async (event) => {
        event.preventDefault();
        const amount = Number(incomingForm.amount);
        if (!incomingForm.payer_id.trim() || !Number.isFinite(amount) || amount <= 0) {
            setNotice('Incoming transaction requires payer ID and positive amount.');
            return;
        }

        const nextTxnId = incomingForm.txn_id.trim() || `IN-${Date.now()}`;
        const record = {
            ...incomingForm,
            txn_id: nextTxnId,
            payer_id: incomingForm.payer_id.trim(),
            amount,
            date: incomingForm.date || new Date().toISOString().slice(0, 10),
        };

        if (editingIncomingId) {
            setIncomingRows((prev) => prev.map((row) => (row.txn_id === editingIncomingId ? record : row)));
            setEditingIncomingId('');
            setIncomingForm(blankIncomingForm);
            setNotice('Incoming transaction updated on screen.');
            setShowIncomingModal(false);
            return;
        }

        setIncomingRows((prev) => [record, ...prev]);
        setIncomingForm(blankIncomingForm);
        setShowIncomingModal(false);

        const response = await executeFinanceTool({
            tool_name: 'record_incoming_txn',
            parameters: {
                payer_id: record.payer_id,
                amount: record.amount,
                payment_mode: record.payment_mode,
                date: record.date,
                txn_id: record.txn_id,
            },
        });

        if (response?.success) {
            setNotice('Incoming transaction submitted to workflow successfully.');
        } else {
            setNotice(response?.error || 'Incoming transaction saved in demo mode (workflow call not completed).');
        }
    };

    const handleOutgoingSubmit = async (event) => {
        event.preventDefault();
        const amount = Number(outgoingForm.amount);
        if (!outgoingForm.payee.trim() || !Number.isFinite(amount) || amount <= 0) {
            setNotice('Outgoing transaction requires payee and positive amount.');
            return;
        }

        const nextTxnId = outgoingForm.txn_id.trim() || `OUT-${Date.now()}`;
        const record = {
            ...outgoingForm,
            txn_id: nextTxnId,
            payee: outgoingForm.payee.trim(),
            amount,
            date: outgoingForm.date || new Date().toISOString().slice(0, 10),
        };

        if (editingOutgoingId) {
            setOutgoingRows((prev) => prev.map((row) => (row.txn_id === editingOutgoingId ? record : row)));
            setEditingOutgoingId('');
            setOutgoingForm(blankOutgoingForm);
            setNotice('Outgoing transaction updated on screen.');
            setShowOutgoingModal(false);
            return;
        }

        setOutgoingRows((prev) => [record, ...prev]);
        setOutgoingForm(blankOutgoingForm);
        setShowOutgoingModal(false);

        const response = await executeFinanceTool({
            tool_name: 'record_outgoing_txn',
            parameters: {
                category: record.category,
                sub_category: record.sub_category || undefined,
                work_done: record.work_done || undefined,
                property_id: record.property_id || undefined,
                amount: record.amount,
                payee: record.payee,
                payment_mode: record.payment_mode,
                remarks: `Submitted from Finance UI (${record.txn_id})`,
            },
        });

        if (response?.success) {
            setNotice('Outgoing transaction submitted to workflow successfully.');
        } else {
            setNotice(response?.error || 'Outgoing transaction saved in demo mode (workflow call not completed).');
        }
    };

    const startIncomingEdit = (row) => {
        setEditingIncomingId(row.txn_id);
        setIncomingForm({
            txn_id: row.txn_id,
            payer_id: row.payer_id,
            amount: String(row.amount),
            date: row.date,
            payment_mode: row.payment_mode,
            status: row.status,
            note: row.note || '',
        });
        setShowIncomingModal(true);
    };

    const startOutgoingEdit = (row) => {
        setEditingOutgoingId(row.txn_id);
        setOutgoingForm({
            txn_id: row.txn_id,
            category: row.category,
            sub_category: row.sub_category || '',
            work_done: row.work_done || '',
            property_id: row.property_id || '',
            amount: String(row.amount),
            payee: row.payee,
            payment_mode: row.payment_mode,
            date: row.date,
            status: row.status,
        });
        setShowOutgoingModal(true);
    };

    return (
        <div className="h-full bg-gray-50/50 overflow-auto">
            <header className="bg-white border-b border-gray-200 px-6 py-4">
                <h1 className="text-2xl font-semibold text-gray-900">Finance Operations</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Incoming and outgoing business transactions with governed workflow execution for new financial actions.
                </p>
            </header>

            <div className="p-6 space-y-6">
                <div className="bg-indigo-50 border border-indigo-100 text-indigo-800 rounded-lg px-4 py-3 text-sm">
                    {notice}
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-2 inline-flex gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveSection('overview')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium ${activeSection === 'overview' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                        Overview
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveSection('incoming')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium ${activeSection === 'incoming' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                        Incoming
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveSection('outgoing')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium ${activeSection === 'outgoing' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                        Outgoing
                    </button>
                </div>

                {activeSection === 'overview' && (
                <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4" data-testid="finance-overview-section">
                    <h2 className="text-lg font-semibold text-gray-800">Overview</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="text-xs text-gray-500">Total Incoming</div>
                            <div className="text-xl font-semibold">{formatCurrency(totals.inflow)}</div>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="text-xs text-gray-500">Total Outgoing</div>
                            <div className="text-xl font-semibold">{formatCurrency(totals.outflow)}</div>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="text-xs text-gray-500">Net</div>
                            <div className="text-xl font-semibold">{formatCurrency(totals.net)}</div>
                        </div>
                    </div>
                </section>
                )}

                {activeSection === 'incoming' && (
                <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4" data-testid="finance-incoming-section">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
                            <h2 className="text-lg font-semibold text-gray-800">Incoming Transactions</h2>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setEditingIncomingId('');
                                setIncomingForm(blankIncomingForm);
                                setShowIncomingModal(true);
                            }}
                            className="inline-flex items-center gap-2 border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-100"
                        >
                            <Plus className="w-4 h-4" />
                            Add Incoming
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <label className="text-sm text-gray-600">
                            Search
                            <div className="mt-1 flex items-center border border-gray-200 rounded-lg px-3 py-2">
                                <Search className="w-4 h-4 text-gray-400" />
                                <input
                                    value={incomingFilter.search}
                                    onChange={(event) => setIncomingFilter((prev) => ({ ...prev, search: event.target.value }))}
                                    className="ml-2 w-full outline-none"
                                    placeholder="Txn ID / payer / note"
                                />
                            </div>
                        </label>
                        <label className="text-sm text-gray-600">
                            Status
                            <select
                                value={incomingFilter.status}
                                onChange={(event) => setIncomingFilter((prev) => ({ ...prev, status: event.target.value }))}
                                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2"
                            >
                                <option value="ALL">All</option>
                                <option value="SUCCESS">SUCCESS</option>
                                <option value="PENDING_REVIEW">PENDING_REVIEW</option>
                            </select>
                        </label>
                    </div>

                    <div className="overflow-auto border border-gray-200 rounded-lg">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600">
                                <tr>
                                    <th className="text-left px-3 py-2">Txn ID</th>
                                    <th className="text-left px-3 py-2">Payer</th>
                                    <th className="text-left px-3 py-2">Date</th>
                                    <th className="text-left px-3 py-2">Mode</th>
                                    <th className="text-left px-3 py-2">Amount</th>
                                    <th className="text-left px-3 py-2">Status</th>
                                    <th className="text-left px-3 py-2">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredIncoming.map((row) => (
                                    <tr key={row.txn_id} className="border-t border-gray-100">
                                        <td className="px-3 py-2">{row.txn_id}</td>
                                        <td className="px-3 py-2">{row.payer_id}</td>
                                        <td className="px-3 py-2">{row.date}</td>
                                        <td className="px-3 py-2">{row.payment_mode}</td>
                                        <td className="px-3 py-2">{formatCurrency(row.amount)}</td>
                                        <td className="px-3 py-2">{row.status}</td>
                                        <td className="px-3 py-2">
                                            <button
                                                type="button"
                                                onClick={() => startIncomingEdit(row)}
                                                className="text-indigo-600 hover:text-indigo-800"
                                            >
                                                Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
                )}

                {activeSection === 'outgoing' && (
                <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4" data-testid="finance-outgoing-section">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <ArrowUpRight className="w-5 h-5 text-rose-600" />
                            <h2 className="text-lg font-semibold text-gray-800">Outgoing Transactions</h2>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setEditingOutgoingId('');
                                setOutgoingForm(blankOutgoingForm);
                                setShowOutgoingModal(true);
                            }}
                            className="inline-flex items-center gap-2 border border-rose-200 bg-rose-50 text-rose-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-rose-100"
                        >
                            <Plus className="w-4 h-4" />
                            Add Outgoing
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <label className="text-sm text-gray-600">
                            Search
                            <div className="mt-1 flex items-center border border-gray-200 rounded-lg px-3 py-2">
                                <Search className="w-4 h-4 text-gray-400" />
                                <input
                                    value={outgoingFilter.search}
                                    onChange={(event) => setOutgoingFilter((prev) => ({ ...prev, search: event.target.value }))}
                                    className="ml-2 w-full outline-none"
                                    placeholder="Txn / payee / work"
                                />
                            </div>
                        </label>
                        <label className="text-sm text-gray-600">
                            Category
                            <select
                                value={outgoingFilter.category}
                                onChange={(event) => setOutgoingFilter((prev) => ({ ...prev, category: event.target.value }))}
                                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2"
                            >
                                <option value="ALL">All</option>
                                <option value="OpEx">OpEx</option>
                                <option value="CapEx">CapEx</option>
                            </select>
                        </label>
                    </div>

                    <div className="overflow-auto border border-gray-200 rounded-lg">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600">
                                <tr>
                                    <th className="text-left px-3 py-2">Txn ID</th>
                                    <th className="text-left px-3 py-2">Category</th>
                                    <th className="text-left px-3 py-2">Payee</th>
                                    <th className="text-left px-3 py-2">Property</th>
                                    <th className="text-left px-3 py-2">Date</th>
                                    <th className="text-left px-3 py-2">Amount</th>
                                    <th className="text-left px-3 py-2">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOutgoing.map((row) => (
                                    <tr key={row.txn_id} className="border-t border-gray-100">
                                        <td className="px-3 py-2">{row.txn_id}</td>
                                        <td className="px-3 py-2">{row.category}</td>
                                        <td className="px-3 py-2">{row.payee}</td>
                                        <td className="px-3 py-2">{row.property_id || '-'}</td>
                                        <td className="px-3 py-2">{row.date}</td>
                                        <td className="px-3 py-2">{formatCurrency(row.amount)}</td>
                                        <td className="px-3 py-2">
                                            <button
                                                type="button"
                                                onClick={() => startOutgoingEdit(row)}
                                                className="text-indigo-600 hover:text-indigo-800"
                                            >
                                                Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
                )}

                {showIncomingModal && (
                    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                        <div className="bg-white w-full max-w-2xl rounded-xl border border-gray-200 shadow-xl p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold">{editingIncomingId ? 'Edit Incoming Transaction' : 'Add Incoming Transaction'}</h3>
                                <button type="button" onClick={() => setShowIncomingModal(false)} className="text-gray-500"><X className="w-5 h-5" /></button>
                            </div>
                            <form onSubmit={handleIncomingSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <input value={incomingForm.payer_id} onChange={(event) => setIncomingForm((prev) => ({ ...prev, payer_id: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" placeholder="Payer ID (+9198...)" />
                                <input value={incomingForm.amount} onChange={(event) => setIncomingForm((prev) => ({ ...prev, amount: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" placeholder="Amount" type="number" step="0.01" />
                                <input value={incomingForm.date} onChange={(event) => setIncomingForm((prev) => ({ ...prev, date: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" type="date" />
                                <input value={incomingForm.payment_mode} onChange={(event) => setIncomingForm((prev) => ({ ...prev, payment_mode: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" placeholder="Payment mode" />
                                <input value={incomingForm.note} onChange={(event) => setIncomingForm((prev) => ({ ...prev, note: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2 md:col-span-2" placeholder="Notes" />
                                <button type="submit" disabled={activeRequest === 'record_incoming_txn'} className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-lg px-4 py-2 disabled:opacity-50">
                                    {editingIncomingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                    {editingIncomingId ? 'Save Incoming Edit' : 'Add Incoming'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {showOutgoingModal && (
                    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                        <div className="bg-white w-full max-w-2xl rounded-xl border border-gray-200 shadow-xl p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold">{editingOutgoingId ? 'Edit Outgoing Transaction' : 'Add Outgoing Transaction'}</h3>
                                <button type="button" onClick={() => setShowOutgoingModal(false)} className="text-gray-500"><X className="w-5 h-5" /></button>
                            </div>
                            <form onSubmit={handleOutgoingSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <select value={outgoingForm.category} onChange={(event) => setOutgoingForm((prev) => ({ ...prev, category: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2">
                                    <option value="OpEx">OpEx</option>
                                    <option value="CapEx">CapEx</option>
                                </select>
                                <input value={outgoingForm.payee} onChange={(event) => setOutgoingForm((prev) => ({ ...prev, payee: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" placeholder="Payee" />
                                <input value={outgoingForm.amount} onChange={(event) => setOutgoingForm((prev) => ({ ...prev, amount: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" placeholder="Amount" type="number" step="0.01" />
                                <input value={outgoingForm.sub_category} onChange={(event) => setOutgoingForm((prev) => ({ ...prev, sub_category: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" placeholder="Sub category" />
                                <input value={outgoingForm.property_id} onChange={(event) => setOutgoingForm((prev) => ({ ...prev, property_id: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" placeholder="Property ID" />
                                <input value={outgoingForm.payment_mode} onChange={(event) => setOutgoingForm((prev) => ({ ...prev, payment_mode: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" placeholder="Payment mode" />
                                <input value={outgoingForm.work_done} onChange={(event) => setOutgoingForm((prev) => ({ ...prev, work_done: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2 md:col-span-2" placeholder="Work done" />
                                <button type="submit" disabled={activeRequest === 'record_outgoing_txn'} className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-lg px-4 py-2 disabled:opacity-50">
                                    {editingOutgoingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                    {editingOutgoingId ? 'Save Outgoing Edit' : 'Add Outgoing'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FinancePage;
