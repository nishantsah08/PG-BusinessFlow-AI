const MasterAI = require('../../../server/src/agents/MasterAI');
const PropertyAI = require('../../../server/src/agents/PropertyAI');
const BusinessConfig = require('../../../server/src/config/business');

describe('MasterAI property image attachment flow', () => {
    test('persists attached image URLs when model omits image_urls in add_property tool args', async () => {
        process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';

        const propertyAI = new PropertyAI();
        const masterAI = new MasterAI([propertyAI]);

        masterAI.openai = {
            chat: {
                completions: {
                    create: jest
                        .fn()
                        .mockResolvedValueOnce({
                            choices: [{
                                message: {
                                    role: 'assistant',
                                    content: null,
                                    tool_calls: [{
                                        id: 'tool-1',
                                        type: 'function',
                                        function: {
                                            name: 'PropertyAI_add_property',
                                            arguments: JSON.stringify({
                                                name: 'Best PG',
                                                address: 'Dighi Hills, Pune 411015'
                                            })
                                        }
                                    }]
                                }
                            }]
                        })
                        .mockResolvedValueOnce({
                            choices: [{
                                message: {
                                    role: 'assistant',
                                    content: 'Done'
                                }
                            }]
                        })
                }
            }
        };

        const history = [{
            role: 'user',
            content: 'create property name "Best PG"\n\n[Attached 2 image(s) — use these as image_urls: /images/a.jpg, /images/b.jpg]'
        }];

        await masterAI.chat(history, { email: BusinessConfig.persona.ceo_email });

        const properties = await propertyAI.callTool('get_properties', {});
        expect(properties).toHaveLength(1);
        expect(properties[0].name).toBe('Best PG');
        expect(properties[0].image_urls).toEqual(['/images/a.jpg', '/images/b.jpg']);
    });
});
