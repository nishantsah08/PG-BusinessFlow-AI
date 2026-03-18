import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Mail, ShieldAlert, X } from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import DateInputField from '../components/common/DateInputField';
import { useTimeDisplay } from '../hooks/useTimeDisplay';

const blankHireForm = {
    name: '',
    designation: 'Caretaker',
    compensation_profile: 'caretaker',
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
    incentive_logic: '',
    incentive_amount_per_unit: '',
    allowance_travel: '',
    allowance_phone: '',
    daily_cleaning_proof_amount: '',
    weekly_parking_cleaning_amount: '',
    maintenance_complaint_deduction: '',
};

const blankBankDetailsForm = {
    account_holder: '',
    account_number: '',
    ifsc: '',
    bank_name: '',
    upi_id: '',
};

const DEMO_EMPLOYEES = [
    { id: 'STF-01', name: 'Ramesh Kumar', designation: 'Property Manager', job_description: 'Operations lead for property and maintenance', contact: { primary: '+919833334444', email: 'ramesh@pgflow.ai' }, status: 'ACTIVE' },
    { id: 'STF-02', name: 'Meera Joshi', designation: 'Sales Executive', job_description: 'Lead handling and customer onboarding', contact: { primary: '+919844445555', email: 'meera@pgflow.ai' }, status: 'ACTIVE' },
    { id: 'STF-03', name: 'Arun Singh', designation: 'Maintenance Supervisor', job_description: 'Maintenance scheduling and vendor coordination', contact: { primary: '+919855556666', email: 'arun@pgflow.ai' }, status: 'TERMINATED', last_working_day: '2026-03-11' },
];

const DEMO_RATE_CARDS = {
    'STF-01': { base_salary: 4000, bank_details: { account_holder: 'Ramesh Kumar', account_number: '00001123456', ifsc: 'HDFC0001234', bank_name: 'HDFC Bank', upi_id: 'ramesh@hdfcbank' }, components: { incentives: { logic: 'Units Occupied * Amount Per Unit', amount_per_unit: 350 }, allowances: { travel: 1000, phone: 500 } } },
    'STF-02': { base_salary: 3500, bank_details: { account_holder: 'Meera Joshi', account_number: '00002123456', ifsc: 'HDFC0001234', bank_name: 'HDFC Bank', upi_id: 'meera@hdfcbank' }, components: { incentives: { logic: 'Qualified Visits * Amount', amount_per_unit: 250 }, allowances: { travel: 1200, phone: 500 } } },
};

const OWNER_ID = 'OWNER-ACCOUNT';

const rosterTone = {
    owner: 'border-amber-200 bg-amber-50 text-amber-950',
    active: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    terminated: 'border-rose-200 bg-rose-50 text-rose-950',
};

const salaryTone = {
    OWNER: 'bg-amber-100 text-amber-800',
    READY: 'bg-emerald-100 text-emerald-800',
    MISSING: 'bg-orange-100 text-orange-800',
};

const formatCurrency = (value) => `INR ${Number(value || 0).toLocaleString('en-IN')}`;
const FALLBACK_COMPENSATION_CATALOG = {
    designation_options: [
        { value: 'Caretaker', label: 'Caretaker', default_profile_key: 'caretaker' },
    ],
    profile_options: [
        {
            key: 'caretaker',
            label: 'Caretaker Standard',
            summary: 'Fixed salary plus unit and proof-based caretaker rules.',
            template: {
                base_salary: 4000,
                components: {
                    incentives: {
                        logic: 'Fully paid occupied units * amount per unit',
                        amount_per_unit: 250,
                    },
                    allowances: {
                        travel: 0,
                        phone: 0,
                    },
                    caretaker_rules: {
                        daily_cleaning_proof_amount: 100,
                        weekly_parking_cleaning_amount: 100,
                        maintenance_complaint_deduction: 100,
                    },
                },
            },
        },
    ],
};

const normalizeCompensationCatalog = (catalog) => {
    const profileOptions = Array.isArray(catalog?.profile_options) && catalog.profile_options.length
        ? catalog.profile_options
        : FALLBACK_COMPENSATION_CATALOG.profile_options;
    const designationOptions = Array.isArray(catalog?.designation_options) && catalog.designation_options.length
        ? catalog.designation_options.map((option) => ({
            ...option,
            default_profile_key: option.default_profile_key || profileOptions[0]?.key || 'default',
        }))
        : FALLBACK_COMPENSATION_CATALOG.designation_options;

    return {
        designation_options: designationOptions,
        profile_options: profileOptions,
    };
};

const formatProfileKeyLabel = (value = '') => String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Unknown';

const getToolErrorMessage = (response, fallbackMessage) => {
    if (!response?.success) return response?.error || fallbackMessage;
    const payload = response?.data;
    if (!payload || typeof payload !== 'object') return null;
    if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
    if (typeof payload.status === 'string' && payload.status.toLowerCase().includes('invalid')) {
        return payload.message || payload.status;
    }
    return null;
};

const ModalFieldRow = ({ label, helper, children }) => (
    <div className="grid grid-cols-1 gap-3 border-b border-slate-100 py-4 md:grid-cols-[240px_minmax(0,1fr)] md:items-start">
        <div>
            <p className="text-sm font-medium text-slate-800">{label}</p>
            {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
        </div>
        <div className="min-w-0">
            {children}
        </div>
    </div>
);

const ModalShell = ({ maxWidthClassName, children }) => (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-slate-950/55 px-4 pb-6 pt-24">
        <div className="flex min-h-full items-start justify-center">
            <div className={`max-h-[calc(100dvh-6.5rem)] w-full overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl ${maxWidthClassName}`}>
                {children}
            </div>
        </div>
    </div>
);

const getCompensationMode = (card) => {
    if (!card) return 'MISSING';
    if (card?.meta?.auto_generated && !card?.meta?.manual_override) return 'AUTO';
    return 'MANUAL';
};

const buildOwnerRecord = (authContext, user) => {
    const owner = authContext?.owner || {};
    const role = owner.role || 'CEO';
    return {
        id: OWNER_ID,
        isOwner: true,
        status: 'ACTIVE',
        name: owner.name || user?.name || 'Workspace Owner',
        designation: role === 'CEO' ? 'CEO / Workspace Owner' : `${role} / Workspace Owner`,
        job_description: 'Owns the business account and remains visible in the people roster. Email is locked in HR.',
        contact: {
            primary: owner.phone || '',
            email: owner.email || user?.email || '',
        },
        salaryStatus: 'OWNER',
        last_working_day: '',
    };
};

const isActiveVisible = (person, statusFilter) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'TERMINATED') return !person.isOwner && person.status === 'TERMINATED';
    if (statusFilter === 'ACTIVE') return person.isOwner || person.status === 'ACTIVE';
    return person.isOwner;
};

const HRPage = () => {
    const { authContext, user } = useAuth();
    const { formatTime } = useTimeDisplay();

    const [employees, setEmployees] = useState([]);
    const [rateCards, setRateCards] = useState({});
    const [selectedPersonId, setSelectedPersonId] = useState(OWNER_ID);
    const [hireForm, setHireForm] = useState(blankHireForm);
    const [profileForm, setProfileForm] = useState(blankProfileForm);
    const [rateCardForm, setRateCardForm] = useState(blankRateCardForm);
    const [bankDetailsForm, setBankDetailsForm] = useState(blankBankDetailsForm);
    const [terminationForm, setTerminationForm] = useState({ reason: '', last_working_day: '' });
    const [showAddForm, setShowAddForm] = useState(false);
    const [showEditForm, setShowEditForm] = useState(false);
    const [showRateCardForm, setShowRateCardForm] = useState(false);
    const [showBankDetailsForm, setShowBankDetailsForm] = useState(false);
    const [showTerminateForm, setShowTerminateForm] = useState(false);
    const [activeRequest, setActiveRequest] = useState('');
    const [statusFilter, setStatusFilter] = useState('ACTIVE');
    const [search, setSearch] = useState('');
    const [notice, setNotice] = useState('');
    const [addFormError, setAddFormError] = useState('');
    const [compensationFormError, setCompensationFormError] = useState('');
    const [bankDetailsFormError, setBankDetailsFormError] = useState('');

    const hrPermissions = useMemo(
        () => authContext?.permissions?.admin_adapter?.HRAgent || [],
        [authContext?.permissions?.admin_adapter?.HRAgent]
    );

    const canExecute = useCallback((toolName) => hrPermissions.includes(toolName), [hrPermissions]);

    const ownerRecord = useMemo(() => buildOwnerRecord(authContext, user), [authContext, user]);
    const compensationCatalog = useMemo(
        () => normalizeCompensationCatalog(authContext?.hr_compensation_catalog),
        [authContext?.hr_compensation_catalog]
    );
    const compensationProfilesByKey = useMemo(
        () => compensationCatalog.profile_options.reduce((acc, profile) => {
            acc[profile.key] = profile;
            return acc;
        }, {}),
        [compensationCatalog.profile_options]
    );
    const people = useMemo(() => {
        const sortedEmployees = [...employees].sort((a, b) => {
            if (a.status === b.status) return a.name.localeCompare(b.name);
            if (a.status === 'ACTIVE') return -1;
            return 1;
        });
        return [ownerRecord, ...sortedEmployees];
    }, [employees, ownerRecord]);

    const selectedPerson = useMemo(
        () => people.find((person) => person.id === selectedPersonId) || ownerRecord,
        [ownerRecord, people, selectedPersonId]
    );

    const selectedEmployee = selectedPerson?.isOwner ? null : selectedPerson;
    const selectedRateCard = selectedEmployee ? rateCards[selectedEmployee.id] || null : null;
    const selectedCompensationMode = getCompensationMode(selectedRateCard);
    const selectedCompensationProfileLabel = useMemo(() => {
        const profileKey = selectedRateCard?.meta?.compensation_profile_key || selectedRateCard?.meta?.designation_template_key || '';
        if (!profileKey) return 'Not configured';
        return compensationProfilesByKey[profileKey]?.label || formatProfileKeyLabel(profileKey);
    }, [compensationProfilesByKey, selectedRateCard]);
    const hireProfile = hireForm.compensation_profile ? compensationProfilesByKey[hireForm.compensation_profile] || null : null;

    const filteredPeople = useMemo(() => {
        const query = search.trim().toLowerCase();
        return people.filter((person) => {
            if (!isActiveVisible(person, statusFilter)) return false;
            if (!query) return true;
            return [
                person.name,
                person.designation,
                person.contact?.primary || '',
                person.contact?.email || '',
                person.id,
            ].some((value) => String(value).toLowerCase().includes(query));
        });
    }, [people, search, statusFilter]);
    const formatDisplayDate = (value) => formatTime(value)?.date || String(value || '');

    const executeHRTool = useCallback(async ({ tool_name, parameters }) => {
        if (!canExecute(tool_name)) {
            return { success: false, error: `Role ${authContext?.profile_type || 'unknown'} is not permitted for ${tool_name}.` };
        }

        setActiveRequest(tool_name);
        try {
            return await apiClient.post('/api/master_ai/tools/execute', {
                agent_name: 'HRAgent',
                tool_name,
                parameters,
            });
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
            setBankDetailsForm(blankBankDetailsForm);
            return;
        }

        setRateCardForm({
            base_salary: String(card.base_salary || ''),
            incentive_logic: card.components?.incentives?.logic || '',
            incentive_amount_per_unit: String(card.components?.incentives?.amount_per_unit || ''),
            allowance_travel: String(card.components?.allowances?.travel || ''),
            allowance_phone: String(card.components?.allowances?.phone || ''),
            daily_cleaning_proof_amount: String(card.components?.caretaker_rules?.daily_cleaning_proof_amount || ''),
            weekly_parking_cleaning_amount: String(card.components?.caretaker_rules?.weekly_parking_cleaning_amount || ''),
            maintenance_complaint_deduction: String(card.components?.caretaker_rules?.maintenance_complaint_deduction || ''),
        });
        setBankDetailsForm({
            account_holder: card.bank_details?.account_holder || '',
            account_number: card.bank_details?.account_number || '',
            ifsc: card.bank_details?.ifsc || '',
            bank_name: card.bank_details?.bank_name || '',
            upi_id: card.bank_details?.upi_id || '',
        });
    }, []);

    const loadRateCard = useCallback(async (staffId) => {
        if (!staffId || !canExecute('get_salary_card')) return null;
        const response = await executeHRTool({
            tool_name: 'get_salary_card',
            parameters: { staff_id: staffId },
        });
        if (!response?.success || !response?.data || response.data.error) return null;
        return response.data;
    }, [canExecute, executeHRTool]);

    const loadEmployees = useCallback(async (preferredId = selectedPersonId) => {
        if (!canExecute('get_all_staff')) {
            setEmployees([]);
            setSelectedPersonId(OWNER_ID);
            setNotice('');
            return;
        }

        const response = await executeHRTool({
            tool_name: 'get_all_staff',
            parameters: {},
        });

        const rows = Array.isArray(response?.data) ? response.data : [];
        const usingFallback = !response?.success;
        const nextEmployees = usingFallback ? DEMO_EMPLOYEES : rows;

        setEmployees(nextEmployees);
        if (usingFallback) {
            setRateCards(DEMO_RATE_CARDS);
            setNotice('Showing fallback employee data.');
        } else {
            if (canExecute('get_salary_card')) {
                const cardResults = await Promise.all(nextEmployees.map(async (employee) => {
                    const card = await loadRateCard(employee.id);
                    return [employee.id, card];
                }));
                setRateCards(cardResults.reduce((acc, [staffId, card]) => {
                    if (card) acc[staffId] = card;
                    return acc;
                }, {}));
            } else {
                setRateCards({});
            }
            setNotice('');
        }

        const preferredExists = preferredId !== OWNER_ID && nextEmployees.some((employee) => employee.id === preferredId);
        setSelectedPersonId(preferredExists ? preferredId : OWNER_ID);
    }, [canExecute, executeHRTool, loadRateCard, selectedPersonId]);

    useEffect(() => {
        if (!hrPermissions.length) return;
        loadEmployees();
    }, [hrPermissions.length, loadEmployees]);

    useEffect(() => {
        const hydrate = async () => {
            if (!selectedEmployee?.id) return;
            const card = rateCards[selectedEmployee.id] || await loadRateCard(selectedEmployee.id);
            if (card && !rateCards[selectedEmployee.id]) {
                setRateCards((prev) => ({ ...prev, [selectedEmployee.id]: card }));
            }
            applyEmployeeToForms(selectedEmployee, card || null);
        };
        hydrate();
    }, [applyEmployeeToForms, loadRateCard, rateCards, selectedEmployee]);

    const openAddEmployeeForm = useCallback(() => {
        setHireForm(blankHireForm);
        setAddFormError('');
        setShowAddForm(true);
    }, []);

    const handleAddEmployee = async (event) => {
        event.preventDefault();
        if (!hireForm.name.trim() || !hireForm.contact_primary.trim()) {
            setAddFormError('Name and primary contact are required for caretaker hire.');
            return;
        }
        setAddFormError('');

        const response = await executeHRTool({
            tool_name: 'hire_staff',
            parameters: {
                name: hireForm.name.trim(),
                designation: hireForm.designation.trim(),
                compensation_profile: hireForm.compensation_profile.trim(),
                job_description: hireForm.job_description.trim() || undefined,
                contact: {
                    primary: hireForm.contact_primary.trim(),
                    email: hireForm.contact_email.trim() || undefined,
                },
            },
        });

        const toolError = getToolErrorMessage(response, 'Could not create employee.');
        if (toolError) {
            setAddFormError(toolError);
            return;
        }

        setShowAddForm(false);
        setHireForm(blankHireForm);
        setAddFormError('');
        setStatusFilter('ACTIVE');
        setSearch('');
        await loadEmployees(response?.data?.staff_id || selectedPersonId);
        setNotice(`Employee added. Compensation applied from ${hireProfile?.label || 'Caretaker Standard'}.`);
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

        const toolError = getToolErrorMessage(response, 'Could not update employee profile.');
        if (toolError) {
            setNotice(toolError);
            return;
        }

        setShowEditForm(false);
        await loadEmployees(selectedEmployee.id);
        setNotice('Employee profile updated.');
    };

    const handleSaveRateCard = async (event) => {
        event.preventDefault();
        if (!selectedEmployee) return;
        setCompensationFormError('');

        const baseSalary = Number(rateCardForm.base_salary);
        if (!selectedRateCard && (!Number.isFinite(baseSalary) || baseSalary <= 0)) {
            setCompensationFormError('Base salary must be a valid positive number.');
            return;
        }

        const card = {
            base_salary: Number.isFinite(baseSalary) ? baseSalary : (selectedRateCard?.base_salary || 0),
            components: {
                incentives: {
                    logic: rateCardForm.incentive_logic.trim(),
                    amount_per_unit: Number(rateCardForm.incentive_amount_per_unit) || 0,
                },
                allowances: {
                    travel: Number(rateCardForm.allowance_travel) || 0,
                    phone: Number(rateCardForm.allowance_phone) || 0,
                },
                caretaker_rules: {
                    daily_cleaning_proof_amount: Number(rateCardForm.daily_cleaning_proof_amount) || 0,
                    weekly_parking_cleaning_amount: Number(rateCardForm.weekly_parking_cleaning_amount) || 0,
                    maintenance_complaint_deduction: Number(rateCardForm.maintenance_complaint_deduction) || 0,
                },
            },
        };

        const response = await executeHRTool({
            tool_name: selectedRateCard ? 'update_salary_card' : 'create_salary_card',
            parameters: selectedRateCard
                ? {
                    staff_id: selectedEmployee.id,
                    new_base_salary: Number(rateCardForm.base_salary) || 0,
                    new_bank_details: {
                        account_holder: bankDetailsForm.account_holder.trim(),
                        account_number: bankDetailsForm.account_number.trim(),
                        ifsc: bankDetailsForm.ifsc.trim(),
                        bank_name: bankDetailsForm.bank_name.trim(),
                        upi_id: bankDetailsForm.upi_id.trim(),
                    },
                    new_components: card.components,
                    reason: 'Reviewed from HR panel',
                }
                : {
                    staff_id: selectedEmployee.id,
                    base_salary: card.base_salary,
                    bank_details: selectedRateCard?.bank_details || {
                        account_holder: selectedEmployee.name,
                        account_number: '',
                        ifsc: '',
                        bank_name: '',
                        upi_id: '',
                    },
                    components: card.components,
                },
        });

        const toolError = getToolErrorMessage(response, 'Could not save compensation.');
        if (toolError) {
            setCompensationFormError(toolError);
            return;
        }

        setRateCards((prev) => ({
            ...prev,
            [selectedEmployee.id]: {
                ...card,
                staff_id: selectedEmployee.id,
                bank_details: selectedRateCard?.bank_details || {
                    account_holder: selectedEmployee.name,
                    account_number: '',
                    ifsc: '',
                    bank_name: '',
                    upi_id: '',
                },
                meta: selectedRateCard
                    ? {
                        ...(selectedRateCard.meta || {}),
                        auto_generated: false,
                        manual_override: true,
                    }
                    : {
                        auto_generated: false,
                        manual_override: true,
                    },
            }
        }));
        setShowRateCardForm(false);
        setCompensationFormError('');
        setNotice('Compensation saved.');
    };

    const handleSaveBankDetails = async (event) => {
        event.preventDefault();
        if (!selectedEmployee) return;
        setBankDetailsFormError('');

        const response = await executeHRTool({
            tool_name: selectedRateCard ? 'update_salary_card' : 'create_salary_card',
            parameters: selectedRateCard
                ? {
                    staff_id: selectedEmployee.id,
                    new_base_salary: Number(selectedRateCard.base_salary) || 0,
                    new_bank_details: {
                        account_holder: bankDetailsForm.account_holder.trim(),
                        account_number: bankDetailsForm.account_number.trim(),
                        ifsc: bankDetailsForm.ifsc.trim(),
                        bank_name: bankDetailsForm.bank_name.trim(),
                        upi_id: bankDetailsForm.upi_id.trim(),
                    },
                    new_components: selectedRateCard.components || {},
                    reason: 'Bank details updated from HR panel',
                }
                : {
                    staff_id: selectedEmployee.id,
                    base_salary: Number(rateCardForm.base_salary) || 0,
                    bank_details: {
                        account_holder: bankDetailsForm.account_holder.trim(),
                        account_number: bankDetailsForm.account_number.trim(),
                        ifsc: bankDetailsForm.ifsc.trim(),
                        bank_name: bankDetailsForm.bank_name.trim(),
                        upi_id: bankDetailsForm.upi_id.trim(),
                    },
                    components: selectedRateCard?.components || {},
                },
        });

        const toolError = getToolErrorMessage(response, 'Could not save bank details.');
        if (toolError) {
            setBankDetailsFormError(toolError);
            return;
        }

        setRateCards((prev) => ({
            ...prev,
            [selectedEmployee.id]: {
                ...(prev[selectedEmployee.id] || selectedRateCard || {}),
                staff_id: selectedEmployee.id,
                base_salary: Number(selectedRateCard?.base_salary) || Number(rateCardForm.base_salary) || 0,
                components: selectedRateCard?.components || {},
                bank_details: {
                    account_holder: bankDetailsForm.account_holder.trim(),
                    account_number: bankDetailsForm.account_number.trim(),
                    ifsc: bankDetailsForm.ifsc.trim(),
                    bank_name: bankDetailsForm.bank_name.trim(),
                    upi_id: bankDetailsForm.upi_id.trim(),
                },
                meta: selectedRateCard?.meta || {
                    auto_generated: false,
                    manual_override: true,
                },
            }
        }));
        setShowBankDetailsForm(false);
        setBankDetailsFormError('');
        setNotice('Bank details saved.');
    };

    const handleTerminateEmployee = async (event) => {
        event.preventDefault();
        if (!selectedEmployee) return;
        if (!terminationForm.reason.trim()) {
            setNotice('Termination reason is required.');
            return;
        }

        const response = await executeHRTool({
            tool_name: 'terminate_staff',
            parameters: {
                staff_id: selectedEmployee.id,
                reason: terminationForm.reason.trim(),
                last_working_day: terminationForm.last_working_day || undefined,
            },
        });

        const toolError = getToolErrorMessage(response, 'Could not terminate employee.');
        if (toolError) {
            setNotice(toolError);
            return;
        }

        setShowTerminateForm(false);
        setTerminationForm({ reason: '', last_working_day: '' });
        await loadEmployees(OWNER_ID);
        setNotice('Employee terminated.');
    };

    const selectedTone = selectedPerson?.isOwner
        ? rosterTone.owner
        : selectedPerson?.status === 'TERMINATED'
            ? rosterTone.terminated
            : rosterTone.active;

    const selectedSalaryBadge = selectedPerson?.isOwner ? 'OWNER' : (selectedRateCard ? 'READY' : 'MISSING');
    const compensationFieldClassName = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900';

    return (
        <section className="h-full overflow-y-auto bg-slate-100 text-slate-900">
            <div className="w-full px-6 py-8 pb-16">
                <header className="mb-6 flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white px-8 py-6 shadow-sm lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">HR Operations</p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight">People and compensation</h1>
                        {notice ? <p className="mt-2 text-sm text-slate-600">{notice}</p> : null}
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={openAddEmployeeForm}
                            disabled={!canExecute('hire_staff')}
                            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-emerald-300"
                        >
                            Add Employee
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 items-stretch gap-6 xl:min-h-[calc(100vh-220px)] xl:grid-cols-[minmax(360px,430px)_minmax(0,1fr)]">
                    <section className="h-full rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm" data-testid="hr-people-roster">
                        <div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">People</p>
                                <h2 className="mt-2 text-2xl font-semibold">Account owner and employees</h2>
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_140px]">
                                <input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                                    placeholder="Search people"
                                />
                                <select
                                    value={statusFilter}
                                    onChange={(event) => setStatusFilter(event.target.value)}
                                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 outline-none"
                                >
                                    <option value="ACTIVE">Current</option>
                                    <option value="ALL">All</option>
                                    <option value="TERMINATED">Terminated</option>
                                </select>
                            </div>
                        </div>

                        <div className="mt-5 space-y-3">
                            {filteredPeople.map((person) => {
                                const tone = person.isOwner ? rosterTone.owner : person.status === 'TERMINATED' ? rosterTone.terminated : rosterTone.active;
                                const badgeKey = person.isOwner ? 'OWNER' : rateCards[person.id] ? 'READY' : 'MISSING';
                                return (
                                    <button
                                        key={person.id}
                                        type="button"
                                        onClick={() => setSelectedPersonId(person.id)}
                                        className={`w-full rounded-2xl border p-4 text-left transition ${selectedPersonId === person.id ? 'ring-2 ring-slate-900/10' : ''} ${tone}`}
                                    >
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                            <div>
                                                <h3 className="text-lg font-semibold">{person.name}</h3>
                                                <p className="text-sm text-slate-600">{person.designation}</p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {person.isOwner ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-amber-800">
                                                        <ShieldAlert className="h-3.5 w-3.5" />
                                                        Owner
                                                    </span>
                                                ) : (
                                                    <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${person.status === 'TERMINATED' ? rosterTone.terminated : rosterTone.active}`}>
                                                        {person.status}
                                                    </span>
                                                )}
                                                <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${salaryTone[badgeKey]}`}>
                                                    {badgeKey === 'OWNER' ? 'Email Locked' : badgeKey === 'READY' ? 'Compensation Ready' : 'Compensation Pending'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mt-3 flex flex-wrap gap-5 text-sm text-slate-600">
                                            <span>{person.id}</span>
                                            {person.contact?.primary ? <span>{person.contact.primary}</span> : null}
                                            {person.contact?.email ? <span>{person.contact.email}</span> : null}
                                            {person.last_working_day ? <span>Last working day: {formatDisplayDate(person.last_working_day)}</span> : null}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <main className="h-full space-y-6">
                        <section className={`flex h-full flex-col rounded-[28px] border bg-white p-6 shadow-sm ${selectedTone}`} data-testid="hr-person-detail">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        {selectedPerson.isOwner ? 'Account Owner Detail' : 'Employee Detail'}
                                    </p>
                                    <h2 className="mt-2 text-2xl font-semibold">{selectedPerson.name}</h2>
                                    <p className="mt-1 text-sm text-slate-600">{selectedPerson.designation}</p>
                                </div>

                                <div className="flex flex-wrap gap-3">
                                    {selectedEmployee ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => setShowEditForm(true)}
                                                disabled={!canExecute('update_staff_profile')}
                                                className="rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Edit Profile
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setShowRateCardForm(true)}
                                                disabled={!canExecute(selectedRateCard ? 'update_salary_card' : 'create_salary_card')}
                                                className="rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {selectedCompensationMode === 'AUTO' ? 'Review Compensation' : selectedRateCard ? 'Edit Compensation' : 'Set Compensation'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setShowBankDetailsForm(true)}
                                                disabled={!canExecute(selectedRateCard ? 'update_salary_card' : 'create_salary_card')}
                                                className="rounded-xl border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Bank Details
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setShowTerminateForm(true)}
                                                disabled={!canExecute('terminate_staff') || selectedEmployee.status === 'TERMINATED'}
                                                className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Terminate
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <span className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
                                                <Mail className="h-4 w-4" />
                                                Email Locked
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                                <div className="rounded-2xl bg-slate-50 p-5">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Profile</p>
                                    <div className="mt-4 space-y-3 text-sm">
                                        <div>
                                            <p className="text-slate-500">Phone</p>
                                            <p className="font-medium text-slate-900">{selectedPerson.contact?.primary || 'Not set'}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500">Email</p>
                                            <p className="font-medium text-slate-900">{selectedPerson.contact?.email || 'Not set'}</p>
                                            {selectedPerson.isOwner ? <p className="mt-1 text-xs font-medium text-amber-800">Owner email is visible but cannot be edited in HR.</p> : null}
                                        </div>
                                        <div>
                                            <p className="text-slate-500">Role Summary</p>
                                            <p className="font-medium text-slate-900">{selectedPerson.job_description || 'No description available.'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl bg-slate-50 p-5">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                        {selectedPerson.isOwner ? 'Owner Controls' : 'Compensation'}
                                    </p>
                                    <div className="mt-4 space-y-3 text-sm">
                                        {selectedEmployee ? (
                                            <>
                                                <div>
                                                    <p className="text-slate-500">Compensation Status</p>
                                                    <p className="font-medium text-slate-900">{selectedSalaryBadge === 'READY' ? (selectedCompensationMode === 'AUTO' ? 'Auto-configured from profile' : 'Configured') : 'Pending setup'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-500">Compensation Source</p>
                                                    <p className="font-medium text-slate-900">
                                                        {selectedCompensationMode === 'AUTO'
                                                            ? selectedCompensationProfileLabel
                                                            : selectedCompensationMode === 'MANUAL'
                                                                ? 'Reviewed override'
                                                                : 'Not configured'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-500">Base Salary</p>
                                                    <p className="font-medium text-slate-900">
                                                        {selectedRateCard ? formatCurrency(selectedRateCard.base_salary) : 'Pending setup'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-500">Incentive Logic</p>
                                                    <p className="font-medium text-slate-900">
                                                        {selectedRateCard?.components?.incentives?.logic || 'Pending setup'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-500">Allowances</p>
                                                    <p className="font-medium text-slate-900">
                                                        {selectedRateCard
                                                            ? `Travel ${selectedRateCard.components?.allowances?.travel || 0} • Phone ${selectedRateCard.components?.allowances?.phone || 0}`
                                                            : 'Pending setup'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-500">Caretaker Rules</p>
                                                    <p className="font-medium text-slate-900">
                                                        {selectedRateCard?.components?.caretaker_rules
                                                            ? `Daily cleaning ${selectedRateCard.components.caretaker_rules.daily_cleaning_proof_amount || 0} • Parking ${selectedRateCard.components.caretaker_rules.weekly_parking_cleaning_amount || 0} • Complaint deduction ${selectedRateCard.components.caretaker_rules.maintenance_complaint_deduction || 0}`
                                                            : 'Pending setup'}
                                                    </p>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div>
                                                    <p className="text-slate-500">Business</p>
                                                    <p className="font-medium text-slate-900">{authContext?.business_name || 'Workspace'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-500">Email Policy</p>
                                                    <p className="font-medium text-slate-900">Not editable from HR</p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-500">Status</p>
                                                    <p className="font-medium text-slate-900">Visible in roster, outside employee lifecycle</p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>
                    </main>
                </div>
            </div>

            {showAddForm ? (
                <ModalShell maxWidthClassName="max-w-3xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-xl font-semibold">Add Employee</h3>
                            <button type="button" onClick={() => { setShowAddForm(false); setAddFormError(''); }} aria-label="Close add employee form"><X className="h-5 w-5 text-slate-500" /></button>
                        </div>
                        <form onSubmit={handleAddEmployee} className="space-y-1">
                            {addFormError ? (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                                    {addFormError}
                                </div>
                            ) : null}
                            <ModalFieldRow label="Employee Name" helper="Full name used in HR, CRM, and payroll.">
                                <input value={hireForm.name} onChange={(event) => setHireForm((prev) => ({ ...prev, name: event.target.value }))} className={compensationFieldClassName} placeholder="Employee name" />
                            </ModalFieldRow>
                            <ModalFieldRow label="Template Employee" helper="Caretaker is the active hire template right now.">
                                <div className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900">Caretaker</div>
                            </ModalFieldRow>
                            <ModalFieldRow label="Primary Phone" helper="Main HR and WhatsApp contact in E.164 or a valid Indian number.">
                                <input value={hireForm.contact_primary} onChange={(event) => setHireForm((prev) => ({ ...prev, contact_primary: event.target.value }))} className={compensationFieldClassName} placeholder="Primary phone" />
                            </ModalFieldRow>
                            <ModalFieldRow label="Email" helper="Used for CRM and account communication when available.">
                                <input value={hireForm.contact_email} onChange={(event) => setHireForm((prev) => ({ ...prev, contact_email: event.target.value }))} className={compensationFieldClassName} placeholder="Email" />
                            </ModalFieldRow>
                            <ModalFieldRow label="Job Description" helper="Short role summary for internal operations.">
                                <textarea value={hireForm.job_description} onChange={(event) => setHireForm((prev) => ({ ...prev, job_description: event.target.value }))} className="min-h-28 w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900" placeholder="Job description" />
                            </ModalFieldRow>
                            <ModalFieldRow label="Compensation Preview" helper="The internal salary card is generated from this caretaker template.">
                                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-800">
                                    {hireProfile ? (
                                        <div className="space-y-2">
                                            <p className="font-semibold text-slate-900">{hireProfile.label}</p>
                                            <p>{hireProfile.summary}</p>
                                            <p>Base salary: <span className="font-medium text-slate-900">{formatCurrency(hireProfile.template?.base_salary || 0)}</span></p>
                                            <p>Per-unit payout: <span className="font-medium text-slate-900">{formatCurrency(hireProfile.template?.components?.incentives?.amount_per_unit || 0)}</span></p>
                                            <p>Daily cleaning payout: <span className="font-medium text-slate-900">{formatCurrency(hireProfile.template?.components?.caretaker_rules?.daily_cleaning_proof_amount || 0)}</span></p>
                                            <p>Weekly parking payout: <span className="font-medium text-slate-900">{formatCurrency(hireProfile.template?.components?.caretaker_rules?.weekly_parking_cleaning_amount || 0)}</span></p>
                                            <p>Complaint deduction: <span className="font-medium text-slate-900">{formatCurrency(hireProfile.template?.components?.caretaker_rules?.maintenance_complaint_deduction || 0)}</span></p>
                                        </div>
                                    ) : (
                                        <p className="text-slate-600">Caretaker compensation is ready and will be applied on hire.</p>
                                    )}
                                </div>
                            </ModalFieldRow>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => { setShowAddForm(false); setAddFormError(''); }} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">Cancel</button>
                                <button type="submit" disabled={activeRequest === 'hire_staff'} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save Employee</button>
                            </div>
                        </form>
                </ModalShell>
            ) : null}

            {showEditForm && selectedEmployee ? (
                <ModalShell maxWidthClassName="max-w-3xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-xl font-semibold">Edit Employee Profile</h3>
                            <button type="button" onClick={() => setShowEditForm(false)} aria-label="Close edit employee form"><X className="h-5 w-5 text-slate-500" /></button>
                        </div>
                        <form onSubmit={handleUpdateEmployee} className="space-y-1">
                            <ModalFieldRow label="Employee Name" helper="Full name used in HR, CRM, and payroll.">
                                <input value={profileForm.name} onChange={(event) => setProfileForm((prev) => ({ ...prev, name: event.target.value }))} className={compensationFieldClassName} placeholder="Employee name" />
                            </ModalFieldRow>
                            <ModalFieldRow label="Role / Designation" helper="Current operating role in the business.">
                                <input value={profileForm.designation} onChange={(event) => setProfileForm((prev) => ({ ...prev, designation: event.target.value }))} className={compensationFieldClassName} placeholder="Designation" />
                            </ModalFieldRow>
                            <ModalFieldRow label="Primary Phone" helper="Main HR and WhatsApp contact.">
                                <input value={profileForm.contact_primary} onChange={(event) => setProfileForm((prev) => ({ ...prev, contact_primary: event.target.value }))} className={compensationFieldClassName} placeholder="Primary phone" />
                            </ModalFieldRow>
                            <ModalFieldRow label="Email" helper="Used for CRM and account communication.">
                                <input value={profileForm.contact_email} onChange={(event) => setProfileForm((prev) => ({ ...prev, contact_email: event.target.value }))} className={compensationFieldClassName} placeholder="Email" />
                            </ModalFieldRow>
                            <ModalFieldRow label="Job Description" helper="Short role summary for internal use.">
                                <textarea value={profileForm.job_description} onChange={(event) => setProfileForm((prev) => ({ ...prev, job_description: event.target.value }))} className="min-h-28 w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900" placeholder="Job description" />
                            </ModalFieldRow>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setShowEditForm(false)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">Cancel</button>
                                <button type="submit" disabled={activeRequest === 'update_staff_profile'} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save Profile</button>
                            </div>
                        </form>
                </ModalShell>
            ) : null}

            {showRateCardForm && selectedEmployee ? (
                <ModalShell maxWidthClassName="max-w-4xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-xl font-semibold">{selectedCompensationMode === 'AUTO' ? 'Review Compensation' : selectedRateCard ? 'Edit Compensation' : 'Set Compensation'}</h3>
                            <button type="button" onClick={() => { setShowRateCardForm(false); setCompensationFormError(''); }} aria-label="Close salary card form"><X className="h-5 w-5 text-slate-500" /></button>
                        </div>
                        <form onSubmit={handleSaveRateCard} className="space-y-1">
                            {compensationFormError ? (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                                    {compensationFormError}
                                </div>
                            ) : null}
                            <ModalFieldRow label="Compensation Formula" helper="Locked from the caretaker template.">
                                <div className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900">
                                    <p className="font-medium">Fully paid occupied units x per-unit payout</p>
                                    <p className="mt-1 text-xs text-slate-500">Paid only on fully paid occupied units.</p>
                                </div>
                            </ModalFieldRow>
                            <ModalFieldRow label="Base Salary" helper="Fixed monthly salary.">
                                <input value={rateCardForm.base_salary} onChange={(event) => setRateCardForm((prev) => ({ ...prev, base_salary: event.target.value }))} className={compensationFieldClassName} placeholder="Base salary" type="number" />
                            </ModalFieldRow>
                            <ModalFieldRow label="Per-Unit Payout" helper="Amount paid for each fully paid occupied unit.">
                                <input value={rateCardForm.incentive_amount_per_unit} onChange={(event) => setRateCardForm((prev) => ({ ...prev, incentive_amount_per_unit: event.target.value }))} className={compensationFieldClassName} placeholder="Per-unit payout" type="number" />
                            </ModalFieldRow>
                            <ModalFieldRow label="Daily Cleaning Payout" helper="Paid when daily cleaning proof is submitted.">
                                <input value={rateCardForm.daily_cleaning_proof_amount} onChange={(event) => setRateCardForm((prev) => ({ ...prev, daily_cleaning_proof_amount: event.target.value }))} className={compensationFieldClassName} placeholder="Daily cleaning payout" type="number" />
                            </ModalFieldRow>
                            <ModalFieldRow label="Weekly Parking Payout" helper="Paid when weekly parking cleaning is completed.">
                                <input value={rateCardForm.weekly_parking_cleaning_amount} onChange={(event) => setRateCardForm((prev) => ({ ...prev, weekly_parking_cleaning_amount: event.target.value }))} className={compensationFieldClassName} placeholder="Weekly parking payout" type="number" />
                            </ModalFieldRow>
                            <ModalFieldRow label="Complaint Deduction" helper="Deducted for each valid maintenance complaint.">
                                <input value={rateCardForm.maintenance_complaint_deduction} onChange={(event) => setRateCardForm((prev) => ({ ...prev, maintenance_complaint_deduction: event.target.value }))} className={compensationFieldClassName} placeholder="Complaint deduction" type="number" />
                            </ModalFieldRow>
                            <ModalFieldRow label="Travel Allowance" helper="Fixed travel support amount.">
                                <input value={rateCardForm.allowance_travel} onChange={(event) => setRateCardForm((prev) => ({ ...prev, allowance_travel: event.target.value }))} className={compensationFieldClassName} placeholder="Travel allowance" type="number" />
                            </ModalFieldRow>
                            <ModalFieldRow label="Phone Allowance" helper="Fixed phone support amount.">
                                <input value={rateCardForm.allowance_phone} onChange={(event) => setRateCardForm((prev) => ({ ...prev, allowance_phone: event.target.value }))} className={compensationFieldClassName} placeholder="Phone allowance" type="number" />
                            </ModalFieldRow>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => { setShowRateCardForm(false); setCompensationFormError(''); }} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">Cancel</button>
                                <button type="submit" disabled={activeRequest === 'create_salary_card' || activeRequest === 'update_salary_card'} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save Compensation</button>
                            </div>
                        </form>
                </ModalShell>
            ) : null}

            {showBankDetailsForm && selectedEmployee ? (
                <ModalShell maxWidthClassName="max-w-3xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-xl font-semibold">Bank Details</h3>
                            <button type="button" onClick={() => { setShowBankDetailsForm(false); setBankDetailsFormError(''); }} aria-label="Close bank details form"><X className="h-5 w-5 text-slate-500" /></button>
                        </div>
                        <form onSubmit={handleSaveBankDetails} className="space-y-1">
                            {bankDetailsFormError ? (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                                    {bankDetailsFormError}
                                </div>
                            ) : null}
                            <ModalFieldRow label="Account Holder" helper="Name on the receiving salary account.">
                                <input value={bankDetailsForm.account_holder} onChange={(event) => setBankDetailsForm((prev) => ({ ...prev, account_holder: event.target.value }))} className={compensationFieldClassName} placeholder="Account holder" />
                            </ModalFieldRow>
                            <ModalFieldRow label="Account Number" helper="Salary payout account number.">
                                <input value={bankDetailsForm.account_number} onChange={(event) => setBankDetailsForm((prev) => ({ ...prev, account_number: event.target.value }))} className={compensationFieldClassName} placeholder="Account number" />
                            </ModalFieldRow>
                            <ModalFieldRow label="IFSC" helper="Branch code used for bank transfer.">
                                <input value={bankDetailsForm.ifsc} onChange={(event) => setBankDetailsForm((prev) => ({ ...prev, ifsc: event.target.value }))} className={compensationFieldClassName} placeholder="IFSC" />
                            </ModalFieldRow>
                            <ModalFieldRow label="Bank Name" helper="Receiving bank name.">
                                <input value={bankDetailsForm.bank_name} onChange={(event) => setBankDetailsForm((prev) => ({ ...prev, bank_name: event.target.value }))} className={compensationFieldClassName} placeholder="Bank name" />
                            </ModalFieldRow>
                            <ModalFieldRow label="UPI ID" helper="Optional payout fallback or reimbursement destination.">
                                <input value={bankDetailsForm.upi_id} onChange={(event) => setBankDetailsForm((prev) => ({ ...prev, upi_id: event.target.value }))} className={compensationFieldClassName} placeholder="UPI ID" />
                            </ModalFieldRow>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => { setShowBankDetailsForm(false); setBankDetailsFormError(''); }} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">Cancel</button>
                                <button type="submit" disabled={activeRequest === 'create_salary_card' || activeRequest === 'update_salary_card'} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save Bank Details</button>
                            </div>
                        </form>
                </ModalShell>
            ) : null}

            {showTerminateForm && selectedEmployee ? (
                <ModalShell maxWidthClassName="max-w-2xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-xl font-semibold text-rose-900">Terminate Employee</h3>
                            <button type="button" onClick={() => setShowTerminateForm(false)} aria-label="Close terminate form"><X className="h-5 w-5 text-slate-500" /></button>
                        </div>
                        <form onSubmit={handleTerminateEmployee} className="space-y-1">
                            <ModalFieldRow label="Last Working Day" helper="Final active working date for the employee.">
                                <DateInputField
                                    ariaLabel="Last Working Day"
                                    value={terminationForm.last_working_day}
                                    onValueChange={(nextValue) => setTerminationForm((prev) => ({ ...prev, last_working_day: nextValue }))}
                                    className={compensationFieldClassName}
                                />
                            </ModalFieldRow>
                            <ModalFieldRow label="Termination Reason" helper="Required for HR record and final settlement context.">
                                <textarea value={terminationForm.reason} onChange={(event) => setTerminationForm((prev) => ({ ...prev, reason: event.target.value }))} className="min-h-32 w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900" placeholder="Reason for termination" />
                            </ModalFieldRow>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setShowTerminateForm(false)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">Cancel</button>
                                <button type="submit" disabled={activeRequest === 'terminate_staff'} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Confirm Termination</button>
                            </div>
                        </form>
                </ModalShell>
            ) : null}
        </section>
    );
};

export default HRPage;
