import { test, expect } from '@playwright/test';

test.describe('Core GUI smoke', () => {
    test.beforeEach(async ({ context, page }) => {
        await context.addInitScript(() => {
            localStorage.setItem('master_ai_user', JSON.stringify({
                email: 'qa@test.local',
                name: 'QA User',
                type: 'Bypass'
            }));
            localStorage.setItem('pg_developer_mode', 'true');
        });

        await page.route('**/api/communications/chat', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: { content: 'Acknowledged by mocked MasterAI response.' },
                    correlation_id: 'trc-smoke-chat',
                }),
            });
        });

        await page.route('**/api/system/agents', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: {
                        agents: [
                            {
                                name: 'PropertyAI',
                                status: 'online',
                                latency_ms: 12,
                                last_heartbeat: '2026-03-03T10:00:00.000Z',
                                last_error: null,
                            },
                        ],
                    },
                    correlation_id: 'trc-smoke-agents',
                }),
            });
        });

        await page.route('**/api/auth/context', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: {
                        email: 'qa@test.local',
                        profile_type: 'Staff',
                        permissions: {
                            admin_adapter: {
                                CRMAgent: [
                                    'get_dashboard_stats',
                                    'get_recent_leads',
                                    'search_leads',
                                    'get_lead',
                                    'get_timeline'
                                ]
                            }
                        }
                    }
                }),
            });
        });
    });

    test('loads core routes and sends one chat message', async ({ page }) => {
        await page.goto('/master');

        await expect(page.getByRole('heading', { name: 'MasterAI Interface' })).toBeVisible();
        await page.getByPlaceholder('Instruct MasterAI...').fill('Smoke test ping');
        await page.locator('form button[type="submit"]').click();
        await expect(page.getByText('Acknowledged by mocked MasterAI response.')).toBeVisible();

        await page.getByRole('link', { name: 'Property & Booking' }).click();
        await expect(page.getByRole('heading', { name: 'Property & Booking' })).toBeVisible();

        await page.getByRole('link', { name: 'Agent Dashboard' }).click();
        await expect(page.getByRole('heading', { name: 'Agent Flow Dashboard' })).toBeVisible();
        await expect(page.getByTestId('card-PropertyAI')).toBeVisible();
    });

    test('renders inline images as horizontal scroll strip and opens blocking lightbox with left/right navigation', async ({ page }) => {
        await page.route('**/api/communications/chat', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: {
                        content: [
                            'Here are property images:',
                            '1. ![Image 1](sandbox:/images/chat_upload_1.jpg)',
                            '2. ![Image 2](sandbox:/images/chat_upload_2.png)',
                            '3. ![Image 3](sandbox:/images/chat_upload_3.jpg)',
                            '4. ![Image 4](sandbox:/images/chat_upload_4.png)',
                            '5. ![Image 5](sandbox:/images/chat_upload_5.jpg)',
                            '6. ![Image 6](sandbox:/images/chat_upload_6.png)',
                            '',
                            'If you need help, ask me.'
                        ].join('\n')
                    },
                    correlation_id: 'trc-smoke-images',
                }),
            });
        });

        await page.goto('/master');
        await page.getByPlaceholder('Instruct MasterAI...').fill('show images');
        await page.locator('form button[type="submit"]').click();

        const renderedImages = page.locator('img[alt^="attachment-"]');
        await expect(renderedImages).toHaveCount(6);
        await expect(renderedImages.first()).toHaveAttribute('src', '/images/chat_upload_1.jpg');
        await expect(page.getByText('Image 1')).toBeVisible();
        await expect(page.getByText('If you need help, ask me.')).toBeVisible();

        const strip = page.getByTestId('assistant-image-strip').first();
        const stripMetrics = await strip.evaluate((el) => ({
            overflowX: window.getComputedStyle(el).overflowX,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth
        }));
        expect(stripMetrics.overflowX).toBe('auto');
        expect(stripMetrics.scrollWidth).toBeGreaterThan(stripMetrics.clientWidth);

        await page.getByTestId('inline-image-button').first().click();
        await expect(page.getByTestId('image-lightbox')).toBeVisible();
        await expect(page.getByTestId('lightbox-image')).toHaveAttribute('src', '/images/chat_upload_1.jpg');

        await page.getByTestId('lightbox-next').click();
        await expect(page.getByTestId('lightbox-image')).toHaveAttribute('src', '/images/chat_upload_2.png');

        await page.getByTestId('lightbox-prev').click();
        await expect(page.getByTestId('lightbox-image')).toHaveAttribute('src', '/images/chat_upload_1.jpg');

        await page.keyboard.press('Escape');
        await expect(page.getByTestId('image-lightbox')).toHaveCount(0);
    });
});
