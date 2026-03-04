const express = require('express');

class WebhookService {
    constructor(eventBus, port = 3000) {
        this.eventBus = eventBus;
        this.app = express();
        this.port = port;

        this.app.use(express.json());
        this.setupRoutes();
    }

    setupRoutes() {
        // WhatsApp Webhook
        this.app.post('/webhooks/whatsapp', (req, res) => {
            console.log('[Webhook] Received WhatsApp message');
            // Basic validation
            if (!req.body) return res.status(400).send('Empty body');

            // Push to Event Bus
            this.eventBus.publish('message.received', {
                channel: 'whatsapp',
                raw: req.body
            });

            res.status(200).send('OK');
        });

        // Email Webhook
        this.app.post('/webhooks/email', (req, res) => {
            console.log('[Webhook] Received Email');
            this.eventBus.publish('message.received', {
                channel: 'email',
                raw: req.body
            });
            res.status(200).send('OK');
        });

        // Razorpay Webhook
        this.app.post('/webhooks/razorpay', (req, res) => {
            console.log('[Webhook] Received Payment Event');
            this.eventBus.publish('payment.received', {
                channel: 'razorpay',
                raw: req.body
            });
            res.status(200).send('OK');
        });

        // Health Check
        this.app.get('/health', (req, res) => {
            res.status(200).json({ status: 'OK', role: 'MasterAI Gateway' });
        });
    }

    start() {
        this.server = this.app.listen(this.port, () => {
            console.log(`Webhook Gateway listening on port ${this.port}`);
        });
    }

    stop() {
        if (this.server) this.server.close();
    }
}

module.exports = WebhookService;
