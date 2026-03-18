const Module = require('module');

const originalLoad = Module._load;

class MockOpenAI {
    constructor() {
        this.chat = {
            completions: {
                create: async () => ({
                    choices: [
                        {
                            message: {
                                role: 'assistant',
                                content: 'Mock portal chat HTTP response.',
                                tool_calls: []
                            }
                        }
                    ]
                })
            }
        };
    }
}

Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'openai') return MockOpenAI;
    return originalLoad.call(this, request, parent, isMain);
};
