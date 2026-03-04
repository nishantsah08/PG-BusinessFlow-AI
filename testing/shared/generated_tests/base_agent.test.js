const BaseAgent = require('../../../server/src/agents/BaseAgent');

describe('BaseAgent Tests (Layer 1)', () => {
    class TestAgent extends BaseAgent {
        constructor() {
            super({ name: 'TestAgent' });
        }
    }

    let agent;

    beforeEach(() => {
        agent = new TestAgent();
        agent.registerTool('echo', 'Echoes input', {}, async (args) => args);
        agent.registerTool('fail', 'Always fails', {}, async () => { throw new Error('Boom'); });
    });

    test('EventEmitter: Can emit and listen to custom events', (done) => {
        agent.on('custom.event', (data) => {
            expect(data).toBe('hello');
            done();
        });
        agent.emit('custom.event', 'hello');
    });

    test('Tool Execution: Emits tool_start and tool_end events', async () => {
        const startSpy = jest.fn();
        const endSpy = jest.fn();

        agent.on('tool_start', startSpy);
        agent.on('tool_end', endSpy);

        await agent.callTool('echo', { msg: 'hi' });

        expect(startSpy).toHaveBeenCalledWith(expect.objectContaining({
            agent: 'TestAgent',
            tool: 'echo',
            args: { msg: 'hi' }
        }));

        expect(endSpy).toHaveBeenCalledWith(expect.objectContaining({
            agent: 'TestAgent',
            tool: 'echo',
            result: { msg: 'hi' }
        }));
    });

    test('Tool Execution: Emits tool_error on failure', async () => {
        const errorSpy = jest.fn();
        agent.on('tool_error', errorSpy);

        await expect(agent.callTool('fail', {})).rejects.toThrow('Boom');

        expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({
            agent: 'TestAgent',
            tool: 'fail',
            error: expect.any(Error)
        }));
    });
});
