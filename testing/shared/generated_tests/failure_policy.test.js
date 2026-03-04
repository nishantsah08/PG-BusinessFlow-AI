
const BaseAgent = require('../../../server/src/agents/BaseAgent');

// Mock Timer Logic
jest.useFakeTimers();

describe('System Failure Policy (v1.2) - Enforcement Tests', () => {
    let agent;

    beforeEach(() => {
        agent = new BaseAgent({ name: 'TestAgent' });
    });

    afterEach(() => {
        jest.clearAllTimers();
    });

    test('PROTOCOL 2.1: Synchronous Control Plane - Fail Fast (Timeout > 60s)', async () => {
        // Define a slow tool that takes 61 seconds
        agent.registerTool('slow_tool', 'A tool that hangs', {}, async () => {
            return new Promise(resolve => setTimeout(resolve, 61000));
        });

        // Execute tool
        const toolPromise = agent.callTool('slow_tool', {});

        // Fast-forward time by 60,001ms
        jest.advanceTimersByTime(60001);

        // Expect failure
        await expect(toolPromise).rejects.toThrow('Tool execution timed out after 60000ms');
    });

    test('PROTOCOL 2.1: Synchronous Control Plane - Success (Time < 60s)', async () => {
        // Define a fast tool that takes 1 second
        agent.registerTool('fast_tool', 'A tool that works', {}, async () => {
            return new Promise(resolve => setTimeout(() => resolve('Success'), 1000));
        });

        // Execute tool
        const toolPromise = agent.callTool('fast_tool', {});

        // Fast-forward time by 1000ms
        jest.advanceTimersByTime(1000);

        // Expect success
        await expect(toolPromise).resolves.toBe('Success');
    });
});
