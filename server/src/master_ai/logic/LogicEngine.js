const fs = require('fs');
const path = require('path');

class LogicEngine {
    constructor(eventBus, sessionService) {
        this.eventBus = eventBus;
        this.sessionService = sessionService;
        this.workflows = {};
        this.activeWorkflows = {};
        this.workflowFile = path.join(__dirname, '../data/workflows.json');

        // Phase 2: Idempotency
        this.processedEventIds = new Map(); // eventId -> instanceId

        // Phase 2: Resource Locking
        this.locks = {};

        // Phase 2: Sessions
        this.sessions = {};

        // Phase 2: Scheduled Events
        this.scheduledEvents = [];

        // Phase 2: Clock override support (for testing)
        this._timeOverride = null;

        this.loadWorkflows();
    }

    // --- Clock abstraction (overridden by TestHarness) ---
    _now() {
        return this._timeOverride !== null ? this._timeOverride : Date.now();
    }

    loadWorkflows() {
        if (fs.existsSync(this.workflowFile)) {
            try {
                this.workflows = JSON.parse(fs.readFileSync(this.workflowFile, 'utf8'));
                console.log('Workflows loaded from disk.');
            } catch (error) {
                console.error('Failed to load workflows:', error);
                this.workflows = {};
            }
        } else {
            const dir = path.dirname(this.workflowFile);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(this.workflowFile, JSON.stringify({}, null, 2));
            this.workflows = {};
        }
    }

    saveWorkflows() {
        fs.writeFileSync(this.workflowFile, JSON.stringify(this.workflows, null, 2));
    }

    // --- Workflow Management ---

    defineWorkflow(id, triggerEvent, steps, validationRules, options = {}) {
        this.workflows[id] = {
            id,
            triggerEvent,
            steps,
            validationRules,
            version: 1,
            createdAt: new Date(this._now()).toISOString(),
            // Phase 2: optional deadline (absolute ms), stepTimeout (ms per step)
            deadline: options.deadline || null,
            stepTimeout: options.stepTimeout || null
        };
        this.saveWorkflows();
        console.log(`Workflow defined: ${id}`);
        return true;
    }

    updateWorkflow(id, newSteps) {
        if (!this.workflows[id]) throw new Error(`Workflow ${id} not found`);
        this.workflows[id].steps = newSteps;
        this.workflows[id].version++;
        this.workflows[id].updatedAt = new Date(this._now()).toISOString();
        this.saveWorkflows();
        console.log(`Workflow updated: ${id}`);
        return true;
    }

    // --- Phase 2: Idempotent Event Processing ---

    processEvent(eventId, workflowId, context) {
        if (this.processedEventIds.has(eventId)) {
            const originalInstanceId = this.processedEventIds.get(eventId);
            console.log(`[Idempotency] Duplicate event ${eventId} — already processed as ${originalInstanceId}`);
            return { duplicate: true, originalWorkflowId: originalInstanceId };
        }
        const instanceId = this.executeWorkflow(workflowId, context);
        // Store mapping synchronously (executeWorkflow returns a promise but the ID is generated inside)
        // We store it after the call starts
        instanceId.then(id => {
            this.processedEventIds.set(eventId, id);
        });
        return { duplicate: false, instanceIdPromise: instanceId };
    }

    // --- Workflow Execution ---

    async executeWorkflow(workflowId, context) {
        const workflow = this.workflows[workflowId];
        if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

        const instanceId = `WF-${this._now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.activeWorkflows[instanceId] = {
            instanceId,
            workflowId,
            status: 'RUNNING',
            stepIndex: 0,
            context: { ...context },
            history: [],
            startedAt: this._now(),
            // Phase 2: track acquired locks for cleanup
            acquiredLocks: []
        };

        console.log(`Starting workflow instance: ${instanceId}`);
        this.runWorkflowLoop(instanceId);
        return instanceId;
    }

    async runWorkflowLoop(instanceId) {
        const instance = this.activeWorkflows[instanceId];
        if (!instance || instance.status !== 'RUNNING') return;

        const workflow = this.workflows[instance.workflowId];

        // Phase 2: Deadline check
        if (workflow.deadline && this._now() > workflow.deadline) {
            instance.status = 'FAILED';
            instance.error = 'DEADLINE_EXPIRED';
            console.log(`Workflow ${instanceId} failed: DEADLINE_EXPIRED`);
            this._releaseWorkflowLocks(instance);
            return;
        }

        const currentStep = workflow.steps[instance.stepIndex];

        if (!currentStep) {
            instance.status = 'COMPLETED';
            console.log(`Workflow ${instanceId} completed successfully.`);
            this._releaseWorkflowLocks(instance);
            return;
        }

        // Phase 2: Resource locking
        if (currentStep.locks) {
            for (const resourceId of currentStep.locks) {
                if (!this.acquireLock(resourceId, instanceId)) {
                    instance.status = 'FAILED';
                    instance.error = `LOCK_CONFLICT: ${resourceId}`;
                    console.log(`Workflow ${instanceId} failed: cannot acquire lock on ${resourceId}`);
                    this._releaseWorkflowLocks(instance);
                    return;
                }
                instance.acquiredLocks.push(resourceId);
            }
        }

        try {
            console.log(`Executing step ${instance.stepIndex}: ${currentStep.name || 'Unnamed Step'}`);

            // Phase 2: Step timeout enforcement
            if (workflow.stepTimeout) {
                const result = await this._executeWithTimeout(currentStep, instance.context, workflow.stepTimeout);
                if (result && result.__timeout) {
                    throw new Error('STEP_TIMEOUT');
                }
            } else {
                await this.executeStep(currentStep, instance.context);
            }

            instance.history.push({
                step: currentStep,
                status: 'SUCCESS',
                timestamp: new Date(this._now())
            });
            instance.stepIndex++;

            setImmediate(() => this.runWorkflowLoop(instanceId));

        } catch (error) {
            console.error(`Workflow ${instanceId} failed at step ${instance.stepIndex}:`, error);
            instance.error = error.message;

            // Phase 2: Compensation logic
            if (this._hasCompensation(workflow, instance)) {
                await this._runCompensation(instanceId);
            } else {
                instance.status = 'FAILED';
                this._releaseWorkflowLocks(instance);
            }
        }
    }

    async _executeWithTimeout(step, context, timeoutMs) {
        return new Promise(async (resolve, reject) => {
            let timedOut = false;
            const timer = setTimeout(() => {
                timedOut = true;
                reject(new Error('STEP_TIMEOUT'));
            }, timeoutMs);

            try {
                const result = await this.executeStep(step, context);
                clearTimeout(timer);
                if (!timedOut) resolve(result);
            } catch (err) {
                clearTimeout(timer);
                if (!timedOut) reject(err);
            }
        });
    }

    async executeStep(step, context) {
        return new Promise(resolve => setTimeout(resolve, 100));
    }

    // --- Phase 2: Compensation ---

    _hasCompensation(workflow, instance) {
        // Check if any completed step has a compensation action
        return instance.history.some(h => h.step.compensation);
    }

    async _runCompensation(instanceId) {
        const instance = this.activeWorkflows[instanceId];
        instance.status = 'ROLLING_BACK';
        instance.compensationHistory = [];

        console.log(`[Compensation] Starting rollback for ${instanceId}`);

        // Execute compensation steps in REVERSE order
        const stepsToCompensate = [...instance.history].reverse();

        for (const entry of stepsToCompensate) {
            if (!entry.step.compensation) continue;

            const compStep = entry.step.compensation;
            try {
                console.log(`[Compensation] Undoing: ${entry.step.name} via ${compStep.tool}`);
                await this.executeStep(compStep, instance.context);
                instance.compensationHistory.push({
                    originalStep: entry.step.name,
                    compensationStep: compStep,
                    status: 'UNDONE',
                    timestamp: new Date(this._now())
                });
            } catch (compError) {
                console.error(`[Compensation] FAILED to undo ${entry.step.name}:`, compError);
                instance.compensationHistory.push({
                    originalStep: entry.step.name,
                    compensationStep: compStep,
                    status: 'UNDO_FAILED',
                    error: compError.message,
                    timestamp: new Date(this._now())
                });
                instance.status = 'COMPENSATION_FAILED';
                instance.error = `Compensation failed at: ${entry.step.name}`;
                this._releaseWorkflowLocks(instance);

                // Escalate to human
                if (this.eventBus) {
                    this.eventBus.publish('system.escalation', {
                        workflowId: instanceId,
                        reason: 'COMPENSATION_FAILED',
                        failedStep: entry.step.name
                    });
                }
                return;
            }
        }

        instance.status = 'ROLLED_BACK';
        console.log(`[Compensation] Workflow ${instanceId} fully rolled back.`);
        this._releaseWorkflowLocks(instance);
    }

    // --- Phase 2: Resource Locking ---

    acquireLock(resourceId, ownerId) {
        if (this.locks[resourceId] && this.locks[resourceId] !== ownerId) {
            console.log(`[Lock] DENIED: ${resourceId} held by ${this.locks[resourceId]}, requested by ${ownerId}`);
            return false;
        }
        this.locks[resourceId] = ownerId;
        console.log(`[Lock] ACQUIRED: ${resourceId} by ${ownerId}`);
        return true;
    }

    releaseLock(resourceId) {
        const owner = this.locks[resourceId];
        delete this.locks[resourceId];
        console.log(`[Lock] RELEASED: ${resourceId} (was: ${owner})`);
    }

    _releaseWorkflowLocks(instance) {
        if (instance.acquiredLocks) {
            for (const lockId of instance.acquiredLocks) {
                this.releaseLock(lockId);
            }
            instance.acquiredLocks = [];
        }
    }

    // --- Phase 2: Session Management ---

    createSession(sessionId, ttlMs) {
        this.sessions[sessionId] = {
            id: sessionId,
            createdAt: this._now(),
            ttlMs,
            expiresAt: this._now() + ttlMs,
            status: 'ACTIVE'
        };
        console.log(`[Session] Created: ${sessionId} (TTL: ${ttlMs}ms)`);
        return this.sessions[sessionId];
    }

    checkSessionExpiry(sessionId) {
        const session = this.sessions[sessionId];
        if (!session) return null;
        if (session.status === 'EXPIRED') return session;

        if (this._now() >= session.expiresAt) {
            session.status = 'EXPIRED';
            console.log(`[Session] EXPIRED: ${sessionId}`);
        }
        return session;
    }

    // --- Phase 2: Scheduled Events ---

    scheduleEvent(topic, payload, triggerAtMs) {
        const scheduled = {
            id: `SCHED-${this._now()}-${Math.random().toString(36).substr(2, 5)}`,
            topic,
            payload,
            triggerAt: triggerAtMs,
            fired: false
        };
        this.scheduledEvents.push(scheduled);
        console.log(`[Scheduler] Registered: ${topic} at ${triggerAtMs}`);
        return scheduled;
    }

    checkScheduledEvents() {
        const now = this._now();
        const fired = [];
        for (const evt of this.scheduledEvents) {
            if (!evt.fired && now >= evt.triggerAt) {
                evt.fired = true;
                console.log(`[Scheduler] Firing: ${evt.topic}`);
                this.eventBus.publish(evt.topic, evt.payload);
                fired.push(evt);
            }
        }
        return fired;
    }

    // --- Admin / Control Tools ---

    listActiveWorkflows(filter) {
        return Object.values(this.activeWorkflows).filter(wf =>
            !filter || wf.status === filter
        );
    }

    getWorkflowDetails(instanceId) {
        return this.activeWorkflows[instanceId] || null;
    }

    pauseWorkflow(instanceId) {
        if (this.activeWorkflows[instanceId]) {
            this.activeWorkflows[instanceId].status = 'PAUSED';
            console.log(`Workflow ${instanceId} PAUSED.`);
            return true;
        }
        return false;
    }

    resumeWorkflow(instanceId) {
        if (this.activeWorkflows[instanceId] && this.activeWorkflows[instanceId].status === 'PAUSED') {
            this.activeWorkflows[instanceId].status = 'RUNNING';
            console.log(`Workflow ${instanceId} RESUMED.`);
            this.runWorkflowLoop(instanceId);
            return true;
        }
        return false;
    }

    cancelWorkflow(instanceId, reason) {
        if (this.activeWorkflows[instanceId]) {
            this.activeWorkflows[instanceId].status = 'CANCELLED';
            this.activeWorkflows[instanceId].cancellationReason = reason;
            console.log(`Workflow ${instanceId} CANCELLED. Reason: ${reason}`);
            return true;
        }
        return false;
    }

    retryWorkflowStep(instanceId, stepId) {
        const instance = this.activeWorkflows[instanceId];
        if (instance && instance.status === 'FAILED') {
            instance.status = 'RUNNING';
            instance.error = null;
            console.log(`Workflow ${instanceId} RETRYING step.`);
            this.runWorkflowLoop(instanceId);
            return true;
        }
        return false;
    }
}

module.exports = LogicEngine;
