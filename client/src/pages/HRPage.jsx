import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Save, Users, X } from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';

const blankHireForm = {
    name: '',
    designation: '',
    job_description: '',
    contact_primary: '',
    contact_email: '',
};

const blankProfileForm = {
    name: '',
    designation: '',
    job_description: '',
    contact_primary: '',
    contact_email: '',
};

const blankRateCardForm = {
    base_salary: '',
    account_holder: '',
    account_number: '',
    ifsc: '',
    bank_name: '',
    upi_id: '',
    incentive_logic: '',
    incentive_amount_per_unit: '',
    allowance_travel: '',
    allowance_phone: '',
};

const DEMO_EMPLOYEES = [
    { id: 'STF-01', name: 'Ramesh Kumar', designation: 'Property Manager', job_description: 'Operations lead for property and maintenance', contact: { primary: '+919833334444', email: 'ramesh@pgflow.ai' }, status: 'ACTIVE' },
    { id: 'STF-02', name: 'Meera Joshi', designation: 'Sales Executive', job_description: 'Lead handling and customer onboarding', contact: { primary: '+919844445555', email: 'meera@pgflow.ai' }, status: 'ACTIVE' },
    { id: 'STF-03', name: 'Arun Singh', designation: 'Maintenance Supervisor', job_description: 'Maintenance scheduling and vendor coordination', contact: { primary: '+919855556666', email: 'arun@pgflow.ai' }, status: 'ACTIVE' },
];

const DEMO_RATE_CARDS = {
    'STF-01': { base_salary: 4000, bank_details: { account_holder: 'Ramesh Kumar', account_number: '00001123456', ifsc: 'HDFC0001234', bank_name: 'HDFC Bank', upi_id: 'ramesh@hdfcbank' }, components: { incentives: { logic: 'Units Occupied * Amount Per Unit', amount_per_unit: 350 }, allowances: { travel: 1000, phone: 500 } } },
    'STF-02': { base_salary: 3500, bank_details: { account_holder: 'Meera Joshi', account_number: '00002123456', ifsc: 'HDFC0001234', bank_name: 'HDFC Bank', upi_id: 'meera@hdfcbank' }, components: { incentives: { logic: 'Qualified Visits * Amount', amount_per_unit: 250 }, allowances: { travel: 1200, phone: 500 } } },
    'STF-03': { base_salary: 3800, bank_details: { account_holder: 'Arun Singh', account_number: '00003123456', ifsc: 'HDFC0001234', bank_name: 'HDFC Bank', upi_id: 'arun@hdfcbank' }, components: { incentives: { logic: 'Tickets Resolved * Amount', amount_per_unit: 300 }, allowances: { travel: 1500, phone: 500 } } },
};

const HRPage = () => {
    const { authContext } = useAuth();

    const [employees, setEmployees] = useState([]);
    const [rateCards, setRateCards] = useState({});
    const [selectedStaffId, setSelectedStaffId] = useState('');
    const [hireForm, setHireForm] = useState(blankHireForm);
    const [profileForm, setProfileForm] = useState(blankProfileForm);
    const [rateCardForm, setRateCardForm] = useState(blankRateCardForm);
    const [showAddForm, setShowAddForm] = useState(false);
    const [showEditForm, setShowEditForm] = useState(false);
    const [showRateCardForm, setShowRateCardForm] = useState(false);
    const [activeRequest, setActiveRequest] = useState('');
    const [notice, setNotice] = useState('Loading employee records...');

    const hrPermissions = useMemo(
        () => authContext?.permissions?.admin_adapter?.HRAgent || [],
        [authContext?.permissions?.admin_adapter?.HRAgent]
    );

    const canExecute = useCallback((toolName) => hrPermissions.includes(toolName), [hrPermissions]);

    const selectedEmployee = useMemo(
        () => employees.find((emp) => emp.id === selectedStaffId) || null,
        [employees, selectedStaffId]
    );

    const selectedRateCard = useMemo(() => rateCards[selectedStaffId] || null, [rateCards, selectedStaffId]);

    const executeHRTool = useCallback(async ({ tool_name, parameters }) => {
        if (!canExecute(tool_name)) {
            return { success: false, error: `Role ${authContext?.profile_type || 'unknown'} is not permitted for ${tool_name}.` };
        }

        setActiveRequest(tool_name);
        try {
            const response = await apiClient.post('/api/master_ai/tools/execute', {
                agent_name: 'HRAgent',
                tool_name,
                parameters,
            });
            return response;
        } finally {
            setActiveRequest('');
        }
    }, [authContext?.profile_type, canExecute]);

    const applyEmployeeToForms = useCallback((employee, card) => {
        setProfileForm({
            name: employee?.name || '',
            designation: employee?.designation || '',
            job_description: employee?.job_description || '',
            contact_primary: employee?.contact?.primary || '',
            contact_email: employee?.contact?.email || '',
        });

        if (!card) {
            setRateCardForm(blankRateCardForm);
            return;
        }

        setRateCardForm({
            base_salary: String(card.base_salary || ''),
            account_holder: card.bank_details?.account_holder || '',
            account_number: card.bank_details?.account_number || '',
            ifsc: card.bank_details?.ifsc || '',
            bank_name: card.bank_details?.bank_name || '',
            upi_id: card.bank_details?.upi_id || '',
            incentive_logic: card.components?.incentives?.logic || '',
            incentive_amount_per_unit: String(card.components?.incentives?.amount_per_unit || ''),
            allowance_travel: String(card.components?.allowances?.travel || ''),
            allowance_phone: String(card.components?.allowances?.phone || ''),
        });
    }, []);

    const loadEmployees = useCallback(async () => {
        if (!canExecute('get_all_staff')) {
            setNotice('Your role does not have staff read permission.');
            setEmployees([]);
            return;
        }

        const response = await executeHRTool({
            tool_name: 'get_all_staff',
            parameters: {}
        });

        const rows = Array.isArray(response?.data) ? response.data : [];
        if (!response?.success || rows.length === 0) {
            setEmployees(DEMO_EMPLOYEES);
            setRateCards(DEMO_RATE_CARDS);
            setSelectedStaffId(DEMO_EMPLOYEES[0].id);
            setNotice('Live HR service is unavailable. Showing demo employee data.');
            return;
        }

        setEmployees(rows);
        const firstId = rows[0]?.id || '';
        setSelectedStaffId(firstId);
        setNotice('Employee records loaded successfully.');
    }, [canExecute, executeHRTool]);

    const loadRateCard = useCallback(async (staffId) => {
        if (!staffId || !canExecute('get_salary_card')) return null;
        const response = await executeHRTool({
            tool_name: 'get_salary_card',
            parameters: { staff_id: staffId }
        });
        if (!response?.success || !response?.data || response.data.error) return null;
        return response.data;
    }, [canExecute, executeHRTool]);

    const selectEmployee = useCallback(async (staffId) => {
        setSelectedStaffId(staffId);
        const employee = employees.find((item) => item.id === staffId);
        const card = await loadRateCard(staffId);
        if (card) {
            setRateCards((prev) => ({ ...prev, [staffId]: card }));
        }
        applyEmployeeToForms(employee, card || null);
    }, [applyEmployeeToForms, employees, loadRateCard]);

    useEffect(() => {
        if (!hrPermissions.length) return;
        loadEmployees();
    }, [hrPermissions.length, loadEmployees]);

    useEffect(() => {
        const run = async () => {
            if (!selectedStaffId) return;
            const employee = employees.find((item) => item.id === selectedStaffId);
            const card = await loadRateCard(selectedStaffId);
            if (card) {
                setRateCards((prev) => (prev[selectedStaffId] ? prev : { ...prev, [selectedStaffId]: card }));
            }
            applyEmployeeToForms(employee, card || null);
        };
        run();
    }, [applyEmployeeToForms, employees, loadRateCard, selectedStaffId]);

    const handleAddEmployee = async (event) => {
        event.preventDefault();
        if (!hireForm.name.trim() || !hireForm.designation.trim() || !hireForm.contact_primary.trim()) {
            setNotice('Name, designation, and primary contact are required to add employee.');
            return;
        }

        const response = await executeHRTool({
            tool_name: 'hire_staff',
            parameters: {
                name: hireForm.name.trim(),
                designation: hireForm.designation.trim(),
                job_description: hireForm.job_description.trim() || undefined,
                contact: {
                    primary: hireForm.contact_primary.trim(),
                    email: hireForm.contact_email.trim() || undefined,
                },
            },
        });

        if (response?.success) {
            setNotice('Employee created successfully.');
            setHireForm(blankHireForm);
            setShowAddForm(false);
            await loadEmployees();
        } else {
            setNotice(response?.error || 'Could not create employee.');
        }
    };

    const handleUpdateEmployee = async (event) => {
        event.preventDefault();
        if (!selectedEmployee) return;

        const response = await executeHRTool({
            tool_name: 'update_staff_profile',
            parameters: {
                staff_id: selectedEmployee.id,
                name: profileForm.name.trim() || undefined,
                designation: profileForm.designation.trim() || undefined,
                job_description: profileForm.job_description.trim() || undefined,
                contact: {
                    primary: profileForm.contact_primary.trim() || undefined,
                    email: profileForm.contact_email.trim() || undefined,
                },
            },
        });

        if (response?.success) {
            setNotice('Employee profile updated.');
            setShowEditForm(false);
            await loadEmployees();
        } else {
            setNotice(response?.error || 'Could not update employee profile.');
        }
    };

    const handleSaveRateCard = async (event) => {
        event.preventDefault();
        if (!selectedEmployee) return;

        const baseSalary = Number(rateCardForm.base_salary);
        if (!Number.isFinite(baseSalary) || baseSalary <= 0) {
            setNotice('Base salary must be a valid positive number.');
            return;
        }

        const card = {
            base_salary: baseSalary,
            bank_details: {
                account_holder: rateCardForm.account_holder.trim(),
                account_number: rateCardForm.account_number.trim(),
                ifsc: rateCardForm.ifsc.trim(),
                bank_name: rateCardForm.bank_name.trim(),
                upi_id: rateCardForm.upi_id.trim(),
            },
            components: {
                incentives: {
                    logic: rateCardForm.incentive_logic.trim(),
                    amount_per_unit: Number(rateCardForm.incentive_amount_per_unit) || 0,
                },
                allowances: {
                    travel: Number(rateCardForm.allowance_travel) || 0,
                    phone: Number(rateCardForm.allowance_phone) || 0,
                },
            },
        };

        const hasExisting = Boolean(selectedRateCard);
        const response = await executeHRTool({
            tool_name: hasExisting ? 'update_salary_card' : 'create_salary_card',
            parameters: hasExisting
                ? {
                    staff_id: selectedEmployee.id,
                    new_components: card.components,
                    reason: 'Rate card update from HR panel',
                }
                : {
                    staff_id: selectedEmployee.id,
                    base_salary: card.base_salary,
                    bank_details: card.bank_details,
                    components: card.components,
                },
        });

        if (response?.success) {
            setNotice('Rate card saved successfully.');
            setShowRateCardForm(false);
            setRateCards((prev) => ({ ...prev, [selectedEmployee.id]: { ...card, staff_id: selectedEmployee.id } }));
        } else {
            setNotice(response?.error || 'Could not save rate card.');
        }
    };

    return (
        <div className="h-full bg-gray-50/50 overflow-auto">
            <header className="bg-white border-b border-gray-200 px-6 py-4">
                <h1 className="text-2xl font-semibold text-gray-900">HR Operations</h1>
                <p className="text-sm text-gray-500 mt-1">Employee list, onboarding, profile management, and rate card updates.</p>
            </header>

            <div className="p-6 space-y-6">
                <div className="bg-indigo-50 border border-indigo-100 text-indigo-800 rounded-lg px-4 py-3 text-sm">
                    {notice}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <section className="xl:col-span-1 bg-white border border-gray-200 rounded-xl p-5 space-y-4" data-testid="hr-employee-list-section">
                        <div className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-indigo-600" />
                            <h2 className="text-lg font-semibold text-gray-800">Employees</h2>
                        </div>

                        <div className="space-y-2 max-h-[34rem] overflow-auto">
                            {employees.length === 0 ? (
                                <div className="text-sm text-gray-500">No employees available.</div>
                            ) : employees.map((emp) => (
                                <button
                                    key={emp.id}
                                    type="button"
                                    onClick={() => selectEmployee(emp.id)}
                                    className={`w-full text-left border rounded-lg p-3 ${selectedStaffId === emp.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="font-semibold text-gray-900">{emp.name}</div>
                                        <div className="text-xs text-gray-500">{emp.id}</div>
                                    </div>
                                    <div className="text-sm text-gray-600 mt-1">{emp.designation}</div>
                                    <div className="text-xs text-gray-500 mt-1">{emp.contact?.primary}</div>
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="xl:col-span-2 space-y-6">
                        <div className="bg-white border border-gray-200 rounded-xl p-5" data-testid="hr-add-employee-section">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-lg font-semibold text-gray-800">Add New Employee</h2>
                                <button
                                    type="button"
                                    onClick={() => setShowAddForm(true)}
                                    className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add Employee
                                </button>
                            </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-xl p-5" data-testid="hr-edit-employee-section">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-lg font-semibold text-gray-800">Edit Employee Profile</h2>
                                <button
                                    type="button"
                                    onClick={() => setShowEditForm(true)}
                                    disabled={!selectedEmployee}
                                    className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                                >
                                    <Pencil className="w-4 h-4" />
                                    Edit Employee
                                </button>
                            </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-xl p-5" data-testid="hr-rate-card-section">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-lg font-semibold text-gray-800">Rate Card</h2>
                                <button
                                    type="button"
                                    onClick={() => setShowRateCardForm(true)}
                                    disabled={!selectedEmployee}
                                    className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                                >
                                    <Pencil className="w-4 h-4" />
                                    Edit Rate Card
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            {showAddForm && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-3xl rounded-xl border border-gray-200 shadow-xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Add New Employee</h3>
                            <button type="button" aria-label="Close Add Employee Modal" onClick={() => setShowAddForm(false)}><X className="w-5 h-5 text-gray-500" /></button>
                        </div>
                        <form onSubmit={handleAddEmployee} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input value={hireForm.name} onChange={(event) => setHireForm((prev) => ({ ...prev, name: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" placeholder="Employee name" />
                            <input value={hireForm.designation} onChange={(event) => setHireForm((prev) => ({ ...prev, designation: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" placeholder="Designation" />
                            <input value={hireForm.contact_primary} onChange={(event) => setHireForm((prev) => ({ ...prev, contact_primary: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" placeholder="Primary contact" />
                            <input value={hireForm.contact_email} onChange={(event) => setHireForm((prev) => ({ ...prev, contact_email: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" placeholder="Email" />
                            <input value={hireForm.job_description} onChange={(event) => setHireForm((prev) => ({ ...prev, job_description: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2 md:col-span-2" placeholder="Job description" />
                            <button type="submit" disabled={activeRequest === 'hire_staff'} className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-lg px-4 py-2 disabled:opacity-50">
                                <Save className="w-4 h-4" />
                                Save Employee
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {showEditForm && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-3xl rounded-xl border border-gray-200 shadow-xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Edit Employee Profile</h3>
                            <button type="button" aria-label="Close Edit Employee Modal" onClick={() => setShowEditForm(false)}><X className="w-5 h-5 text-gray-500" /></button>
                        </div>
                        <form onSubmit={handleUpdateEmployee} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input value={profileForm.name} onChange={(event) => setProfileForm((prev) => ({ ...prev, name: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" placeholder="Employee name" />
                            <input value={profileForm.designation} onChange={(event) => setProfileForm((prev) => ({ ...prev, designation: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" placeholder="Designation" />
                            <input value={profileForm.contact_primary} onChange={(event) => setProfileForm((prev) => ({ ...prev, contact_primary: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" placeholder="Primary contact" />
                            <input value={profileForm.contact_email} onChange={(event) => setProfileForm((prev) => ({ ...prev, contact_email: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" placeholder="Email" />
                            <input value={profileForm.job_description} onChange={(event) => setProfileForm((prev) => ({ ...prev, job_description: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2 md:col-span-2" placeholder="Job description" />
                            <button type="submit" disabled={activeRequest === 'update_staff_profile'} className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-lg px-4 py-2 disabled:opacity-50">
                                <Save className="w-4 h-4" />
                                Save Profile
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {showRateCardForm && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-auto">
                    <div className="bg-white w-full max-w-3xl rounded-xl border border-gray-200 shadow-xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Edit Rate Card</h3>
                            <button type="button" aria-label="Close Rate Card Modal" onClick={() => setShowRateCardForm(false)}><X className="w-5 h-5 text-gray-500" /></button>
                        </div>
                        <form onSubmit={handleSaveRateCard} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input value={rateCardForm.base_salary} onChange={(event) => setRateCardForm((prev) => ({ ...prev, base_salary: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" placeholder="Base salary" type="number" />
                            <input value={rateCardForm.account_holder} onChange={(event) => setRateCardForm((prev) => ({ ...prev, account_holder: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" placeholder="Account holder" />
                            <input value={rateCardForm.account_number} onChange={(event) => setRateCardForm((prev) => ({ ...prev, account_number: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" placeholder="Account number" />
                            <input value={rateCardForm.ifsc} onChange={(event) => setRateCardForm((prev) => ({ ...prev, ifsc: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" placeholder="IFSC" />
                            <input value={rateCardForm.bank_name} onChange={(event) => setRateCardForm((prev) => ({ ...prev, bank_name: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" placeholder="Bank name" />
                            <input value={rateCardForm.upi_id} onChange={(event) => setRateCardForm((prev) => ({ ...prev, upi_id: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" placeholder="UPI ID" />
                            <input value={rateCardForm.incentive_logic} onChange={(event) => setRateCardForm((prev) => ({ ...prev, incentive_logic: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2 md:col-span-2" placeholder="Incentive logic" />
                            <input value={rateCardForm.incentive_amount_per_unit} onChange={(event) => setRateCardForm((prev) => ({ ...prev, incentive_amount_per_unit: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" placeholder="Incentive amount per unit" type="number" />
                            <input value={rateCardForm.allowance_travel} onChange={(event) => setRateCardForm((prev) => ({ ...prev, allowance_travel: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" placeholder="Travel allowance" type="number" />
                            <input value={rateCardForm.allowance_phone} onChange={(event) => setRateCardForm((prev) => ({ ...prev, allowance_phone: event.target.value }))} className="border border-gray-200 rounded-lg px-3 py-2" placeholder="Phone allowance" type="number" />
                            <button type="submit" disabled={activeRequest === 'create_salary_card' || activeRequest === 'update_salary_card'} className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-lg px-4 py-2 disabled:opacity-50">
                                <Save className="w-4 h-4" />
                                Save Rate Card
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HRPage;
