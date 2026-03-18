import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import WorkflowList from './WorkflowList';
import { renderWithSettings } from '../../test/renderWithSettings';

const MOCK_WORKFLOWS = [
    {
        workflow_id: 'onboard_tenant',
        trigger_event: 'tenant.new',
        steps: [{ step_id: 's1' }, { step_id: 's2' }],
        created_at: '2026-02-20T10:00:00+05:30'
    },
    {
        workflow_id: 'payment_ack',
        trigger_event: 'payment.received',
        steps: [{ step_id: 's1' }],
        created_at: '2026-02-21T09:00:00+05:30'
    }
];

describe('WorkflowList Component', () => {

    it('renders all workflow cards with expected fields', () => {
        const onSelect = jest.fn();
        const onDelete = jest.fn();
        const onCreateNew = jest.fn();

        renderWithSettings(
            <WorkflowList
                workflows={MOCK_WORKFLOWS}
                selectedId={null}
                onSelect={onSelect}
                onDelete={onDelete}
                onCreateNew={onCreateNew}
            />
        );

        expect(screen.getByText('onboard_tenant')).toBeInTheDocument();
        expect(screen.getByText('tenant.new')).toBeInTheDocument();
        expect(screen.getByText('2 steps')).toBeInTheDocument();

        expect(screen.getByText('payment_ack')).toBeInTheDocument();
        expect(screen.getByText('payment.received')).toBeInTheDocument();
        expect(screen.getByText('1 step')).toBeInTheDocument();
    });

    it('shows empty state when no workflows provided', () => {
        renderWithSettings(
            <WorkflowList
                workflows={[]}
                selectedId={null}
                onSelect={jest.fn()}
                onDelete={jest.fn()}
                onCreateNew={jest.fn()}
            />
        );

        expect(screen.getByText('No workflows defined yet.')).toBeInTheDocument();
    });

    it('calls onSelect when a workflow card is clicked', () => {
        const onSelect = jest.fn();
        renderWithSettings(
            <WorkflowList
                workflows={MOCK_WORKFLOWS}
                selectedId={null}
                onSelect={onSelect}
                onDelete={jest.fn()}
                onCreateNew={jest.fn()}
            />
        );

        fireEvent.click(screen.getByText('onboard_tenant'));
        expect(onSelect).toHaveBeenCalledWith(MOCK_WORKFLOWS[0]);
    });

    it('calls onCreateNew when New Workflow button is clicked', () => {
        const onCreateNew = jest.fn();
        renderWithSettings(
            <WorkflowList
                workflows={MOCK_WORKFLOWS}
                selectedId={null}
                onSelect={jest.fn()}
                onDelete={jest.fn()}
                onCreateNew={onCreateNew}
            />
        );

        fireEvent.click(screen.getByText('New Workflow'));
        expect(onCreateNew).toHaveBeenCalledTimes(1);
    });

    it('shows the workflow count badge', () => {
        renderWithSettings(
            <WorkflowList
                workflows={MOCK_WORKFLOWS}
                selectedId={null}
                onSelect={jest.fn()}
                onDelete={jest.fn()}
                onCreateNew={jest.fn()}
            />
        );

        expect(screen.getByText('2')).toBeInTheDocument();
    });
});
