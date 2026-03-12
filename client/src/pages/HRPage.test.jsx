import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import HRPage from './HRPage';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';

jest.mock('../api/client', () => ({
    __esModule: true,
    default: {
        post: jest.fn(),
    },
}));

jest.mock('../context/AuthContext', () => ({
    useAuth: jest.fn(),
}));

const mockEmployees = [
    {
        id: 'STF-01',
        name: 'Ramesh Kumar',
        designation: 'Property Manager',
        job_description: 'Operations lead',
        contact: { primary: '+919833334444', email: 'ramesh@company.com' },
        status: 'ACTIVE',
    },
    {
        id: 'STF-02',
        name: 'Arun Singh',
        designation: 'Maintenance Supervisor',
        job_description: 'Field maintenance',
        contact: { primary: '+919855556666', email: 'arun@company.com' },
        status: 'TERMINATED',
        last_working_day: '2026-03-11',
    },
];

const salaryCard = {
    base_salary: 4000,
    meta: {
        auto_generated: true,
        manual_override: false,
        compensation_profile_key: 'caretaker',
    },
    bank_details: {
        account_holder: 'Ramesh Kumar',
        account_number: '00001123456',
        ifsc: 'HDFC0001234',
        bank_name: 'HDFC Bank',
        upi_id: 'ramesh@hdfcbank',
    },
    components: {
        incentives: { logic: 'Fully paid occupied units * amount per unit', amount_per_unit: 250 },
        allowances: { travel: 1000, phone: 500 },
        caretaker_rules: {
            daily_cleaning_proof_amount: 100,
            weekly_parking_cleaning_amount: 100,
            maintenance_complaint_deduction: 100,
        },
    },
};

describe('HRPage live layout', () => {
    beforeEach(() => {
        useAuth.mockReturnValue({
            user: { email: 'nishant@company.com', name: 'Nishant Sah' },
            authContext: {
                profile_type: 'CEO',
                business_name: 'Acme Workspace',
                owner: {
                    name: 'Nishant Sah',
                    email: 'nishant@company.com',
                    phone: '+917588498834',
                    role: 'CEO',
                },
                hr_compensation_catalog: {
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
                                    incentives: { logic: 'Fully paid occupied units * amount per unit', amount_per_unit: 250 },
                                    allowances: { travel: 0, phone: 0 },
                                    caretaker_rules: {
                                        daily_cleaning_proof_amount: 100,
                                        weekly_parking_cleaning_amount: 100,
                                        maintenance_complaint_deduction: 100,
                                    },
                                },
                            },
                        },
                    ],
                },
                permissions: {
                    admin_adapter: {
                        HRAgent: [
                            'get_all_staff',
                            'get_salary_card',
                            'hire_staff',
                            'update_staff_profile',
                            'create_salary_card',
                            'update_salary_card',
                            'terminate_staff',
                        ],
                    },
                },
            },
        });

        apiClient.post.mockImplementation(async (_url, body) => {
            if (body.tool_name === 'get_all_staff') {
                return { success: true, data: mockEmployees };
            }
            if (body.tool_name === 'get_salary_card') {
                return { success: true, data: salaryCard };
            }
            return { success: true, data: {} };
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('shows the owner in the shared roster and hides terminated employees by default', async () => {
        render(<HRPage />);

        await waitFor(() => expect(screen.getAllByText('Nishant Sah')).toHaveLength(2));
        expect(screen.getByTestId('hr-people-roster')).toHaveTextContent('Nishant Sah');
        expect(screen.getByTestId('hr-people-roster')).toHaveTextContent('Ramesh Kumar');
        expect(screen.getByTestId('hr-people-roster')).not.toHaveTextContent('Arun Singh');
    });

    it('loads employee detail and salary card when an active employee is selected', async () => {
        const user = userEvent.setup();
        render(<HRPage />);

        await user.click(await screen.findByRole('button', { name: /ramesh kumar/i }));

        await waitFor(() => {
            expect(screen.getByTestId('hr-person-detail')).toHaveTextContent('Ramesh Kumar');
            expect(screen.getByTestId('hr-person-detail')).toHaveTextContent('INR 4,000');
            expect(screen.getByTestId('hr-person-detail')).toHaveTextContent('Fully paid occupied units * amount per unit');
            expect(screen.getByRole('button', { name: 'Review Compensation' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Bank Details' })).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', { name: 'Review Compensation' }));
        expect(screen.getAllByText('Base Salary').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Compensation Formula').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Per-Unit Payout').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Complaint Deduction').length).toBeGreaterThan(0);
    });

    it('reveals terminated employees only after switching the filter', async () => {
        const user = userEvent.setup();
        render(<HRPage />);

        await user.selectOptions(await screen.findByRole('combobox'), 'TERMINATED');

        expect(screen.getByTestId('hr-people-roster')).toHaveTextContent('Arun Singh');
    });

    it('shows the caretaker template and compensation preview in the add form', async () => {
        const user = userEvent.setup();
        render(<HRPage />);

        await user.click(await screen.findByRole('button', { name: 'Add Employee' }));

        expect(screen.getByText('Template Employee')).toBeInTheDocument();
        expect(screen.getByText('Caretaker')).toBeInTheDocument();
        expect(screen.getAllByText('Caretaker Standard').length).toBeGreaterThan(0);
        expect(screen.getByText(/daily cleaning payout/i)).toBeInTheDocument();
        expect(screen.getByText(/per-unit payout/i)).toBeInTheDocument();
    });

    it('surfaces invalid hire input instead of pretending the employee was created', async () => {
        const user = userEvent.setup();
        apiClient.post.mockImplementation(async (_url, body) => {
            if (body.tool_name === 'get_all_staff') {
                return { success: true, data: mockEmployees };
            }
            if (body.tool_name === 'get_salary_card') {
                return { success: true, data: salaryCard };
            }
            if (body.tool_name === 'hire_staff') {
                return {
                    success: true,
                    data: {
                        status: 'Invalid Input',
                        message: 'Invalid phone number format provided in contacts',
                    },
                };
            }
            return { success: true, data: {} };
        });

        render(<HRPage />);

        await user.click(await screen.findByRole('button', { name: 'Add Employee' }));
        await user.type(screen.getByPlaceholderText('Employee name'), 'Bad Hire');
        await user.type(screen.getByPlaceholderText('Primary phone'), '5465');
        await user.click(screen.getByRole('button', { name: 'Save Employee' }));

        expect(await screen.findByText('Invalid phone number format provided in contacts')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Add Employee' })).toBeInTheDocument();
        expect(screen.getAllByText('Add Employee').length).toBeGreaterThan(0);
    });
});
