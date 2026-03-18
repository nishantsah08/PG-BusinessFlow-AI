import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PropertyManagementView from './PropertyManagementView';

const mockProperties = [
    {
        id: 'PROP-1',
        name: 'Aarav Habitat 1',
        address: 'Tower A, Indiranagar Main Road, Indiranagar, Bengaluru, Karnataka, 560038',
        street_address: 'Tower A, Indiranagar Main Road',
        area: 'Indiranagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        pin_code: '560038',
        description: 'Test property',
        image_urls: ['https://picsum.photos/seed/prop-1/1200/800'],
        thumbnail_url: 'https://picsum.photos/seed/prop-1-thumb/1200/800',
        floors: 2,
        status: 'ACTIVE',
        amenities: ['Wi-Fi']
    }
];

describe('PropertyManagementView prefill behavior', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = jest.fn();
        localStorage.setItem(
            'master_ai_user',
            JSON.stringify({
                email: 'ceo.aarav.sharma@example.com',
                tenant_id: 'ceo_aarav_sharma_example_com'
            })
        );
    });

    it('prefills mandatory edit fields and keeps Save enabled for name-only edits', async () => {
        let callCount = 0;
        global.fetch.mockImplementation(async () => {
            callCount += 1;

            if (callCount === 1) {
                return {
                    ok: true,
                    status: 200,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ data: mockProperties })
                };
            }

            if (callCount === 2) {
                return {
                    ok: true,
                    status: 200,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ data: [] })
                };
            }

            if (callCount === 3) {
                return {
                    ok: true,
                    status: 200,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ data: mockProperties[0] })
                };
            }

            return {
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: async () => ({ data: [] })
            };
        });

        render(<PropertyManagementView />);

        expect(await screen.findByRole('heading', { level: 2, name: 'Aarav Habitat 1' })).toBeInTheDocument();
        fireEvent.click(await screen.findByRole('button', { name: /Open property actions/i }));
        fireEvent.click(await screen.findByRole('button', { name: /^Edit Details$/i }));

        expect(await screen.findByText('Edit Property')).toBeInTheDocument();
        expect(await screen.findByDisplayValue('Aarav Habitat 1')).toBeInTheDocument();
        expect(screen.getByDisplayValue('560038')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Save Property/i })).toBeEnabled();
        expect(screen.getAllByLabelText('required field')).toHaveLength(10);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(3);
        });
    });

    it('preserves existing images when edit payload is missing image_urls', async () => {
        const payloadWithoutImages = {
            id: 'PROP-1',
            name: 'Aarav Habitat 1',
            address: 'Tower A, Indiranagar Main Road, Indiranagar, Bengaluru, Karnataka, 560038',
            street_address: 'Tower A, Indiranagar Main Road',
            area: 'Indiranagar',
            city: 'Bengaluru',
            state: 'Karnataka',
            pin_code: '560038',
            description: 'Test property',
            floors: 2,
            status: 'ACTIVE',
            amenities: ['Wi-Fi']
        };

        let callCount = 0;
        global.fetch.mockImplementation(async () => {
            callCount += 1;

            if (callCount === 1) {
                return {
                    ok: true,
                    status: 200,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ data: mockProperties })
                };
            }

            if (callCount === 2) {
                return {
                    ok: true,
                    status: 200,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ data: [] })
                };
            }

            if (callCount === 3) {
                return {
                    ok: true,
                    status: 200,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ data: payloadWithoutImages })
                };
            }

            return {
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: async () => ({ data: [] })
            };
        });

        render(<PropertyManagementView />);

        fireEvent.click(await screen.findByRole('button', { name: /Open property actions/i }));
        expect(await screen.findByRole('button', { name: /^Edit Details$/i })).toBeInTheDocument();
        fireEvent.click(await screen.findByRole('button', { name: /^Edit Details$/i }));

        expect(await screen.findByText('Edit Property')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Save Property/i })).toBeEnabled();
    });

    it('keeps thumbnail as image source when payload clears image_urls', async () => {
        const propertyWithOnlyThumbnail = {
            ...mockProperties[0],
            image_urls: [],
            thumbnail_url: 'https://picsum.photos/seed/thumb-only/1200/800'
        };

        const payloadWithEmptyImages = {
            ...propertyWithOnlyThumbnail,
            image_urls: [],
            name: 'Aarav Habitat 1'
        };

        let callCount = 0;
        global.fetch.mockImplementation(async () => {
            callCount += 1;

            if (callCount === 1) {
                return {
                    ok: true,
                    status: 200,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ data: [propertyWithOnlyThumbnail] })
                };
            }

            if (callCount === 2) {
                return {
                    ok: true,
                    status: 200,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ data: [] })
                };
            }

            if (callCount === 3) {
                return {
                    ok: true,
                    status: 200,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ data: payloadWithEmptyImages })
                };
            }

            return {
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: async () => ({ data: [] })
            };
        });

        render(<PropertyManagementView />);

        fireEvent.click(await screen.findByRole('button', { name: /Open property actions/i }));
        expect(await screen.findByRole('button', { name: /^Edit Details$/i })).toBeInTheDocument();
        fireEvent.click(await screen.findByRole('button', { name: /^Edit Details$/i }));

        expect(await screen.findByText('Edit Property')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Save Property/i })).toBeEnabled();
        expect(screen.getAllByLabelText('required field')).toHaveLength(10);
        const thumbnails = screen.getAllByRole('img', { name: 'Property' });
        expect(thumbnails.length).toBeGreaterThan(0);
    });

    it('falls back to image keys missing image_urls and still preloads edit images', async () => {
        const legacyProperty = {
            ...mockProperties[0],
            image_urls: undefined,
            images: ['https://picsum.photos/seed/legacy/1200/800', 'https://picsum.photos/seed/legacy-2/1200/800']
        };
        delete legacyProperty.image_urls;

        let callCount = 0;
        global.fetch.mockImplementation(async () => {
            callCount += 1;

            if (callCount === 1) {
                return {
                    ok: true,
                    status: 200,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ data: [legacyProperty] })
                };
            }

            if (callCount === 2) {
                return {
                    ok: true,
                    status: 200,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ data: [] })
                };
            }

            if (callCount === 3) {
                return {
                    ok: true,
                    status: 200,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ data: legacyProperty })
                };
            }

            return {
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: async () => ({ data: [] })
            };
        });

        render(<PropertyManagementView />);

        fireEvent.click(await screen.findByRole('button', { name: /Open property actions/i }));
        expect(await screen.findByRole('button', { name: /^Edit Details$/i })).toBeInTheDocument();
        fireEvent.click(await screen.findByRole('button', { name: /^Edit Details$/i }));

        expect(await screen.findByText('Edit Property')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Save Property/i })).toBeEnabled();
        expect(screen.getAllByRole('img', { name: 'Property' })).toHaveLength(2);
    });

    it('derives tenant_id from email even when stale tenant_id exists', async () => {
        localStorage.setItem(
            'master_ai_user',
            JSON.stringify({
                email: 'ceo.aarav.sharma@example.com',
                tenant_id: 'default'
            })
        );

        let callCount = 0;
        const fetchBodies = [];
        global.fetch.mockImplementation(async (_, options = {}) => {
            callCount += 1;
            fetchBodies.push(options.body || '{}');

            if (callCount === 1) {
                return {
                    ok: true,
                    status: 200,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ data: [mockProperties[0]] })
                };
            }

            if (callCount === 2) {
                return {
                    ok: true,
                    status: 200,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ data: [] })
                };
            }

            if (callCount === 3) {
                return {
                    ok: true,
                    status: 200,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ data: mockProperties[0] })
                };
            }

            return {
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: async () => ({ data: [] })
            };
        });

        render(<PropertyManagementView />);

        fireEvent.click(await screen.findByRole('button', { name: /Open property actions/i }));
        expect(await screen.findByRole('button', { name: /^Edit Details$/i })).toBeInTheDocument();
        fireEvent.click(await screen.findByRole('button', { name: /^Edit Details$/i }));

        await waitFor(() => {
            expect(fetchBodies.length).toBeGreaterThanOrEqual(3);
        });

        const thirdPayload = JSON.parse(fetchBodies[2]);
        expect(thirdPayload.tenant_id).toBe('ceo_aarav_sharma_example_com');
    });
});
