const MasterAI = require('../../../server/src/agents/MasterAI');

describe('MasterAI image attachment injection', () => {
    let master;

    beforeEach(() => {
        process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
        master = new MasterAI([]);
    });

    test('extracts image URLs from latest user attachment marker', () => {
        const history = [
            { role: 'user', content: 'hello' },
            {
                role: 'user',
                content: 'create property\n\n[Attached 2 image(s) — use these as image_urls: /images/a.jpg, /images/b.jpg]'
            }
        ];

        const urls = master._extractRecentAttachedImageUrls(history);
        expect(urls).toEqual(['/images/a.jpg', '/images/b.jpg']);
    });

    test('extracts image URLs from earlier user message when last user message is only confirmation', () => {
        const history = [
            {
                role: 'user',
                content: 'create property\n\n[Attached 2 image(s) — use these as image_urls: /images/a.jpg, /images/b.jpg]'
            },
            { role: 'assistant', content: 'Would you like to proceed?' },
            { role: 'user', content: 'yes' }
        ];

        const urls = master._extractRecentAttachedImageUrls(history);
        expect(urls).toEqual(['/images/a.jpg', '/images/b.jpg']);
    });

    test('injects image_urls for PropertyAI add_property when omitted by model', () => {
        const history = [
            {
                role: 'user',
                content: 'create property\n\n[Attached 1 image(s) — use these as image_urls: /images/p1.jpg]'
            }
        ];

        const args = { name: 'Best PG', address: 'Dighi Hills, Pune 411015' };
        const updated = master._injectImageUrlsIntoPropertyArgs({ name: 'PropertyAI' }, 'add_property', args, history);

        expect(updated.image_urls).toEqual(['/images/p1.jpg']);
        expect(updated.name).toBe('Best PG');
    });

    test('does not override explicit image_urls provided by model', () => {
        const history = [
            {
                role: 'user',
                content: 'update property\n\n[Attached 1 image(s) — use these as image_urls: /images/new.jpg]'
            }
        ];

        const args = { property_id: 'PROP-1', image_urls: ['/images/existing.jpg'] };
        const updated = master._injectImageUrlsIntoPropertyArgs({ name: 'PropertyAI' }, 'update_property', args, history);

        expect(updated.image_urls).toEqual(['/images/existing.jpg']);
    });
});
