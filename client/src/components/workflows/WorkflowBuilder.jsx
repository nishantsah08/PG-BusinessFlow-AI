import React, { useState, useEffect } from 'react';
import { Save, X, Plus, Trash2, ChevronUp, ChevronDown, Code } from 'lucide-react';
import { useDeveloperMode } from '../../context/DeveloperModeContext';

/**
 * WorkflowBuilder Component
 * Form for creating or editing a workflow definition.
 *
 * Props:
 * - workflow: workflow object to edit (null = create mode)
 * - onSave: (workflowData) => void
 * - onCancel: () => void
 */

const EMPTY_STEP = { step_id: '', description: '', agent: '', tool: '', params: '{}', on_failure: 'retry' };

const FAILURE_OPTIONS = ['retry', 'compensate', 'abort'];

const WorkflowBuilder = ({ workflow, onSave, onCancel }) => {
    const { isDeveloperMode } = useDeveloperMode();
    const isEditMode = !!workflow;

    const [workflowId, setWorkflowId] = useState('');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [triggerEvent, setTriggerEvent] = useState('');
    const [triggerDescription, setTriggerDescription] = useState('');
    const [steps, setSteps] = useState([{ ...EMPTY_STEP }]);
    const [errors, setErrors] = useState({});

    const [showTriggerDevMode, setShowTriggerDevMode] = useState(false);
    const [openSteps, setOpenSteps] = useState({});
    const toggleStepDevMode = (idx) => {
        setOpenSteps(prev => ({ ...prev, [idx]: !prev[idx] }));
    };

    const formatName = (str) => {
        if (!str) return '';
        return str
            .replace(/_/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
    };

    useEffect(() => {
        if (workflow) {
            setWorkflowId(workflow.workflow_id || '');
            setName(workflow.name || '');
            setDescription(workflow.description || '');
            setTriggerEvent(workflow.trigger_event || '');
            setTriggerDescription(workflow.trigger_description || '');
            setSteps(
                (workflow.steps || []).map(s => ({
                    ...s,
                    params: typeof s.params === 'object' ? JSON.stringify(s.params, null, 2) : (s.params || '{}')
                }))
            );
            setShowTriggerDevMode(false);
        } else {
            setWorkflowId('');
            setName('');
            setDescription('');
            setTriggerEvent('');
            setTriggerDescription('');
            setSteps([{ ...EMPTY_STEP }]);
            setShowTriggerDevMode(false);
        }
        setErrors({});
    }, [workflow]);

    const validate = () => {
        const newErrors = {};
        if (!workflowId.trim()) newErrors.workflowId = 'Required';
        if (!description.trim()) newErrors.description = 'A clear description is required so MasterAI knows when to trigger this workflow.';
        if (!triggerEvent.trim()) newErrors.triggerEvent = 'Required';

        // Validate steps
        steps.forEach((step, i) => {
            if (!step.step_id.trim()) newErrors[`step_${i}_id`] = 'Required';
            if (!step.agent.trim()) newErrors[`step_${i}_agent`] = 'Required';
            if (!step.tool.trim()) newErrors[`step_${i}_tool`] = 'Required';
            try { JSON.parse(step.params); } catch { newErrors[`step_${i}_params`] = 'Invalid JSON'; }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!validate()) return;

        const data = {
            workflow_id: workflowId.trim(),
            name: name.trim(),
            description: description.trim(),
            trigger_event: triggerEvent.trim(),
            trigger_description: triggerDescription.trim(),
            steps: steps.map(s => ({
                step_id: s.step_id.trim(),
                description: s.description ? s.description.trim() : '',
                agent: s.agent.trim(),
                tool: s.tool.trim(),
                params: JSON.parse(s.params),
                on_failure: s.on_failure
            }))
        };
        onSave(data);
    };

    const updateStep = (index, field, value) => {
        setSteps(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
    };

    const addStep = () => {
        setSteps(prev => [...prev, { ...EMPTY_STEP }]);
    };

    const removeStep = (index) => {
        if (steps.length <= 1) return;
        setSteps(prev => prev.filter((_, i) => i !== index));
    };

    const moveStep = (index, direction) => {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= steps.length) return;
        setSteps(prev => {
            const arr = [...prev];
            [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
            return arr;
        });
    };

    const getNaturalSummary = (step) => {
        if (!step.agent && !step.tool) return "<span class=\"text-gray-400 italic\">New unconfigured step.</span>";

        let text = `Instruct `;
        text += step.agent ? `<strong class="font-medium text-indigo-700">${step.agent}</strong>` : 'an agent';
        text += ` to execute `;
        text += step.tool ? `<strong class="font-medium text-gray-800">${step.tool}</strong>` : 'a task';

        try {
            const p = typeof step.params === 'string' ? JSON.parse(step.params || '{}') : step.params;
            const keys = Object.keys(p);
            if (keys.length > 0) {
                const paramStrings = keys.map(k => `<span class="text-xs bg-gray-100 px-1 py-0.5 rounded text-gray-600 border">${k}: ${Array.isArray(p[k]) || typeof p[k] === 'object' ? JSON.stringify(p[k]) : p[k]}</span>`).join(' ');
                text += ` using parameters: <div class="mt-1.5 space-x-1.5">${paramStrings}</div>`;
            } else {
                text += ` with no additional parameters.`;
            }
        } catch {
            text += ` with parameters <span class="text-red-500 text-xs">(Invalid JSON)</span>.`;
        }

        if (step.on_failure && step.on_failure !== 'abort') {
            text += ` <div class="mt-1.5"><span class="text-amber-600 text-[11px] font-medium uppercase tracking-wide px-1.5 py-0.5 bg-amber-50 rounded">If fails: ${step.on_failure}</span></div>`;
        } else if (step.on_failure === 'abort') {
            text += ` <div class="mt-1.5"><span class="text-red-500 text-[11px] font-medium uppercase tracking-wide px-1.5 py-0.5 bg-red-50 rounded">If fails: Abort workflow</span></div>`;
        }

        return text;
    };

    return (
        <div className="flex flex-col h-full relative">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 shrink-0">
                <div className="flex items-center space-x-2">
                    <div className="flex flex-col">
                        <h2 className="text-xl font-bold text-gray-900">
                            {formatName(name || (isEditMode ? workflowId : 'Create New Workflow'))}
                        </h2>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={onCancel}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }} className="flex-1 overflow-y-auto">
                <fieldset className="p-4 space-y-5">

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                            Description
                        </label>
                        <p className="text-[11px] text-gray-400 mb-2">
                            Write a clear, isolated description of what this workflow does when triggered.
                        </p>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="e.g. Logs the lead in CRM and sends a confirmation message."
                            rows={3}
                            className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-colors resize-none
                            ${errors.description ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}
                        />
                        {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
                    </div>

                    {/* Trigger */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Trigger
                            </label>
                            {isDeveloperMode && (
                                <button type="button" onClick={() => setShowTriggerDevMode(!showTriggerDevMode)}
                                    className={`p-1 rounded transition-colors ${showTriggerDevMode ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400 hover:text-indigo-600'}`}
                                    title="Developer Details">
                                    <Code className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                        <p className="text-[11px] text-gray-400 mb-2">
                            Write a clear description in plain English of when and why this workflow should run. MasterAI uses this to decide whether to trigger this workflow.
                        </p>
                        <input
                            type="text"
                            value={triggerDescription}
                            onChange={(e) => setTriggerDescription(e.target.value)}
                            placeholder="e.g. When a new property enquiry comes in..."
                            className="w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-colors border-gray-200 bg-white"
                        />

                        {isDeveloperMode && showTriggerDevMode && (
                            <div className="p-4 border border-indigo-100 bg-indigo-50/50 rounded-xl relative mt-3 mb-2">
                                <span className="absolute -top-2.5 left-3 bg-white px-2 text-[10px] font-bold tracking-wider text-indigo-500 uppercase border border-indigo-100 rounded-full">Developer Details</span>
                                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                    System Event ID
                                </label>
                                <input
                                    type="text"
                                    value={triggerEvent}
                                    onChange={(e) => setTriggerEvent(e.target.value)}
                                    placeholder="e.g. property.enquiry.received"
                                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-colors
                                    ${errors.triggerEvent ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}
                                />
                                {errors.triggerEvent && <p className="text-xs text-red-500 mt-1">{errors.triggerEvent}</p>}
                            </div>
                        )}
                    </div>

                    {/* Steps */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Breakdown ({steps.length} Steps)
                            </label>
                        </div>

                        <div className="space-y-3">
                            {steps.map((step, idx) => (
                                <div key={idx} className="p-3 border border-gray-200 rounded-xl bg-gray-50/50 space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-indigo-600">Step {idx + 1}</span>
                                        <div className="flex items-center space-x-1">
                                            {isDeveloperMode && (
                                                <button type="button" onClick={() => toggleStepDevMode(idx)}
                                                    className={`p-1 rounded transition-colors ${openSteps[idx] ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400 hover:text-indigo-600'}`}
                                                    title="Developer Details">
                                                    <Code className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            <button type="button" onClick={() => moveStep(idx, -1)} disabled={idx === 0}
                                                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 rounded transition-colors">
                                                <ChevronUp className="w-3.5 h-3.5" />
                                            </button>
                                            <button type="button" onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1}
                                                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 rounded transition-colors">
                                                <ChevronDown className="w-3.5 h-3.5" />
                                            </button>
                                            <button type="button" onClick={() => removeStep(idx)} disabled={steps.length <= 1}
                                                className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30 rounded transition-colors">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-2 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                        <textarea
                                            value={step.description || ''}
                                            onChange={(e) => updateStep(idx, 'description', e.target.value)}
                                            placeholder="Write step description in plain English..."
                                            rows={2}
                                            className="w-full px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                                        />
                                    </div>

                                    {isDeveloperMode && openSteps[idx] && (
                                        <div className="mt-3 relative p-4 bg-gray-50/80 border border-gray-200 rounded-xl">
                                            <span className="absolute -top-2.5 left-3 bg-white px-2 text-[10px] font-bold tracking-wider text-gray-500 uppercase border border-gray-200 rounded-full">Developer Details</span>
                                            <div className="space-y-3">
                                                <div className="text-xs text-gray-600 bg-white px-3 py-2.5 rounded-lg border border-gray-200 shadow-sm" dangerouslySetInnerHTML={{ __html: getNaturalSummary(step) }} />

                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <input type="text" value={step.step_id} onChange={(e) => updateStep(idx, 'step_id', e.target.value)}
                                                            placeholder="Step ID" className={`w-full px-2.5 py-2 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300
                                                        ${errors[`step_${idx}_id`] ? 'border-red-300' : 'border-gray-200'}`} />
                                                    </div>
                                                    <div>
                                                        <input type="text" value={step.agent} onChange={(e) => updateStep(idx, 'agent', e.target.value)}
                                                            placeholder="Agent" className={`w-full px-2.5 py-2 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300
                                                        ${errors[`step_${idx}_agent`] ? 'border-red-300' : 'border-gray-200'}`} />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <input type="text" value={step.tool} onChange={(e) => updateStep(idx, 'tool', e.target.value)}
                                                            placeholder="Tool" className={`w-full px-2.5 py-2 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300
                                                        ${errors[`step_${idx}_tool`] ? 'border-red-300' : 'border-gray-200'}`} />
                                                    </div>
                                                    <div>
                                                        <select value={step.on_failure} onChange={(e) => updateStep(idx, 'on_failure', e.target.value)}
                                                            className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                                                            {FAILURE_OPTIONS.map(opt => (
                                                                <option key={opt} value={opt}>{opt}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>

                                                <div>
                                                    <textarea
                                                        value={step.params}
                                                        onChange={(e) => updateStep(idx, 'params', e.target.value)}
                                                        placeholder='{"key": "value"}'
                                                        rows={2}
                                                        className={`w-full px-2.5 py-2 border rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none
                                                        ${errors[`step_${idx}_params`] ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                                                    />
                                                    {errors[`step_${idx}_params`] && <p className="text-xs text-red-500 mt-0.5">{errors[`step_${idx}_params`]}</p>}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>


                </fieldset>
            </form>

            {/* Actions */}
            <div className="flex items-center space-x-3 p-4 border-t border-gray-200 shrink-0 bg-white">
                <button
                    type="button"
                    onClick={handleSubmit}
                    className="flex-1 flex items-center justify-center space-x-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
                >
                    <Save className="w-4 h-4" />
                    <span>{isEditMode ? 'Save Workflow' : 'Create Workflow'}</span>
                </button>
                <button
                    type="button"
                    onClick={() => { onCancel(); }}
                    className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default WorkflowBuilder;
