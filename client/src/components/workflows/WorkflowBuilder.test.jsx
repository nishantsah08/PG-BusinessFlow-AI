import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkflowBuilder from './WorkflowBuilder';

const MOCK_WORKFLOW = {
    workflow_id: 'onboard_tenant',
    name: 'Onboard Tenant',
    description: 'Handles the full tenant onboarding process after a visit.',
    trigger_description: 'When a new tenant contract is signed.',
    trigger_event: 'tenant.new',
    steps: [
        { step_id: 'verify', description: 'Verification step', agent: 'CRMAgent', tool: 'get_lead_by_phone', params: { phone: '123' }, on_failure: 'abort' }
    ]
};

describe('WorkflowBuilder Component', () => {

    it('renders empty form in create mode', () => {
        render(<WorkflowBuilder workflow={null} onSave={jest.fn()} onCancel={jest.fn()} />);

        expect(screen.getByText('Create New Workflow')).toBeInTheDocument();
        expect(screen.getByText('Create Workflow')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/When a new property enquiry/)).toBeInTheDocument();
    });

    it('pre-fills form in edit mode', () => {
        render(<WorkflowBuilder workflow={MOCK_WORKFLOW} onSave={jest.fn()} onCancel={jest.fn()} />);

        expect(screen.getByText('Onboard Tenant')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Handles the full tenant onboarding process after a visit.')).toBeInTheDocument();
        expect(screen.getByDisplayValue('When a new tenant contract is signed.')).toBeInTheDocument();
        expect(screen.getByText('Save Workflow')).toBeInTheDocument();
    });

    it('shows trigger description input field', () => {
        render(<WorkflowBuilder workflow={null} onSave={jest.fn()} onCancel={jest.fn()} />);

        expect(screen.getByPlaceholderText(/When a new property enquiry comes in\.\.\./)).toBeInTheDocument();
    });

    it('calls onCancel when Cancel button is clicked', () => {
        const onCancel = jest.fn();
        render(<WorkflowBuilder workflow={null} onSave={jest.fn()} onCancel={onCancel} />);

        fireEvent.click(screen.getByText('Cancel'));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('shows validation errors when submitting empty form', () => {
        const onSave = jest.fn();
        render(<WorkflowBuilder workflow={null} onSave={onSave} onCancel={jest.fn()} />);

        fireEvent.click(screen.getByText('Create Workflow'));
        expect(onSave).not.toHaveBeenCalled();
    });

    it('validates description is required', () => {
        const onSave = jest.fn();
        render(<WorkflowBuilder workflow={null} onSave={onSave} onCancel={jest.fn()} />);

        fireEvent.click(screen.getByText('Create Workflow'));
        expect(screen.getByText(/clear description is required/)).toBeInTheDocument();
        expect(onSave).not.toHaveBeenCalled();
    });

    it('does not emit validation_rules in onSave data', () => {
        const onSave = jest.fn();
        render(<WorkflowBuilder workflow={MOCK_WORKFLOW} onSave={onSave} onCancel={jest.fn()} />);

        fireEvent.click(screen.getByText('Save Workflow'));
        expect(onSave).toHaveBeenCalledTimes(1);
        const savedData = onSave.mock.calls[0][0];
        expect(savedData).not.toHaveProperty('validation_rules');
        expect(savedData).toHaveProperty('description');
        expect(savedData).toHaveProperty('trigger_description');
    });
});
